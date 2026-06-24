import { buildDashboardKpiSummary } from "../packages/domain/src/kpi/dashboard.js";
import { createDatabase } from "../packages/db/src/client.js";

const SOURCE_SYSTEM = "business-central";

type Command = "profile" | "reconcile" | "target-coverage";

interface Filters {
  readonly from: string;
  readonly to: string;
  readonly entityId?: string;
  readonly itemNo?: string;
}

interface SqlParts {
  readonly where: string;
  readonly params: unknown[];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  return value;
}

function jakartaDate(daysFromToday = 0): string {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${formatNumber(value, 2)}%`;
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function buildFilters(): Filters {
  const fallback = { from: jakartaDate(-6), to: jakartaDate() };
  const from = validateDate(process.env.RECONCILE_FROM?.trim() || fallback.from, "RECONCILE_FROM");
  const to = validateDate(process.env.RECONCILE_TO?.trim() || fallback.to, "RECONCILE_TO");
  if (to < from) throw new Error("RECONCILE_TO must be on or after RECONCILE_FROM");
  return {
    from,
    to,
    ...(process.env.RECONCILE_ENTITY_ID?.trim()
      ? { entityId: process.env.RECONCILE_ENTITY_ID.trim() }
      : {}),
    ...(process.env.RECONCILE_ITEM_NO?.trim()
      ? { itemNo: process.env.RECONCILE_ITEM_NO.trim().toUpperCase() }
      : {})
  };
}

function outputWhere(filters: Filters): SqlParts {
  const clauses = ["source_system = $1", "posting_date >= $2", "posting_date <= $3"];
  const params: unknown[] = [SOURCE_SYSTEM, filters.from, filters.to];
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`entity_id = $${params.length}`);
  }
  if (filters.itemNo) {
    params.push(filters.itemNo);
    clauses.push(`item_no = $${params.length}`);
  }
  return { where: clauses.join(" and "), params };
}

async function runProfile(pool: ReturnType<typeof createDatabase>["pool"]) {
  console.log("Business Central profile");
  console.log(`Source system: ${SOURCE_SYSTEM}`);

  const totals = await pool.query<{
    total_rows: string | number;
    min_posting_date: string | null;
    max_posting_date: string | null;
    ok_rows: string | number;
    reject_rows: string | number;
    unmapped_rows: string | number;
    conversion_gaps: string | number;
  }>(`
    select
      count(*) as total_rows,
      min(posting_date)::text as min_posting_date,
      max(posting_date)::text as max_posting_date,
      count(*) filter (where normalized_output_type = 'OK' and quantity > 0) as ok_rows,
      count(*) filter (where reject_kg > 0) as reject_rows,
      count(*) filter (where entity_id is null) as unmapped_rows,
      count(*) filter (where reject_kg > 0 and reject_pcs_eq is null) as conversion_gaps
    from production_outputs
    where source_system = $1
  `, [SOURCE_SYSTEM]);
  const total = totals.rows[0];
  console.log(
    `Rows: ${total?.total_rows ?? 0}; posting date range: ${total?.min_posting_date ?? "N/A"} to ${total?.max_posting_date ?? "N/A"}`
  );
  console.log(
    `OK rows: ${total?.ok_rows ?? 0}; reject rows: ${total?.reject_rows ?? 0}; unmapped rows: ${total?.unmapped_rows ?? 0}; conversion gaps: ${total?.conversion_gaps ?? 0}`
  );

  await printRows(
    "Rows by source system",
    pool.query("select source_system, count(*) as rows from production_outputs group by source_system order by rows desc")
  );
  await printRows(
    "Rows by month",
    pool.query(
      `select date_trunc('month', posting_date)::date::text as month, count(*) as rows
       from production_outputs
       where source_system = $1
       group by 1
       order by 1`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Rows by Entry_Type",
    pool.query(
      `select coalesce(entry_type, '(blank)') as entry_type, count(*) as rows
       from production_outputs
       where source_system = $1
       group by 1
       order by rows desc, entry_type asc
       limit 20`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Rows by normalized output type",
    pool.query(
      `select normalized_output_type, count(*) as rows, coalesce(sum(quantity), 0) as quantity
       from production_outputs
       where source_system = $1
       group by 1
       order by rows desc, normalized_output_type asc`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Top unmapped machine/entity output",
    pool.query(
      `select coalesce(machine_center_no, '(blank)') as machine_center_no,
              count(*) as rows,
              coalesce(sum(case when normalized_output_type = 'OK' and quantity > 0 then quantity else 0 end), 0) as ok_qty
       from production_outputs
       where source_system = $1 and entity_id is null
       group by 1
       order by ok_qty desc, rows desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Top items by OK quantity",
    pool.query(
      `select item_no,
              left(coalesce(max(item_description), ''), 60) as item_description,
              count(*) as rows,
              coalesce(sum(quantity), 0) as ok_qty
       from production_outputs
       where source_system = $1 and normalized_output_type = 'OK' and quantity > 0
       group by item_no
       order by ok_qty desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows("Target coverage summary", targetCoverageSummary(pool));
}

async function runReconcile(pool: ReturnType<typeof createDatabase>["pool"]) {
  const filters = buildFilters();
  const where = outputWhere(filters);
  console.log("Business Central dashboard reconciliation");
  console.log(`Window: ${filters.from} to ${filters.to}`);
  if (filters.entityId) console.log(`Entity filter: ${filters.entityId}`);
  if (filters.itemNo) console.log(`Item filter: ${filters.itemNo}`);

  const [aggregate, activeDays, targets, latestSync] = await Promise.all([
    pool.query<{
      output_ok_qty: string | number | null;
      raw_ok_qty: string | number | null;
      reject_kg: string | number | null;
      reject_pcs_equivalent: string | number | null;
      incomplete_reject_conversion_count: string | number | null;
      active_days: string | number | null;
      raw_rows: string | number;
      excluded_rows: string | number;
    }>(
      `
        select
          coalesce(sum(case when normalized_output_type = 'OK' and quantity > 0 then quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as raw_ok_qty,
          coalesce(sum(case when reject_kg > 0 then reject_kg else 0 end), 0) as reject_kg,
          coalesce(sum(case when reject_pcs_eq > 0 then reject_pcs_eq else 0 end), 0) as reject_pcs_equivalent,
          count(*) filter (where reject_kg > 0 and reject_pcs_eq is null) as incomplete_reject_conversion_count,
          count(distinct posting_date) filter (where normalized_output_type = 'OK' and quantity > 0) as active_days,
          count(*) as raw_rows,
          count(*) filter (where not (normalized_output_type = 'OK' and quantity > 0)) as excluded_rows
        from production_outputs
        where ${where.where}
      `,
      where.params
    ),
    pool.query<{ entity_id: string; posting_date: string }>(
      `
        select entity_id, posting_date::text
        from production_outputs
        where ${where.where}
          and entity_id is not null
          and normalized_output_type = 'OK'
          and quantity > 0
        group by entity_id, posting_date
      `,
      where.params
    ),
    pool.query<{
      entity_id: string;
      effective_from: string;
      effective_to: string | null;
      daily_target_qty: string | number;
      min_achievement_pct: string | number;
      max_achievement_pct: string | number;
    }>(
      `
        select entity_id,
               effective_from::text,
               effective_to::text,
               daily_target_qty,
               min_achievement_pct,
               max_achievement_pct
        from production_targets
        where effective_from <= $1
          and (effective_to is null or effective_to >= $2)
          and status in ('APPROVED', 'ACTIVE')
          ${filters.entityId ? "and entity_id = $3" : ""}
      `,
      filters.entityId ? [filters.to, filters.from, filters.entityId] : [filters.to, filters.from]
    ),
    pool.query<{ finished_at: Date | null }>(
      `
        select finished_at
        from sync_runs
        where source_system = $1
          and status = 'SUCCESS'
          and ($2::boolean = false or (source_url is not null and source_url not like 'mock://%'))
        order by finished_at desc
        limit 1
      `,
      [SOURCE_SYSTEM, process.env.ODATA_SYNC_MODE === "live"]
    )
  ]);

  const row = aggregate.rows[0];
  const coverage = computeCoverage(activeDays.rows, targets.rows);
  const kpis = buildDashboardKpiSummary({
    outputOkQty: numberValue(row?.output_ok_qty),
    rejectKg: numberValue(row?.reject_kg),
    rejectPcsEquivalent: numberValue(row?.reject_pcs_equivalent),
    prorataTarget: coverage.prorataTarget,
    hasTarget: coverage.hasTarget,
    activeDays: numberValue(row?.active_days),
    incompleteRejectConversionCount: numberValue(row?.incomplete_reject_conversion_count),
    latestSuccessfulSyncFinishedAt: latestSync.rows[0]?.finished_at ?? null,
    now: new Date(),
    ...(coverage.minAchievementPct ? { minAchievementPct: coverage.minAchievementPct } : {}),
    ...(coverage.maxAchievementPct ? { maxAchievementPct: coverage.maxAchievementPct } : {})
  });
  const rawOk = numberValue(row?.raw_ok_qty);
  const warnings: string[] = [];
  if (Math.abs(kpis.outputOkQty - rawOk) > 0.0001) warnings.push("Dashboard OK output differs from raw OK aggregate.");
  if (kpis.targetStatusReason === "TARGET_MISSING" && coverage.activeEntityDays > 0) {
    warnings.push("Achievement is N/A because one or more active entity-days have no approved/active target.");
  } else if (kpis.targetStatusReason === "TARGET_MISSING") {
    warnings.push("Achievement is N/A because OK output has no mapped active entity-days for target matching.");
  }
  if (kpis.rejectConversionStatus === "INCOMPLETE") warnings.push("Reject PCS equivalent is incomplete because reject rows have missing gross weight conversion.");
  if (coverage.activeEntityDays === 0 && kpis.outputOkQty > 0) warnings.push("OK output exists but no rows are mapped to a master entity, so target coverage cannot be calculated.");

  console.log(`Dashboard OK output: ${formatNumber(kpis.outputOkQty, 4)}`);
  console.log(`Raw OK output: ${formatNumber(rawOk, 4)}`);
  console.log(`Target: ${coverage.hasTarget ? formatNumber(kpis.prorataTarget, 4) : "N/A"}`);
  console.log(`Target reason: ${kpis.targetStatusReason ?? "OK"}`);
  console.log(`Achievement: ${formatPct(kpis.achievementPct)}`);
  console.log(`Reject KG: ${formatNumber(kpis.rejectKg, 4)}`);
  console.log(`Reject PCS equivalent: ${formatNumber(kpis.rejectPcsEquivalent, 4)}`);
  console.log(`Reject conversion status: ${kpis.rejectConversionStatus}; gaps: ${kpis.incompleteRejectConversionCount}`);
  console.log(`Reject rate: ${formatPct(kpis.rejectRatePct)}`);
  console.log(`Raw rows in window: ${row?.raw_rows ?? 0}; excluded from OK KPI: ${row?.excluded_rows ?? 0}`);
  console.log(`Active entity-days: ${coverage.activeEntityDays}; missing target entity-days: ${coverage.missingTargetEntityDays}`);
  console.log(
    `Freshness: ${kpis.dataFreshnessStatus}; latest successful sync: ${latestSync.rows[0]?.finished_at?.toISOString() ?? "N/A"}`
  );
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  } else {
    console.log("Warnings: none");
  }
}

async function runTargetCoverage(pool: ReturnType<typeof createDatabase>["pool"]) {
  console.log("Business Central target coverage");
  await printRows("Coverage by entity/machine/month", targetCoverageSummary(pool));
}

function computeCoverage(
  activeDays: readonly { readonly entity_id: string; readonly posting_date: string }[],
  targets: readonly {
    readonly entity_id: string;
    readonly effective_from: string;
    readonly effective_to: string | null;
    readonly daily_target_qty: string | number;
    readonly min_achievement_pct: string | number;
    readonly max_achievement_pct: string | number;
  }[]
) {
  let prorataTarget = 0;
  let missingTargetEntityDays = 0;
  const minValues: number[] = [];
  const maxValues: number[] = [];
  for (const activeDay of activeDays) {
    const target = targets
      .filter((candidate) => {
        if (candidate.entity_id !== activeDay.entity_id) return false;
        if (dateText(candidate.effective_from) > activeDay.posting_date) return false;
        if (candidate.effective_to && dateText(candidate.effective_to) < activeDay.posting_date) return false;
        return true;
      })
      .sort((a, b) => dateText(b.effective_from).localeCompare(dateText(a.effective_from)))[0];
    if (!target) {
      missingTargetEntityDays += 1;
      continue;
    }
    prorataTarget += numberValue(target.daily_target_qty);
    minValues.push(numberValue(target.min_achievement_pct));
    maxValues.push(numberValue(target.max_achievement_pct));
  }
  return {
    prorataTarget,
    missingTargetEntityDays,
    activeEntityDays: activeDays.length,
    hasTarget: activeDays.length > 0 && missingTargetEntityDays === 0,
    minAchievementPct: minValues.length ? minValues.reduce((total, value) => total + value, 0) / minValues.length : undefined,
    maxAchievementPct: maxValues.length ? maxValues.reduce((total, value) => total + value, 0) / maxValues.length : undefined
  };
}

function targetCoverageSummary(pool: ReturnType<typeof createDatabase>["pool"]) {
  return pool.query(
    `
      with output_rows as (
        select
          date_trunc('month', po.posting_date)::date::text as month,
          po.posting_date,
          po.entity_id,
          po.machine_center_no,
          po.quantity,
          case
            when po.entity_id is null then 'UNMAPPED_ENTITY'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            ) then 'COVERED'
            else 'TARGET_MISSING'
          end as coverage_status
        from production_outputs po
        where po.source_system = $1
          and po.normalized_output_type = 'OK'
          and po.quantity > 0
      )
      select
        output_rows.month,
        coalesce(me.display_name, output_rows.machine_center_no, 'Unmapped') as entity_or_machine,
        output_rows.coverage_status,
        count(*) as rows,
        coalesce(sum(output_rows.quantity), 0) as ok_qty
      from output_rows
      left join master_entities me on me.id = output_rows.entity_id
      group by output_rows.month, coalesce(me.display_name, output_rows.machine_center_no, 'Unmapped'), output_rows.coverage_status
      order by output_rows.month desc, output_rows.coverage_status desc, ok_qty desc
      limit 50
    `,
    [SOURCE_SYSTEM]
  );
}

async function printRows(title: string, rowsPromise: Promise<{ rows: Record<string, unknown>[] }>) {
  const result = await rowsPromise;
  console.log("");
  console.log(title);
  if (result.rows.length === 0) {
    console.log("- none");
    return;
  }
  for (const row of result.rows) {
    const parts = Object.entries(row).map(([key, value]) => `${key}=${value instanceof Date ? value.toISOString() : String(value)}`);
    console.log(`- ${parts.join("; ")}`);
  }
}

async function main() {
  const command = (process.argv[2] ?? "profile") as Command;
  if (!["profile", "reconcile", "target-coverage"].includes(command)) {
    throw new Error("Usage: bc-metrics <profile|reconcile|target-coverage>");
  }
  const database = createDatabase({ connectionString: requireEnv("DATABASE_URL") });
  try {
    if (command === "profile") await runProfile(database.pool);
    else if (command === "reconcile") await runReconcile(database.pool);
    else await runTargetCoverage(database.pool);
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown BC metrics error";
  console.error(message);
  process.exitCode = 1;
});
