"use client";

import { useCallback, useEffect, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { DataTable, EmptyState, ErrorState, LoadingSkeleton, MetricCard, PageHeader, SectionHeader, SourceBadge, StatusBadge } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
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
  const { toast } = useToast();
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
      else toast(`Sinkronisasi masuk antrean. Run ID: ${payload.data.runId}`);
      await load();
    } finally {
      setLoadingRun(false);
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={6} /></div>;

  return (
    <PermissionGate user={currentUser} permission="sync.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Settings" title="OData Sync Center" description="Pantau freshness Business Central, checkpoint, dan riwayat sinkronisasi tanpa mengubah konfigurasi sumber." meta={<><SourceBadge>{status?.sourceSystem ?? "OData"}</SourceBadge>{status ? <StatusBadge status={status.freshnessStatus} /> : null}</>} actions={<PermissionGate user={currentUser} permission="sync.run" fallback={null}><button type="button" onClick={triggerSync} disabled={loadingRun}>{loadingRun ? "Memasukkan antrean…" : "Jalankan sync"}</button></PermissionGate>} />
        {error ? <ErrorState message={`${error} Coba jalankan ulang atau periksa layanan worker.`} onRetry={() => void load()} /> : null}
        {!status ? (
          <EmptyState title="Status sync belum tersedia" description="Belum ada sinkronisasi berhasil. Jalankan sync bila Anda memiliki permission." />
        ) : (
          <div className="metric-grid">
            <MetricCard label="Latest success" value={formatDateTime(status.latestSuccessfulSync?.finishedAt ?? null)} detail="Waktu selesai sinkronisasi sukses terakhir" tone="success" />
            <MetricCard label="Freshness" value={status.freshnessMinutes === null ? "Belum sync" : `${status.freshnessMinutes} min`} detail={<StatusBadge status={status.freshnessStatus} />} tone={status.freshnessStatus === "FRESH" ? "success" : "warning"} />
            <MetricCard label="Checkpoint entry" value={status.checkpoint.lastEntryNo ?? "—"} detail={status.checkpoint.lastPostingDate ?? "Belum ada posting date"} />
            <MetricCard label="Latest posting date" value={status.latestPostingDate ?? "—"} detail={freshnessText(status)} />
          </div>
        )}

        <section><SectionHeader title="Riwayat sync" description="Jumlah fetched, inserted, updated, dan skipped membantu memverifikasi hasil setiap run." />
        {runs.length === 0 ? (
          <EmptyState title="Belum ada sync run" description="Run yang masuk antrean dan selesai akan ditampilkan di sini." />
        ) : (
          <DataTable headers={["Status / mode", "Mulai", "Selesai", "Hasil baris", "Error"]}>
            {runs.map((run) => (
              <tr key={run.id}><td><StatusBadge status={run.status} /><small>{run.mode}</small></td><td>{formatDateTime(run.startedAt)}</td><td>{formatDateTime(run.finishedAt)}</td><td>F {run.rowsFetched} · I {run.rowsInserted} · U {run.rowsUpdated} · S {run.rowsSkipped}</td><td>{run.errorMessage ?? "—"}</td></tr>
            ))}
          </DataTable>
        )}</section>
      </div>
    </PermissionGate>
  );
}
