"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "../../components/Icons";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
import { useToast } from "../../components/Toast";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  InsightCard,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  Pagination,
  SectionHeader,
  SourceBadge,
  StatusBadge
} from "../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

interface IssueSummary {
  readonly openIssues: number;
  readonly acknowledgedIssues: number;
  readonly resolvedIssues: number;
  readonly ignoredIssues: number;
  readonly criticalIssues: number;
  readonly highIssues: number;
  readonly warningIssues: number;
  readonly mediumIssues: number;
  readonly lowIssues: number;
  readonly infoIssues: number;
  readonly byCode: readonly { issueCode: string; issueCount: number }[];
}

interface DataQualityIssue {
  readonly id: string;
  readonly issueCode: string;
  readonly severity: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly sourceSystem: string | null;
  readonly sourceRef: string | null;
  readonly description: string;
  readonly explanation: string;
  readonly payload: unknown;
  readonly status: string;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface BusinessCentralGenerateSummary {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly resolved: number;
  readonly byType: Record<string, unknown>;
  readonly bySeverity: Record<string, unknown>;
}

interface IssueList {
  readonly rows: readonly DataQualityIssue[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

interface Filters {
  readonly status: string;
  readonly severity: string;
  readonly source: string;
  readonly issueCode: string;
  readonly from: string;
  readonly to: string;
}

function businessDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

const defaultFilters = (): Filters => ({
  status: "",
  severity: "",
  source: "",
  issueCode: "",
  from: businessDate(-30),
  to: businessDate(0)
});

function buildQuery(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }
  return params.toString();
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function formatNumber(value: unknown, digits = 0) {
  const numberValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numberValue)
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(numberValue)
    : "—";
}

function payloadRecord(issue: DataQualityIssue): Record<string, unknown> {
  return issue.payload && typeof issue.payload === "object" && !Array.isArray(issue.payload)
    ? issue.payload as Record<string, unknown>
    : {};
}

function payloadText(issue: DataQualityIssue, key: string) {
  const value = payloadRecord(issue)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function payloadNumber(issue: DataQualityIssue, key: string) {
  const value = payloadRecord(issue)[key];
  const numberValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function DataQualityPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [issues, setIssues] = useState<IssueList | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(null);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"resolve" | "ignore" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);
  const canManage = currentUser?.permissions.includes("settings.manage") ?? false;
  const businessCentralIssues = useMemo(
    () => issues?.rows.filter((issue) => issue.sourceSystem === "business-central" && issue.issueCode.startsWith("BC_")).slice(0, 8) ?? [],
    [issues]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!me.ok) return;
      setCurrentUser(me.data.user);
      if (!me.data.user.permissions.includes("data_quality.view")) return;
      const [summaryResponse, issuesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/data-quality/summary`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/data-quality/issues?${query}`, { credentials: "include" })
      ]);
      const summaryPayload = (await summaryResponse.json()) as ApiResult<IssueSummary>;
      const issuesPayload = (await issuesResponse.json()) as ApiResult<IssueList>;
      if (!summaryPayload.ok) setError(summaryPayload.error.message);
      else setSummary(summaryPayload.data);
      if (!issuesPayload.ok) setError(issuesPayload.error.message);
      else {
        setIssues(issuesPayload.data);
        setSelectedIssue((current) =>
          current ? issuesPayload.data.rows.find((issue) => issue.id === current.id) ?? current : null
        );
      }
    } catch {
      setError("Data quality cockpit tidak dapat dijangkau. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function openIssue(id: string) {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/data-quality/issues/${id}`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<DataQualityIssue>;
      if (!payload.ok) setError(payload.error.message);
      else {
        setSelectedIssue(payload.data);
        setNote(payload.data.resolutionNote ?? "");
      }
    } catch {
      setError("Detail issue tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
    }
  }

  async function changeStatus(action: "acknowledge" | "resolve" | "ignore" | "reopen") {
    if (!selectedIssue || saving) return;
    if (["resolve", "ignore"].includes(action) && note.trim().length < 3) {
      setError("Tambahkan catatan minimal 3 karakter untuk resolve atau ignore.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/data-quality/issues/${selectedIssue.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "reopen" ? {} : { note: note.trim() || undefined })
      });
      const payload = (await response.json()) as ApiResult<DataQualityIssue>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setSelectedIssue(payload.data);
      setPendingAction(null);
      setNote(payload.data.resolutionNote ?? "");
      toast(`Issue ${payload.data.issueCode} diperbarui menjadi ${payload.data.status}.`);
      await load();
    } catch {
      setError("Status issue tidak dapat diperbarui. Catatan Anda tetap tersimpan di formulir; coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function generateBusinessCentralIssues() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/data-quality/business-central/generate`, {
        method: "POST",
        credentials: "include"
      });
      const payload = (await response.json()) as ApiResult<BusinessCentralGenerateSummary>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      const totalChanged = payload.data.created + payload.data.updated + payload.data.resolved;
      toast(`Business Central DQ generated: ${totalChanged} berubah, ${payload.data.unchanged} tetap.`);
      setDraftFilters((value) => ({ ...value, source: "business-central", issueCode: "" }));
      setFilters((value) => ({ ...value, source: "business-central", issueCode: "" }));
      setPage(1);
      await load();
    } catch {
      setError("Generate issue Business Central gagal. Coba lagi setelah koneksi API normal.");
    } finally {
      setGenerating(false);
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  return (
    <PermissionGate user={currentUser} permission="data_quality.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader
          eyebrow="Operations / Data trust"
          title="Data Quality Cockpit"
          description="Tinjau anomali sumber, pahami dampaknya, dan kelola status penyelesaian dengan jejak audit."
          meta={<><SourceBadge>OData + Import Center</SourceBadge>{summary ? <StatusBadge status={summary.criticalIssues ? "CRITICAL" : summary.openIssues ? "WARNING" : "HEALTHY"} /> : null}</>}
          actions={<><button className="secondary-button" disabled={loading || generating} onClick={() => void load()}><Icons.refresh />{loading ? "Memuat…" : "Refresh"}</button>{canManage ? <button disabled={generating} onClick={() => void generateBusinessCentralIssues()}><Icons.sync />{generating ? "Generating…" : "Generate BC issues"}</button> : null}</>}
        />

        {summary ? (
          <>
            <section className="metric-grid metric-grid-five">
              <MetricCard icon={<Icons.alert />} label="Open" value={String(summary.openIssues)} detail="Belum ditangani" tone={summary.openIssues ? "warning" : "success"} />
              <MetricCard icon={<Icons.quality />} label="Acknowledged" value={String(summary.acknowledgedIssues)} detail="Sedang ditinjau" tone="info" />
              <MetricCard icon={<Icons.check />} label="Resolved" value={String(summary.resolvedIssues)} detail="Selesai dengan catatan" tone="success" />
              <MetricCard icon={<Icons.close />} label="Ignored" value={String(summary.ignoredIssues)} detail="Dikecualikan secara sadar" />
              <MetricCard icon={<Icons.alert />} label="Critical open" value={String(summary.criticalIssues)} detail="Perlu prioritas segera" tone={summary.criticalIssues ? "danger" : "success"} />
            </section>
            <section className="insight-grid">
              <InsightCard icon={<Icons.quality />} title="Severity distribution" value={`${summary.openIssues + summary.acknowledgedIssues} active`} description="Active berarti issue OPEN atau ACKNOWLEDGED." rows={[
                { label: "Critical", value: summary.criticalIssues, tone: "danger" },
                { label: "High", value: summary.highIssues, tone: "danger" },
                { label: "Warning", value: summary.warningIssues, tone: "warning" },
                { label: "Medium", value: summary.mediumIssues, tone: "warning" },
                { label: "Low", value: summary.lowIssues, tone: "info" },
                { label: "Info", value: summary.infoIssues, tone: "info" }
              ]} />
              <InsightCard icon={<Icons.filter />} title="Top issue categories" value={`${summary.byCode.length} categories`} description="Kategori berdasarkan issue aktual yang tersimpan." rows={summary.byCode.slice(0, 5).map((row) => ({
                label: row.issueCode.replaceAll("_", " "),
                value: row.issueCount,
                tone: row.issueCode.includes("MISSING") || row.issueCode.includes("UNKNOWN") ? "warning" : "neutral"
              }))} />
            </section>
          </>
        ) : null}

        <FilterBar compact actions={<><button className="secondary-button" onClick={() => { const next = defaultFilters(); setDraftFilters(next); setFilters(next); setPage(1); }}>Reset</button><button onClick={() => { setFilters(draftFilters); setPage(1); }}>Apply</button></>}>
          <Field label="Status"><select value={draftFilters.status} onChange={(event) => setDraftFilters((value) => ({ ...value, status: event.target.value }))}><option value="">All</option><option value="OPEN">Open</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option></select></Field>
          <Field label="Severity"><select value={draftFilters.severity} onChange={(event) => setDraftFilters((value) => ({ ...value, severity: event.target.value }))}><option value="">All</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="WARNING">Warning</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="INFO">Info</option></select></Field>
          <Field label="Source"><input placeholder="business-central" value={draftFilters.source} onChange={(event) => setDraftFilters((value) => ({ ...value, source: event.target.value }))} /></Field>
          <Field label="Issue type"><input placeholder="UNKNOWN_MACHINE" value={draftFilters.issueCode} onChange={(event) => setDraftFilters((value) => ({ ...value, issueCode: event.target.value }))} /></Field>
          <Field label="From"><input type="date" value={draftFilters.from} onChange={(event) => setDraftFilters((value) => ({ ...value, from: event.target.value }))} /></Field>
          <Field label="To"><input type="date" value={draftFilters.to} onChange={(event) => setDraftFilters((value) => ({ ...value, to: event.target.value }))} /></Field>
        </FilterBar>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {businessCentralIssues.length ? (
          <section>
            <SectionHeader title="Business Central generated issues" description="Issue otomatis dari mapping, target, dan reject diagnostics." />
            <DataTable headers={["Issue type", "Severity", "Source / entity", "Rows", "OK qty", "Recommended action", "Updated"]}>
              {businessCentralIssues.map((issue) => {
                const sourceValue = payloadText(issue, "sourceValue") ?? issue.sourceRef ?? "—";
                const entityName = payloadText(issue, "entityName") ?? payloadText(issue, "entityCode");
                const recommendedAction = payloadText(issue, "recommendedAction") ?? issue.description;
                return (
                  <tr
                    key={`bc-${issue.id}`}
                    onClick={() => void openIssue(issue.id)}
                    style={{ cursor: "pointer" }}
                    tabIndex={0}
                  >
                    <td><strong>{issue.issueCode.replaceAll("_", " ")}</strong><small>{payloadText(issue, "targetReason") ?? payloadText(issue, "conversionGapReason") ?? issue.status}</small></td>
                    <td><StatusBadge status={issue.severity} /></td>
                    <td>{sourceValue}<small>{entityName ?? issue.sourceRef ?? "business-central"}</small></td>
                    <td>{formatNumber(payloadNumber(issue, "rowCount"))}</td>
                    <td>{formatNumber(payloadNumber(issue, "okQty"), 1)}</td>
                    <td>{recommendedAction}</td>
                    <td>{formatDate(issue.updatedAt)}</td>
                  </tr>
                );
              })}
            </DataTable>
          </section>
        ) : null}

        <section className={`master-detail-layout${selectedIssue ? " has-detail" : ""}`}>
          <div>
            <SectionHeader title="Issue register" description="Klik baris untuk melihat penjelasan dan konteks sumber." />
            {!issues || issues.rows.length === 0 ? (
              <EmptyState title="Tidak ada issue" description="Tidak ada data quality issue yang sesuai dengan filter." />
            ) : (
              <>
                <DataTable headers={["Severity", "Issue", "Source", "Entity", "Status", "Updated"]}>
                  {issues.rows.map((issue) => (
                    <tr
                      className={selectedIssue?.id === issue.id ? "selected-row" : ""}
                      key={issue.id}
                      onClick={() => void openIssue(issue.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openIssue(issue.id);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                    >
                      <td><StatusBadge status={issue.severity} /></td>
                      <td><strong>{issue.issueCode.replaceAll("_", " ")}</strong><small>{issue.description}</small></td>
                      <td>{issue.sourceSystem ?? "—"}<small>{issue.sourceRef ?? "No source ref"}</small></td>
                      <td>{issue.entityType.replaceAll("_", " ")}<small>{issue.entityId ?? "No entity ID"}</small></td>
                      <td><StatusBadge status={issue.status} /></td>
                      <td>{formatDate(issue.updatedAt)}</td>
                    </tr>
                  ))}
                </DataTable>
                <Pagination page={issues.pagination.page} totalPages={issues.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
              </>
            )}
          </div>

          {selectedIssue ? (
            <aside className="detail-panel">
              <div className="detail-panel-header"><div><p className="eyebrow">Issue detail</p><h2>{selectedIssue.issueCode.replaceAll("_", " ")}</h2></div><button className="icon-button" aria-label="Tutup detail" onClick={() => setSelectedIssue(null)}><Icons.close /></button></div>
              <div className="detail-badges"><StatusBadge status={selectedIssue.severity} /><StatusBadge status={selectedIssue.status} /><SourceBadge>{selectedIssue.sourceSystem ?? "Unknown source"}</SourceBadge></div>
              <div className="detail-section"><h3>What this means</h3><p>{selectedIssue.explanation}</p></div>
              <dl className="detail-facts">
                <div><dt>Source reference</dt><dd>{selectedIssue.sourceRef ?? "—"}</dd></div>
                <div><dt>Entity</dt><dd>{selectedIssue.entityType} · {selectedIssue.entityId ?? "unmapped"}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(selectedIssue.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(selectedIssue.updatedAt)}</dd></div>
                <div><dt>Last status update</dt><dd>{formatDate(selectedIssue.resolvedAt)}</dd></div>
              </dl>
              <div className="detail-section"><h3>Source context</h3><pre className="json-view">{JSON.stringify(selectedIssue.payload, null, 2)}</pre></div>
              {selectedIssue.resolutionNote ? <div className="detail-section"><h3>Resolution note</h3><p>{selectedIssue.resolutionNote}</p></div> : null}
              {canManage ? (
                <div className="detail-section">
                  <Field label="Operational note" helper="Wajib untuk resolve atau ignore."><textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
                  <div className="detail-actions">
                    {selectedIssue.status === "OPEN" ? <button className="secondary-button" disabled={saving} onClick={() => void changeStatus("acknowledge")}>Acknowledge</button> : null}
                    {["OPEN", "ACKNOWLEDGED"].includes(selectedIssue.status) ? <><button disabled={saving} onClick={() => setPendingAction("resolve")}>Resolve</button><button className="secondary-button" disabled={saving} onClick={() => setPendingAction("ignore")}>Ignore</button></> : null}
                    {["RESOLVED", "IGNORED"].includes(selectedIssue.status) ? <button className="secondary-button" disabled={saving} onClick={() => void changeStatus("reopen")}>Reopen</button> : null}
                  </div>
                </div>
              ) : <p className="permission-note">Status changes require system management permission.</p>}
            </aside>
          ) : null}
        </section>

        <ConfirmDialog
          open={Boolean(pendingAction)}
          title={pendingAction === "resolve" ? "Resolve this issue?" : "Ignore this issue?"}
          description={pendingAction === "resolve" ? "Issue will leave the active queue and the note will explain how it was corrected." : "Issue will be excluded from the active queue without changing source data. The note documents why it is acceptable."}
          confirmLabel={pendingAction === "resolve" ? "Resolve issue" : "Ignore issue"}
          tone={pendingAction === "ignore" ? "danger" : "primary"}
          busy={saving}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => { if (pendingAction) void changeStatus(pendingAction); }}
        />
      </div>
    </PermissionGate>
  );
}
