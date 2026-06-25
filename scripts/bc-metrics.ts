import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardKpiSummary } from "../packages/domain/src/kpi/dashboard.js";
import { createDatabase } from "../packages/db/src/client.js";
import {
  isMasterSourceField,
  normalizeAliasDisplay,
  normalizeAliasKey,
  type MasterSourceField
} from "../packages/domain/src/master-data/alias.js";
import {
  buildMappingPlanRows,
  containsMappingSecretLikeText,
  mappingPlanRowsToCsv,
  mappingPlanSourceFields,
  parseMappingPlanCsv,
  suggestMappingCandidates,
  type CandidateEntityInput,
  type MappingPlanRow,
  type MappingSuggestion
} from "../packages/domain/src/master-data/mapping-candidates.js";

const SOURCE_SYSTEM = "business-central";
const DEFAULT_MAPPING_PLAN_PATH = ".tmp/mapping-plan/business-central-mapping-plan.csv";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Command =
  | "profile"
  | "reconcile"
  | "target-coverage"
  | "mapping-candidates"
  | "mapping-apply"
  | "mapping-plan"
  | "mapping-plan-apply";

type DatabasePool = ReturnType<typeof createDatabase>["pool"];

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

const sourceFieldColumns: Record<MasterSourceField, string> = {
  machine_center_no: "machine_center_no",
  prod_line_no: "prod_line_no",
  prod_line_description: "prod_line_description",
  item_no: "item_no",
  uom: "uom"
};

interface MappingCoverageSummary {
  readonly totalRows: number;
  readonly mappedRows: number;
  readonly unmappedRows: number;
  readonly okRows: number;
  readonly mappedOkRows: number;
  readonly unmappedOkRows: number;
  readonly unmappedOkQty: number;
}

interface UnmappedSourceGroup {
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
  readonly rows: number;
  readonly okQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly suggestions: readonly MappingSuggestion[];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function resolveRepoPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(REPO_ROOT, value);
}

function displayRepoPath(value: string): string {
  const absolute = resolveRepoPath(value);
  const relative = path.relative(REPO_ROOT, absolute);
  return relative.startsWith("..") ? absolute : relative;
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

function sourceFieldColumn(sourceField: MasterSourceField): string {
  return sourceFieldColumns[sourceField];
}

function requireSourceField(): MasterSourceField {
  const value = process.env.SOURCE_FIELD?.trim();
  if (!value || !isMasterSourceField(value)) {
    throw new Error("SOURCE_FIELD must be one of machine_center_no, prod_line_no, prod_line_description, item_no, uom");
  }
  return value;
}

function sqlNormalizeExpression(column: string): string {
  return `upper(regexp_replace(trim(coalesce(${column}, '')), '[^A-Za-z0-9]+', '', 'g'))`;
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

async function mappingCoverageSummary(pool: DatabasePool): Promise<MappingCoverageSummary> {
  const result = await pool.query<{
    total_rows: string | number;
    mapped_rows: string | number;
    unmapped_rows: string | number;
    ok_rows: string | number;
    mapped_ok_rows: string | number;
    unmapped_ok_rows: string | number;
    unmapped_ok_qty: string | number | null;
  }>(
    `
      select
        count(*) as total_rows,
        count(*) filter (where entity_id is not null) as mapped_rows,
        count(*) filter (where entity_id is null) as unmapped_rows,
        count(*) filter (where normalized_output_type = 'OK' and quantity > 0) as ok_rows,
        count(*) filter (where entity_id is not null and normalized_output_type = 'OK' and quantity > 0) as mapped_ok_rows,
        count(*) filter (where entity_id is null and normalized_output_type = 'OK' and quantity > 0) as unmapped_ok_rows,
        coalesce(sum(quantity) filter (where entity_id is null and normalized_output_type = 'OK' and quantity > 0), 0) as unmapped_ok_qty
      from production_outputs
      where source_system = $1
    `,
    [SOURCE_SYSTEM]
  );
  const row = result.rows[0];
  return {
    totalRows: numberValue(row?.total_rows),
    mappedRows: numberValue(row?.mapped_rows),
    unmappedRows: numberValue(row?.unmapped_rows),
    okRows: numberValue(row?.ok_rows),
    mappedOkRows: numberValue(row?.mapped_ok_rows),
    unmappedOkRows: numberValue(row?.unmapped_ok_rows),
    unmappedOkQty: numberValue(row?.unmapped_ok_qty)
  };
}

function mappingCoveragePct(summary: MappingCoverageSummary): number | null {
  return summary.totalRows > 0 ? (summary.mappedRows / summary.totalRows) * 100 : null;
}

async function activeEntityCandidates(pool: DatabasePool): Promise<readonly CandidateEntityInput[]> {
  const result = await pool.query<{
    entity_id: string;
    entity_code: string;
    display_name: string;
    line_code: string | null;
    product_family: string | null;
    report_group: string | null;
    alias_values: string[] | null;
    target_exists: boolean;
  }>(
    `
      select me.id as entity_id,
             me.entity_code,
             me.display_name,
             me.line_code,
             me.product_family,
             me.report_group,
             array_remove(array_agg(distinct mea.alias), null) as alias_values,
             exists (
               select 1
               from production_targets pt
               where pt.entity_id = me.id
                 and pt.status in ('APPROVED', 'ACTIVE')
                 and pt.daily_target_qty > 0
             ) as target_exists
      from master_entities me
      left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active
      where me.is_active
      group by me.id
      order by me.entity_code
      limit 1000
    `
  );
  return result.rows.map((row) => ({
    entityId: row.entity_id,
    entityCode: row.entity_code,
    displayName: row.display_name,
    aliasValues: row.alias_values ?? [],
    targetExists: row.target_exists,
    lineCode: row.line_code,
    productFamily: row.product_family,
    reportGroup: row.report_group
  }));
}

async function fetchUnmappedSourceGroups(
  pool: DatabasePool,
  limit: number,
  entities: readonly CandidateEntityInput[]
): Promise<readonly UnmappedSourceGroup[]> {
  const result = await pool.query<{
    source_field: MasterSourceField;
    source_value: string | null;
    normalized_value: string;
    rows: string | number;
    ok_qty: string | number;
    first_posting_date: string | null;
    last_posting_date: string | null;
  }>(
    `
      with source_rows as (
        select 'machine_center_no'::text as source_field, machine_center_no as source_value, posting_date, quantity
        from production_outputs
        where source_system = $1 and entity_id is null and normalized_output_type = 'OK' and quantity > 0
        union all
        select 'prod_line_no', prod_line_no, posting_date, quantity
        from production_outputs
        where source_system = $1 and entity_id is null and normalized_output_type = 'OK' and quantity > 0
        union all
        select 'prod_line_description', prod_line_description, posting_date, quantity
        from production_outputs
        where source_system = $1 and entity_id is null and normalized_output_type = 'OK' and quantity > 0
      )
      select source_field,
             coalesce(source_value, '') as source_value,
             upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
             count(*) as rows,
             coalesce(sum(quantity), 0) as ok_qty,
             min(posting_date)::text as first_posting_date,
             max(posting_date)::text as last_posting_date
      from source_rows
      group by source_field, coalesce(source_value, '')
      order by ok_qty desc, rows desc
      limit $2
    `,
    [SOURCE_SYSTEM, limit]
  );
  return result.rows.map((row) => ({
    sourceField: row.source_field,
    sourceValue: row.source_value ?? "",
    normalizedValue: row.normalized_value,
    rows: numberValue(row.rows),
    okQty: numberValue(row.ok_qty),
    firstPostingDate: row.first_posting_date,
    lastPostingDate: row.last_posting_date,
    suggestions: suggestMappingCandidates(row.source_value ?? "", entities)
  }));
}

async function previewMappingPlanRow(pool: DatabasePool, row: Pick<MappingPlanRow, "source_field" | "source_value" | "suggested_entity_id">) {
  const sourceColumn = sourceFieldColumn(row.source_field);
  const normalized = normalizeAliasKey(row.source_value);
  return pool.query<{
    affected_rows: string | number;
    already_mapped_rows: string | number;
    ok_qty: string | number | null;
    target_covered_rows: string | number;
  }>(
    `
      select
        count(*) filter (where po.entity_id is null) as affected_rows,
        count(*) filter (where po.entity_id is not null) as already_mapped_rows,
        coalesce(sum(po.quantity) filter (where po.entity_id is null and po.normalized_output_type = 'OK' and po.quantity > 0), 0) as ok_qty,
        count(*) filter (
          where po.entity_id is null
            and po.normalized_output_type = 'OK'
            and po.quantity > 0
            and exists (
              select 1
              from production_targets pt
              where pt.entity_id = $3::uuid
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.daily_target_qty > 0
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            )
        ) as target_covered_rows
      from production_outputs po
      where po.source_system = $1
        and ${sqlNormalizeExpression(`po.${sourceColumn}`)} = $2
    `,
    [SOURCE_SYSTEM, normalized, row.suggested_entity_id]
  ).then((result) => ({
    affectedRows: numberValue(result.rows[0]?.affected_rows),
    alreadyMappedRows: numberValue(result.rows[0]?.already_mapped_rows),
    okQty: numberValue(result.rows[0]?.ok_qty),
    targetCoveredRows: numberValue(result.rows[0]?.target_covered_rows)
  }));
}

function printCoverageSummary(summary: MappingCoverageSummary) {
  console.log(
    `Rows: total=${formatNumber(summary.totalRows, 0)}; mapped=${formatNumber(summary.mappedRows, 0)}; unmapped=${formatNumber(summary.unmappedRows, 0)}; coverage=${formatPct(mappingCoveragePct(summary))}`
  );
  console.log(
    `OK rows: total=${formatNumber(summary.okRows, 0)}; mapped=${formatNumber(summary.mappedOkRows, 0)}; unmapped=${formatNumber(summary.unmappedOkRows, 0)}; unmapped_ok_qty=${formatNumber(summary.unmappedOkQty, 2)}`
  );
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
    "Top mapped entities by OK quantity",
    pool.query(
      `select me.entity_code,
              me.display_name,
              count(*) as rows,
              coalesce(sum(po.quantity), 0) as ok_qty
       from production_outputs po
       inner join master_entities me on me.id = po.entity_id
       where po.source_system = $1 and po.normalized_output_type = 'OK' and po.quantity > 0
       group by me.entity_code, me.display_name
       order by ok_qty desc, rows desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Alias coverage by source field",
    pool.query(
      `select source_field,
              count(*) filter (where is_active) as active_aliases,
              count(*) as total_aliases
       from master_entity_aliases
       where source_system = $1
       group by source_field
       order by source_field`,
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
  await printRows("Conversion gaps by item/UOM", conversionGapSummary(pool));
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

async function runMappingCandidates(pool: ReturnType<typeof createDatabase>["pool"]) {
  const limit = Math.min(Number(process.env.MAPPING_CANDIDATE_LIMIT ?? 25) || 25, 100);
  console.log("Business Central mapping candidates");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Limit: ${limit}`);

  const [coverage, entities] = await Promise.all([
    mappingCoverageSummary(pool),
    activeEntityCandidates(pool)
  ]);
  printCoverageSummary(coverage);

  const groups = await fetchUnmappedSourceGroups(pool, limit, entities);
  if (groups.length === 0) {
    console.log("- no unmapped source groups found");
    return;
  }

  console.log("");
  console.log("Top unmapped source groups with suggestions");
  for (const group of groups) {
    const top = group.suggestions[0];
    const candidates = group.suggestions
      .slice(0, 3)
      .map((candidate) => `${candidate.entityCode} ${candidate.confidence}/${candidate.score}${candidate.targetExists ? "/target" : "/no-target"} (${candidate.reason})`);
    console.log(
      `- source_field=${group.sourceField}; source_value=${group.sourceValue || "(blank)"}; normalized=${group.normalizedValue || "(blank)"}; rows=${group.rows}; ok_qty=${formatNumber(group.okQty, 2)}; range=${group.firstPostingDate ?? "N/A"}..${group.lastPostingDate ?? "N/A"}; confidence=${top?.confidence ?? "LOW"}; estimated_mapped_rows_if_committed=${group.sourceValue ? group.rows : 0}; candidates=${candidates.join(" | ") || "none"}`
    );
  }

  await printRows(
    "Top unmapped by machine_center_no",
    pool.query(
      `
        select coalesce(machine_center_no, '(blank)') as machine_center_no,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by prod_line_no",
    pool.query(
      `
        select coalesce(prod_line_no, '(blank)') as prod_line_no,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by prod_line_description",
    pool.query(
      `
        select coalesce(prod_line_description, '(blank)') as prod_line_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by machine/prod-line/description",
    pool.query(
      `
        select coalesce(machine_center_no, '(blank)') as machine_center_no,
               coalesce(prod_line_no, '(blank)') as prod_line_no,
               coalesce(prod_line_description, '(blank)') as prod_line_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1, 2, 3
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by item/product family",
    pool.query(
      `
        select coalesce(item_category_code, '(blank)') as item_category_code,
               coalesce(item_no, '(blank)') as item_no,
               left(coalesce(max(item_description), ''), 80) as item_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1, 2
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by month",
    pool.query(
      `
        select date_trunc('month', posting_date)::date::text as month,
               count(*) as rows,
               coalesce(sum(quantity) filter (where normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
        from production_outputs
        where source_system = $1 and entity_id is null
        group by 1
        order by month desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
}

async function runMappingPlan(pool: DatabasePool) {
  const limit = Math.min(Number(process.env.MAPPING_PLAN_LIMIT ?? 250) || 250, 1000);
  const outputPathInput = process.env.MAPPING_PLAN_OUTPUT?.trim() || DEFAULT_MAPPING_PLAN_PATH;
  const outputPath = resolveRepoPath(outputPathInput);
  console.log("Business Central mapping plan");
  console.log(`Mode: DRY_RUN`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Output: ${displayRepoPath(outputPath)}`);
  console.log(`Limit: ${limit}`);

  const [coverage, entities] = await Promise.all([
    mappingCoverageSummary(pool),
    activeEntityCandidates(pool)
  ]);
  printCoverageSummary(coverage);

  const groups = await fetchUnmappedSourceGroups(pool, limit, entities);
  const rows = buildMappingPlanRows(groups.map((group) => ({
    sourceSystem: SOURCE_SYSTEM,
    sourceField: group.sourceField,
    sourceValue: group.sourceValue,
    rowCount: group.rows,
    okQty: group.okQty,
    firstPostingDate: group.firstPostingDate,
    lastPostingDate: group.lastPostingDate,
    suggestions: group.suggestions
  })));
  const csv = mappingPlanRowsToCsv(rows);
  if (containsMappingSecretLikeText(csv)) {
    throw new Error("Generated mapping plan contains secret-like text; refusing to write it.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, "utf8");

  const suggestedRows = rows.filter((row) => row.suggested_entity_id);
  const highRows = rows.filter((row) => row.confidence === "HIGH");
  const mediumRows = rows.filter((row) => row.confidence === "MEDIUM");
  const targetRows = rows.filter((row) => row.target_exists === "TRUE");
  console.log("");
  console.log("Plan summary");
  console.log(`- rows_written=${rows.length}`);
  console.log(`- suggested_rows=${suggestedRows.length}; high=${highRows.length}; medium=${mediumRows.length}; low_or_none=${rows.length - highRows.length - mediumRows.length}`);
  console.log(`- target_exists_for_suggestion=${targetRows.length}`);
  console.log(`- default_action=REVIEW`);
  console.log(`- review_file=${displayRepoPath(outputPath)}`);
  console.log("Dry-run only. Edit action=COMMIT for reviewed rows, then run MAPPING_PLAN_COMMIT=true pnpm bc:mapping-plan-apply.");
}

function isPlanSourceField(value: string): value is (typeof mappingPlanSourceFields)[number] {
  return (mappingPlanSourceFields as readonly string[]).includes(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function runMappingPlanApply(pool: DatabasePool) {
  const filePathInput = process.env.MAPPING_PLAN_FILE?.trim() || DEFAULT_MAPPING_PLAN_PATH;
  const filePath = resolveRepoPath(filePathInput);
  const commit = process.env.MAPPING_PLAN_COMMIT === "true";
  console.log("Business Central mapping plan apply");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Plan file: ${displayRepoPath(filePath)}`);

  const csv = await readFile(filePath, "utf8");
  if (containsMappingSecretLikeText(csv)) {
    throw new Error("Mapping plan contains secret-like text; refusing to process it.");
  }
  const rows = parseMappingPlanCsv(csv);
  const commitRows = rows.filter((row) => row.action === "COMMIT");
  const warnings: string[] = [];
  const conflicts: string[] = [];
  console.log(`Rows in plan: ${rows.length}; action=COMMIT rows: ${commitRows.length}`);

  const entities = await activeEntityCandidates(pool);
  const entityIds = new Set(entities.map((entity) => entity.entityId));
  const validRows = commitRows.flatMap((row) => {
    if (row.source_system !== SOURCE_SYSTEM) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value || "(blank)"} because source_system is ${row.source_system}.`);
      return [];
    }
    if (!isPlanSourceField(row.source_field)) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value || "(blank)"} because the source field is not allowlisted for entity mapping.`);
      return [];
    }
    if (!normalizeAliasKey(row.source_value)) {
      warnings.push(`Skipped ${row.source_field} blank source value; blank machine groups require row context.`);
      return [];
    }
    if (!isUuid(row.suggested_entity_id) || !entityIds.has(row.suggested_entity_id)) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value} because suggested_entity_id is not an active master entity.`);
      return [];
    }
    if (row.confidence === "LOW") {
      warnings.push(`Skipped LOW confidence row ${row.source_field}:${row.source_value}; low-confidence mappings require manual one-off handling.`);
      return [];
    }
    return [row];
  });

  let aliasesInserted = 0;
  let aliasesSkipped = 0;
  let rowsUpdated = 0;
  let rowsWouldUpdate = 0;
  let targetCoveredRows = 0;
  let alreadyMappedRows = 0;

  const previews = await Promise.all(validRows.map((row) => previewMappingPlanRow(pool, row)));
  const coverage = await mappingCoverageSummary(pool);
  previews.forEach((preview) => {
    rowsWouldUpdate += preview.affectedRows;
    targetCoveredRows += preview.targetCoveredRows;
    alreadyMappedRows += preview.alreadyMappedRows;
  });

  console.log("");
  console.log("Dry-run estimate");
  console.log(`- valid_commit_rows=${validRows.length}`);
  console.log(`- rows_would_update=${rowsWouldUpdate}`);
  console.log(`- mapped_rows_before=${coverage.mappedRows}; mapped_rows_after_estimate=${coverage.mappedRows + rowsWouldUpdate}`);
  console.log(`- unmapped_rows_before=${coverage.unmappedRows}; unmapped_rows_after_estimate=${Math.max(coverage.unmappedRows - rowsWouldUpdate, 0)}`);
  console.log(`- already_mapped_rows_not_overwritten=${alreadyMappedRows}`);
  console.log(`- target_covered_rows_after_mapping_estimate=${targetCoveredRows}`);

  if (!commit) {
    console.log("Dry-run only. Set MAPPING_PLAN_COMMIT=true after reviewing the CSV to create aliases and update unmapped rows.");
    if (warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of validRows) {
      const sourceValue = normalizeAliasDisplay(row.source_value);
      const normalized = normalizeAliasKey(sourceValue);
      const sourceColumn = sourceFieldColumn(row.source_field);
      const alias = await client.query<{
        id: string;
        entity_id: string;
        source_field: string;
        alias_normalized: string;
        is_active: boolean;
      }>(
        `
          select id, entity_id, source_field, alias_normalized, is_active
          from master_entity_aliases
          where alias = $4
             or (
               source_system = $1
               and source_field = $2
               and alias_normalized = $3
             )
          order by is_active desc, created_at desc
        `,
        [SOURCE_SYSTEM, row.source_field, normalized, sourceValue]
      );
      const conflictingAlias = alias.rows.find((candidate) => (
        candidate.entity_id !== row.suggested_entity_id
        || candidate.source_field !== row.source_field
        || candidate.alias_normalized !== normalized
      ));
      if (conflictingAlias) {
        conflicts.push(`${row.source_field}:${sourceValue} conflicts with existing alias ${conflictingAlias.id}`);
        continue;
      }
      const existingAlias = alias.rows[0];
      if (existingAlias) {
        if (!existingAlias.is_active) {
          await client.query("update master_entity_aliases set is_active = true, updated_at = now() where id = $1", [existingAlias.id]);
        }
        aliasesSkipped += 1;
      } else {
        await client.query(
          `
            insert into master_entity_aliases
              (entity_id, alias, source_system, source_field, alias_normalized, source, confidence, match_confidence)
            values ($1, $2, $3, $4, $5, 'mapping-plan', $6, $6)
          `,
          [
            row.suggested_entity_id,
            sourceValue,
            SOURCE_SYSTEM,
            row.source_field,
            normalized,
            row.confidence === "HIGH" ? 100 : 80
          ]
        );
        aliasesInserted += 1;
      }

      const updated = await client.query<{ entry_no: string }>(
        `
          update production_outputs
          set entity_id = $3,
              updated_at = now()
          where source_system = $1
            and ${sqlNormalizeExpression(sourceColumn)} = $2
            and entity_id is null
          returning entry_no::text
        `,
        [SOURCE_SYSTEM, normalized, row.suggested_entity_id]
      );
      rowsUpdated += updated.rowCount ?? 0;
      const entryNos = updated.rows.map((updatedRow) => updatedRow.entry_no);
      if (entryNos.length > 0) {
        await client.query(
          `
            update data_quality_issues
            set status = 'RESOLVED',
                resolved_at = now(),
                resolution_note = 'Resolved by reviewed mapping plan'
            where source_system = $1
              and status in ('OPEN', 'ACKNOWLEDGED')
              and issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
              and source_ref = any($2::text[])
          `,
          [SOURCE_SYSTEM, entryNos]
        );
      }
    }

    await client.query(
      `
        insert into audit_logs (action, entity_type, entity_id, before_value, after_value, user_agent)
        values ('master.mapping_plan.script_commit', 'production_output_mapping', $1, $2::jsonb, $3::jsonb, 'bc-metrics-script')
      `,
      [
        displayRepoPath(filePath),
        JSON.stringify({ sourceSystem: SOURCE_SYSTEM, filePath: displayRepoPath(filePath), planRows: rows.length, commitRows: commitRows.length }),
        JSON.stringify({ aliasesInserted, aliasesSkipped, rowsUpdated, conflicts: conflicts.length, warnings: warnings.length })
      ]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log("");
  console.log("Commit summary");
  console.log(`- aliases_inserted=${aliasesInserted}`);
  console.log(`- aliases_skipped=${aliasesSkipped}`);
  console.log(`- rows_updated=${rowsUpdated}`);
  console.log(`- conflicts=${conflicts.length}`);
  console.log(`- warnings=${warnings.length}`);
  if (conflicts.length > 0) {
    console.log("Conflicts:");
    for (const conflict of conflicts) console.log(`- ${conflict}`);
  }
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

async function runMappingApply(pool: ReturnType<typeof createDatabase>["pool"]) {
  const sourceField = requireSourceField();
  const sourceValue = normalizeAliasDisplay(requireEnv("SOURCE_VALUE"));
  const entityId = requireEnv("ENTITY_ID");
  const commit = process.env.APPLY_MAPPING_COMMIT === "true";
  const sourceColumn = sourceFieldColumn(sourceField);
  const normalized = normalizeAliasKey(sourceValue);

  console.log("Business Central mapping apply");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Source field: ${sourceField}`);
  console.log(`Source value: ${sourceValue}`);
  console.log(`Entity ID: ${entityId}`);

  const entity = await pool.query<{ id: string; entity_code: string; display_name: string }>(
    "select id, entity_code, display_name from master_entities where id = $1 and is_active limit 1",
    [entityId]
  );
  if (!entity.rows[0]) throw new Error("ENTITY_ID must reference an active master entity");

  const preview = await pool.query<{
    affected_rows: string | number;
    already_mapped_rows: string | number;
    ok_qty: string | number;
  }>(
    `
      select
        count(*) filter (where entity_id is null) as affected_rows,
        count(*) filter (where entity_id is not null) as already_mapped_rows,
        coalesce(sum(quantity) filter (where entity_id is null and normalized_output_type = 'OK' and quantity > 0), 0) as ok_qty
      from production_outputs
      where source_system = $1
        and ${sqlNormalizeExpression(sourceColumn)} = $2
    `,
    [SOURCE_SYSTEM, normalized]
  );
  console.log(
    `Preview: affected_rows=${preview.rows[0]?.affected_rows ?? 0}; already_mapped_rows=${preview.rows[0]?.already_mapped_rows ?? 0}; unmapped_ok_qty=${preview.rows[0]?.ok_qty ?? 0}`
  );

  if (!commit) {
    console.log("Dry-run only. Set APPLY_MAPPING_COMMIT=true to create the alias and update unmapped rows.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const alias = await client.query<{ id: string; entity_id: string; is_active: boolean }>(
      `
        select id, entity_id, is_active
        from master_entity_aliases
        where source_system = $1
          and source_field = $2
          and alias_normalized = $3
        order by is_active desc, created_at desc
        limit 1
      `,
      [SOURCE_SYSTEM, sourceField, normalized]
    );
    const existingAlias = alias.rows[0];
    if (existingAlias && existingAlias.entity_id !== entityId) {
      throw new Error("An alias for this source value already belongs to another entity");
    }
    if (existingAlias && !existingAlias.is_active) {
      await client.query(
        "update master_entity_aliases set is_active = true, updated_at = now() where id = $1",
        [existingAlias.id]
      );
    }
    if (!existingAlias) {
      await client.query(
        `
          insert into master_entity_aliases
            (entity_id, alias, source_system, source_field, alias_normalized, source, confidence, match_confidence)
          values ($1, $2, $3, $4, $5, 'mapping-script', 100, 100)
        `,
        [entityId, sourceValue, SOURCE_SYSTEM, sourceField, normalized]
      );
    }

    const updated = await client.query(
      `
        update production_outputs
        set entity_id = $3,
            updated_at = now()
        where source_system = $1
          and ${sqlNormalizeExpression(sourceColumn)} = $2
          and entity_id is null
      `,
      [SOURCE_SYSTEM, normalized, entityId]
    );

    const issues = await client.query(
      `
        update data_quality_issues dqi
        set status = 'RESOLVED',
            resolved_at = now(),
            resolution_note = 'Resolved by mapping apply script'
        where dqi.source_system = $1
          and dqi.status in ('OPEN', 'ACKNOWLEDGED')
          and dqi.issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
          and exists (
            select 1
            from production_outputs po
            where po.source_system = $1
              and po.entry_no::text = dqi.source_ref
              and po.entity_id = $3
              and ${sqlNormalizeExpression(`po.${sourceColumn}`)} = $2
          )
      `,
      [SOURCE_SYSTEM, normalized, entityId]
    );

    await client.query(
      `
        insert into audit_logs (action, entity_type, entity_id, before_value, after_value, user_agent)
        values ('master.mapping.script_commit', 'production_output_mapping', $1, $2::jsonb, $3::jsonb, 'bc-metrics-script')
      `,
      [
        `${sourceField}:${sourceValue}`,
        JSON.stringify({ sourceSystem: SOURCE_SYSTEM, sourceField, sourceValue, mode: "dry-run-preview" }),
        JSON.stringify({
          sourceSystem: SOURCE_SYSTEM,
          sourceField,
          sourceValue,
          entityId,
          updatedRows: updated.rowCount ?? 0,
          resolvedIssues: issues.rowCount ?? 0
        })
      ]
    );

    await client.query("commit");
    console.log(`Commit: updated_rows=${updated.rowCount ?? 0}; resolved_issues=${issues.rowCount ?? 0}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
                and pt.daily_target_qty = 0
            ) then 'TARGET_ZERO'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
                and pt.daily_target_qty > 0
            ) then 'COVERED'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status not in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            ) then 'TARGET_NOT_APPROVED'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
            ) then 'OUTSIDE_EFFECTIVE_DATE'
            else 'NO_ACTIVE_TARGET'
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

function conversionGapSummary(pool: ReturnType<typeof createDatabase>["pool"]) {
  return pool.query(
    `
      select po.item_no,
             coalesce(po.uom, '') as uom,
             count(*) as rows,
             coalesce(sum(po.reject_kg), 0) as reject_kg,
             max(icm.gross_weight_per_pcs) as mapped_gross_weight_per_pcs
      from production_outputs po
      left join item_conversion_mappings icm
        on icm.is_active
       and upper(icm.item_no) = upper(po.item_no)
       and upper(coalesce(icm.uom, '')) = upper(coalesce(po.uom, ''))
      where po.source_system = $1
        and po.reject_kg > 0
        and (po.reject_pcs_eq is null or po.gross_weight_per_pcs is null or po.gross_weight_per_pcs <= 0)
      group by po.item_no, coalesce(po.uom, '')
      order by reject_kg desc, rows desc
      limit 20
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
  if (!["profile", "reconcile", "target-coverage", "mapping-candidates", "mapping-apply", "mapping-plan", "mapping-plan-apply"].includes(command)) {
    throw new Error("Usage: bc-metrics <profile|reconcile|target-coverage|mapping-candidates|mapping-apply|mapping-plan|mapping-plan-apply>");
  }
  const database = createDatabase({ connectionString: requireEnv("DATABASE_URL") });
  try {
    if (command === "profile") await runProfile(database.pool);
    else if (command === "reconcile") await runReconcile(database.pool);
    else if (command === "target-coverage") await runTargetCoverage(database.pool);
    else if (command === "mapping-candidates") await runMappingCandidates(database.pool);
    else if (command === "mapping-plan") await runMappingPlan(database.pool);
    else if (command === "mapping-plan-apply") await runMappingPlanApply(database.pool);
    else await runMappingApply(database.pool);
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown BC metrics error";
  console.error(message);
  process.exitCode = 1;
});
