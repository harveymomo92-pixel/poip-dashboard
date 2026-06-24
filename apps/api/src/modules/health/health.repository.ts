import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { importRuns, syncRuns, waParserRuns } from "@poip/db";
import { Queue } from "bullmq";
import { desc, eq, sql } from "drizzle-orm";
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
  readonly freshness: HealthStatus;
  readonly latestSyncStatus: string | null;
}): HealthStatus {
  if (input.database === "CRITICAL" || input.redis === "CRITICAL") return "CRITICAL";
  if (
    input.migrations !== "HEALTHY" ||
    input.queue !== "HEALTHY" ||
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
      const failedJobs = counts.failed ?? 0;
      queueCheck = {
        status: workers > 0 && failedJobs === 0 ? "HEALTHY" : "WARNING",
        workers,
        counts,
        message:
          workers === 0
            ? "Queue is reachable but no sync worker heartbeat is visible."
            : failedJobs > 0
              ? `${workers} sync worker connected; ${failedJobs} failed job(s) remain visible.`
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
        queue: queueCheck
      },
      operations
    };
  }

  private async getOperationalStatus() {
    const [latestSyncRows, successfulSyncRows, latestImportRows, latestParserRows] = await Promise.all([
      this.database.db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1),
      this.database.db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.status, "SUCCESS"))
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
            rowsSkipped: latestSync.rowsSkipped
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
