"use client";

import { useCallback, useEffect, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface SyncRun {
  readonly id: string;
  readonly mode: string;
  readonly status: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly rowsFetched: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
  readonly rowsSkipped: number;
  readonly errorMessage: string | null;
}

interface SyncStatus {
  readonly sourceSystem: string;
  readonly latestRun: SyncRun | null;
  readonly latestSuccessfulSync: SyncRun | null;
  readonly checkpoint: {
    readonly lastEntryNo: string | null;
    readonly lastPostingDate: string | null;
  };
  readonly latestPostingDate: string | null;
  readonly freshnessMinutes: number | null;
  readonly freshnessStatus: string;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

function freshnessText(status: SyncStatus): string {
  if (status.freshnessMinutes === null) return "Belum pernah sync";
  return `${status.freshnessStatus} · ${status.freshnessMinutes} menit`;
}

export function SyncPageClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [runs, setRuns] = useState<readonly SyncRun[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
    const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
    if (!me.ok) {
      setLoaded(true);
      return;
    }
    setCurrentUser(me.data.user);
    if (!me.data.user.permissions.includes("sync.view")) {
      setLoaded(true);
      return;
    }

    const [statusResponse, runsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/sync/status`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/sync/runs`, { credentials: "include" })
    ]);
    const statusPayload = (await statusResponse.json()) as ApiResult<SyncStatus>;
    const runsPayload = (await runsResponse.json()) as ApiResult<readonly SyncRun[]>;
    if (statusPayload.ok) setStatus(statusPayload.data);
    else setError(statusPayload.error.message);
    if (runsPayload.ok) setRuns(runsPayload.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function triggerSync() {
    setLoadingRun(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/sync/odata/run`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as ApiResult<{ runId: string }>;
      if (!payload.ok) setError(payload.error.message);
      await load();
    } finally {
      setLoadingRun(false);
    }
  }

  if (!loaded) return <section className="panel">Loading sync center...</section>;

  return (
    <PermissionGate user={currentUser} permission="sync.view" fallback={<ForbiddenState />}>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Sync Center</h1>
          </div>
          <PermissionGate user={currentUser} permission="sync.run" fallback={null}>
            <button type="button" onClick={triggerSync} disabled={loadingRun}>
              {loadingRun ? "Queueing..." : "Run sync"}
            </button>
          </PermissionGate>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {!status ? (
          <p>Belum ada status sync.</p>
        ) : (
          <div className="facts sync-facts">
            <div>
              <dt>Latest Success</dt>
              <dd>{formatDateTime(status.latestSuccessfulSync?.finishedAt ?? null)}</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>{freshnessText(status)}</dd>
            </div>
            <div>
              <dt>Checkpoint Entry</dt>
              <dd>{status.checkpoint.lastEntryNo ?? "-"}</dd>
            </div>
            <div>
              <dt>Latest Posting Date</dt>
              <dd>{status.latestPostingDate ?? "-"}</dd>
            </div>
          </div>
        )}

        <h2>Run History</h2>
        {runs.length === 0 ? (
          <p>Belum ada sync run.</p>
        ) : (
          <div className="table">
            {runs.map((run) => (
              <div className="table-row sync-row" key={run.id}>
                <span>
                  <strong>{run.status}</strong>
                  <small>{run.mode}</small>
                </span>
                <span>{formatDateTime(run.startedAt)}</span>
                <span>{formatDateTime(run.finishedAt)}</span>
                <span>
                  F {run.rowsFetched} · I {run.rowsInserted} · U {run.rowsUpdated} · S{" "}
                  {run.rowsSkipped}
                </span>
                <span>{run.errorMessage ?? "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PermissionGate>
  );
}
