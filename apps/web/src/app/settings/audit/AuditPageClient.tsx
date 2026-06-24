"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "../../../components/Icons";
import { ForbiddenState, PermissionGate } from "../../../components/PermissionGate";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  Pagination,
  SectionHeader,
  SourceBadge,
  StatusBadge
} from "../../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../../lib/api";

interface AuditEvent {
  readonly id: string;
  readonly requestId: string | null;
  readonly actor: { readonly id: string; readonly name: string; readonly email: string | null } | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly summary: string;
  readonly changedFields: readonly string[];
  readonly beforeValue: unknown;
  readonly afterValue: unknown;
  readonly createdAt: string;
}

interface AuditList {
  readonly rows: readonly AuditEvent[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

interface Filters {
  readonly entityType: string;
  readonly action: string;
  readonly actor: string;
  readonly entityId: string;
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
  entityType: "",
  action: "",
  actor: "",
  entityId: "",
  from: businessDate(-30),
  to: businessDate(0)
});

function buildQuery(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
  return params.toString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function AuditPageClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [events, setEvents] = useState<AuditList | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!me.ok) return;
      setCurrentUser(me.data.user);
      if (!me.data.user.permissions.includes("audit.view")) return;
      const response = await fetch(`${API_BASE_URL}/audit?${query}`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<AuditList>;
      if (!payload.ok) setError(payload.error.message);
      else {
        setEvents(payload.data);
        setSelected((current) => current ? payload.data.rows.find((event) => event.id === current.id) ?? current : null);
      }
    } catch {
      setError("Audit viewer tidak dapat dijangkau. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function openEvent(id: string) {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/audit/${id}`, { credentials: "include" });
      const payload = (await response.json()) as ApiResult<AuditEvent>;
      if (!payload.ok) setError(payload.error.message);
      else setSelected(payload.data);
    } catch {
      setError("Detail audit tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
    }
  }

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  return (
    <PermissionGate user={currentUser} permission="audit.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader
          eyebrow="Settings / Governance"
          title="Audit Viewer"
          description="Jejak perubahan append-only untuk aktivitas operasional dan administrasi."
          meta={<><SourceBadge>Redacted safe view</SourceBadge><StatusBadge status="HEALTHY" label="Read only" /></>}
          actions={<button className="secondary-button" disabled={loading} onClick={() => void load()}><Icons.refresh />{loading ? "Memuat…" : "Refresh"}</button>}
        />

        <section className="metric-grid">
          <MetricCard icon={<Icons.audit />} label="Events found" value={String(events?.pagination.totalRows ?? 0)} detail="Within selected filters" tone="info" />
          <MetricCard icon={<Icons.users />} label="Latest actor" value={events?.rows[0]?.actor?.name ?? "System"} detail={events?.rows[0] ? formatDate(events.rows[0].createdAt) : "No activity"} />
          <MetricCard icon={<Icons.database />} label="Latest module" value={events?.rows[0]?.entityType.replaceAll("_", " ") ?? "—"} detail={events?.rows[0]?.action ?? "No action"} />
          <MetricCard icon={<Icons.quality />} label="Data handling" value="Redacted" detail="Secrets and raw source payloads are hidden" tone="success" />
        </section>

        <FilterBar compact actions={<><button className="secondary-button" onClick={() => { const next = defaultFilters(); setDraftFilters(next); setFilters(next); setPage(1); }}>Reset</button><button onClick={() => { setFilters(draftFilters); setPage(1); }}>Apply</button></>}>
          <Field label="Module / entity"><input placeholder="downtime_event" value={draftFilters.entityType} onChange={(event) => setDraftFilters((value) => ({ ...value, entityType: event.target.value }))} /></Field>
          <Field label="Action"><input placeholder="approve / update" value={draftFilters.action} onChange={(event) => setDraftFilters((value) => ({ ...value, action: event.target.value }))} /></Field>
          <Field label="Actor"><input placeholder="Name or email" value={draftFilters.actor} onChange={(event) => setDraftFilters((value) => ({ ...value, actor: event.target.value }))} /></Field>
          <Field label="Entity ID"><input placeholder="ID contains…" value={draftFilters.entityId} onChange={(event) => setDraftFilters((value) => ({ ...value, entityId: event.target.value }))} /></Field>
          <Field label="From"><input type="date" value={draftFilters.from} onChange={(event) => setDraftFilters((value) => ({ ...value, from: event.target.value }))} /></Field>
          <Field label="To"><input type="date" value={draftFilters.to} onChange={(event) => setDraftFilters((value) => ({ ...value, to: event.target.value }))} /></Field>
        </FilterBar>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <section className={`master-detail-layout${selected ? " has-detail" : ""}`}>
          <div>
            <SectionHeader title="Activity log" description="Klik event untuk melihat perubahan sebelum dan sesudah." />
            {!events || events.rows.length === 0 ? (
              <EmptyState title="Tidak ada audit event" description="Tidak ada aktivitas yang sesuai dengan filter." />
            ) : (
              <>
                <DataTable headers={["Time", "Actor", "Action", "Entity", "Summary", "Changed"]}>
                  {events.rows.map((event) => (
                    <tr
                      className={selected?.id === event.id ? "selected-row" : ""}
                      key={event.id}
                      onClick={() => void openEvent(event.id)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          void openEvent(event.id);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                    >
                      <td>{formatDate(event.createdAt)}</td>
                      <td><strong>{event.actor?.name ?? "System"}</strong><small>{event.actor?.email ?? "Automated action"}</small></td>
                      <td><SourceBadge>{event.action}</SourceBadge></td>
                      <td>{event.entityType.replaceAll("_", " ")}<small>{event.entityId ?? "No entity ID"}</small></td>
                      <td>{event.summary}</td>
                      <td>{event.changedFields.length ? event.changedFields.slice(0, 3).join(", ") : "—"}</td>
                    </tr>
                  ))}
                </DataTable>
                <Pagination page={events.pagination.page} totalPages={events.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
              </>
            )}
          </div>

          {selected ? (
            <aside className="detail-panel">
              <div className="detail-panel-header"><div><p className="eyebrow">Audit detail</p><h2>{selected.action}</h2></div><button className="icon-button" aria-label="Tutup detail" onClick={() => setSelected(null)}><Icons.close /></button></div>
              <p className="activity-summary">{selected.summary}</p>
              <dl className="detail-facts">
                <div><dt>Timestamp</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                <div><dt>Actor</dt><dd>{selected.actor?.name ?? "System"} · {selected.actor?.email ?? "automated"}</dd></div>
                <div><dt>Entity</dt><dd>{selected.entityType} · {selected.entityId ?? "—"}</dd></div>
                <div><dt>Request ID</dt><dd>{selected.requestId ?? "—"}</dd></div>
              </dl>
              <div className="detail-section"><h3>Changed fields</h3><div className="detail-badges">{selected.changedFields.length ? selected.changedFields.map((field) => <SourceBadge key={field}>{field}</SourceBadge>) : <span>Not available</span>}</div></div>
              <div className="audit-diff">
                <div><h3>Before</h3><pre className="json-view">{JSON.stringify(selected.beforeValue, null, 2) ?? "null"}</pre></div>
                <div><h3>After</h3><pre className="json-view">{JSON.stringify(selected.afterValue, null, 2) ?? "null"}</pre></div>
              </div>
              <p className="permission-note">Passwords, credentials, tokens, raw source payloads, and source text are redacted by the API.</p>
            </aside>
          ) : null}
        </section>
      </div>
    </PermissionGate>
  );
}
