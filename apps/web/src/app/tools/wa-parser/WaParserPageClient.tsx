"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sourceText, setSourceText] = useState(sampleText);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runs, setRuns] = useState<readonly ParserRun[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  if (!loaded) return <section className="panel">Loading parser...</section>;

  return (
    <PermissionGate user={currentUser} permission="parser.preview" fallback={<ForbiddenState />}>
      <section className="panel parser-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tools</p>
            <h1>WA Parser</h1>
          </div>
          <button type="button" onClick={runPreview} disabled={loading || !sourceText.trim()}>
            {loading ? "Working..." : "Preview"}
          </button>
        </div>

        <textarea
          className="parser-textarea"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
        />

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

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
                <dt>Warnings</dt>
                <dd>{preview.summary.warningRows}</dd>
              </div>
            </div>

            <div className="panel-header parser-actions">
              <h2>Preview Rows</h2>
              <PermissionGate user={currentUser} permission="parser.commit" fallback={null}>
                <button type="button" onClick={commitRows} disabled={!canCommit || loading || selectedCount === 0}>
                  Commit {selectedCount}
                </button>
              </PermissionGate>
            </div>

            {rows.length === 0 ? (
              <p>No parsed rows.</p>
            ) : (
              <div className="table">
                {rows.map((row) => (
                  <div className="table-row parser-row" key={row.id}>
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
                      <small>{row.parsedPayload.type ?? "UNKNOWN"} · {row.confidence}%</small>
                    </span>
                    <span>{row.sourceLine}</span>
                    <span>{row.warnings.map((warning) => warning.code ?? warning.message).join(", ") || "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p>Paste WhatsApp text and run preview.</p>
        )}

        <h2>Recent Runs</h2>
        {runs.length === 0 ? (
          <p>No parser runs yet.</p>
        ) : (
          <div className="table">
            {runs.map((run) => (
              <button type="button" className="run-row" key={run.id} onClick={() => void loadRun(run.id)}>
                <span>{run.status}</span>
                <span>{formatDateTime(run.createdAt)}</span>
                <span>{String(run.metadata.totalRows ?? "-")} rows</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </PermissionGate>
  );
}
