import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { importRuns, syncRuns, waParserRuns } from "@poip/db";
import { Queue } from "bullmq";
import { and, desc, eq, sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";

const ODATA_SYNC_QUEUE = "odata-sync";
export type HealthStatus = "HEALTHY" | "WARNING" | "CRITICAL";

function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

function freshness(minutes: number | null): HealthStatus {
  if (minutes === null || minutes > 360) return "CRITICAL";
  if (minutes > 120) return "WARNING";
  return "HEALTHY";
}

export function readinessStatus(input: {
  readonly database: HealthStatus;
  readonly redis: HealthStatus;
  readonly migrations: HealthStatus;
  readonly queue: HealthStatus;
  readonly syncMode: HealthStatus;
  readonly freshness: HealthStatus;
  readonly latestSyncStatus: string | null;
}): HealthStatus {
  if (input.database === "CRITICAL" || input.redis === "CRITICAL") return "CRITICAL";
  if (
    input.migrations !== "HEALTHY" ||
    input.queue !== "HEALTHY" ||
    input.syncMode !== "HEALTHY" ||
    input.freshness !== "HEALTHY" ||
    input.latestSyncStatus === "FAILED"
  ) {
    return "WARNING";
  }
  return "HEALTHY";
}

@Injectable()
export class HealthRepository implements OnModuleDestroy {
  private readonly redis = new Redis(getRedisUrl(), {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    commandTimeout: 2_000
  });
  private readonly queue = new Queue(ODATA_SYNC_QUEUE, { connection: this.redis });

  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async onModuleDestroy() {
    await this.queue.close();
    this.redis.disconnect();
  }

  async readiness() {
    const startedAt = Date.now();
    let databaseCheck: { status: "HEALTHY" | "CRITICAL"; latencyMs: number; message: string };
    try {
      const dbStarted = Date.now();
      await this.database.db.execute(sql`select 1 as ready`);
      databaseCheck = {
        status: "HEALTHY",
        latencyMs: Date.now() - dbStarted,
        message: "PostgreSQL connection is ready."
      };
    } catch {
      databaseCheck = {
        status: "CRITICAL",
        latencyMs: Date.now() - startedAt,
        message: "PostgreSQL connection failed."
      };
    }

    let migrationCheck: {
      status: HealthStatus;
      latestMigration: string | null;
      appliedAt: string | null;
      message: string;
    };
    if (databaseCheck.status === "HEALTHY") {
      try {
        const result = await this.database.db.execute<{
          id: string;
          appliedAt: Date | string;
        }>(sql`
          select id, applied_at as "appliedAt"
          from schema_migrations
          order by applied_at desc
          limit 1
        `);
        const migration = result.rows[0];
        migrationCheck = migration
          ? {
              status: "HEALTHY",
              latestMigration: migration.id,
              appliedAt: new Date(migration.appliedAt).toISOString(),
              message: `Latest recorded migration is ${migration.id}.`
            }
          : {
              status: "WARNING",
              latestMigration: null,
              appliedAt: null,
              message: "No applied migration record was found."
            };
      } catch {
        migrationCheck = {
          status: "WARNING",
          latestMigration: null,
          appliedAt: null,
          message: "Migration status is unavailable."
        };
      }
    } else {
      migrationCheck = {
        status: "CRITICAL",
        latestMigration: null,
        appliedAt: null,
        message: "Migration status is unavailable because PostgreSQL is not reachable."
      };
    }

    let redisCheck: { status: "HEALTHY" | "CRITICAL"; latencyMs: number; message: string };
    let queueCheck: {
      status: "HEALTHY" | "WARNING" | "CRITICAL";
      workers: number | null;
      counts: Record<string, number>;
      effectiveFailedJobs?: number;
      staleSuccessfulFailedJobs?: number;
      message: string;
    };
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const redisStarted = Date.now();
      await this.redis.ping();
      redisCheck = {
        status: "HEALTHY",
        latencyMs: Date.now() - redisStarted,
        message: "Redis connection is ready."
      };
      const [counts, workers] = await Promise.all([
        this.queue.getJobCounts("wait", "active", "completed", "failed", "delayed"),
        this.queue.getWorkersCount()
      ]);
      const failedJobs = await this.effectiveFailedJobCount(counts.failed ?? 0);
      queueCheck = {
        status: workers > 0 && failedJobs.effectiveFailedJobs === 0 ? "HEALTHY" : "WARNING",
        workers,
        counts,
        effectiveFailedJobs: failedJobs.effectiveFailedJobs,
        staleSuccessfulFailedJobs: failedJobs.staleSuccessfulFailedJobs,
        message:
          workers === 0
            ? "Queue is reachable but no sync worker heartbeat is visible."
            : failedJobs.effectiveFailedJobs > 0
              ? `${workers} sync worker connected; ${failedJobs.effectiveFailedJobs} unresolved failed job(s) remain visible.`
              : failedJobs.staleSuccessfulFailedJobs > 0
                ? `${workers} sync worker connected; stale failed queue jobs are matched by successful DB sync runs.`
              : `${workers} sync worker connected.`
      };
    } catch {
      redisCheck = {
        status: "CRITICAL",
        latencyMs: Date.now() - startedAt,
        message: "Redis connection failed."
      };
      queueCheck = {
        status: "CRITICAL",
        workers: null,
        counts: {},
        message: "Queue status is unavailable because Redis is not reachable."
      };
    }

    const mode = process.env.ODATA_SYNC_MODE ?? "mock";
    const syncModeCheck = {
      status: mode === "live" ? "HEALTHY" : "WARNING",
      mode,
      message:
        mode === "live"
          ? "Business Central live OData sync mode is enabled."
          : "OData sync is not in live mode; Business Central ingestion is not production-ready."
    } as const;

    const operations =
      databaseCheck.status === "HEALTHY"
        ? await this.getOperationalStatus()
        : {
            latestSync: null,
            latestSuccessfulSync: null,
            freshnessMinutes: null,
            freshnessStatus: "CRITICAL" as const,
            latestImport: null,
            latestParser: null
          };

    const status = readinessStatus({
      database: databaseCheck.status,
      redis: redisCheck.status,
      migrations: migrationCheck.status,
      queue: queueCheck.status,
      syncMode: syncModeCheck.status,
      freshness: operations.freshnessStatus,
      latestSyncStatus: operations.latestSync?.status ?? null
    });
    return {
      status,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      service: {
        name: "poip-api",
        version: process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown",
        environment: process.env.NODE_ENV ?? "development",
        uptimeSeconds: Math.floor(process.uptime())
      },
      checks: {
        database: databaseCheck,
        migrations: migrationCheck,
        redis: redisCheck,
        queue: queueCheck,
        syncMode: syncModeCheck
      },
      operations
    };
  }

  private async effectiveFailedJobCount(failedCount: number) {
    if (failedCount <= 0) {
      return { effectiveFailedJobs: 0, staleSuccessfulFailedJobs: 0 };
    }

    const jobs = await this.queue.getFailed(0, Math.min(failedCount, 100) - 1);
    const jobIds = jobs
      .map((job) => job.id)
      .filter((id): id is string =>
        Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      );
    if (jobIds.length === 0) {
      return { effectiveFailedJobs: failedCount, staleSuccessfulFailedJobs: 0 };
    }

    const result = await this.database.pool.query<{ id: string }>(
      "select id from sync_runs where id = any($1::uuid[]) and status = 'SUCCESS'",
      [jobIds]
    );
    const staleSuccessfulFailedJobs = result.rows.length;
    const uninspectedFailedJobs = Math.max(failedCount - jobs.length, 0);
    return {
      effectiveFailedJobs: uninspectedFailedJobs + Math.max(jobs.length - staleSuccessfulFailedJobs, 0),
      staleSuccessfulFailedJobs
    };
  }

  private async getOperationalStatus() {
    const requireLiveSource = process.env.ODATA_SYNC_MODE === "live";
    const liveSuccessClause = requireLiveSource
      ? sql`${syncRuns.sourceUrl} is not null and ${syncRuns.sourceUrl} not like 'mock://%'`
      : undefined;
    const [latestSyncRows, successfulSyncRows, latestImportRows, latestParserRows] = await Promise.all([
      this.database.db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1),
      this.database.db
        .select()
        .from(syncRuns)
        .where(and(eq(syncRuns.status, "SUCCESS"), ...(liveSuccessClause ? [liveSuccessClause] : [])))
        .orderBy(desc(syncRuns.finishedAt))
        .limit(1),
      this.database.db.select().from(importRuns).orderBy(desc(importRuns.createdAt)).limit(1),
      this.database.db.select().from(waParserRuns).orderBy(desc(waParserRuns.createdAt)).limit(1)
    ]);
    const latestSync = latestSyncRows[0];
    const latestSuccessfulSync = successfulSyncRows[0];
    const latestImport = latestImportRows[0];
    const latestParser = latestParserRows[0];
    const freshnessMinutes = latestSuccessfulSync?.finishedAt
      ? Math.max(0, Math.floor((Date.now() - latestSuccessfulSync.finishedAt.getTime()) / 60_000))
      : null;
    return {
      latestSync: latestSync
        ? {
            id: latestSync.id,
            status: latestSync.status,
            startedAt: latestSync.startedAt.toISOString(),
            finishedAt: latestSync.finishedAt?.toISOString() ?? null,
            rowsFetched: latestSync.rowsFetched,
            rowsInserted: latestSync.rowsInserted,
            rowsUpdated: latestSync.rowsUpdated,
            rowsSkipped: latestSync.rowsSkipped,
            errorCode: latestSync.errorCode,
            errorMessage: latestSync.errorMessage
          }
        : null,
      latestSuccessfulSync: latestSuccessfulSync
        ? {
            id: latestSuccessfulSync.id,
            finishedAt: latestSuccessfulSync.finishedAt?.toISOString() ?? null
          }
        : null,
      freshnessMinutes,
      freshnessStatus: freshness(freshnessMinutes),
      latestImport: latestImport
        ? {
            id: latestImport.id,
            filename: latestImport.originalFilename,
            status: latestImport.status,
            rowsInserted: latestImport.rowsInserted,
            createdAt: latestImport.createdAt.toISOString(),
            committedAt: latestImport.committedAt?.toISOString() ?? null
          }
        : null,
      latestParser: latestParser
        ? {
            id: latestParser.id,
            status: latestParser.status,
            parserMode: latestParser.parserMode,
            createdAt: latestParser.createdAt.toISOString(),
            committedAt: latestParser.committedAt?.toISOString() ?? null
          }
        : null
    };
  }
}
