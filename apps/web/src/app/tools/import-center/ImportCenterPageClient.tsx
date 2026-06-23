"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runs, setRuns] = useState<readonly ImportRun[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  if (!loaded) return <section className="panel">Loading Import Center...</section>;

  return (
    <PermissionGate user={currentUser} permission="import.preview" fallback={<ForbiddenState />}>
      <section className="panel import-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tools</p>
            <h1>Import Center</h1>
          </div>
          <button type="button" onClick={runPreview} disabled={loading || !file}>
            {loading ? "Working..." : "Preview"}
          </button>
        </div>

        <div className="filters import-upload">
          <label>
            Import type
            <select value="downtime" disabled>
              <option value="downtime">Downtime CSV/XLSX</option>
            </select>
          </label>
          <label>
            File
            <input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <pre className="form-success import-message">{message}</pre> : null}

        {preview ? (
          <>
            <div className="facts sync-facts">
              <div>
                <dt>Total</dt>
                <dd>{preview.summary.totalRows}</dd>
              </div>
              <div>
                <dt>Valid</dt>
                <dd>{preview.summary.validRows}</dd>
              </div>
              <div>
                <dt>Invalid</dt>
                <dd>{preview.summary.invalidRows}</dd>
              </div>
              <div>
                <dt>Duplicates</dt>
                <dd>{preview.summary.duplicateRows}</dd>
              </div>
              <div>
                <dt>Conflicts</dt>
                <dd>{preview.summary.conflictRows}</dd>
              </div>
            </div>

            <div className="panel-header parser-actions">
              <h2>Preview Rows</h2>
              <div className="button-row">
                <button type="button" className="secondary-button" onClick={loadErrors} disabled={loading}>
                  Errors
                </button>
                <PermissionGate user={currentUser} permission="import.commit" fallback={null}>
                  <button type="button" onClick={commitRows} disabled={!canCommit || loading || selectedCount === 0}>
                    Commit {selectedCount}
                  </button>
                </PermissionGate>
              </div>
            </div>

            {rows.length === 0 ? (
              <p>No import rows.</p>
            ) : (
              <div className="table">
                {rows.map((row) => (
                  <div className="table-row import-row" key={row.id}>
                    <span>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(row.id)}
                        disabled={row.status !== "VALID"}
                        onChange={() => toggleRow(row.id)}
                      />
                    </span>
                    <span>
                      <strong>{row.status}</strong>
                      <small>Row {row.rowNumber}</small>
                    </span>
                    <span>
                      {row.normalizedPayload.eventDate ?? "-"}
                      <small>{row.normalizedPayload.machineCode ?? "-"} / {row.normalizedPayload.category ?? "-"}</small>
                    </span>
                    <span>
                      {row.normalizedPayload.status}
                      <small>{row.normalizedPayload.durationMinutes ?? "-"} minutes</small>
                    </span>
                    <span>{row.issues.map((issue) => issue.code).join(", ") || "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p>Upload a downtime CSV or XLSX file and run preview.</p>
        )}

        <h2>Import History</h2>
        {runs.length === 0 ? (
          <p>No import runs yet.</p>
        ) : (
          <div className="table">
            {runs.map((run) => (
              <button type="button" className="table-row run-row" key={run.id} onClick={() => void loadRun(run.id)}>
                <span>
                  <strong>{run.originalFilename}</strong>
                  <small>{run.importType}</small>
                </span>
                <span>{run.status}</span>
                <span>{run.rowsValid}/{run.rowsTotal} valid</span>
                <span>{formatDateTime(run.committedAt ?? run.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </PermissionGate>
  );
}
