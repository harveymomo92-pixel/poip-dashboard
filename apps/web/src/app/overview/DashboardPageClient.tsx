"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
import { DataTable, EmptyState, ErrorState, Field, FilterBar, InsightCard, LoadingSkeleton, MetricCard, PageHeader, Pagination, SectionHeader, SourceBadge, StatusBadge } from "../../components/ui";
import { API_BASE_URL, type ApiResult, type CurrentUser } from "../../lib/api";

interface DashboardSummary {
  readonly kpis: { readonly outputOkQty: number; readonly prorataTarget: number; readonly achievementPct: number | null; readonly targetStatus: string; readonly rejectKg: number; readonly rejectPcsEquivalent: number; readonly rejectRatePct: number | null; readonly incompleteRejectConversionCount: number; };
  readonly dataFreshness: { readonly status: string; readonly freshnessMinutes: number | null; readonly latestSuccessfulSyncFinishedAt: string | null; };
  readonly targetCoverage: { readonly activeEntityDays: number; readonly missingTargetEntityDays: number; };
  readonly dataQuality: { readonly openIssues: number; readonly criticalIssues: number; readonly warningIssues: number; readonly byCode: readonly { issueCode: string; count: number }[]; };
  readonly downtime: { readonly totalDurationMinutes: number; readonly openEventCount: number; readonly eventCount: number; readonly topCategories: readonly { readonly category: string; readonly durationMinutes: number; readonly eventCount: number; }[]; readonly topEntities: readonly { readonly label: string; readonly durationMinutes: number; readonly eventCount: number; }[]; };
}
interface TrendRow { readonly postingDate: string; readonly outputOkQty: number; readonly rejectKg: number; readonly prorataTarget: number; }
interface BreakdownRow { readonly key: string; readonly label: string; readonly outputOkQty: number; readonly rejectKg: number; readonly rowCount: number; }
interface OutputRow { readonly id: string; readonly entryNo: string | null; readonly postingDate: string; readonly itemNo: string; readonly machineCenterNo: string | null; readonly shiftCode: string | null; readonly normalizedOutputType: string; readonly quantity: number; readonly rejectKg: number; }
interface OutputList { readonly rows: readonly OutputRow[]; readonly pagination: { readonly page: number; readonly pageSize: number; readonly totalRows: number; readonly totalPages: number; }; }
interface Filters { readonly from: string; readonly to: string; readonly machineCenterNo: string; readonly itemNo: string; readonly shiftCode: string; }

function businessDate(offsetDays = 0): string {
  const date = new Date(); date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
const defaultFilters = (): Filters => ({ from: businessDate(-6), to: businessDate(0), machineCenterNo: "", itemNo: "", shiftCode: "" });
const formatNumber = (value: number, digits = 0) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const formatPct = (value: number | null) => value === null ? "N/A" : `${formatNumber(value, 1)}%`;
const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString("id-ID") : "Belum pernah disinkronkan";
function buildQuery(filters: Filters, page = 1) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to, page: String(page), pageSize: "10" });
  if (filters.machineCenterNo.trim()) params.set("machineCenterNo", filters.machineCenterNo.trim());
  if (filters.itemNo.trim()) params.set("itemNo", filters.itemNo.trim());
  if (filters.shiftCode.trim()) params.set("shiftCode", filters.shiftCode.trim());
  return params.toString();
}

export function DashboardPageClient() {
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
  const maxTrendOutput = useMemo(() => Math.max(1, ...trends.map((trend) => trend.outputOkQty)), [trends]);

  useEffect(() => {
    const saved = window.localStorage.getItem("poip.overview.filters");
    if (!saved) return;
    try { const parsed = JSON.parse(saved) as Filters; setDraftFilters(parsed); setFilters(parsed); } catch { window.localStorage.removeItem("poip.overview.filters"); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
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
        summaryResponse.json() as Promise<ApiResult<DashboardSummary>>, trendsResponse.json() as Promise<ApiResult<readonly TrendRow[]>>,
        breakdownResponse.json() as Promise<ApiResult<readonly BreakdownRow[]>>, outputsResponse.json() as Promise<ApiResult<OutputList>>
      ]);
      if (!summaryPayload.ok) setError(`${summaryPayload.error.message} Coba muat ulang dashboard.`);
      else setSummary(summaryPayload.data);
      if (trendPayload.ok) setTrends(trendPayload.data);
      if (breakdownPayload.ok) setBreakdowns(breakdownPayload.data);
      if (outputsPayload.ok) setOutputs(outputsPayload.data);
    } catch { setError("Dashboard tidak dapat dijangkau. Periksa koneksi lalu coba lagi."); }
    finally { setLoading(false); setLoaded(true); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  function applyFilters() { setPage(1); setFilters(draftFilters); window.localStorage.setItem("poip.overview.filters", JSON.stringify(draftFilters)); }
  function resetFilters() { const next = defaultFilters(); setDraftFilters(next); setFilters(next); setPage(1); window.localStorage.removeItem("poip.overview.filters"); }
  const freshnessTone = summary?.dataFreshness.status === "FRESH" || summary?.dataFreshness.status === "HEALTHY" ? "success" : summary?.dataFreshness.status === "STALE" ? "warning" : "danger";
  const targetTone = summary?.kpis.targetStatus === "NO_TARGET" ? "danger" : "success";

  if (!loaded) return <div className="page"><LoadingSkeleton rows={7} /></div>;
  return (
    <PermissionGate user={currentUser} permission="dashboard.view" fallback={<ForbiddenState />}>
      <div className="page">
        <PageHeader eyebrow="Dashboard" title="Operations Overview" description="Ringkasan output, target, reject, downtime, dan kualitas data untuk pengambilan keputusan harian." meta={<><SourceBadge>OData + operational workflows</SourceBadge>{summary ? <><StatusBadge status={summary.dataFreshness.status} /><span className="page-description">Terakhir diperbarui {formatDateTime(summary.dataFreshness.latestSuccessfulSyncFinishedAt)}</span></> : null}</>} actions={<button className="secondary-button" disabled={loading} onClick={() => void load()}>{loading ? "Memuat…" : "Segarkan data"}</button>} />
        <FilterBar actions={<><button className="secondary-button" onClick={resetFilters}>Reset</button><button onClick={applyFilters}>Terapkan filter</button></>}>
          <Field label="Dari tanggal" helper="Tanggal produksi, zona waktu Jakarta."><input type="date" value={draftFilters.from} onChange={(event) => setDraftFilters((value) => ({ ...value, from: event.target.value }))} /></Field>
          <Field label="Sampai tanggal" helper="Termasuk seluruh data pada tanggal ini."><input type="date" value={draftFilters.to} onChange={(event) => setDraftFilters((value) => ({ ...value, to: event.target.value }))} /></Field>
          <Field label="Mesin / entity" helper="Kosongkan untuk semua mesin."><input placeholder="Contoh: MC-01" value={draftFilters.machineCenterNo} onChange={(event) => setDraftFilters((value) => ({ ...value, machineCenterNo: event.target.value }))} /></Field>
          <Field label="Item" helper="Nomor item dari sumber produksi."><input placeholder="Nomor item" value={draftFilters.itemNo} onChange={(event) => setDraftFilters((value) => ({ ...value, itemNo: event.target.value }))} /></Field>
          <Field label="Shift" helper="Kode shift operasional."><input placeholder="A / B / N" value={draftFilters.shiftCode} onChange={(event) => setDraftFilters((value) => ({ ...value, shiftCode: event.target.value }))} /></Field>
        </FilterBar>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {loading && summary ? <p>Memperbarui data dashboard…</p> : null}
        {summary ? <>
          <section className="metric-grid" aria-label="KPI operasional">
            <MetricCard label="OK Output" value={formatNumber(summary.kpis.outputOkQty, 1)} detail="Kuantitas output OK dalam periode" tone="success" />
            <MetricCard label="Target" value={formatNumber(summary.kpis.prorataTarget, 1)} detail={summary.kpis.targetStatus === "NO_TARGET" ? <StatusBadge status="NO_TARGET" label="Target belum tersedia" /> : "Target prorata periode"} tone={targetTone} />
            <MetricCard label="Achievement" value={formatPct(summary.kpis.achievementPct)} detail={<StatusBadge status={summary.kpis.targetStatus} />} tone={targetTone} />
            <MetricCard label="Reject KG" value={formatNumber(summary.kpis.rejectKg, 2)} detail="Berat reject tercatat" tone={summary.kpis.rejectKg > 0 ? "warning" : "neutral"} />
            <MetricCard label="Reject PCS Eq" value={formatNumber(summary.kpis.rejectPcsEquivalent, 1)} detail={summary.kpis.incompleteRejectConversionCount ? `${summary.kpis.incompleteRejectConversionCount} konversi belum lengkap` : "Konversi lengkap"} tone={summary.kpis.incompleteRejectConversionCount ? "warning" : "neutral"} />
            <MetricCard label="Reject Rate" value={formatPct(summary.kpis.rejectRatePct)} detail="Reject terhadap total produksi" tone="info" />
            <MetricCard label="Downtime" value={`${formatNumber(summary.downtime.totalDurationMinutes)} min`} detail={`${summary.downtime.openEventCount} event masih terbuka`} tone={summary.downtime.openEventCount ? "warning" : "neutral"} />
            <MetricCard label="Freshness" value={summary.dataFreshness.freshnessMinutes === null ? "Belum sync" : `${summary.dataFreshness.freshnessMinutes} min`} detail={<StatusBadge status={summary.dataFreshness.status} />} tone={freshnessTone} />
          </section>
          <section className="insight-grid">
            <InsightCard title="Data Quality" value={`${summary.dataQuality.openIssues} isu terbuka`} tone={summary.dataQuality.criticalIssues ? "danger" : summary.dataQuality.warningIssues ? "warning" : "success"} description={summary.dataQuality.openIssues === 0 ? "Tidak ada isu kualitas data terbuka pada cakupan ini." : `${summary.dataQuality.criticalIssues} kritis dan ${summary.dataQuality.warningIssues} peringatan perlu ditinjau. ${summary.targetCoverage.missingTargetEntityDays} entity-day belum memiliki target.`}><StatusBadge status={summary.dataQuality.criticalIssues ? "CRITICAL" : summary.dataQuality.warningIssues ? "WARNING" : "HEALTHY"} /></InsightCard>
            <InsightCard title="Downtime" value={`${summary.downtime.eventCount} event`} tone={summary.downtime.openEventCount ? "warning" : "neutral"} description={summary.downtime.eventCount === 0 ? "Tidak ada downtime tercatat pada periode ini." : `Penyebab utama: ${summary.downtime.topCategories[0]?.category ?? "belum dikategorikan"}. Entity terdampak terbesar: ${summary.downtime.topEntities[0]?.label ?? "belum tersedia"}.`}><StatusBadge status={summary.downtime.openEventCount ? "OPEN" : "CLOSED"} label={`${summary.downtime.openEventCount} terbuka`} /></InsightCard>
          </section>
        </> : !loading ? <EmptyState title="Belum ada data dashboard" description="Tidak ada data yang cocok dengan filter. Ubah rentang tanggal atau pastikan sinkronisasi sudah berhasil." /> : <LoadingSkeleton rows={5} />}
        <section><SectionHeader title="Tren output OK" description="Output harian dari data API aktual pada periode yang dipilih." />{trends.length === 0 ? <EmptyState title="Tren belum tersedia" description="Belum ada data output harian untuk filter ini. Tidak ada data ilustrasi yang ditampilkan." /> : <div className="trend-chart">{trends.map((trend) => <div className="trend-row" key={trend.postingDate}><span>{trend.postingDate}</span><div><i style={{ width: `${Math.max(2, (trend.outputOkQty / maxTrendOutput) * 100)}%` }} /></div><strong>{formatNumber(trend.outputOkQty)}</strong></div>)}</div>}</section>
        <section><SectionHeader title="Performa mesin" description="Breakdown output dan reject per mesin." />{breakdowns.length === 0 ? <EmptyState title="Breakdown belum tersedia" description="Data mesin tidak tersedia pada periode dan filter ini." /> : <DataTable headers={["Mesin / entity", "Output OK", "Reject", "Baris sumber"]}>{breakdowns.map((row) => <tr key={row.key}><td><strong>{row.label}</strong></td><td>{formatNumber(row.outputOkQty, 1)}</td><td>{formatNumber(row.rejectKg, 2)} kg</td><td>{row.rowCount}</td></tr>)}</DataTable>}</section>
        <section><SectionHeader title="Detail output" description="Transaksi sumber yang membentuk KPI di atas." />{!outputs || outputs.rows.length === 0 ? <EmptyState title="Tidak ada detail output" description="Tidak ada transaksi output yang sesuai dengan filter saat ini." /> : <><DataTable headers={["Tanggal", "Entry", "Item", "Mesin", "Shift", "Tipe", "Qty", "Reject kg"]}>{outputs.rows.map((row) => <tr key={row.id}><td>{row.postingDate}</td><td>{row.entryNo ?? "—"}</td><td><strong>{row.itemNo}</strong></td><td>{row.machineCenterNo ?? "—"}</td><td>{row.shiftCode ?? "—"}</td><td><SourceBadge>{row.normalizedOutputType}</SourceBadge></td><td>{formatNumber(row.quantity, 1)}</td><td>{formatNumber(row.rejectKg, 2)}</td></tr>)}</DataTable><Pagination page={outputs.pagination.page} totalPages={outputs.pagination.totalPages} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} /></>}</section>
      </div>
    </PermissionGate>
  );
}
