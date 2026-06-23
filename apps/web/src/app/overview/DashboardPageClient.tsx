"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ForbiddenState, PermissionGate } from "../../components/PermissionGate";
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
  readonly targetCoverage: {
    readonly activeEntityDays: number;
    readonly missingTargetEntityDays: number;
  };
  readonly dataQuality: {
    readonly openIssues: number;
    readonly criticalIssues: number;
    readonly warningIssues: number;
    readonly byCode: readonly { issueCode: string; count: number }[];
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

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${formatNumber(value, 1)}%`;
}

function buildQuery(filters: Filters, page = 1): string {
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
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: businessDate(-6),
    to: businessDate(0),
    machineCenterNo: "",
    itemNo: "",
    shiftCode: ""
  });
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<readonly TrendRow[]>([]);
  const [breakdowns, setBreakdowns] = useState<readonly BreakdownRow[]>([]);
  const [outputs, setOutputs] = useState<OutputList | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => buildQuery(filters, page), [filters, page]);
  const maxTrendOutput = useMemo(
    () => Math.max(1, ...trends.map((trend) => trend.outputOkQty)),
    [trends]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
      const me = (await meResponse.json()) as ApiResult<{ user: CurrentUser }>;
      if (!me.ok) {
        setLoaded(true);
        return;
      }
      setCurrentUser(me.data.user);
      if (!me.data.user.permissions.includes("dashboard.view")) {
        setLoaded(true);
        return;
      }

      const [summaryResponse, trendsResponse, breakdownResponse, outputsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary?${query}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/dashboard/trends?${query}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/dashboard/breakdowns?${query}&groupBy=machine`, {
          credentials: "include"
        }),
        fetch(`${API_BASE_URL}/outputs?${query}`, { credentials: "include" })
      ]);
      const summaryPayload = (await summaryResponse.json()) as ApiResult<DashboardSummary>;
      const trendPayload = (await trendsResponse.json()) as ApiResult<readonly TrendRow[]>;
      const breakdownPayload = (await breakdownResponse.json()) as ApiResult<readonly BreakdownRow[]>;
      const outputsPayload = (await outputsResponse.json()) as ApiResult<OutputList>;

      if (!summaryPayload.ok) setError(summaryPayload.error.message);
      else setSummary(summaryPayload.data);
      if (trendPayload.ok) setTrends(trendPayload.data);
      if (breakdownPayload.ok) setBreakdowns(breakdownPayload.data);
      if (outputsPayload.ok) setOutputs(outputsPayload.data);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  async function logout() {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    router.push("/login");
    router.refresh();
  }

  if (!loaded) return <section className="panel">Loading dashboard...</section>;

  return (
    <PermissionGate user={currentUser} permission="dashboard.view" fallback={<ForbiddenState />}>
      <section className="panel dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Overview</h1>
          </div>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="filters">
          <label>
            From
            <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label>
            Machine
            <input value={filters.machineCenterNo} onChange={(event) => updateFilter("machineCenterNo", event.target.value)} />
          </label>
          <label>
            Item
            <input value={filters.itemNo} onChange={(event) => updateFilter("itemNo", event.target.value)} />
          </label>
          <label>
            Shift
            <input value={filters.shiftCode} onChange={(event) => updateFilter("shiftCode", event.target.value)} />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p>Refreshing dashboard...</p> : null}

        {summary ? (
          <>
            <div className="kpi-grid">
              <KpiCard label="OK Output" value={formatNumber(summary.kpis.outputOkQty, 1)} />
              <KpiCard label="Target" value={formatNumber(summary.kpis.prorataTarget, 1)} />
              <KpiCard label="Achievement" value={formatPct(summary.kpis.achievementPct)} detail={summary.kpis.targetStatus} />
              <KpiCard label="Reject KG" value={formatNumber(summary.kpis.rejectKg, 2)} />
              <KpiCard label="Reject PCS Eq" value={formatNumber(summary.kpis.rejectPcsEquivalent, 1)} />
              <KpiCard label="Reject Rate" value={formatPct(summary.kpis.rejectRatePct)} />
              <KpiCard label="Freshness" value={summary.dataFreshness.status} detail={summary.dataFreshness.freshnessMinutes === null ? "Never synced" : `${summary.dataFreshness.freshnessMinutes} min`} />
            </div>

            <section className="warning-panel">
              <strong>Data Quality</strong>
              <span>
                {summary.dataQuality.openIssues} open · {summary.dataQuality.criticalIssues} critical ·{" "}
                {summary.targetCoverage.missingTargetEntityDays} missing target entity-days
              </span>
            </section>
          </>
        ) : (
          <p>Belum ada data dashboard untuk filter ini.</p>
        )}

        <section>
          <h2>Output Trend</h2>
          {trends.length === 0 ? (
            <p>Belum ada trend output.</p>
          ) : (
            <div className="trend-chart">
              {trends.map((trend) => (
                <div className="trend-row" key={trend.postingDate}>
                  <span>{trend.postingDate}</span>
                  <div>
                    <i style={{ width: `${Math.max(2, (trend.outputOkQty / maxTrendOutput) * 100)}%` }} />
                  </div>
                  <strong>{formatNumber(trend.outputOkQty, 0)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2>Machine Breakdown</h2>
          {breakdowns.length === 0 ? (
            <p>Belum ada breakdown.</p>
          ) : (
            <div className="table">
              {breakdowns.map((row) => (
                <div className="table-row breakdown-row" key={row.key}>
                  <span>{row.label}</span>
                  <span>{formatNumber(row.outputOkQty, 1)} OK</span>
                  <span>{formatNumber(row.rejectKg, 2)} kg reject</span>
                  <span>{row.rowCount} rows</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2>Output Detail</h2>
          {!outputs || outputs.rows.length === 0 ? (
            <p>Belum ada output untuk filter ini.</p>
          ) : (
            <>
              <div className="table">
                {outputs.rows.map((row) => (
                  <div className="table-row output-row" key={row.id}>
                    <span>{row.postingDate}</span>
                    <span>{row.entryNo ?? "-"}</span>
                    <span>{row.itemNo}</span>
                    <span>{row.machineCenterNo ?? "-"}</span>
                    <span>{row.shiftCode ?? "-"}</span>
                    <span>{row.normalizedOutputType}</span>
                    <span>{formatNumber(row.quantity, 1)}</span>
                    <span>{formatNumber(row.rejectKg, 2)}</span>
                  </div>
                ))}
              </div>
              <div className="pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </button>
                <span>
                  Page {outputs.pagination.page} / {Math.max(outputs.pagination.totalPages, 1)}
                </span>
                <button
                  type="button"
                  disabled={page >= outputs.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </section>
    </PermissionGate>
  );
}

function KpiCard({ label, value, detail }: Readonly<{ label: string; value: string; detail?: string }>) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
