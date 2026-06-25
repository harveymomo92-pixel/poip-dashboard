import { buildDashboardKpiSummary } from "../packages/domain/src/kpi/dashboard.js";
import { createDatabase } from "../packages/db/src/client.js";
import {
  isMasterSourceField,
  normalizeAliasDisplay,
  normalizeAliasKey,
  type MasterSourceField
} from "../packages/domain/src/master-data/alias.js";

const SOURCE_SYSTEM = "business-central";

type Command = "profile" | "reconcile" | "target-coverage" | "mapping-candidates" | "mapping-apply";

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

function similarity(source: string, target: string): number {
  const left = normalizeAliasKey(source);
  const right = normalizeAliasKey(target);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 80;
  let common = 0;
  for (const char of new Set(left)) if (right.includes(char)) common += 1;
  return Math.round((common / Math.max(new Set([...left, ...right]).size, 1)) * 60);
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

  const [groups, entities] = await Promise.all([
    pool.query<{
      source_field: MasterSourceField;
      source_value: string;
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
               source_value,
               upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
               count(*) as rows,
               coalesce(sum(quantity), 0) as ok_qty,
               min(posting_date)::text as first_posting_date,
               max(posting_date)::text as last_posting_date
        from source_rows
        where source_value is not null and source_value <> ''
        group by source_field, source_value
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    ),
    pool.query<{
      entity_id: string;
      entity_code: string;
      display_name: string;
      alias_values: string[] | null;
    }>(
      `
        select me.id as entity_id,
               me.entity_code,
               me.display_name,
               array_remove(array_agg(distinct mea.alias), null) as alias_values
        from master_entities me
        left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active
        where me.is_active
        group by me.id
        order by me.entity_code
        limit 500
      `
    )
  ]);

  if (groups.rows.length === 0) {
    console.log("- no unmapped source groups found");
    return;
  }
  for (const group of groups.rows) {
    const candidates = entities.rows
      .flatMap((entity) => {
        const score = Math.max(
          ...[entity.entity_code, entity.display_name, ...(entity.alias_values ?? [])].map((value) => similarity(group.source_value, value))
        );
        return score >= 30
          ? [`${entity.entity_code} (${score})`]
          : [];
      })
      .slice(0, 3);
    console.log(
      `- source_field=${group.source_field}; source_value=${group.source_value}; normalized=${group.normalized_value}; rows=${group.rows}; ok_qty=${group.ok_qty}; range=${group.first_posting_date ?? "N/A"}..${group.last_posting_date ?? "N/A"}; candidates=${candidates.join(", ") || "none"}`
    );
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
  if (!["profile", "reconcile", "target-coverage", "mapping-candidates", "mapping-apply"].includes(command)) {
    throw new Error("Usage: bc-metrics <profile|reconcile|target-coverage|mapping-candidates|mapping-apply>");
  }
  const database = createDatabase({ connectionString: requireEnv("DATABASE_URL") });
  try {
    if (command === "profile") await runProfile(database.pool);
    else if (command === "reconcile") await runReconcile(database.pool);
    else if (command === "target-coverage") await runTargetCoverage(database.pool);
    else if (command === "mapping-candidates") await runMappingCandidates(database.pool);
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
