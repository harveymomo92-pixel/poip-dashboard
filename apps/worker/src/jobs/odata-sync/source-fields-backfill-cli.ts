import { createDatabase } from "@poip/db";
import { pathToFileURL } from "node:url";
import { getDatabaseUrl } from "../../common/env.js";
import { BusinessCentralODataClient, createODataClientFromEnv } from "./odata-client.js";
import {
  BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE,
  createSourceFieldsBackfillPlan,
  type LocalSourceFieldsRow,
  type SourceFieldsBackfillUpdate
} from "./source-fields-backfill.js";
import type { ODataFetchStats } from "./types.js";

const SOURCE_SYSTEM = "business-central";
const SOURCE_SELECT_FIELDS = [
  "Entry_No",
  BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineNo,
  BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineDescription
] as const;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function validatePositiveInteger(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed.toString();
}

function validatePositiveNumber(value: string | undefined, name: string): number | undefined {
  const text = validatePositiveInteger(value, name);
  return text ? Number.parseInt(text, 10) : undefined;
}

function redactedError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Unknown Business Central source fields backfill error";
  return rawMessage
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [REDACTED]")
    .replace(/Bearer\s+\S+/g, "Bearer [REDACTED]");
}

function createLiveClient(): BusinessCentralODataClient {
  const client = createODataClientFromEnv();
  if (!(client instanceof BusinessCentralODataClient)) {
    throw new Error("ODATA_SYNC_MODE=live is required for Business Central source fields backfill");
  }
  return client;
}

function formatValue(value: string | null): string {
  return value && value.trim() ? value : "N/A";
}

function formatMode(commit: boolean): string {
  return commit ? "commit" : "dry-run";
}

function commitRequested(): boolean {
  return env("BC_SOURCE_FIELDS_BACKFILL_COMMIT") === "true" ||
    env("BC_MACHINE_DESCRIPTION_BACKFILL_COMMIT") === "true";
}

function sourceEnv(name: string, legacyName: string): string | undefined {
  return env(name) ?? env(legacyName);
}

async function fetchLocalRows(limit: number | undefined): Promise<readonly LocalSourceFieldsRow[]> {
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  try {
    const result = await database.pool.query<{
      entry_no: string;
      posting_date: string;
      machine_center_no: string | null;
      machine_description: string | null;
      prod_line_no: string | null;
      prod_line_description: string | null;
    }>(
      `
        select
          entry_no::text,
          posting_date::text,
          machine_center_no,
          machine_description,
          prod_line_no,
          prod_line_description
        from production_outputs
        where source_system = $1
          and entry_no is not null
          and (
            prod_line_no is null
            or btrim(prod_line_no) = ''
            or prod_line_description is null
            or btrim(prod_line_description) = ''
          )
        order by entry_no asc
        ${limit ? "limit $2" : ""}
      `,
      limit ? [SOURCE_SYSTEM, limit] : [SOURCE_SYSTEM]
    );
    return result.rows.map((row) => ({
      entryNo: row.entry_no,
      postingDate: row.posting_date.slice(0, 10),
      machineCenterNo: row.machine_center_no,
      machineDescription: row.machine_description,
      prodLineNo: row.prod_line_no,
      prodLineDescription: row.prod_line_description
    }));
  } finally {
    await database.pool.end();
  }
}

function entryNoFilter(entryNos: readonly string[]): string {
  const values = entryNos.map((entryNo) => {
    if (!/^\d+$/.test(entryNo)) throw new Error("entry_no must be numeric for OData backfill filtering");
    return `Entry_No eq ${entryNo}`;
  });
  return values.length === 1 ? values[0] ?? "" : `(${values.join(" or ")})`;
}

function addStats(left: ODataFetchStats, right: ODataFetchStats): ODataFetchStats {
  return {
    pagesAttempted: left.pagesAttempted + right.pagesAttempted,
    pagesFetched: left.pagesFetched + right.pagesFetched,
    rowsFetched: left.rowsFetched + right.rowsFetched,
    nextLinkUsed: left.nextLinkUsed || right.nextLinkUsed,
    keysetPaginationUsed: left.keysetPaginationUsed || right.keysetPaginationUsed,
    truncatedByMaxPages: left.truncatedByMaxPages || right.truncatedByMaxPages
  };
}

async function fetchRemoteRowsForEntries(input: {
  readonly localRows: readonly LocalSourceFieldsRow[];
  readonly pageSize: string;
  readonly batchSize: number;
}): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly stats: ODataFetchStats }> {
  const rows: Record<string, unknown>[] = [];
  let stats: ODataFetchStats = {
    pagesAttempted: 0,
    pagesFetched: 0,
    rowsFetched: 0,
    nextLinkUsed: false,
    keysetPaginationUsed: false,
    truncatedByMaxPages: false
  };
  for (let index = 0; index < input.localRows.length; index += input.batchSize) {
    const batch = input.localRows.slice(index, index + input.batchSize);
    const client = createLiveClient();
    rows.push(...await client.fetchProductionOutputs({
      mode: "backfill",
      sourceSystem: SOURCE_SYSTEM,
      lastEntryNo: null,
      filters: [entryNoFilter(batch.map((row) => row.entryNo))],
      requiredSelectFields: SOURCE_SELECT_FIELDS,
      forceSelectFields: true,
      backfill: {
        from: "1900-01-01",
        dateField: "Posting_Date",
        pageSize: input.pageSize,
        forcePageSize: true,
        maxPages: 1
      }
    }));
    stats = addStats(stats, client.lastFetchStats());
  }
  return { rows, stats };
}

async function commitUpdates(updates: readonly SourceFieldsBackfillUpdate[]): Promise<number> {
  if (updates.length === 0) return 0;
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  try {
    let updatedRows = 0;
    const batchSize =
      validatePositiveNumber(
        sourceEnv("BC_SOURCE_FIELDS_BACKFILL_UPDATE_BATCH_SIZE", "BC_MACHINE_DESCRIPTION_BACKFILL_UPDATE_BATCH_SIZE"),
        "BC_SOURCE_FIELDS_BACKFILL_UPDATE_BATCH_SIZE"
      ) ?? 500;
    for (let index = 0; index < updates.length; index += batchSize) {
      const batch = updates.slice(index, index + batchSize);
      const result = await database.pool.query<{ entry_no: string }>(
        `
          update production_outputs po
          set prod_line_no = case
                when incoming.prod_line_no is not null
                  and (po.prod_line_no is null or btrim(po.prod_line_no) = '')
                then incoming.prod_line_no
                else po.prod_line_no
              end,
              prod_line_description = case
                when incoming.prod_line_description is not null
                  and (po.prod_line_description is null or btrim(po.prod_line_description) = '')
                then incoming.prod_line_description
                else po.prod_line_description
              end,
              updated_at = now()
          from (
            select *
            from unnest($1::text[], $2::text[], $3::text[]) as t(entry_no, prod_line_no, prod_line_description)
          ) as incoming
          where po.source_system = $4
            and po.entry_no::text = incoming.entry_no
            and (
              (
                incoming.prod_line_no is not null
                and (po.prod_line_no is null or btrim(po.prod_line_no) = '')
              )
              or (
                incoming.prod_line_description is not null
                and (po.prod_line_description is null or btrim(po.prod_line_description) = '')
              )
            )
          returning po.entry_no::text
        `,
        [
          batch.map((item) => item.entryNo),
          batch.map((item) => item.newProdLineNo),
          batch.map((item) => item.newProdLineDescription),
          SOURCE_SYSTEM
        ]
      );
      updatedRows += result.rowCount ?? result.rows.length;
    }
    return updatedRows;
  } finally {
    await database.pool.end();
  }
}

function printSummary(input: {
  readonly commit: boolean;
  readonly missingRows: number;
  readonly matchedRows: number;
  readonly updateableProdLineNoRows: number;
  readonly updateableProdLineDescriptionRows: number;
  readonly updateableMachineDescriptionRows: 0;
  readonly unchangedRows: number;
  readonly withoutSourceValueRows: number;
  readonly notFoundRows: number;
  readonly pagesFetched: number;
  readonly rowsFetched: number;
  readonly updates: readonly SourceFieldsBackfillUpdate[];
  readonly rowsUpdated?: number;
}) {
  console.log("Business Central source fields backfill");
  console.log(`Mode: ${formatMode(input.commit)}`);
  console.log("Machine description source field: not exposed");
  console.log(`Production line no source field: ${BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineNo}`);
  console.log(`Production line description source field: ${BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineDescription}`);
  console.log(`Rows with missing source fields: ${input.missingRows}`);
  console.log(`Rows matched in Business Central: ${input.matchedRows}`);
  console.log(`Rows updateable prod_line_no: ${input.updateableProdLineNoRows}`);
  console.log(`Rows updateable prod_line_description: ${input.updateableProdLineDescriptionRows}`);
  console.log(`Rows updateable machine_description: ${input.updateableMachineDescriptionRows}`);
  console.log(`Rows unchanged: ${input.unchangedRows}`);
  console.log(`Rows without source values: ${input.withoutSourceValueRows}`);
  console.log(`Rows not found in BC: ${input.notFoundRows}`);
  console.log(`Rows fetched from BC: ${input.rowsFetched}`);
  console.log(`Pages fetched: ${input.pagesFetched}`);
  if (input.commit) {
    console.log(`Rows updated: ${input.rowsUpdated ?? 0}`);
    console.log(`Rows skipped: ${input.updates.length - (input.rowsUpdated ?? 0)}`);
  }
  console.log("Sample updates:");
  if (input.updates.length === 0) {
    console.log("- none");
    return;
  }
  for (const update of input.updates.slice(0, 10)) {
    console.log(
      `- entry_no=${update.entryNo} ` +
      `prod_line_no: ${formatValue(update.oldProdLineNo)} -> ${formatValue(update.newProdLineNo)}; ` +
      `prod_line_description: ${formatValue(update.oldProdLineDescription)} -> ${formatValue(update.newProdLineDescription)}`
    );
  }
}

export async function runSourceFieldsBackfill(): Promise<void> {
  const commit = commitRequested();
  const localLimit =
    validatePositiveNumber(
      sourceEnv("BC_SOURCE_FIELDS_BACKFILL_LIMIT", "BC_MACHINE_DESCRIPTION_BACKFILL_LIMIT"),
      "BC_SOURCE_FIELDS_BACKFILL_LIMIT"
    );
  const localRows = await fetchLocalRows(localLimit);
  let stats: ODataFetchStats = {
    pagesAttempted: 0,
    pagesFetched: 0,
    rowsFetched: 0,
    nextLinkUsed: false,
    keysetPaginationUsed: false,
    truncatedByMaxPages: false
  };
  let remoteRows: readonly Record<string, unknown>[] = [];

  if (localRows.length > 0) {
    const pageSize =
      validatePositiveInteger(
        sourceEnv("BC_SOURCE_FIELDS_BACKFILL_PAGE_SIZE", "BC_MACHINE_DESCRIPTION_BACKFILL_PAGE_SIZE") ??
          env("BC_ODATA_PAGE_SIZE") ??
          "1000",
        "BC_SOURCE_FIELDS_BACKFILL_PAGE_SIZE"
      ) ?? "1000";
    const batchSize =
      validatePositiveNumber(
        sourceEnv("BC_SOURCE_FIELDS_BACKFILL_ENTRY_BATCH_SIZE", "BC_MACHINE_DESCRIPTION_BACKFILL_ENTRY_BATCH_SIZE"),
        "BC_SOURCE_FIELDS_BACKFILL_ENTRY_BATCH_SIZE"
      ) ?? 250;
    const result = await fetchRemoteRowsForEntries({ localRows, pageSize, batchSize });
    remoteRows = result.rows;
    stats = result.stats;
  }

  const plan = createSourceFieldsBackfillPlan(localRows, remoteRows);
  const rowsUpdated = commit ? await commitUpdates(plan.updates) : undefined;
  printSummary({
    commit,
    missingRows: plan.missingRows,
    matchedRows: plan.matchedRows,
    updateableProdLineNoRows: plan.updateableProdLineNoRows,
    updateableProdLineDescriptionRows: plan.updateableProdLineDescriptionRows,
    updateableMachineDescriptionRows: plan.updateableMachineDescriptionRows,
    unchangedRows: plan.unchangedRows,
    withoutSourceValueRows: plan.withoutSourceValueRows,
    notFoundRows: plan.notFoundRows,
    pagesFetched: stats.pagesFetched,
    rowsFetched: stats.rowsFetched,
    updates: plan.updates,
    ...(typeof rowsUpdated === "number" ? { rowsUpdated } : {})
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runSourceFieldsBackfill();
  } catch (error) {
    console.error(`Business Central source fields backfill failed: ${redactedError(error)}`);
    process.exitCode = 1;
  }
}
