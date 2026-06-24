"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "../../../components/Icons";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import {
  DataTable,
  EmptyState,
  ErrorState,
  InsightCard,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  SectionHeader,
  SourceBadge,
  StatusBadge
} from "../../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface HealthCheck {
  readonly status: string;
  readonly latencyMs?: number;
  readonly workers?: number | null;
  readonly counts?: Record<string, number>;
  readonly message: string;
}

interface Readiness {
  readonly status: string;
  readonly checkedAt: string;
  readonly durationMs: number;
  readonly service: {
    readonly name: string;
    readonly version: string;
    readonly environment: string;
    readonly uptimeSeconds: number;
  };
  readonly checks: {
    readonly database: HealthCheck;
    readonly migrations: HealthCheck & {
      readonly latestMigration: string | null;
      readonly appliedAt: string | null;
    };
    readonly redis: HealthCheck;
    readonly queue: HealthCheck;
  };
  readonly operations: {
    readonly latestSync: {
      readonly id: string;
      readonly status: string;
      readonly startedAt: string;
      readonly finishedAt: string | null;
      readonly rowsFetched: number;
      readonly rowsInserted: number;
      readonly rowsUpdated: number;
      readonly rowsSkipped: number;
    } | null;
    readonly latestSuccessfulSync: { readonly id: string; readonly finishedAt: string | null } | null;
    readonly freshnessMinutes: number | null;
    readonly freshnessStatus: string;
    readonly latestImport: {
      readonly id: string;
      readonly filename: string;
      readonly status: string;
      readonly rowsInserted: number;
      readonly createdAt: string;
      readonly committedAt: string | null;
    } | null;
    readonly latestParser: {
      readonly id: string;
      readonly status: string;
      readonly parserMode: string;
      readonly createdAt: string;
      readonly committedAt: string | null;
    } | null;
  };
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export function HealthPageClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [health, setHealth] = useState<Readiness | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!me.ok) return;
      setCurrentUser(me.data.user);
      if (!me.data.user.permissions.includes("settings.manage")) return;
      const response = await fetch(`${API_BASE_URL}/health/readiness`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<Readiness>;
      if (!payload.ok) setError(payload.error.message);
      else setHealth(payload.data);
    } catch {
      setError("System health tidak dapat dijangkau. API mungkin sedang tidak tersedia.");
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  const queueCounts = health?.checks.queue.counts ?? {};

  return (
    <PermissionGate user={currentUser} permission="settings.manage" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader
          eyebrow="Settings / Observability"
          title="System Health"
          description="Read-only readiness view for API, PostgreSQL, Redis, sync worker, and operational pipelines."
          meta={<>{health ? <StatusBadge status={health.status} /> : null}<SourceBadge>{health?.service.environment ?? "Environment"}</SourceBadge><span className="info-pill"><Icons.health />Checked {formatDate(health?.checkedAt ?? null)}</span></>}
          actions={<button className="secondary-button" disabled={loading} onClick={() => void load()}><Icons.refresh />{loading ? "Checking…" : "Run checks"}</button>}
        />

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {health ? (
          <>
            <section className="metric-grid">
              <MetricCard icon={<Icons.health />} label="API readiness" value={health.status} detail={`${health.durationMs} ms total check`} tone={health.status === "HEALTHY" ? "success" : health.status === "WARNING" ? "warning" : "danger"} />
              <MetricCard icon={<Icons.database />} label="PostgreSQL" value={health.checks.database.status} detail={`${health.checks.database.latencyMs ?? "—"} ms`} tone={health.checks.database.status === "HEALTHY" ? "success" : "danger"} />
              <MetricCard icon={<Icons.sync />} label="Redis / queue" value={health.checks.redis.status} detail={`${health.checks.queue.workers ?? 0} worker connected`} tone={health.checks.redis.status === "HEALTHY" ? health.checks.queue.status === "HEALTHY" ? "success" : "warning" : "danger"} />
              <MetricCard icon={<Icons.database />} label="Data freshness" value={health.operations.freshnessMinutes === null ? "Never synced" : `${health.operations.freshnessMinutes} min`} detail={<StatusBadge status={health.operations.freshnessStatus} />} tone={health.operations.freshnessStatus === "HEALTHY" ? "success" : health.operations.freshnessStatus === "WARNING" ? "warning" : "danger"} />
            </section>

            <section className="insight-grid">
              <InsightCard icon={<Icons.database />} title="Service identity" value={health.service.name} description="Safe runtime identity only; credentials and infrastructure addresses are not exposed." rows={[
                { label: "Version", value: health.service.version, tone: "info" },
                { label: "Environment", value: health.service.environment, tone: "neutral" },
                { label: "Uptime", value: formatUptime(health.service.uptimeSeconds), tone: "success" }
              ]} />
              <InsightCard icon={<Icons.sync />} title="Queue activity" value={`${health.checks.queue.workers ?? 0} workers`} description={health.checks.queue.message} tone={health.checks.queue.status === "HEALTHY" ? "success" : health.checks.queue.status === "WARNING" ? "warning" : "danger"} rows={[
                { label: "Waiting", value: queueCounts.wait ?? 0, tone: "warning" },
                { label: "Active", value: queueCounts.active ?? 0, tone: "info" },
                { label: "Failed", value: queueCounts.failed ?? 0, tone: (queueCounts.failed ?? 0) ? "danger" : "success" }
              ]} />
            </section>

            <section>
              <SectionHeader title="Infrastructure checks" description="Readiness checks are live and do not modify system state." />
              <DataTable headers={["Component", "Status", "Latency / workers", "Message"]}>
                <tr><td><strong>PostgreSQL</strong></td><td><StatusBadge status={health.checks.database.status} /></td><td>{health.checks.database.latencyMs ?? "—"} ms</td><td>{health.checks.database.message}</td></tr>
                <tr><td><strong>Database migrations</strong></td><td><StatusBadge status={health.checks.migrations.status} /></td><td>{health.checks.migrations.latestMigration ?? "—"}</td><td>{health.checks.migrations.appliedAt ? `${health.checks.migrations.message} Applied ${formatDate(health.checks.migrations.appliedAt)}.` : health.checks.migrations.message}</td></tr>
                <tr><td><strong>Redis</strong></td><td><StatusBadge status={health.checks.redis.status} /></td><td>{health.checks.redis.latencyMs ?? "—"} ms</td><td>{health.checks.redis.message}</td></tr>
                <tr><td><strong>OData sync queue</strong></td><td><StatusBadge status={health.checks.queue.status} /></td><td>{health.checks.queue.workers ?? "—"} workers</td><td>{health.checks.queue.message}</td></tr>
              </DataTable>
            </section>

            <section>
              <SectionHeader title="Latest operational runs" description="Latest known status from sync, Import Center, and WhatsApp Parser." />
              <DataTable headers={["Workflow", "Status", "Started / created", "Finished / committed", "Details"]}>
                <tr>
                  <td><strong>OData sync</strong></td>
                  <td>{health.operations.latestSync ? <StatusBadge status={health.operations.latestSync.status} /> : "—"}</td>
                  <td>{formatDate(health.operations.latestSync?.startedAt ?? null)}</td>
                  <td>{formatDate(health.operations.latestSync?.finishedAt ?? null)}</td>
                  <td>{health.operations.latestSync ? `F ${health.operations.latestSync.rowsFetched} · I ${health.operations.latestSync.rowsInserted} · U ${health.operations.latestSync.rowsUpdated} · S ${health.operations.latestSync.rowsSkipped}` : "No run"}</td>
                </tr>
                <tr>
                  <td><strong>Import Center</strong></td>
                  <td>{health.operations.latestImport ? <StatusBadge status={health.operations.latestImport.status} /> : "—"}</td>
                  <td>{formatDate(health.operations.latestImport?.createdAt ?? null)}</td>
                  <td>{formatDate(health.operations.latestImport?.committedAt ?? null)}</td>
                  <td>{health.operations.latestImport ? `${health.operations.latestImport.filename} · ${health.operations.latestImport.rowsInserted} inserted` : "No run"}</td>
                </tr>
                <tr>
                  <td><strong>WhatsApp Parser</strong></td>
                  <td>{health.operations.latestParser ? <StatusBadge status={health.operations.latestParser.status} /> : "—"}</td>
                  <td>{formatDate(health.operations.latestParser?.createdAt ?? null)}</td>
                  <td>{formatDate(health.operations.latestParser?.committedAt ?? null)}</td>
                  <td>{health.operations.latestParser?.parserMode ?? "No run"}</td>
                </tr>
              </DataTable>
            </section>
          </>
        ) : !error ? <EmptyState title="Health data unavailable" description="Run checks to retrieve current system readiness." /> : null}
      </div>
    </PermissionGate>
  );
}
