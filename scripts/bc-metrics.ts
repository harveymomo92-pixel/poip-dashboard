import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardKpiSummary } from "../packages/domain/src/kpi/dashboard.js";
import { classifyOutputRow } from "../packages/domain/src/kpi/output-classification.js";
import { createDatabase } from "../packages/db/src/client.js";
import {
  buildDailyItemResume,
  DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES,
  DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS,
  isAttachedDailyItemResumeRejectAttachmentStatus,
  summarizeDailyItemResumeRejectDocuments,
  summarizeDailyItemResumeRejectConversions,
  DAILY_ITEM_RESUME_TARGET_REASONS,
  summarizeDailyItemResumeTargetReasons,
  type DailyItemResumeRow,
  type DailyItemResumeFilters,
  type DailyItemResumeRejectAttachmentStatus,
  type DailyItemResumeSourceRow,
  type DailyItemResumeTarget
} from "../apps/api/src/modules/dashboard/daily-item-resume.js";
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
  | "daily-item-resume"
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
  machine_description: "machine_description",
  machine_center_no: "machine_center_no",
  prod_line_description: "prod_line_description",
  prod_line_no: "prod_line_no",
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

function formatTableField(value: unknown): string {
  return String(value ?? "N/A").replace(/\s*\|\s*/g, " / ");
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
    throw new Error("SOURCE_FIELD must be one of machine_description, machine_center_no, prod_line_description, prod_line_no, item_no, uom");
  }
  return value;
}

function sqlNormalizeExpression(column: string): string {
  return `upper(regexp_replace(trim(coalesce(${column}, '')), '[^A-Za-z0-9]+', '', 'g'))`;
}

function preferredEntitySourceFieldSql(alias = "po"): string {
  return `
    case
      when nullif(btrim(${alias}.machine_description), '') is not null then 'machine_description'
      when nullif(btrim(${alias}.machine_center_no), '') is not null then 'machine_center_no'
      when nullif(btrim(${alias}.prod_line_description), '') is not null then 'prod_line_description'
      when nullif(btrim(${alias}.prod_line_no), '') is not null then 'prod_line_no'
      else 'blank'
    end
  `;
}

function preferredEntitySourceValueSql(alias = "po"): string {
  return `
    coalesce(
      nullif(btrim(${alias}.machine_description), ''),
      nullif(btrim(${alias}.machine_center_no), ''),
      nullif(btrim(${alias}.prod_line_description), ''),
      nullif(btrim(${alias}.prod_line_no), '')
    )
  `;
}

function outputEntryTypePredicate(alias?: string): string {
  const column = alias ? `${alias}.entry_type` : "entry_type";
  return `upper(coalesce(${column}, '')) = 'OUTPUT'`;
}

function okOutputPredicate(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `upper(coalesce(${prefix}item_no, '')) not like 'RJ%' and upper(coalesce(${prefix}uom, '')) = 'PCS'`;
}

function rejectOutputPredicate(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `upper(coalesce(${prefix}item_no, '')) like 'RJ%' and upper(coalesce(${prefix}uom, '')) = 'KG'`;
}

function rejectKgExpression(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `case when ${rejectOutputPredicate(alias)} then abs(${prefix}quantity) else 0 end`;
}

function rejectPcsEqExpression(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `case when ${rejectOutputPredicate(alias)} and ${prefix}gross_weight_per_pcs > 0 then abs(${prefix}quantity) / ${prefix}gross_weight_per_pcs else null end`;
}

function outputClassCase(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `
    case
      when ${okOutputPredicate(alias)} then 'OK'
      when ${rejectOutputPredicate(alias)} then 'REJECT'
      when upper(coalesce(${prefix}item_no, '')) like 'RJ%' then 'REJECT_UOM_MISMATCH'
      when nullif(btrim(coalesce(${prefix}item_no, '')), '') is not null then 'OK_UOM_MISMATCH'
      else 'UNKNOWN_OUTPUT_CLASS'
    end
  `;
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

function outputWhere(filters: Filters, alias?: string): SqlParts {
  const prefix = alias ? `${alias}.` : "";
  const clauses = [`${prefix}source_system = $1`, outputEntryTypePredicate(alias), `${prefix}posting_date >= $2`, `${prefix}posting_date <= $3`];
  const params: unknown[] = [SOURCE_SYSTEM, filters.from, filters.to];
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`${prefix}entity_id = $${params.length}`);
  }
  if (filters.itemNo) {
    params.push(filters.itemNo);
    clauses.push(`${prefix}item_no = $${params.length}`);
  }
  return { where: clauses.join(" and "), params };
}

async function queryDailyItemResumeSourceRows(pool: DatabasePool, filters: Filters): Promise<DailyItemResumeSourceRow[]> {
  const where = outputWhere(filters, "po");
  const result = await pool.query<{
    id: string;
    posting_date: string;
    document_no: string | null;
    external_document_no: string | null;
    normalized_output_type: string;
    item_no: string;
    item_description: string | null;
    item_category_code: string | null;
    machine_description: string | null;
    machine_center_no: string | null;
    prod_line_no: string | null;
    prod_line_description: string | null;
    entity_id: string | null;
    entity_code: string | null;
    entity_display_name: string | null;
    planned_runtime_hours: string | number | null;
    shift_code: string | null;
    operator_name: string | null;
    quantity: string | number;
    uom: string | null;
    gross_weight_per_pcs: string | number | null;
    mapped_gross_weight_per_pcs: string | number | null;
    mapped_gross_weight_source: string | null;
    reject_kg: string | number;
    reject_pcs_eq: string | number | null;
  }>(
    `
      select
        po.id,
        po.posting_date::text,
        po.document_no,
        po.external_document_no,
        po.normalized_output_type,
        po.item_no,
        po.item_description,
        po.item_category_code,
        po.machine_description,
        po.machine_center_no,
        po.prod_line_no,
        po.prod_line_description,
        po.entity_id,
        me.entity_code,
        me.display_name as entity_display_name,
        me.planned_runtime_hours,
        po.shift_code,
        po.operator_name,
        po.quantity,
        po.uom,
        po.gross_weight_per_pcs,
        icm.gross_weight_per_pcs as mapped_gross_weight_per_pcs,
        case when icm.gross_weight_per_pcs is not null then 'ITEM_CONVERSION_MAPPING' else null end as mapped_gross_weight_source,
        po.reject_kg,
        po.reject_pcs_eq
      from production_outputs po
      left join master_entities me on me.id = po.entity_id
      left join lateral (
        select gross_weight_per_pcs
        from item_conversion_mappings
        where item_no = po.item_no
          and uom = coalesce(po.uom, '')
          and is_active = true
        order by updated_at desc, created_at desc
        limit 1
      ) icm on true
      where ${where.where}
      order by po.posting_date desc, po.id asc
    `,
    where.params
  );

  return result.rows.map((row) => ({
    id: row.id,
    postingDate: dateText(row.posting_date),
    documentNo: row.document_no,
    externalDocumentNo: row.external_document_no,
    normalizedOutputType: row.normalized_output_type,
    itemNo: row.item_no,
    itemDescription: row.item_description,
    itemCategoryCode: row.item_category_code,
    machineDescription: row.machine_description,
    machineCenterNo: row.machine_center_no,
    prodLineNo: row.prod_line_no,
    prodLineDescription: row.prod_line_description,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityDisplayName: row.entity_display_name,
    plannedRuntimeHours: row.planned_runtime_hours === null ? null : numberValue(row.planned_runtime_hours),
    shiftCode: row.shift_code,
    operatorName: row.operator_name,
    quantity: numberValue(row.quantity),
    uom: row.uom,
    grossWeightPerPcs: row.gross_weight_per_pcs === null ? null : numberValue(row.gross_weight_per_pcs),
    mappedGrossWeightPerPcs: row.mapped_gross_weight_per_pcs === null ? null : numberValue(row.mapped_gross_weight_per_pcs),
    mappedGrossWeightSource: row.mapped_gross_weight_source === null ? null : "ITEM_CONVERSION_MAPPING",
    rejectKg: numberValue(row.reject_kg),
    rejectPcsEq: row.reject_pcs_eq === null ? null : numberValue(row.reject_pcs_eq)
  }));
}

async function queryDailyItemResumeTargets(pool: DatabasePool, filters: Filters): Promise<DailyItemResumeTarget[]> {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`entity_id = $${params.length}`);
  }
  const result = await pool.query<{
    entity_id: string;
    effective_from: string;
    effective_to: string | null;
    daily_target_qty: string | number;
    status: string | null;
  }>(
    `
      select entity_id, effective_from::text, effective_to::text, daily_target_qty, status
      from production_targets
      ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
      order by entity_id, effective_from desc
    `,
    params
  );
  return result.rows.map((row) => ({
    entityId: row.entity_id,
    effectiveFrom: dateText(row.effective_from),
    effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
    dailyTargetQty: numberValue(row.daily_target_qty),
    status: row.status
  }));
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
        count(*) filter (where ${okOutputPredicate()}) as ok_rows,
        count(*) filter (where entity_id is not null and ${okOutputPredicate()}) as mapped_ok_rows,
        count(*) filter (where entity_id is null and ${okOutputPredicate()}) as unmapped_ok_rows,
        coalesce(sum(quantity) filter (where entity_id is null and ${okOutputPredicate()}), 0) as unmapped_ok_qty
      from production_outputs
      where source_system = $1
        and ${outputEntryTypePredicate()}
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
        select ${preferredEntitySourceFieldSql("po")}::text as source_field,
               ${preferredEntitySourceValueSql("po")} as source_value,
               po.posting_date,
               po.quantity
        from production_outputs po
        where po.source_system = $1 and ${outputEntryTypePredicate("po")} and po.entity_id is null and ${okOutputPredicate("po")}
      )
      select source_field,
             coalesce(source_value, '') as source_value,
             upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
             count(*) as rows,
             coalesce(sum(quantity), 0) as ok_qty,
             min(posting_date)::text as first_posting_date,
             max(posting_date)::text as last_posting_date
      from source_rows
      where source_field <> 'blank'
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
        coalesce(sum(po.quantity) filter (where po.entity_id is null and ${okOutputPredicate("po")}), 0) as ok_qty,
        count(*) filter (
          where po.entity_id is null
            and ${okOutputPredicate("po")}
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

async function printEntitySourceUsage(pool: DatabasePool, title = "Entity source usage") {
  await printRows(
    title,
    pool.query(
      `
        select ${preferredEntitySourceFieldSql("po")} as source_field,
               count(*) as rows,
               count(*) filter (where po.entity_id is null) as unmapped_rows,
               coalesce(sum(po.quantity) filter (where ${okOutputPredicate("po")}), 0) as ok_qty
        from production_outputs po
        where po.source_system = $1
          and ${outputEntryTypePredicate("po")}
        group by 1
        order by rows desc, source_field asc
      `,
      [SOURCE_SYSTEM]
    )
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
      count(*) filter (where ${okOutputPredicate()}) as ok_rows,
      count(*) filter (where ${rejectOutputPredicate()}) as reject_rows,
      count(*) filter (where entity_id is null) as unmapped_rows,
      count(*) filter (where ${rejectOutputPredicate()} and (gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)) as conversion_gaps
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
    "Rows by item/UOM output classification",
    pool.query(
      `select ${outputClassCase()} as output_class, count(*) as rows, coalesce(sum(quantity), 0) as quantity
       from production_outputs
       where source_system = $1
       group by 1
       order by rows desc, output_class asc`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Top unmapped preferred source output",
    pool.query(
      `select ${preferredEntitySourceFieldSql("po")} as source_field,
              coalesce(${preferredEntitySourceValueSql("po")}, '(blank)') as source_value,
              count(*) as rows,
              coalesce(sum(case when ${okOutputPredicate("po")} then po.quantity else 0 end), 0) as ok_qty
       from production_outputs po
       where po.source_system = $1 and po.entity_id is null
       group by 1, 2
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
       where po.source_system = $1 and ${okOutputPredicate("po")}
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
  await printEntitySourceUsage(pool);
  await printRows(
    "Top items by OK quantity",
    pool.query(
      `select item_no,
              left(coalesce(max(item_description), ''), 60) as item_description,
              count(*) as rows,
              coalesce(sum(quantity), 0) as ok_qty
       from production_outputs
       where source_system = $1 and ${okOutputPredicate()}
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

  const [aggregate, activeDays, targets, latestSync, sourceRows] = await Promise.all([
    pool.query<{
      output_ok_qty: string | number | null;
      raw_ok_qty: string | number | null;
      reject_kg: string | number | null;
      reject_pcs_equivalent: string | number | null;
      incomplete_reject_conversion_count: string | number | null;
      active_days: string | number | null;
      ok_rows: string | number;
      reject_rows: string | number;
      reject_conversion_complete_count: string | number;
      raw_rows: string | number;
      excluded_rows: string | number;
    }>(
      `
        select
          coalesce(sum(case when ${okOutputPredicate()} then quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as raw_ok_qty,
          coalesce(sum(${rejectKgExpression()}), 0) as reject_kg,
          coalesce(sum(${rejectPcsEqExpression()}), 0) as reject_pcs_equivalent,
          count(*) filter (where ${rejectOutputPredicate()} and (gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)) as incomplete_reject_conversion_count,
          count(distinct posting_date) filter (where ${okOutputPredicate()}) as active_days,
          count(*) filter (where ${okOutputPredicate()}) as ok_rows,
          count(*) filter (where ${rejectOutputPredicate()}) as reject_rows,
          count(*) filter (where ${rejectOutputPredicate()} and gross_weight_per_pcs > 0) as reject_conversion_complete_count,
          count(*) as raw_rows,
          count(*) filter (where not (${okOutputPredicate()})) as excluded_rows
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
          and ${okOutputPredicate()}
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
    ),
    queryDailyItemResumeSourceRows(pool, filters)
  ]);

  const row = aggregate.rows[0];
  const conversionRows = buildDailyItemResume(sourceRows, [], {
    from: filters.from,
    to: filters.to,
    sourceSystem: SOURCE_SYSTEM,
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.itemNo ? { itemNo: filters.itemNo } : {}),
    page: 1,
    pageSize: Math.max(sourceRows.length, 1),
    sort: "postingDate.desc"
  }).rows;
  const conversionTotals = summarizeDailyItemResumeRejectConversions(conversionRows);
  const coverage = computeCoverage(activeDays.rows, targets.rows);
  const kpis = buildDashboardKpiSummary({
    outputOkQty: numberValue(row?.output_ok_qty),
    rejectKg: numberValue(row?.reject_kg),
    rejectPcsEquivalent: conversionTotals.rejectPcsEquivalent,
    prorataTarget: coverage.prorataTarget,
    hasTarget: coverage.hasTarget,
    activeDays: numberValue(row?.active_days),
    incompleteRejectConversionCount: conversionTotals.incompleteCount,
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
  if (kpis.rejectConversionStatus === "INCOMPLETE") warnings.push("Reject PCS equivalent is incomplete because one or more reject rows lack a safe OK-item gross weight conversion.");
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
  console.log(`OK rows count: ${row?.ok_rows ?? 0}; reject rows count: ${row?.reject_rows ?? 0}`);
  console.log(`Reject PCS Eq complete/incomplete count: ${conversionTotals.completeCount}/${conversionTotals.incompleteCount}`);
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

function topResumeValues(
  rows: readonly DailyItemResumeRow[],
  pickLabel: (row: DailyItemResumeRow) => string,
  limit = 3
): string {
  const grouped = new Map<string, { rows: number; netOutput: number }>();
  for (const row of rows) {
    const label = pickLabel(row) || "N/A";
    const current = grouped.get(label) ?? { rows: 0, netOutput: 0 };
    current.rows += 1;
    current.netOutput += row.netOutputQty;
    grouped.set(label, current);
  }
  const values = [...grouped.entries()]
    .sort((left, right) => right[1].rows - left[1].rows || Math.abs(right[1].netOutput) - Math.abs(left[1].netOutput) || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, value]) => `${label} (${value.rows} rows, net=${formatNumber(value.netOutput, 2)})`);
  return values.length ? values.join(" | ") : "none";
}

function sampleResumeRows(rows: readonly DailyItemResumeRow[], limit = 3): string {
  const samples = rows.slice(0, limit).map((row) => (
    `${row.postingDate}; machine_display=${row.machineDisplay}; machine_label=${row.machineLabel}; ${row.itemNo}; net=${formatNumber(row.netOutputQty, 2)}; bucket=${row.targetBucketLabel ?? row.targetBucket ?? "N/A"}; target=${row.dailyTarget ?? "N/A"}`
  ));
  return samples.length ? samples.join(" | ") : "none";
}

function rejectAttachmentStatus(detail: Record<string, unknown>): DailyItemResumeRejectAttachmentStatus | null {
  const status = typeof detail.attachmentStatus === "string" ? detail.attachmentStatus : "";
  if (status === "NONE" || DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES.includes(status as Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">)) {
    return status as DailyItemResumeRejectAttachmentStatus;
  }
  return null;
}

function rejectAttachmentCandidates(detail: Record<string, unknown>): readonly Record<string, unknown>[] {
  return Array.isArray(detail.attachmentCandidates)
    ? detail.attachmentCandidates.filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === "object")
    : [];
}

function rejectConversionGapReason(detail: Record<string, unknown>): typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number] | null {
  const reason = typeof detail.conversionGapReason === "string" ? detail.conversionGapReason : "";
  return DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS.includes(reason as typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number])
    ? reason as typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number]
    : null;
}

function buildRejectAttachmentStatusBreakdown(rows: readonly DailyItemResumeRow[]) {
  const breakdown = new Map<Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">, { rejectRows: number; groups: number; rejectKg: number }>();
  for (const status of DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES) {
    breakdown.set(status, { rejectRows: 0, groups: 0, rejectKg: 0 });
  }
  for (const row of rows) {
    const groupStatuses = new Set<Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">>();
    for (const detail of row.rejectDetails) {
      const status = rejectAttachmentStatus(detail);
      if (!status || status === "NONE") continue;
      const current = breakdown.get(status);
      if (!current) continue;
      current.rejectRows += 1;
      current.rejectKg += numberValue(detail.rejectKg as string | number | null | undefined);
      groupStatuses.add(status);
    }
    for (const status of groupStatuses) {
      const current = breakdown.get(status);
      if (current) current.groups += 1;
    }
  }
  return breakdown;
}

function buildRejectConversionGapBreakdown(rows: readonly DailyItemResumeRow[]) {
  const breakdown = new Map<typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number], { rows: number; rejectKg: number }>();
  for (const reason of DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS) {
    breakdown.set(reason, { rows: 0, rejectKg: 0 });
  }
  for (const row of rows) {
    for (const detail of row.rejectDetails) {
      if (detail.conversionStatus !== "INCOMPLETE") continue;
      const reason = rejectConversionGapReason(detail) ?? "MISSING_OK_GROSS_WEIGHT";
      const current = breakdown.get(reason);
      if (!current) continue;
      current.rows += 1;
      current.rejectKg += numberValue(detail.rejectKg as string | number | null | undefined);
    }
  }
  return breakdown;
}

function printDailyItemResumeTargetBreakdown(rows: readonly DailyItemResumeRow[]) {
  console.log("");
  console.log("Target reason breakdown:");
  const summaries = summarizeDailyItemResumeTargetReasons(rows);
  for (const reason of DAILY_ITEM_RESUME_TARGET_REASONS) {
    const summary = summaries.find((item) => item.reason === reason);
    const reasonRows = rows.filter((row) => row.targetReason === reason);
    console.log(`- ${reason}: rows=${summary?.rowCount ?? 0}; net_output=${formatNumber(summary?.netOutputQty ?? 0, 4)}`);
    console.log(`  top_machines=${topResumeValues(reasonRows, (row) => row.machineLabel)}`);
    console.log(`  top_items=${topResumeValues(reasonRows, (row) => row.itemNo)}`);
    console.log(`  samples=${sampleResumeRows(reasonRows)}`);
  }
}

async function runDailyItemResume(pool: DatabasePool) {
  const baseFilters = buildFilters();
  const filters: DailyItemResumeFilters = {
    ...baseFilters,
    sourceSystem: SOURCE_SYSTEM,
    page: 1,
    pageSize: 20,
    sort: "postingDate.desc"
  };
  const [sourceRows, targets] = await Promise.all([
    queryDailyItemResumeSourceRows(pool, baseFilters),
    queryDailyItemResumeTargets(pool, baseFilters)
  ]);
  const resume = buildDailyItemResume(sourceRows, targets, filters);
  const allRows = buildDailyItemResume(sourceRows, targets, { ...filters, pageSize: Math.max(1, sourceRows.length) }).rows;
  const classificationCounts = sourceRows.reduce(
    (acc, row) => {
      const classification = classifyOutputRow({ entryType: "Output", itemNo: row.itemNo, uom: row.uom });
      if (classification === "OK") acc.okRows += 1;
      else if (classification === "REJECT") acc.rejectRows += 1;
      else acc.unknownRows += 1;
      return acc;
    },
    { okRows: 0, rejectRows: 0, unknownRows: 0 }
  );
  const totals = allRows.reduce(
    (acc, row) => ({
      netOutput: acc.netOutput + row.netOutputQty,
      positiveOutput: acc.positiveOutput + row.positiveOutputQty,
      correctionOutput: acc.correctionOutput + row.correctionOutputQty,
      rejectAttachedCount: acc.rejectAttachedCount + row.rejectDetails.filter((detail) => {
        const status = rejectAttachmentStatus(detail);
        return status ? isAttachedDailyItemResumeRejectAttachmentStatus(status) : false;
      }).length,
      rejectOnlyGroupCount: acc.rejectOnlyGroupCount + (row.rejectAttachmentStatus === "REJECT_ONLY" ? 1 : 0),
      ambiguousRejectAttachmentCount: acc.ambiguousRejectAttachmentCount + (row.rejectAttachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT" ? 1 : 0),
      totalRejectKg: acc.totalRejectKg + row.rejectKg,
      conversionCompleteCount: acc.conversionCompleteCount + row.rejectDetails.filter((detail) => detail.conversionStatus === "COMPLETE").length,
      conversionGaps: acc.conversionGaps + row.rejectDetails.filter((detail) => detail.conversionStatus === "INCOMPLETE").length,
      targetMissingCount: acc.targetMissingCount + (row.dailyTarget === null ? 1 : 0),
      targetNonMatchedCount: acc.targetNonMatchedCount + (row.targetReason === "TARGET_MATCHED" ? 0 : 1)
    }),
    { netOutput: 0, positiveOutput: 0, correctionOutput: 0, rejectAttachedCount: 0, rejectOnlyGroupCount: 0, ambiguousRejectAttachmentCount: 0, totalRejectKg: 0, conversionCompleteCount: 0, conversionGaps: 0, targetMissingCount: 0, targetNonMatchedCount: 0 }
  );
  const rejectAttachmentBreakdown = buildRejectAttachmentStatusBreakdown(allRows);
  const rejectConversionGapBreakdown = buildRejectConversionGapBreakdown(allRows);

  console.log("Business Central daily item resume");
  console.log(`Window: ${baseFilters.from} to ${baseFilters.to}`);
  console.log(`Raw Output row count: ${sourceRows.length}`);
  console.log(`OK rows count: ${classificationCounts.okRows}`);
  console.log(`Reject rows count: ${classificationCounts.rejectRows}`);
  console.log(`Unknown/mismatch output rows count: ${classificationCounts.unknownRows}`);
  console.log(`Grouped resume row count: ${resume.pagination.totalRows}`);
  console.log(`Net output: ${formatNumber(totals.netOutput, 4)}`);
  console.log(`Positive output: ${formatNumber(totals.positiveOutput, 4)}`);
  console.log(`Correction output: ${formatNumber(totals.correctionOutput, 4)}`);
  console.log(`Reject attached count: ${totals.rejectAttachedCount}`);
  console.log(`Reject-only group count: ${totals.rejectOnlyGroupCount}`);
  console.log(`Ambiguous reject attachment count: ${totals.ambiguousRejectAttachmentCount}`);
  console.log(`Total reject kg: ${formatNumber(totals.totalRejectKg, 4)}`);
  console.log(`Reject PCS Eq complete/incomplete count: ${totals.conversionCompleteCount}/${totals.conversionGaps}`);
  console.log("Reject conversion gap breakdown:");
  for (const reason of DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS) {
    const value = rejectConversionGapBreakdown.get(reason) ?? { rows: 0, rejectKg: 0 };
    console.log(`- ${reason}: rows=${value.rows}; reject_kg=${formatNumber(value.rejectKg, 4)}`);
  }
  console.log("Reject attachment status breakdown:");
  for (const status of DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES) {
    const value = rejectAttachmentBreakdown.get(status) ?? { rejectRows: 0, groups: 0, rejectKg: 0 };
    console.log(`- ${status}: reject_rows=${value.rejectRows}; groups=${value.groups}; reject_kg=${formatNumber(value.rejectKg, 4)}`);
  }
  console.log(`Target missing count: ${totals.targetMissingCount}`);
  console.log(`Target non-matched count: ${totals.targetNonMatchedCount}`);
  await printEntitySourceUsage(pool);
  printDailyItemResumeTargetBreakdown(allRows);
  console.log("Top reject documents:");
  const topRejectDocuments = [...summarizeDailyItemResumeRejectDocuments(allRows)]
    .sort((left, right) => right.rejectKg - left.rejectKg || right.rows - left.rows)
    .slice(0, 5);
  if (topRejectDocuments.length === 0) console.log("- none");
  for (const value of topRejectDocuments) {
    console.log(`- ${value.documentNo}: reject_kg=${formatNumber(value.rejectKg, 4)}; rows=${value.rows}; ok_items=${value.okItems.join(", ") || "none"}; reject_items=${value.rejectItems.join(", ") || "none"}`);
  }
  const attachedSample = allRows.flatMap((row) =>
    row.rejectDetails
      .filter((detail) => {
        const status = rejectAttachmentStatus(detail);
        return status ? isAttachedDailyItemResumeRejectAttachmentStatus(status) : false;
      })
      .map((detail) => ({ row, detail }))
  )[0];
  console.log("Sample attached reject:");
  if (attachedSample) {
    const status = rejectAttachmentStatus(attachedSample.detail) ?? "N/A";
    console.log(
      `- ${String(attachedSample.detail.documentNo ?? "N/A")}: OK item ${attachedSample.row.itemNo}; Reject item ${String(attachedSample.detail.itemNo ?? "N/A")}; reject_kg=${formatNumber(numberValue(attachedSample.detail.rejectKg as string | number | null | undefined), 4)}; status=${status}`
    );
  } else {
    console.log("- none");
  }
  console.log("Reject conversion gap examples:");
  const allGapExamples = allRows.flatMap((row) =>
    row.rejectDetails
      .filter((detail) => detail.conversionStatus === "INCOMPLETE")
      .map((detail) => ({ row, detail }))
  );
  const gapExamples = DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS.flatMap((reason) =>
    allGapExamples.filter((example) => rejectConversionGapReason(example.detail) === reason).slice(0, 2)
  ).slice(0, 8);
  if (gapExamples.length === 0) {
    console.log("- none");
  }
  for (const example of gapExamples) {
    const status = rejectAttachmentStatus(example.detail) ?? "N/A";
    const hasMatchedOk = status !== "N/A" && isAttachedDailyItemResumeRejectAttachmentStatus(status as DailyItemResumeRejectAttachmentStatus);
    console.log(`- document_no=${String(example.detail.documentNo ?? "N/A")}`);
    console.log(`  reject_item=${String(example.detail.itemNo ?? "N/A")}`);
    console.log(`  reject_kg=${formatNumber(numberValue(example.detail.rejectKg as string | number | null | undefined), 4)}`);
    console.log(`  attachment_status=${status}`);
    console.log(`  ok_item=${hasMatchedOk ? example.row.itemNo : "N/A"}`);
    console.log(`  ok_item_description=${hasMatchedOk ? example.row.itemDescription ?? "N/A" : "N/A"}`);
    console.log(`  ok_gross_weight=${example.detail.grossWeight === null || typeof example.detail.grossWeight === "undefined" ? "N/A" : formatNumber(numberValue(example.detail.grossWeight as string | number | null | undefined), 6)}`);
    console.log(`  gross_weight_source=${String(example.detail.grossWeightSource ?? "N/A")}`);
    console.log(`  reason=${rejectConversionGapReason(example.detail) ?? "MISSING_OK_GROSS_WEIGHT"}`);
  }
  console.log("Ambiguous reject examples:");
  const ambiguousExamples = allRows.flatMap((row) =>
    row.rejectAttachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT"
      ? row.rejectDetails.map((detail) => ({ row, detail }))
      : []
  ).slice(0, 3);
  if (ambiguousExamples.length === 0) {
    console.log("- none");
  }
  for (const example of ambiguousExamples) {
    const candidates = rejectAttachmentCandidates(example.detail);
    console.log(`- document_no=${String(example.detail.documentNo ?? "N/A")}`);
    console.log(`  reject_item=${String(example.detail.itemNo ?? "N/A")}`);
    console.log(`  reject_kg=${formatNumber(numberValue(example.detail.rejectKg as string | number | null | undefined), 4)}`);
    console.log(`  candidate_count=${candidates.length}`);
    console.log("  candidates=");
    if (candidates.length === 0) {
      console.log("    none");
      continue;
    }
    console.log("    posting_date | machine | item_no | item_description | net_output | operator | shift | work_hours");
    for (const candidate of candidates.slice(0, 5)) {
      console.log(
        `    ${formatTableField(candidate.postingDate)} | ${formatTableField(candidate.machine)} | ${formatTableField(candidate.itemNo)} | ${formatTableField(candidate.itemDescription)} | ${formatNumber(numberValue(candidate.netOutput as string | number | null | undefined), 4)} | ${formatTableField(candidate.operator)} | ${formatTableField(candidate.shift)} | ${formatTableField(candidate.workHours)}`
      );
    }
  }
  console.log("Sample grouped rows:");
  for (const row of resume.rows.slice(0, 5)) {
    console.log(`- ${row.postingDate}; machine_display=${row.machineDisplay}; machine_label=${row.machineLabel}; ${row.itemNo}; net=${formatNumber(row.netOutputQty, 4)}; correction=${formatNumber(row.correctionOutputQty, 4)}; rejectKg=${formatNumber(row.rejectKg, 4)}; target=${row.dailyTarget ?? "N/A"}; reason=${row.targetReason}; achievement=${formatPct(row.achievementPct)}; status=${row.achievementStatus}`);
  }
}

async function runTargetCoverage(pool: ReturnType<typeof createDatabase>["pool"]) {
  console.log("Business Central target coverage");
  await printEntitySourceUsage(pool);
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
  await printEntitySourceUsage(pool);

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
    "Top unmapped by machine_description",
    pool.query(
      `
        select coalesce(machine_description, '(blank)') as machine_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by machine_center_no fallback",
    pool.query(
      `
        select coalesce(machine_center_no, '(blank)') as machine_center_no,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
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
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
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
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by preferred source/machine/prod-line",
    pool.query(
      `
        select ${preferredEntitySourceFieldSql("po")} as source_field,
               coalesce(${preferredEntitySourceValueSql("po")}, '(blank)') as source_value,
               coalesce(machine_description, '(blank)') as machine_description,
               coalesce(machine_center_no, '(blank)') as machine_center_no,
               coalesce(prod_line_no, '(blank)') as prod_line_no,
               coalesce(prod_line_description, '(blank)') as prod_line_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate("po")}), 0) as ok_qty
        from production_outputs po
        where po.source_system = $1 and ${outputEntryTypePredicate("po")} and po.entity_id is null
        group by 1, 2, 3, 4, 5, 6
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
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
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
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
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
  await printEntitySourceUsage(pool);

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
        coalesce(sum(quantity) filter (where entity_id is null and ${okOutputPredicate()}), 0) as ok_qty
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
          ${preferredEntitySourceFieldSql("po")} as source_field,
          ${preferredEntitySourceValueSql("po")} as source_value,
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
          and ${outputEntryTypePredicate("po")}
          and ${okOutputPredicate("po")}
      )
      select
        output_rows.month,
        output_rows.source_field,
        coalesce(me.display_name, output_rows.source_value, 'Unmapped') as entity_or_machine,
        output_rows.coverage_status,
        count(*) as rows,
        coalesce(sum(output_rows.quantity), 0) as ok_qty
      from output_rows
      left join master_entities me on me.id = output_rows.entity_id
      group by output_rows.month, output_rows.source_field, coalesce(me.display_name, output_rows.source_value, 'Unmapped'), output_rows.coverage_status
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
             coalesce(sum(${rejectKgExpression("po")}), 0) as reject_kg,
             max(icm.gross_weight_per_pcs) as mapped_gross_weight_per_pcs
      from production_outputs po
      left join item_conversion_mappings icm
        on icm.is_active
       and upper(icm.item_no) = upper(po.item_no)
       and upper(coalesce(icm.uom, '')) = upper(coalesce(po.uom, ''))
      where po.source_system = $1
        and ${rejectOutputPredicate("po")}
        and (po.gross_weight_per_pcs is null or po.gross_weight_per_pcs <= 0)
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
  if (!["profile", "reconcile", "target-coverage", "daily-item-resume", "mapping-candidates", "mapping-apply", "mapping-plan", "mapping-plan-apply"].includes(command)) {
    throw new Error("Usage: bc-metrics <profile|reconcile|target-coverage|daily-item-resume|mapping-candidates|mapping-apply|mapping-plan|mapping-plan-apply>");
  }
  const database = createDatabase({ connectionString: requireEnv("DATABASE_URL") });
  try {
    if (command === "profile") await runProfile(database.pool);
    else if (command === "reconcile") await runReconcile(database.pool);
    else if (command === "target-coverage") await runTargetCoverage(database.pool);
    else if (command === "daily-item-resume") await runDailyItemResume(database.pool);
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
