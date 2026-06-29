import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, desc, eq, sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { bcLedgerEntries, syncCheckpoints, syncRuns } from "@poip/db";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type { ODataSyncJobPayload, ODataSyncMode } from "./sync.types.js";

const ODATA_SYNC_QUEUE = "odata-sync";
const ODATA_SYNC_JOB = "odata-sync";
const DEFAULT_SOURCE_SYSTEM = "business-central";

function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

function cleanSourceUrl(): string | null {
  const value =
    process.env.ODATA_SYNC_MODE === "mock"
      ? "mock://business-central/production-output"
      : process.env.BC_ODATA_URL ?? process.env.BC_ODATA_BASE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return value.split("?")[0] ?? value;
  }
}

function checkpointJson(checkpoint: { readonly lastEntryNo: bigint | null; readonly lastPostingDate: string | null } | null) {
  return {
    lastEntryNo: checkpoint?.lastEntryNo?.toString() ?? null,
    lastPostingDate: checkpoint?.lastPostingDate ?? null
  };
}

function serializeRun(run: typeof syncRuns.$inferSelect) {
  return {
    id: run.id,
    sourceSystem: run.sourceSystem,
    sourceUrl: run.sourceUrl,
    mode: run.mode,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    checkpointBefore: run.checkpointBefore,
    checkpointAfter: run.checkpointAfter,
    rowsFetched: run.rowsFetched,
    rowsInserted: run.rowsInserted,
    rowsUpdated: run.rowsUpdated,
    rowsSkipped: run.rowsSkipped,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    metadata: run.metadata,
    triggeredBy: run.triggeredBy
  };
}

function freshnessStatus(minutes: number | null) {
  if (minutes === null) return "NEVER_SYNCED";
  if (minutes <= 120) return "FRESH";
  if (minutes <= 360) return "STALE";
  return "CRITICAL";
}

@Injectable()
export class SyncService implements OnModuleDestroy {
  private readonly redis = new Redis(getRedisUrl(), { maxRetriesPerRequest: null });
  private readonly queue = new Queue<ODataSyncJobPayload>(ODATA_SYNC_QUEUE, { connection: this.redis });

  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async onModuleDestroy() {
    await this.queue.close();
    this.redis.disconnect();
  }

  async triggerODataSync(input: {
    readonly mode: ODataSyncMode;
    readonly sourceSystem?: string;
    readonly requestedBy: string | null;
    readonly range?: { readonly from: string; readonly to: string };
  }) {
    const sourceSystem = input.sourceSystem ?? DEFAULT_SOURCE_SYSTEM;
    const checkpoint = await this.getCheckpoint(sourceSystem);
    const [run] = await this.database.db
      .insert(syncRuns)
      .values({
        sourceSystem,
        sourceUrl: cleanSourceUrl(),
        mode: input.mode,
        status: "QUEUED",
        checkpointBefore: checkpointJson(checkpoint),
        triggeredBy: input.requestedBy,
        metadata: input.range ? { range: input.range } : {}
      })
      .returning();
    if (!run) throw new Error("Unable to create sync run");

    const payload: ODataSyncJobPayload = {
      syncRunId: run.id,
      mode: input.mode,
      sourceSystem,
      requestedBy: input.requestedBy,
      ...(input.range ? { range: input.range } : {})
    };
    const job = await this.queue.add(ODATA_SYNC_JOB, payload, {
      jobId: run.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    });
    await this.database.db
      .update(syncRuns)
      .set({ metadata: { ...(input.range ? { range: input.range } : {}), jobId: job.id } })
      .where(eq(syncRuns.id, run.id));

    return {
      runId: run.id,
      jobId: job.id,
      status: "QUEUED"
    };
  }

  async getStatus(sourceSystem = DEFAULT_SOURCE_SYSTEM) {
    const requireLiveSource = process.env.ODATA_SYNC_MODE === "live";
    const liveSuccessClause = requireLiveSource
      ? sql`${syncRuns.sourceUrl} is not null and ${syncRuns.sourceUrl} not like 'mock://%'`
      : undefined;
    const [latestRun] = await this.database.db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.sourceSystem, sourceSystem))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    const [latestSuccessfulRun] = await this.database.db
      .select()
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.sourceSystem, sourceSystem),
          eq(syncRuns.status, "SUCCESS"),
          ...(liveSuccessClause ? [liveSuccessClause] : [])
        )
      )
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1);
    const checkpoint = await this.getCheckpoint(sourceSystem);
    const [latestOutput] = await this.database.db
      .select({ latestPostingDate: sql<string | null>`max(${bcLedgerEntries.postingDate})` })
      .from(bcLedgerEntries)
      .where(eq(bcLedgerEntries.sourceSystem, sourceSystem));

    const freshnessMinutes =
      latestSuccessfulRun?.finishedAt
        ? Math.floor((Date.now() - latestSuccessfulRun.finishedAt.getTime()) / 60_000)
        : null;

    return {
      sourceSystem,
      latestRun: latestRun ? serializeRun(latestRun) : null,
      latestSuccessfulSync: latestSuccessfulRun ? serializeRun(latestSuccessfulRun) : null,
      checkpoint: checkpointJson(checkpoint),
      latestPostingDate: latestOutput?.latestPostingDate ?? null,
      freshnessMinutes,
      freshnessStatus: freshnessStatus(freshnessMinutes)
    };
  }

  async listRuns(sourceSystem = DEFAULT_SOURCE_SYSTEM, limit = 20) {
    const runs = await this.database.db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.sourceSystem, sourceSystem))
      .orderBy(desc(syncRuns.startedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return runs.map(serializeRun);
  }

  async getRun(id: string) {
    const [run] = await this.database.db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1);
    return run ? serializeRun(run) : null;
  }

  private async getCheckpoint(sourceSystem: string) {
    const [checkpoint] = await this.database.db
      .select({
        lastEntryNo: syncCheckpoints.lastEntryNo,
        lastPostingDate: syncCheckpoints.lastPostingDate
      })
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.sourceSystem, sourceSystem))
      .limit(1);
    return checkpoint ?? null;
  }
}
