import { auditLogs, createDatabase } from "@poip/db";
import { pathToFileURL } from "node:url";
import {
  BusinessCentralODataClient,
  createODataClientFromEnv,
  type ODataFetchStats
} from "./odata-client.js";
import { ODataSyncProcessor } from "./processor.js";
import { DrizzleSyncRunRepository } from "./repository.js";
import type { ODataBackfillOptions, SyncCommitResult } from "./types.js";
import { getDatabaseUrl } from "../../common/env.js";

const DEFAULT_SOURCE_SYSTEM = "business-central";
const defaultFetchStats: ODataFetchStats = {
  pagesFetched: 0,
  rowsFetched: 0,
  nextLinkUsed: false,
  keysetPaginationUsed: false,
  truncatedByMaxPages: false
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }
  return value;
}

function validatePositiveInteger(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed.toString();
}

function validateDateField(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("BACKFILL_DATE_FIELD must be a simple OData field name");
  }
  return value;
}

function redactedError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Unknown OData backfill error";
  return rawMessage
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [REDACTED]")
    .replace(/Bearer\s+\S+/g, "Bearer [REDACTED]");
}

function validateLiveODataEnv(): void {
  if (env("ODATA_SYNC_MODE") !== "live") {
    throw new Error("ODATA_SYNC_MODE=live is required for live backfill");
  }
  requireEnv("BC_ODATA_URL");
  const authMode = (env("BC_ODATA_AUTH_MODE") ?? "none").toLowerCase();
  if (authMode === "basic") {
    requireEnv("BC_ODATA_USERNAME");
    requireEnv("BC_ODATA_PASSWORD");
    return;
  }
  if (authMode === "bearer") {
    requireEnv("BC_ODATA_BEARER_TOKEN");
    return;
  }
  if (authMode !== "none") {
    throw new Error("BC_ODATA_AUTH_MODE must be basic, bearer, or none");
  }
}

export function backfillOptionsFromEnv(): ODataBackfillOptions {
  const from = validateDate(requireEnv("BACKFILL_FROM"), "BACKFILL_FROM");
  const to = env("BACKFILL_TO") ? validateDate(requireEnv("BACKFILL_TO"), "BACKFILL_TO") : undefined;
  if (to && to <= from) throw new Error("BACKFILL_TO must be after BACKFILL_FROM");
  const pageSize = validatePositiveInteger(env("BACKFILL_PAGE_SIZE"), "BACKFILL_PAGE_SIZE");
  const maxPagesValue = validatePositiveInteger(env("BACKFILL_MAX_PAGES"), "BACKFILL_MAX_PAGES");
  return {
    from,
    ...(to ? { to } : {}),
    dateField: validateDateField(env("BACKFILL_DATE_FIELD") ?? "Posting_Date"),
    ...(pageSize ? { pageSize } : {}),
    ...(maxPagesValue ? { maxPages: Number.parseInt(maxPagesValue, 10) } : {})
  };
}

function createLiveClient(): BusinessCentralODataClient {
  const client = createODataClientFromEnv();
  if (!(client instanceof BusinessCentralODataClient)) {
    throw new Error("Live Business Central OData client is required for backfill");
  }
  return client;
}

function publicBackfillConfig(backfill: ODataBackfillOptions) {
  return {
    from: backfill.from,
    ...(backfill.to ? { to: backfill.to } : {}),
    dateField: backfill.dateField,
    ...(backfill.pageSize ? { pageSize: backfill.pageSize } : {}),
    ...(backfill.maxPages ? { maxPages: backfill.maxPages } : {})
  };
}

async function logBackfillAudit(
  result: SyncCommitResult,
  backfill: ODataBackfillOptions,
  pagination: ODataFetchStats
): Promise<void> {
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  try {
    await database.db.insert(auditLogs).values({
      action: "sync.backfill",
      entityType: "sync_run",
      entityId: result.runId,
      afterValue: {
        status: result.status,
        rowsFetched: result.rowsFetched,
        rowsInserted: result.rowsInserted,
        rowsUpdated: result.rowsUpdated,
        rowsSkipped: result.rowsSkipped,
        backfill: publicBackfillConfig(backfill),
        pagination
      }
    });
  } finally {
    await database.pool.end();
  }
}

function printSummary(
  result: SyncCommitResult,
  backfill: ODataBackfillOptions,
  pagination: ODataFetchStats,
  auditLogged: boolean
): void {
  console.log("OData backfill completed");
  console.log(`Run ID: ${result.runId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Backfill from: ${backfill.from}`);
  if (backfill.to) console.log(`Backfill to: ${backfill.to}`);
  console.log(`Date field: ${backfill.dateField}`);
  console.log(`Rows fetched: ${result.rowsFetched}`);
  console.log(`Rows inserted: ${result.rowsInserted}`);
  console.log(`Rows updated: ${result.rowsUpdated}`);
  console.log(`Rows skipped: ${result.rowsSkipped}`);
  console.log(`Pages fetched: ${pagination.pagesFetched}`);
  console.log(`NextLink used: ${pagination.nextLinkUsed ? "yes" : "no"}`);
  console.log(`Keyset pagination used: ${pagination.keysetPaginationUsed ? "yes" : "no"}`);
  console.log(`Truncated by max pages: ${pagination.truncatedByMaxPages ? "yes" : "no"}`);
  console.log(`Audit logged: ${auditLogged ? "yes" : "no"}`);
}

export async function runBackfillCheck(): Promise<void> {
  validateLiveODataEnv();
  const client = createLiveClient();
  const backfill = {
    ...backfillOptionsFromEnv(),
    pageSize: "1",
    maxPages: 1,
    forcePageSize: true
  };
  const rows = await client.fetchProductionOutputs({
    mode: "backfill",
    sourceSystem: env("BACKFILL_SOURCE_SYSTEM") ?? DEFAULT_SOURCE_SYSTEM,
    lastEntryNo: null,
    backfill
  });
  const pagination = client.lastFetchStats();
  console.log("OData backfill check HTTP 200");
  console.log(`Rows returned: ${rows.length}`);
  console.log(`Pages fetched: ${pagination.pagesFetched}`);
  console.log(`More pages likely: ${pagination.truncatedByMaxPages ? "yes" : "no"}`);
  console.log(`Keyset pagination available: ${pagination.keysetPaginationUsed || pagination.truncatedByMaxPages ? "yes" : "no"}`);
}

export async function runBackfill(): Promise<void> {
  validateLiveODataEnv();
  const backfill = backfillOptionsFromEnv();
  const client = createLiveClient();
  const repository = new DrizzleSyncRunRepository();
  let result: SyncCommitResult;
  try {
    result = await new ODataSyncProcessor(repository, client).run({
      mode: "backfill",
      sourceSystem: env("BACKFILL_SOURCE_SYSTEM") ?? DEFAULT_SOURCE_SYSTEM,
      requestedBy: null,
      backfill
    });
  } finally {
    await repository.close();
  }

  const pagination = client.lastFetchStats() ?? defaultFetchStats;
  await logBackfillAudit(result, backfill, pagination);
  printSummary(result, backfill, pagination, true);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes("--check")) {
    await runBackfillCheck();
    return;
  }
  await runBackfill();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(`OData backfill failed: ${redactedError(error)}`);
    process.exitCode = 1;
  }
}
