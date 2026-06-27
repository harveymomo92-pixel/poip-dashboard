import { normalizeODataOutputRow } from "@poip/domain";
import type { ODataClient, ODataFetchStats, ODataSyncJobPayload, SyncRunRepository } from "./types.js";

const knownSecretValues = [
  process.env.BC_ODATA_PASSWORD,
  process.env.BC_ODATA_BEARER_TOKEN,
  process.env.BC_ODATA_USERNAME
].filter((value): value is string => Boolean(value && value.length >= 3));

const REQUIRED_OUTPUT_SELECT_FIELDS = [
  "gItem_Description",
  "gProdOrRotLine_No",
  "gProdOrRotLine_Description"
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message
      .replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [REDACTED]")
      .replace(/Bearer\s+\S+/g, "Bearer [REDACTED]");
    for (const secret of knownSecretValues) {
      message = message.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
    }
    return message.slice(0, 1000);
  }
  return "Unknown sync error";
}

function publicBackfillMetadata(payload: ODataSyncJobPayload): Record<string, unknown> | undefined {
  if (!payload.backfill) return undefined;
  return {
    from: payload.backfill.from,
    ...(payload.backfill.to ? { to: payload.backfill.to } : {}),
    dateField: payload.backfill.dateField,
    ...(payload.backfill.afterEntryNo !== undefined ? { afterEntryNo: payload.backfill.afterEntryNo.toString() } : {}),
    ...(payload.backfill.pageSize ? { pageSize: payload.backfill.pageSize } : {}),
    ...(payload.backfill.maxPages ? { maxPages: payload.backfill.maxPages } : {})
  };
}

function parseNonNegativeInteger(value: string | undefined, name: string): number {
  if (typeof value === "undefined" || value === "") return 14;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function asiaJakartaDate(daysFromToday = 0): string {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  jakarta.setUTCDate(jakarta.getUTCDate() + daysFromToday);
  return jakarta.toISOString().slice(0, 10);
}

async function syncStrategyDecision(input: {
  readonly payload: ODataSyncJobPayload;
  readonly repository: SyncRunRepository;
  readonly client: ODataClient;
  readonly checkpointLastEntryNo: bigint | null;
}): Promise<{
  readonly skipFetch: boolean;
  readonly lastEntryNo: bigint | null;
  readonly range?: { readonly from: string; readonly to: string };
  readonly metadata: Record<string, unknown>;
}> {
  if (input.payload.mode !== "incremental" || !input.client.fetchLatestEntryNo) {
    return {
      skipFetch: false,
      lastEntryNo: input.payload.mode === "incremental" ? input.checkpointLastEntryNo : null,
      ...(input.payload.range ? { range: input.payload.range } : {}),
      metadata: { mode: input.payload.mode }
    };
  }

  const [remoteLatestEntryNo, localLatestEntryNo] = await Promise.all([
    input.client.fetchLatestEntryNo({
      sourceSystem: input.payload.sourceSystem,
      ...(input.payload.range ? { range: input.payload.range } : {})
    }),
    input.repository.getLatestLocalEntryNo(input.payload.sourceSystem)
  ]);
  const effectiveLocalEntryNo = localLatestEntryNo ?? input.checkpointLastEntryNo;
  const scanDays = parseNonNegativeInteger(
    process.env.BC_ODATA_BACKFILL_SCAN_DAYS ?? "14",
    "BC_ODATA_BACKFILL_SCAN_DAYS"
  );
  const baseMetadata = {
    remoteLatestEntryNo: remoteLatestEntryNo?.toString() ?? null,
    localLatestEntryNo: effectiveLocalEntryNo?.toString() ?? null,
    incrementalField: process.env.BC_ODATA_INCREMENTAL_FIELD ?? "Entry_No"
  };

  if (remoteLatestEntryNo !== null && effectiveLocalEntryNo !== null && remoteLatestEntryNo <= effectiveLocalEntryNo) {
    if (scanDays === 0) {
      return {
        skipFetch: true,
        lastEntryNo: null,
        metadata: {
          mode: "skip",
          ...baseMetadata,
          reason: "remote latest Entry_No is not newer than local latest Entry_No"
        }
      };
    }
    const range = {
      from: asiaJakartaDate(-(scanDays - 1)),
      to: asiaJakartaDate()
    };
    return {
      skipFetch: false,
      lastEntryNo: null,
      range,
      metadata: {
        mode: "backfill-scan",
        ...baseMetadata,
        backfillScanDays: scanDays,
        backfillScanWindow: range
      }
    };
  }

  return {
    skipFetch: false,
    lastEntryNo: effectiveLocalEntryNo,
    ...(input.payload.range ? { range: input.payload.range } : {}),
    metadata: {
      mode: "incremental",
      ...baseMetadata
    }
  };
}

function runMetadata(
  payload: ODataSyncJobPayload,
  durationMs: number,
  pagination?: ODataFetchStats,
  strategy?: Record<string, unknown>
): Record<string, unknown> {
  return {
    durationMs,
    ...(strategy ? { syncStrategy: strategy } : {}),
    ...(pagination ? { pagination } : {}),
    ...(payload.backfill ? { backfill: publicBackfillMetadata(payload) } : {})
  };
}

export class ODataSyncProcessor {
  constructor(
    private readonly repository: SyncRunRepository,
    private readonly client: ODataClient
  ) {}

  async run(payload: ODataSyncJobPayload) {
    const startedAt = Date.now();
    const sourceUrl = this.client.sourceUrl();
    const run = await this.repository.prepareRun(payload, sourceUrl);
    if (run.completedResult) return run.completedResult;
    let strategy: Record<string, unknown> | undefined;

    try {
      const decision = await syncStrategyDecision({
        payload,
        repository: this.repository,
        client: this.client,
        checkpointLastEntryNo: run.checkpointBefore.lastEntryNo
      });
      strategy = decision.metadata;
      const rawRows = decision.skipFetch
        ? []
        : await this.client.fetchProductionOutputs({
            mode: payload.mode,
            sourceSystem: payload.sourceSystem,
            lastEntryNo: decision.lastEntryNo,
            requiredSelectFields: REQUIRED_OUTPUT_SELECT_FIELDS,
            ...(decision.range ? { range: decision.range } : {}),
            ...(payload.backfill ? { backfill: payload.backfill } : {})
          });
      const rows = rawRows.map((rawPayload) => ({
        ...normalizeODataOutputRow(rawPayload),
        rawPayload
      }));

      return await this.repository.commitSuccessfulRun({
        run,
        sourceUrl,
        rows,
        metadata: runMetadata(payload, Date.now() - startedAt, this.client.lastFetchStats?.(), strategy)
      });
    } catch (error) {
      await this.repository.markRunFailed({
        runId: run.id,
        errorCode: "ODATA_SYNC_FAILED",
        errorMessage: safeErrorMessage(error),
        metadata: runMetadata(payload, Date.now() - startedAt, this.client.lastFetchStats?.(), strategy)
      });
      throw error;
    }
  }
}
