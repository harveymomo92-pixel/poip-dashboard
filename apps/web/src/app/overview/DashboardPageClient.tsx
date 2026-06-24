"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "../../components/Icons";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
import { useToast } from "../../components/Toast";
import {
  ChartCard,
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

interface DashboardSummary {
  readonly kpis: {
    readonly outputOkQty: number;
    readonly prorataTarget: number;
    readonly achievementPct: number | null;
    readonly targetStatus: string;
    readonly rejectKg: number;
    readonly rejectPcsEquivalent: number;
    readonly rejectRatePct: number | null;
    readonly incompleteRejectConversionCount: number;
  };
  readonly dataFreshness: {
    readonly status: string;
    readonly freshnessMinutes: number | null;
    readonly latestSuccessfulSyncFinishedAt: string | null;
  };
  readonly targetCoverage: { readonly activeEntityDays: number; readonly missingTargetEntityDays: number };
  readonly dataQuality: {
    readonly openIssues: number;
    readonly criticalIssues: number;
    readonly warningIssues: number;
    readonly byCode: readonly { issueCode: string; count: number }[];
  };
  readonly downtime: {
    readonly totalDurationMinutes: number;
    readonly openEventCount: number;
    readonly eventCount: number;
    readonly topCategories: readonly { readonly category: string; readonly durationMinutes: number; readonly eventCount: number }[];
    readonly topEntities: readonly { readonly label: string; readonly durationMinutes: number; readonly eventCount: number }[];
  };
}

interface TrendRow {
  readonly postingDate: string;
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly prorataTarget: number;
}

interface BreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly rowCount: number;
}

interface OutputRow {
  readonly id: string;
  readonly entryNo: string | null;
  readonly postingDate: string;
  readonly itemNo: string;
  readonly machineCenterNo: string | null;
  readonly shiftCode: string | null;
  readonly normalizedOutputType: string;
  readonly quantity: number;
  readonly rejectKg: number;
}

interface OutputList {
  readonly rows: readonly OutputRow[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

interface Filters {
  readonly from: string;
  readonly to: string;
  readonly machineCenterNo: string;
  readonly itemNo: string;
  readonly shiftCode: string;
}

function businessDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const defaultFilters = (): Filters => ({
  from: businessDate(-6),
  to: businessDate(0),
  machineCenterNo: "",
  itemNo: "",
  shiftCode: ""
});

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);

const formatPct = (value: number | null) => value === null ? "N/A" : `${formatNumber(value, 1)}%`;
const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Belum pernah sync";

function buildQuery(filters: Filters, page = 1) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    page: String(page),
    pageSize: "10"
  });
  if (filters.machineCenterNo.trim()) params.set("machineCenterNo", filters.machineCenterNo.trim());
  if (filters.itemNo.trim()) params.set("itemNo", filters.itemNo.trim());
  if (filters.shiftCode.trim()) params.set("shiftCode", filters.shiftCode.trim());
  return params.toString();
}

export function DashboardPageClient() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<readonly TrendRow[]>([]);
  const [breakdowns, setBreakdowns] = useState<readonly BreakdownRow[]>([]);
  const [outputs, setOutputs] = useState<OutputList | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(filters, page), [filters, page]);
  const maxTrendValue = useMemo(
    () => Math.max(1, ...trends.flatMap((trend) => [trend.outputOkQty, trend.prorataTarget])),
    [trends]
  );
  const maxMachineOutput = useMemo(
    () => Math.max(1, ...breakdowns.map((row) => row.outputOkQty)),
    [breakdowns]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("poip.overview.filters");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Filters;
      setDraftFilters(parsed);
      setFilters(parsed);
    } catch {
      window.localStorage.removeItem("poip.overview.filters");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!me.ok) return;
      setCurrentUser(me.data.user);
      if (!me.data.user.permissions.includes("dashboard.view")) return;

      const [summaryResponse, trendsResponse, breakdownResponse, outputsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary?${query}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/dashboard/trends?${query}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/dashboard/breakdowns?${query}&groupBy=machine`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/outputs?${query}`, { credentials: "include" })
      ]);
      const [summaryPayload, trendPayload, breakdownPayload, outputsPayload] = await Promise.all([
        summaryResponse.json() as Promise<ApiResult<DashboardSummary>>,
        trendsResponse.json() as Promise<ApiResult<readonly TrendRow[]>>,
        breakdownResponse.json() as Promise<ApiResult<readonly BreakdownRow[]>>,
        outputsResponse.json() as Promise<ApiResult<OutputList>>
      ]);

      if (!summaryPayload.ok) setError(`${summaryPayload.error.message} Coba muat ulang dashboard.`);
      else setSummary(summaryPayload.data);
      if (trendPayload.ok) setTrends(trendPayload.data);
      if (breakdownPayload.ok) setBreakdowns(breakdownPayload.data);
      if (outputsPayload.ok) setOutputs(outputsPayload.data);
    } catch {
      setError("Dashboard tidak dapat dijangkau. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  function applyFilters() {
    setPage(1);
    setFilters(draftFilters);
    window.localStorage.setItem("poip.overview.filters", JSON.stringify(draftFilters));
  }

  function resetFilters() {
    const next = defaultFilters();
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
    window.localStorage.removeItem("poip.overview.filters");
  }

  async function copyOutputReference(row: OutputRow) {
    const reference = row.entryNo ?? row.id;
    try {
      await navigator.clipboard.writeText(reference);
      toast(`Referensi output ${reference} disalin.`);
    } catch {
      toast("Referensi tidak dapat disalin dari browser ini.", "error");
    }
  }

  const freshnessTone =
    summary?.dataFreshness.status === "FRESH" || summary?.dataFreshness.status === "HEALTHY"
      ? "success"
      : summary?.dataFreshness.status === "STALE"
        ? "warning"
        : "danger";
  const targetTone =
    summary?.kpis.targetStatus === "NO_TARGET"
      ? "danger"
      : summary?.kpis.targetStatus === "BELOW_TARGET"
        ? "warning"
        : summary?.kpis.targetStatus === "ABOVE_TARGET"
          ? "info"
          : "success";
  const topBreakdowns = breakdowns.slice(0, 6);

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;

  return (
    <PermissionGate user={currentUser} permission="dashboard.view" fallback={<ForbiddenState />}>
      <div className="page overview-page">
        <PageHeader
          className="page-header-compact"
          eyebrow="Dashboard / Operations cockpit"
          title="Production Overview"
          description="Output, target, reject, downtime, dan kualitas data dalam satu tampilan operasional."
          meta={
            <>
              <SourceBadge>Business Central OData</SourceBadge>
              {summary ? <StatusBadge status={summary.dataFreshness.status} /> : null}
              <span className="info-pill"><Icons.database />Last sync: {formatDateTime(summary?.dataFreshness.latestSuccessfulSyncFinishedAt ?? null)}</span>
            </>
          }
          actions={
            <button className="secondary-button" disabled={loading} onClick={() => void load()}>
              <Icons.refresh /> {loading ? "Memperbarui…" : "Refresh"}
            </button>
          }
        />

        <FilterBar compact actions={<><button className="secondary-button" onClick={resetFilters}>Reset</button><button onClick={applyFilters}>Apply filters</button></>}>
          <Field label="From"><input type="date" value={draftFilters.from} onChange={(event) => setDraftFilters((value) => ({ ...value, from: event.target.value }))} /></Field>
          <Field label="To"><input type="date" value={draftFilters.to} onChange={(event) => setDraftFilters((value) => ({ ...value, to: event.target.value }))} /></Field>
          <Field label="Machine / entity"><input placeholder="All machines" value={draftFilters.machineCenterNo} onChange={(event) => setDraftFilters((value) => ({ ...value, machineCenterNo: event.target.value }))} /></Field>
          <Field label="Item"><input placeholder="All items" value={draftFilters.itemNo} onChange={(event) => setDraftFilters((value) => ({ ...value, itemNo: event.target.value }))} /></Field>
          <Field label="Shift"><input placeholder="All shifts" value={draftFilters.shiftCode} onChange={(event) => setDraftFilters((value) => ({ ...value, shiftCode: event.target.value }))} /></Field>
        </FilterBar>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {summary ? (
          <section className="metric-grid" aria-label="KPI operasional">
            <MetricCard icon={<Icons.output />} label="OK Output" value={formatNumber(summary.kpis.outputOkQty, 1)} detail="Good output in selected period" tone="success" />
            <MetricCard icon={<Icons.target />} label="Target" value={formatNumber(summary.kpis.prorataTarget, 1)} detail={summary.kpis.targetStatus === "NO_TARGET" ? <StatusBadge status="NO_TARGET" label="Target missing" /> : "Prorated production target"} tone={targetTone} />
            <MetricCard icon={<Icons.achievement />} label="Achievement" value={formatPct(summary.kpis.achievementPct)} detail={<StatusBadge status={summary.kpis.targetStatus} />} tone={targetTone} />
            <MetricCard icon={<Icons.scale />} label="Reject KG" value={formatNumber(summary.kpis.rejectKg, 2)} detail="Recorded reject weight" tone={summary.kpis.rejectKg > 0 ? "warning" : "neutral"} />
            <MetricCard icon={<Icons.reject />} label="Reject PCS Eq" value={formatNumber(summary.kpis.rejectPcsEquivalent, 1)} detail={summary.kpis.incompleteRejectConversionCount ? `${summary.kpis.incompleteRejectConversionCount} conversion gaps` : "Conversion complete"} tone={summary.kpis.incompleteRejectConversionCount ? "warning" : "neutral"} />
            <MetricCard icon={<Icons.percent />} label="Reject Rate" value={formatPct(summary.kpis.rejectRatePct)} detail="Reject against total production" tone="info" />
            <MetricCard icon={<Icons.downtime />} label="Downtime" value={`${formatNumber(summary.downtime.totalDurationMinutes)} min`} detail={`${summary.downtime.openEventCount} events still open`} tone={summary.downtime.openEventCount ? "warning" : "neutral"} />
            <MetricCard icon={<Icons.database />} label="Freshness" value={summary.dataFreshness.freshnessMinutes === null ? "Never synced" : `${summary.dataFreshness.freshnessMinutes} min`} detail={<StatusBadge status={summary.dataFreshness.status} />} tone={freshnessTone} />
          </section>
        ) : !loading ? (
          <EmptyState title="Belum ada data dashboard" description="Ubah rentang tanggal atau pastikan sinkronisasi sudah berhasil." />
        ) : <LoadingSkeleton rows={4} />}

        <section className="cockpit-grid">
          <ChartCard
            title="Output vs target"
            description={`${filters.from} — ${filters.to}`}
            legend={<><span className="legend-item"><i />OK output</span><span className="legend-item legend-item-target"><i />Target</span></>}
            action={<div className="timeframe-pills" aria-label="Rentang aktif"><span className="active">Range</span></div>}
          >
            {trends.length === 0 ? (
              <EmptyState title="Trend belum tersedia" description="Belum ada output harian untuk filter ini." />
            ) : (
              <div className="trend-columns" aria-label="Grafik output dan target harian">
                {trends.map((trend) => (
                  <div className="trend-column" key={trend.postingDate} title={`${trend.postingDate}: output ${formatNumber(trend.outputOkQty)}, target ${formatNumber(trend.prorataTarget)}`}>
                    <div className="trend-bars">
                      <i className="trend-bar" style={{ height: `${Math.max(2, (trend.outputOkQty / maxTrendValue) * 100)}%` }} />
                      <i className="trend-bar trend-bar-target" style={{ height: `${Math.max(2, (trend.prorataTarget / maxTrendValue) * 100)}%` }} />
                    </div>
                    <small>{trend.postingDate.slice(5)}</small>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Machine output" description="Top entities by OK output">
            {topBreakdowns.length === 0 ? (
              <EmptyState title="Breakdown belum tersedia" description="Tidak ada data mesin pada filter ini." />
            ) : (
              <div className="machine-chart">
                {topBreakdowns.map((row) => (
                  <div className="machine-chart-row" key={row.key} title={`${row.label}: ${formatNumber(row.outputOkQty, 1)} OK`}>
                    <span>{row.label}</span>
                    <div><i style={{ width: `${Math.max(3, (row.outputOkQty / maxMachineOutput) * 100)}%` }} /></div>
                    <strong>{formatNumber(row.outputOkQty)}</strong>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <aside className="insight-stack" aria-label="Operational insights">
            {summary ? (
              <>
                <InsightCard
                  icon={<Icons.quality />}
                  title="Data Quality"
                  value={`${summary.dataQuality.openIssues} open issues`}
                  tone={summary.dataQuality.criticalIssues ? "danger" : summary.dataQuality.warningIssues ? "warning" : "success"}
                  description={summary.dataQuality.openIssues === 0 ? "No unresolved quality issues in this scope." : "Review critical issues and target coverage before the daily meeting."}
                  rows={[
                    { label: "Critical", value: summary.dataQuality.criticalIssues, tone: "danger" },
                    { label: "Warning", value: summary.dataQuality.warningIssues, tone: "warning" },
                    { label: "Missing target days", value: summary.targetCoverage.missingTargetEntityDays, tone: summary.targetCoverage.missingTargetEntityDays ? "danger" : "success" }
                  ]}
                >
                  <StatusBadge status={summary.dataQuality.criticalIssues ? "CRITICAL" : summary.dataQuality.warningIssues ? "WARNING" : "HEALTHY"} />
                </InsightCard>
                <InsightCard
                  icon={<Icons.downtime />}
                  title="Downtime Summary"
                  value={`${summary.downtime.totalDurationMinutes} minutes`}
                  tone={summary.downtime.openEventCount ? "warning" : "success"}
                  description={summary.downtime.eventCount === 0 ? "No downtime recorded in this period." : `Top cause: ${summary.downtime.topCategories[0]?.category ?? "Not categorized"}.`}
                  rows={[
                    { label: "Open events", value: summary.downtime.openEventCount, tone: summary.downtime.openEventCount ? "warning" : "success" },
                    { label: "Total events", value: summary.downtime.eventCount, tone: "info" },
                    { label: "Top entity", value: summary.downtime.topEntities[0]?.label ?? "—", tone: "neutral" }
                  ]}
                  action={<Link className="insight-link" href="/downtime">Open downtime center <Icons.arrowRight /></Link>}
                >
                  <StatusBadge status={summary.downtime.openEventCount ? "OPEN" : "CLOSED"} label={`${summary.downtime.openEventCount} open`} />
                </InsightCard>
              </>
            ) : <LoadingSkeleton rows={2} />}
          </aside>
        </section>

        <section className="table-card">
          <SectionHeader title="Latest production outputs" description="Source transactions behind the KPI summary." actions={outputs ? <SourceBadge>{outputs.pagination.totalRows} rows</SourceBadge> : null} />
          {!outputs || outputs.rows.length === 0 ? (
            <EmptyState title="Tidak ada output terbaru" description="Tidak ada transaksi output yang sesuai dengan filter saat ini." />
          ) : (
            <>
              <DataTable headers={["Date", "Entry", "Item", "Machine", "Shift", "Status", "Qty", "Reject", ""]}>
                {outputs.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.postingDate}</td>
                    <td>{row.entryNo ?? "—"}</td>
                    <td><strong>{row.itemNo}</strong></td>
                    <td>{row.machineCenterNo ?? "—"}</td>
                    <td>{row.shiftCode ?? "—"}</td>
                    <td><StatusBadge status={row.normalizedOutputType === "OK" ? "HEALTHY" : "WARNING"} label={row.normalizedOutputType} /></td>
                    <td><strong>{formatNumber(row.quantity, 1)}</strong></td>
                    <td>{formatNumber(row.rejectKg, 2)} kg</td>
                    <td><button className="table-icon-button" title="Copy source reference" onClick={() => void copyOutputReference(row)}><Icons.copy /></button></td>
                  </tr>
                ))}
              </DataTable>
              <Pagination page={outputs.pagination.page} totalPages={outputs.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
            </>
          )}
        </section>
      </div>
    </PermissionGate>
  );
}
