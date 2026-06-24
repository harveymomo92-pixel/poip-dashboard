import { auditLogs, createDatabase } from "@poip/db";
import { pathToFileURL } from "node:url";
import {
  BusinessCentralODataClient,
  createODataClientFromEnv
} from "./odata-client.js";
import { ODataSyncProcessor } from "./processor.js";
import { DrizzleSyncRunRepository } from "./repository.js";
import type { ODataBackfillOptions, ODataFetchStats, SyncCommitResult } from "./types.js";
import { getDatabaseUrl } from "../../common/env.js";

const DEFAULT_SOURCE_SYSTEM = "business-central";
const defaultFetchStats: ODataFetchStats = {
  pagesAttempted: 0,
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
  const afterEntryNo = validatePositiveInteger(env("BACKFILL_AFTER_ENTRY_NO"), "BACKFILL_AFTER_ENTRY_NO");
  const pageSize = validatePositiveInteger(env("BACKFILL_PAGE_SIZE"), "BACKFILL_PAGE_SIZE");
  const maxPagesValue = validatePositiveInteger(env("BACKFILL_MAX_PAGES"), "BACKFILL_MAX_PAGES");
  return {
    from,
    ...(to ? { to } : {}),
    dateField: validateDateField(env("BACKFILL_DATE_FIELD") ?? "Posting_Date"),
    ...(afterEntryNo ? { afterEntryNo: BigInt(afterEntryNo) } : {}),
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
    ...(backfill.afterEntryNo !== undefined ? { afterEntryNo: backfill.afterEntryNo.toString() } : {}),
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
  if (backfill.afterEntryNo !== undefined) console.log(`After Entry_No: ${backfill.afterEntryNo.toString()}`);
  console.log(`Rows fetched: ${result.rowsFetched}`);
  console.log(`Rows inserted: ${result.rowsInserted}`);
  console.log(`Rows updated: ${result.rowsUpdated}`);
  console.log(`Rows skipped: ${result.rowsSkipped}`);
  console.log(`Max Entry_No: ${result.maxEntryNo ?? "none"}`);
  console.log(`Pages attempted: ${pagination.pagesAttempted}`);
  console.log(`Pages fetched: ${pagination.pagesFetched}`);
  console.log(`NextLink used: ${pagination.nextLinkUsed ? "yes" : "no"}`);
  console.log(`Keyset pagination used: ${pagination.keysetPaginationUsed ? "yes" : "no"}`);
  console.log(`Truncated by max pages: ${pagination.truncatedByMaxPages ? "yes" : "no"}`);
  console.log(`Audit logged: ${auditLogged ? "yes" : "no"}`);
}

async function executeBackfillChunk(
  repository: DrizzleSyncRunRepository,
  client: BusinessCentralODataClient,
  backfill: ODataBackfillOptions
) {
  const result = await new ODataSyncProcessor(repository, client).run({
    mode: "backfill",
    sourceSystem: env("BACKFILL_SOURCE_SYSTEM") ?? DEFAULT_SOURCE_SYSTEM,
    requestedBy: null,
    backfill
  });
  const pagination = client.lastFetchStats() ?? defaultFetchStats;
  await logBackfillAudit(result, backfill, pagination);
  return { result, pagination };
}

function printChunkedSummary(input: {
  readonly chunks: number;
  readonly rowsFetched: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
  readonly rowsSkipped: number;
  readonly pagesAttempted: number;
  readonly pagesFetched: number;
  readonly finalMaxEntryNo: string | null;
  readonly completed: boolean;
}) {
  console.log("OData chunked backfill summary");
  console.log(`Chunks completed: ${input.chunks}`);
  console.log(`Rows fetched: ${input.rowsFetched}`);
  console.log(`Rows inserted: ${input.rowsInserted}`);
  console.log(`Rows updated: ${input.rowsUpdated}`);
  console.log(`Rows skipped: ${input.rowsSkipped}`);
  console.log(`Pages attempted: ${input.pagesAttempted}`);
  console.log(`Pages fetched: ${input.pagesFetched}`);
  console.log(`Final max Entry_No: ${input.finalMaxEntryNo ?? "none"}`);
  console.log(`Completed full range: ${input.completed ? "yes" : "no"}`);
}

export async function runBackfillCheck(): Promise<void> {
  validateLiveODataEnv();
  const client = createLiveClient();
  const checkTop = validatePositiveInteger(env("BACKFILL_CHECK_TOP"), "BACKFILL_CHECK_TOP") ?? "1";
  const checkMaxPages =
    validatePositiveInteger(env("BACKFILL_CHECK_MAX_PAGES"), "BACKFILL_CHECK_MAX_PAGES") ?? "1";
  const backfill = {
    ...backfillOptionsFromEnv(),
    pageSize: checkTop,
    maxPages: Number.parseInt(checkMaxPages, 10),
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
  console.log(`Check top: ${checkTop}`);
  console.log(`Check max pages: ${checkMaxPages}`);
  console.log(`Rows returned: ${rows.length}`);
  console.log(`Pages attempted: ${pagination.pagesAttempted}`);
  console.log(`Pages fetched: ${pagination.pagesFetched}`);
  console.log(`More pages likely: ${pagination.truncatedByMaxPages ? "yes" : "no"}`);
  console.log(`Keyset pagination available: ${pagination.keysetPaginationUsed || pagination.truncatedByMaxPages ? "yes" : "no"}`);
}

export async function runBackfill(): Promise<void> {
  validateLiveODataEnv();
  const backfill = backfillOptionsFromEnv();
  const client = createLiveClient();
  const repository = new DrizzleSyncRunRepository();
  try {
    const chunkPagesValue = validatePositiveInteger(env("BACKFILL_CHUNK_PAGES"), "BACKFILL_CHUNK_PAGES");
    if (!chunkPagesValue) {
      const { result, pagination } = await executeBackfillChunk(repository, client, backfill);
      printSummary(result, backfill, pagination, true);
      return;
    }

    const maxChunksValue = validatePositiveInteger(env("BACKFILL_MAX_CHUNKS"), "BACKFILL_MAX_CHUNKS");
    const chunkRetriesValue = validatePositiveInteger(env("BACKFILL_CHUNK_RETRIES"), "BACKFILL_CHUNK_RETRIES");
    const chunkPages = Number.parseInt(chunkPagesValue, 10);
    const maxChunks = maxChunksValue ? Number.parseInt(maxChunksValue, 10) : null;
    const chunkRetries = chunkRetriesValue ? Number.parseInt(chunkRetriesValue, 10) : 2;
    let afterEntryNo = backfill.afterEntryNo;
    let chunks = 0;
    let rowsFetched = 0;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    let rowsSkipped = 0;
    let pagesAttempted = 0;
    let pagesFetched = 0;
    let finalMaxEntryNo: string | null = afterEntryNo?.toString() ?? null;

    while (true) {
      if (maxChunks !== null && chunks >= maxChunks) {
        printChunkedSummary({
          chunks,
          rowsFetched,
          rowsInserted,
          rowsUpdated,
          rowsSkipped,
          pagesAttempted,
          pagesFetched,
          finalMaxEntryNo,
          completed: false
        });
        return;
      }

      const chunkBackfill: ODataBackfillOptions = {
        ...backfill,
        ...(afterEntryNo !== undefined ? { afterEntryNo } : {}),
        maxPages: chunkPages
      };
      let chunkResult: Awaited<ReturnType<typeof executeBackfillChunk>> | null = null;
      for (let attempt = 1; attempt <= chunkRetries + 1; attempt += 1) {
        try {
          chunkResult = await executeBackfillChunk(repository, client, chunkBackfill);
          break;
        } catch (error) {
          if (attempt > chunkRetries) throw error;
          console.log(
            `Chunk ${chunks + 1} attempt ${attempt} failed safely; retrying (${redactedError(error)})`
          );
        }
      }
      if (!chunkResult) throw new Error("Backfill chunk did not return a result");
      const { result, pagination } = chunkResult;
      chunks += 1;
      rowsFetched += result.rowsFetched;
      rowsInserted += result.rowsInserted;
      rowsUpdated += result.rowsUpdated;
      rowsSkipped += result.rowsSkipped;
      pagesAttempted += pagination.pagesAttempted;
      pagesFetched += pagination.pagesFetched;
      finalMaxEntryNo = result.maxEntryNo ?? finalMaxEntryNo;
      console.log(
        `Chunk ${chunks} completed: run=${result.runId} fetched=${result.rowsFetched} inserted=${result.rowsInserted} updated=${result.rowsUpdated} skipped=${result.rowsSkipped} maxEntry=${result.maxEntryNo ?? "none"}`
      );

      if (!pagination.truncatedByMaxPages || result.rowsFetched === 0) {
        printChunkedSummary({
          chunks,
          rowsFetched,
          rowsInserted,
          rowsUpdated,
          rowsSkipped,
          pagesAttempted,
          pagesFetched,
          finalMaxEntryNo,
          completed: true
        });
        return;
      }

      if (!result.maxEntryNo) {
        throw new Error("Backfill chunk could not advance because no Entry_No cursor was available");
      }
      afterEntryNo = BigInt(result.maxEntryNo);
    }
  } finally {
    await repository.close();
  }
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
