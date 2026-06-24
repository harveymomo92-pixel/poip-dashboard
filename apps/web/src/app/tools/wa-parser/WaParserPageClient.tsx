"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, Field, LoadingSkeleton, MetricCard, PageHeader, SectionHeader, SourceBadge, StatusBadge, WorkflowSteps } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface ParserRow {
  readonly id: string;
  readonly rowNumber: number;
  readonly sourceLine: string;
  readonly parsedPayload: { readonly type?: string; readonly [key: string]: unknown };
  readonly confidence: number;
  readonly warnings: readonly { readonly code?: string; readonly message?: string; readonly severity?: string }[];
  readonly status: string;
  readonly downtimeEventId: string | null;
}

interface ParserRun {
  readonly id: string;
  readonly parserMode: string;
  readonly parserVersion: string;
  readonly status: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly committedAt: string | null;
  readonly rows?: readonly ParserRow[];
}

interface PreviewResult {
  readonly run: ParserRun;
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly warningRows: number;
  };
}

const sampleText = `2026-06-22 Shift A MC-MOCK-01 item FG-MOCK-001 output 120 reject 2
22/06/2026 shift N downtime MC-MOCK-01 23:30-01:00 breakdown root bearing failure action replaced bearing`;

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

export function WaParserPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sourceText, setSourceText] = useState(sampleText);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runs, setRuns] = useState<readonly ParserRun[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const canCommit = currentUser?.permissions.includes("parser.commit") ?? false;
  const rows = useMemo(() => preview?.run.rows ?? [], [preview]);

  const selectedCount = useMemo(
    () => rows.filter((row) => selectedRowIds.has(row.id)).length,
    [rows, selectedRowIds]
  );

  const loadRuns = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/parser/wa/runs`, { credentials: "include" });
    const payload = (await response.json()) as ApiResult<readonly ParserRun[]>;
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
        if (me.data.user.permissions.includes("parser.preview")) await loadRuns();
      }
      setLoaded(true);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [loadRuns]);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/parser/wa/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceText })
      });
      const payload = (await response.json()) as ApiResult<PreviewResult>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setPreview(payload.data);
      setSelectedRowIds(new Set(payload.data.run.rows?.filter((row) => row.status === "VALID").map((row) => row.id)));
      setMessage(`Preview created: ${payload.data.summary.validRows} valid rows`);
      toast(`Parser selesai: ${payload.data.summary.validRows} baris valid dan ${payload.data.summary.warningRows} baris dengan peringatan.`);
      await loadRuns();
    } finally {
      setLoading(false);
    }
  }

  async function loadRun(runId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/parser/wa/runs/${runId}`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<ParserRun>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      const runRows = payload.data.rows ?? [];
      setPreview({
        run: payload.data,
        summary: {
          totalRows: runRows.length,
          validRows: runRows.filter((row) => row.status === "VALID").length,
          invalidRows: runRows.filter((row) => row.status === "INVALID").length,
          warningRows: runRows.filter((row) => row.warnings.length > 0).length
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
      const response = await fetch(`${API_BASE_URL}/parser/wa/runs/${preview.run.id}/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedRowIds: [...selectedRowIds] })
      });
      const payload = (await response.json()) as ApiResult<{
        committedRows: number;
        productionRowsCommitted: number;
        downtimeRowsCommitted: number;
      }>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setMessage(
        `Committed ${payload.data.committedRows} rows (${payload.data.productionRowsCommitted} output, ${payload.data.downtimeRowsCommitted} downtime)`
      );
      setConfirmCommit(false);
      toast(`Commit selesai: ${payload.data.productionRowsCommitted} output dan ${payload.data.downtimeRowsCommitted} downtime dibuat.`);
      await loadRun(preview.run.id);
      await loadRuns();
    } finally {
      setLoading(false);
    }
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
    <PermissionGate user={currentUser} permission="parser.preview" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Tools" title="WhatsApp Parser" description="Ubah teks laporan shift menjadi preview terstruktur, tinjau peringatan, lalu commit hanya baris yang dipercaya." meta={<><SourceBadge>Rules parser</SourceBadge>{preview ? <><StatusBadge status={preview.run.status} /><span className="page-description">Versi {preview.run.parserVersion}</span></> : null}</>} />
        <WorkflowSteps steps={["Paste text", "Parse preview", "Review issues", "Commit", "Result"]} current={!preview ? 0 : preview.run.committedAt ? 4 : 2} />
        <section className="form-panel">
          <SectionHeader title="Teks laporan WhatsApp" description="Satu laporan per baris. Preview tidak mengubah data produksi atau downtime." actions={<button type="button" onClick={runPreview} disabled={loading || !sourceText.trim()}>{loading ? "Memproses…" : "Parse preview"}</button>} />
          <Field label="Teks sumber" helper="Pertahankan tanggal, shift, mesin, waktu, output/reject, dan keterangan downtime sedekat mungkin dengan pesan asli.">
            <textarea className="parser-textarea" value={sourceText} onChange={(event) => setSourceText(event.target.value)} />
          </Field>
        </section>
        {error ? <ErrorState message={`${error} Periksa format teks dan coba preview kembali.`} /> : null}
        {message ? <p className="form-success">{message}</p> : null}

        {preview ? (
          <>
            <div className="metric-grid">
              <MetricCard label="Total rows" value={String(preview.summary.totalRows)} />
              <MetricCard label="Valid" value={String(preview.summary.validRows)} tone="success" />
              <MetricCard label="Invalid" value={String(preview.summary.invalidRows)} tone={preview.summary.invalidRows ? "danger" : "neutral"} />
              <MetricCard label="Warnings" value={String(preview.summary.warningRows)} tone={preview.summary.warningRows ? "warning" : "neutral"} />
            </div>
            <section><SectionHeader title="Review hasil parse" description={`${selectedCount} baris valid dipilih. Confidence dan warning membantu peninjauan, tetapi tidak menggantikan verifikasi operator.`} actions={<PermissionGate user={currentUser} permission="parser.commit" fallback={null}><button type="button" onClick={() => setConfirmCommit(true)} disabled={!canCommit || loading || selectedCount === 0}>Commit {selectedCount} baris</button></PermissionGate>} />

            {rows.length === 0 ? (
              <EmptyState title="Tidak ada baris terdeteksi" description="Periksa apakah setiap laporan berada pada baris terpisah dan memiliki informasi operasional yang cukup." />
            ) : (
              <DataTable headers={["Pilih", "Validasi", "Teks sumber", "Warnings"]}>
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
                    <td><StatusBadge status={row.status} /><small>{row.parsedPayload.type ?? "UNKNOWN"} · confidence {row.confidence}%</small></td>
                    <td>{row.sourceLine}</td>
                    <td>{row.warnings.length ? row.warnings.map((warning, index) => <StatusBadge key={`${warning.code ?? index}`} status={warning.severity ?? "WARNING"} label={warning.code ?? warning.message ?? "Warning"} />) : "—"}</td>
                  </tr>
                ))}
              </DataTable>
            )}
            </section>
          </>
        ) : (
          <EmptyState title="Siap mem-parsing laporan" description="Tempel teks WhatsApp di atas. Sistem akan membuat preview yang bisa diperiksa sebelum commit." />
        )}

        <section><SectionHeader title="Riwayat parser" description="Buka run sebelumnya untuk meninjau kembali hasil parse dan status commit." />
        {runs.length === 0 ? (
          <EmptyState title="Belum ada parser run" description="Riwayat preview parser akan muncul di sini." />
        ) : (
          <DataTable headers={["Status", "Dibuat", "Jumlah baris"]}>
            {runs.map((run) => (
              <tr key={run.id} onClick={() => void loadRun(run.id)} style={{ cursor: "pointer" }}><td><StatusBadge status={run.status} /></td><td>{formatDateTime(run.createdAt)}</td><td>{String(run.metadata.totalRows ?? "—")}</td></tr>
            ))}
          </DataTable>
        )}</section>
        <ConfirmDialog open={confirmCommit} title={`Commit ${selectedCount} baris hasil parser?`} description="Baris terpilih akan dibuat menjadi output produksi dan/atau downtime sesuai hasil parse. Pastikan teks sumber, tipe, confidence, dan warning sudah ditinjau." confirmLabel="Ya, commit hasil parse" busy={loading} onCancel={() => setConfirmCommit(false)} onConfirm={() => void commitRows()} />
      </div>
    </PermissionGate>
  );
}
