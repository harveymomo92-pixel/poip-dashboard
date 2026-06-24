"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, Field, LoadingSkeleton, MetricCard, PageHeader, SectionHeader, SourceBadge, StatusBadge, WorkflowSteps } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface ImportIssue {
  readonly code: string;
  readonly severity: string;
}

interface ImportRow {
  readonly id: string;
  readonly rowNumber: number;
  readonly rawPayload: Record<string, string>;
  readonly normalizedPayload: {
    readonly eventDate: string | null;
    readonly machineCode: string | null;
    readonly category: string | null;
    readonly durationMinutes: number | null;
    readonly status: string;
  };
  readonly status: string;
  readonly issues: readonly ImportIssue[];
}

interface ImportRun {
  readonly id: string;
  readonly importType: string;
  readonly originalFilename: string;
  readonly status: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly rowsDuplicate: number;
  readonly rowsConflict: number;
  readonly rowsInserted: number;
  readonly createdAt: string;
  readonly committedAt: string | null;
  readonly rows?: readonly ImportRow[];
}

interface PreviewResult {
  readonly run: ImportRun;
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly duplicateRows: number;
    readonly conflictRows: number;
    readonly warningRows: number;
  };
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

export function ImportCenterPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runs, setRuns] = useState<readonly ImportRun[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const canCommit = currentUser?.permissions.includes("import.commit") ?? false;
  const rows = useMemo(() => preview?.run.rows ?? [], [preview]);

  const selectedCount = useMemo(
    () => rows.filter((row) => selectedRowIds.has(row.id)).length,
    [rows, selectedRowIds]
  );

  const loadRuns = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/imports/runs`, { credentials: "include" });
    const payload = (await response.json()) as ApiResult<readonly ImportRun[]>;
    if (payload.ok) setRuns(payload.data);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!mounted) return;
      if (me.ok) {
        setCurrentUser(me.data.user);
        if (me.data.user.permissions.includes("import.preview")) await loadRuns();
      }
      setLoaded(true);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [loadRuns]);

  async function runPreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("importType", "downtime");
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/imports/preview`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const payload = (await response.json()) as ApiResult<PreviewResult>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setPreview(payload.data);
      setSelectedRowIds(new Set(payload.data.run.rows?.filter((row) => row.status === "VALID").map((row) => row.id)));
      setMessage(`Preview created: ${payload.data.summary.validRows} valid rows`);
      toast(`Preview selesai: ${payload.data.summary.validRows} baris valid, ${payload.data.summary.invalidRows} baris perlu ditinjau.`);
      await loadRuns();
    } finally {
      setLoading(false);
    }
  }

  async function loadRun(runId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/imports/runs/${runId}`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<ImportRun>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      const runRows = payload.data.rows ?? [];
      setPreview({
        run: payload.data,
        summary: {
          totalRows: payload.data.rowsTotal,
          validRows: payload.data.rowsValid,
          invalidRows: payload.data.rowsInvalid,
          duplicateRows: payload.data.rowsDuplicate,
          conflictRows: payload.data.rowsConflict,
          warningRows: runRows.filter((row) => row.issues.some((issue) => issue.severity === "WARNING")).length
        }
      });
      setSelectedRowIds(new Set(runRows.filter((row) => row.status === "VALID").map((row) => row.id)));
    } finally {
      setLoading(false);
    }
  }

  async function commitRows() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/imports/runs/${preview.run.id}/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedRowIds: [...selectedRowIds] })
      });
      const payload = (await response.json()) as ApiResult<{ committedRows: number; skippedRows: number }>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setMessage(`Committed ${payload.data.committedRows} rows, skipped ${payload.data.skippedRows}`);
      setConfirmCommit(false);
      toast(`Import selesai: ${payload.data.committedRows} baris dibuat, ${payload.data.skippedRows} dilewati.`);
      await loadRun(preview.run.id);
      await loadRuns();
    } finally {
      setLoading(false);
    }
  }

  async function loadErrors() {
    if (!preview) return;
    const response = await fetch(`${API_BASE_URL}/imports/runs/${preview.run.id}/errors`, { credentials: "include" });
    const payload = (await response.json()) as ApiResult<{ filename: string; content: string }>;
    if (!payload.ok) {
      setError(payload.error.message);
      return;
    }
    setMessage(`Error report ready: ${payload.data.filename}\n${payload.data.content}`);
  }

  function toggleRow(rowId: string) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={6} /></div>;

  return (
    <PermissionGate user={currentUser} permission="import.preview" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Tools" title="Import Center" description="Validasi downtime CSV/XLSX sebelum data masuk ke operasi. Preview tidak mengubah data produksi." meta={<><SourceBadge>CSV / XLSX</SourceBadge>{preview ? <StatusBadge status={preview.run.status} /> : null}</>} />
        <WorkflowSteps steps={["Upload", "Preview", "Review issues", "Commit", "Result"]} current={!preview ? 0 : preview.run.committedAt ? 4 : 2} />
        <section className="form-panel">
          <SectionHeader title="Upload file downtime" description="File diproses sebagai preview terlebih dahulu. Hanya baris valid yang dapat dipilih untuk commit." actions={<button type="button" onClick={runPreview} disabled={loading || !file}>{loading ? "Membuat preview…" : "Buat preview"}</button>} />
          <div className="form-grid">
          <Field label="Tipe import" helper="Milestone ini mendukung downtime CSV/XLSX.">
            <select value="downtime" disabled>
              <option value="downtime">Downtime CSV/XLSX</option>
            </select>
          </Field>
          <Field label="File" helper="Gunakan .csv atau .xlsx dengan header yang didukung."><input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
          </div>
        </section>

        {error ? <ErrorState message={`${error} Perbaiki file atau ulangi preview.`} /> : null}
        {message ? <pre className="form-success import-message">{message}</pre> : null}

        {preview ? (
          <>
            <div className="metric-grid">
              <MetricCard label="Total rows" value={String(preview.summary.totalRows)} />
              <MetricCard label="Valid" value={String(preview.summary.validRows)} tone="success" />
              <MetricCard label="Invalid" value={String(preview.summary.invalidRows)} tone={preview.summary.invalidRows ? "danger" : "neutral"} />
              <MetricCard label="Duplicate / conflict" value={`${preview.summary.duplicateRows} / ${preview.summary.conflictRows}`} tone={preview.summary.duplicateRows + preview.summary.conflictRows ? "warning" : "neutral"} />
            </div>
            <section>
            <SectionHeader title="Review preview" description={`${selectedCount} baris valid dipilih. Baris invalid, duplicate, atau conflict tidak akan di-commit.`} actions={<div className="button-row">
                <button type="button" className="secondary-button" onClick={loadErrors} disabled={loading}>
                  Lihat laporan error
                </button>
                <PermissionGate user={currentUser} permission="import.commit" fallback={null}>
                  <button type="button" onClick={() => setConfirmCommit(true)} disabled={!canCommit || loading || selectedCount === 0}>Commit {selectedCount} baris</button>
                </PermissionGate>
              </div>} />

            {rows.length === 0 ? (
              <EmptyState title="Preview tidak berisi baris" description="Periksa file dan header kolom, lalu jalankan preview kembali." />
            ) : (
              <DataTable headers={["Pilih", "Validasi", "Tanggal / mesin", "Status / durasi", "Issues"]}>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={`Pilih baris ${row.rowNumber}`}
                        className="checkbox"
                        type="checkbox"
                        checked={selectedRowIds.has(row.id)}
                        disabled={row.status !== "VALID"}
                        onChange={() => toggleRow(row.id)}
                      /></td>
                    <td><StatusBadge status={row.status} /><small>Baris {row.rowNumber}</small></td>
                    <td><strong>{row.normalizedPayload.eventDate ?? "—"}</strong><small>{row.normalizedPayload.machineCode ?? "Tanpa mesin"} / {row.normalizedPayload.category ?? "Tanpa kategori"}</small></td>
                    <td><StatusBadge status={row.normalizedPayload.status} /><small>{row.normalizedPayload.durationMinutes ?? "—"} menit</small></td>
                    <td>{row.issues.length ? row.issues.map((issue) => <StatusBadge key={issue.code} status={issue.severity} label={issue.code} />) : "—"}</td>
                  </tr>
                ))}
              </DataTable>
            )}
            </section>
          </>
        ) : (
          <EmptyState title="Siap untuk preview" description="Pilih file downtime CSV/XLSX. Sistem akan memvalidasi isi tanpa langsung memasukkannya ke data operasional." />
        )}

        <section><SectionHeader title="Riwayat import" description="Buka run sebelumnya untuk meninjau hasil dan status commit." />
        {runs.length === 0 ? (
          <EmptyState title="Belum ada import" description="Riwayat preview dan commit akan muncul di sini." />
        ) : (
          <DataTable headers={["File", "Status", "Validasi", "Waktu"]}>
            {runs.map((run) => (
              <tr key={run.id} onClick={() => void loadRun(run.id)} style={{ cursor: "pointer" }}>
                <td><strong>{run.originalFilename}</strong><small>{run.importType}</small></td>
                <td><StatusBadge status={run.status} /></td><td>{run.rowsValid}/{run.rowsTotal} valid</td><td>{formatDateTime(run.committedAt ?? run.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}</section>
        <ConfirmDialog open={confirmCommit} title={`Commit ${selectedCount} baris downtime?`} description="Baris terpilih akan dibuat sebagai data downtime operasional. Baris invalid, duplicate, conflict, dan tidak dipilih tetap tidak masuk." confirmLabel="Ya, commit baris" busy={loading} onCancel={() => setConfirmCommit(false)} onConfirm={() => void commitRows()} />
      </div>
    </PermissionGate>
  );
}
