import {
  createV2Database,
  formatNumber,
  loadLocalV1Plan,
  loadV2OutputRows,
  optionalDateEnv,
  printPlanSummary,
  SOURCE_SYSTEM
} from "./v1-master-lib.js";
import {
  estimateV1Reconcile,
  type V1AliasPlan,
  type V1ConversionPlan,
  type V1ImportPlan,
  type V1MasterEntityPlan,
  type V1TargetPlan
} from "../packages/domain/src/master-data/v1-import.js";

interface QueryResult<T> {
  readonly rows: T[];
  readonly rowCount: number | null;
}

interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, values?: unknown[]): Promise<QueryResult<T>>;
}

interface ImportSummary {
  readonly mode: "DRY_RUN" | "COMMIT";
  readonly allowUpdate: boolean;
  readonly effectiveFrom: string;
  readonly entities: MutableCounts;
  readonly aliases: MutableCounts;
  readonly targets: MutableCounts;
  readonly conversions: MutableCounts;
  readonly outputMappings: {
    matchedRows: number;
    updatedRows: number;
    alreadyMappedRows: number;
    conflictRows: number;
  };
  auditLogged: boolean;
  warnings: string[];
}

interface MutableCounts {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

type EntityMap = Map<string, string>;

const IMPORT_SOURCE = "v1-master-import";

function emptyCounts(): MutableCounts {
  return { inserted: 0, updated: 0, skipped: 0, conflicts: 0 };
}

function numberEqual(left: string | number | null | undefined, right: number | null | undefined, digits = 4): boolean {
  if (right === null || right === undefined) return left === null || left === undefined || left === "";
  const parsed = Number(left);
  return Number.isFinite(parsed) && Math.abs(parsed - right) < 10 ** -digits;
}

function sameNullableText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "") === (right ?? "");
}

function entityMatches(existing: Record<string, unknown>, entity: V1MasterEntityPlan): boolean {
  return (
    existing.display_name === entity.displayName &&
    sameNullableText(existing.area as string | null, entity.area) &&
    sameNullableText(existing.line_code as string | null, entity.lineCode) &&
    sameNullableText(existing.product_family as string | null, entity.productFamily) &&
    sameNullableText(existing.report_group as string | null, entity.reportGroup) &&
    numberEqual(existing.planned_runtime_hours as string | number | null, 24, 2) &&
    existing.is_active === true
  );
}

function targetMatches(existing: Record<string, unknown>, target: V1TargetPlan, effectiveFrom: string): boolean {
  return (
    String(existing.effective_from).slice(0, 10) === effectiveFrom &&
    existing.effective_to === null &&
    numberEqual(existing.daily_target_qty as string | number | null, target.dailyTargetQty, 4) &&
    numberEqual(existing.reject_target_pct as string | number | null, target.rejectTargetPct, 4) &&
    numberEqual(existing.min_achievement_pct as string | number | null, target.minAchievementPct, 4) &&
    numberEqual(existing.max_achievement_pct as string | number | null, target.maxAchievementPct, 4) &&
    (existing.status === "APPROVED" || existing.status === "ACTIVE")
  );
}

async function importEntities(
  db: Queryable,
  plan: V1ImportPlan,
  summary: ImportSummary,
  commit: boolean,
  allowUpdate: boolean
): Promise<{ entityIds: EntityMap; unavailable: Set<string> }> {
  const entityIds: EntityMap = new Map();
  const unavailable = new Set<string>();
  for (const entity of plan.entities) {
    const existing = await db.query<{
      id: string;
      display_name: string;
      area: string | null;
      line_code: string | null;
      product_family: string | null;
      report_group: string | null;
      planned_runtime_hours: string | number;
      is_active: boolean;
    }>(
      `
        select id::text, display_name, area, line_code, product_family, report_group, planned_runtime_hours, is_active
        from master_entities
        where entity_code = $1
        limit 1
      `,
      [entity.entityCode]
    );
    const row = existing.rows[0];
    if (!row) {
      summary.entities.inserted += 1;
      if (commit) {
        const inserted = await db.query<{ id: string }>(
          `
            insert into master_entities
              (entity_code, display_name, area, line_code, product_family, report_group, planned_runtime_hours, is_active)
            values ($1, $2, $3, $4, $5, $6, '24', true)
            returning id::text
          `,
          [entity.entityCode, entity.displayName, entity.area, entity.lineCode, entity.productFamily, entity.reportGroup]
        );
        entityIds.set(entity.importKey, inserted.rows[0]!.id);
      } else {
        entityIds.set(entity.importKey, `dry-run:${entity.entityCode}`);
      }
      continue;
    }

    entityIds.set(entity.importKey, row.id);
    if (entityMatches(row, entity)) {
      summary.entities.skipped += 1;
      continue;
    }
    if (!allowUpdate) {
      summary.entities.conflicts += 1;
      unavailable.add(entity.importKey);
      summary.warnings.push(`Entity differs and V1_IMPORT_ALLOW_UPDATE is not true: ${entity.entityCode}`);
      continue;
    }
    summary.entities.updated += 1;
    if (commit) {
      await db.query(
        `
          update master_entities
          set display_name = $2,
              area = $3,
              line_code = $4,
              product_family = $5,
              report_group = $6,
              planned_runtime_hours = '24',
              is_active = true,
              updated_at = now()
          where id = $1
        `,
        [row.id, entity.displayName, entity.area, entity.lineCode, entity.productFamily, entity.reportGroup]
      );
    }
  }
  return { entityIds, unavailable };
}

async function importTargets(
  db: Queryable,
  plan: V1ImportPlan,
  summary: ImportSummary,
  entityIds: EntityMap,
  unavailable: ReadonlySet<string>,
  commit: boolean,
  allowUpdate: boolean,
  effectiveFrom: string
): Promise<void> {
  for (const target of plan.targets) {
    const entityId = entityIds.get(target.entityImportKey);
    if (!entityId || unavailable.has(target.entityImportKey)) {
      summary.targets.skipped += 1;
      continue;
    }
    if (entityId.startsWith("dry-run:")) {
      summary.targets.inserted += 1;
      continue;
    }
    const existing = await db.query<{
      id: string;
      effective_from: string;
      effective_to: string | null;
      daily_target_qty: string | number;
      reject_target_pct: string | number | null;
      min_achievement_pct: string | number;
      max_achievement_pct: string | number;
      status: string;
    }>(
      `
        select id::text, effective_from::text, effective_to::text, daily_target_qty, reject_target_pct,
               min_achievement_pct, max_achievement_pct, status
        from production_targets
        where entity_id = $1::uuid and target_version = $2
        limit 1
      `,
      [entityId, target.targetVersion]
    );
    const row = existing.rows[0];
    if (!row) {
      summary.targets.inserted += 1;
      if (commit) {
        await db.query(
          `
            insert into production_targets
              (entity_id, target_version, effective_from, effective_to, daily_target_qty,
               reject_target_pct, min_achievement_pct, max_achievement_pct, status, approved_at)
            values ($1::uuid, $2, $3::date, null, $4, $5, $6, $7, 'APPROVED', now())
          `,
          [
            entityId,
            target.targetVersion,
            effectiveFrom,
            target.dailyTargetQty.toString(),
            target.rejectTargetPct === null ? null : target.rejectTargetPct.toString(),
            target.minAchievementPct.toString(),
            target.maxAchievementPct.toString()
          ]
        );
      }
      continue;
    }
    if (targetMatches(row, target, effectiveFrom)) {
      summary.targets.skipped += 1;
      continue;
    }
    if (!allowUpdate) {
      summary.targets.conflicts += 1;
      summary.warnings.push(`Target differs and V1_IMPORT_ALLOW_UPDATE is not true: ${target.entityCode}`);
      continue;
    }
    summary.targets.updated += 1;
    if (commit) {
      await db.query(
        `
          update production_targets
          set effective_from = $2::date,
              effective_to = null,
              daily_target_qty = $3,
              reject_target_pct = $4,
              min_achievement_pct = $5,
              max_achievement_pct = $6,
              status = 'APPROVED',
              approved_at = coalesce(approved_at, now())
          where id = $1::uuid
        `,
        [
          row.id,
          effectiveFrom,
          target.dailyTargetQty.toString(),
          target.rejectTargetPct === null ? null : target.rejectTargetPct.toString(),
          target.minAchievementPct.toString(),
          target.maxAchievementPct.toString()
        ]
      );
    }
  }
}

async function importAliases(
  db: Queryable,
  plan: V1ImportPlan,
  summary: ImportSummary,
  entityIds: EntityMap,
  unavailable: ReadonlySet<string>,
  commit: boolean,
  allowUpdate: boolean
): Promise<Array<V1AliasPlan & { entityId: string }>> {
  const usableAliases: Array<V1AliasPlan & { entityId: string }> = [];
  for (const alias of plan.aliases) {
    const entityId = entityIds.get(alias.entityImportKey);
    if (!entityId || unavailable.has(alias.entityImportKey)) {
      summary.aliases.skipped += 1;
      continue;
    }
    if (entityId.startsWith("dry-run:")) {
      summary.aliases.inserted += 1;
      usableAliases.push({ ...alias, entityId });
      continue;
    }
    const existing = await db.query<{
      id: string;
      entity_id: string;
      alias: string;
      source_system: string;
      source_field: string;
      alias_normalized: string;
      is_active: boolean;
    }>(
      `
        select id::text, entity_id::text, alias, source_system, source_field, alias_normalized, is_active
        from master_entity_aliases
        where alias = $1
           or (source_system = $2 and source_field = $3 and alias_normalized = $4)
        order by is_active desc, created_at desc
        limit 1
      `,
      [alias.alias, SOURCE_SYSTEM, alias.sourceField, alias.aliasNormalized]
    );
    const row = existing.rows[0];
    if (!row) {
      summary.aliases.inserted += 1;
      usableAliases.push({ ...alias, entityId });
      if (commit) {
        await db.query(
          `
            insert into master_entity_aliases
              (entity_id, alias, source_system, source_field, alias_normalized, source, confidence, match_confidence, is_active)
            values ($1::uuid, $2, $3, $4, $5, $6, '100', '100', true)
          `,
          [entityId, alias.alias, SOURCE_SYSTEM, alias.sourceField, alias.aliasNormalized, IMPORT_SOURCE]
        );
      }
      continue;
    }
    if (
      row.entity_id === entityId &&
      row.source_system === SOURCE_SYSTEM &&
      row.source_field === alias.sourceField &&
      row.alias_normalized === alias.aliasNormalized &&
      row.is_active
    ) {
      summary.aliases.skipped += 1;
      usableAliases.push({ ...alias, entityId });
      continue;
    }
    if (row.entity_id !== entityId) {
      summary.aliases.conflicts += 1;
      summary.warnings.push(`Alias already maps to another entity: ${alias.sourceField}:${alias.alias}`);
      continue;
    }
    if (!allowUpdate) {
      summary.aliases.conflicts += 1;
      summary.warnings.push(`Alias differs/inactive and V1_IMPORT_ALLOW_UPDATE is not true: ${alias.sourceField}:${alias.alias}`);
      continue;
    }
    summary.aliases.updated += 1;
    usableAliases.push({ ...alias, entityId });
    if (commit) {
      await db.query(
        `
          update master_entity_aliases
          set source_system = $2,
              source_field = $3,
              alias_normalized = $4,
              source = $5,
              confidence = '100',
              match_confidence = '100',
              is_active = true,
              updated_at = now()
          where id = $1::uuid
        `,
        [row.id, SOURCE_SYSTEM, alias.sourceField, alias.aliasNormalized, IMPORT_SOURCE]
      );
    }
  }
  return usableAliases;
}

async function importConversions(
  db: Queryable,
  conversions: readonly V1ConversionPlan[],
  summary: ImportSummary,
  commit: boolean,
  allowUpdate: boolean
): Promise<void> {
  for (const conversion of conversions) {
    const existing = await db.query<{
      id: string;
      gross_weight_per_pcs: string | number;
      is_active: boolean;
    }>(
      `
        select id::text, gross_weight_per_pcs, is_active
        from item_conversion_mappings
        where upper(item_no) = upper($1) and upper(coalesce(uom, '')) = upper($2)
        order by is_active desc, created_at desc
        limit 1
      `,
      [conversion.itemNo, conversion.uom]
    );
    const row = existing.rows[0];
    if (!row) {
      summary.conversions.inserted += 1;
      if (commit) {
        await db.query(
          `
            insert into item_conversion_mappings
              (item_no, uom, gross_weight_per_pcs, source, is_active)
            values ($1, $2, $3, $4, true)
          `,
          [conversion.itemNo, conversion.uom, conversion.grossWeightPerPcs.toString(), IMPORT_SOURCE]
        );
      }
      continue;
    }
    if (row.is_active && numberEqual(row.gross_weight_per_pcs, conversion.grossWeightPerPcs, 6)) {
      summary.conversions.skipped += 1;
      continue;
    }
    if (!allowUpdate) {
      summary.conversions.conflicts += 1;
      summary.warnings.push(`Conversion differs/inactive and V1_IMPORT_ALLOW_UPDATE is not true: ${conversion.itemNo}:${conversion.uom}`);
      continue;
    }
    summary.conversions.updated += 1;
    if (commit) {
      await db.query(
        `
          update item_conversion_mappings
          set gross_weight_per_pcs = $2,
              source = $3,
              is_active = true,
              updated_at = now()
          where id = $1::uuid
        `,
        [row.id, conversion.grossWeightPerPcs.toString(), IMPORT_SOURCE]
      );
    }
  }
}

function aliasRowsForSql(aliases: readonly Array<V1AliasPlan & { entityId: string }>) {
  return aliases
    .filter((alias) => !alias.entityId.startsWith("dry-run:"))
    .map((alias) => ({
      source_field: alias.sourceField,
      alias_normalized: alias.aliasNormalized,
      entity_id: alias.entityId
    }));
}

async function previewOutputMapping(
  db: Queryable,
  aliases: readonly Array<V1AliasPlan & { entityId: string }>,
  allowUpdate: boolean
): Promise<ImportSummary["outputMappings"]> {
  const aliasRows = aliasRowsForSql(aliases);
  if (aliasRows.length === 0) return { matchedRows: 0, updatedRows: 0, alreadyMappedRows: 0, conflictRows: 0 };
  const result = await db.query<{
    matched_rows: string | number;
    updatable_rows: string | number;
    already_mapped_rows: string | number;
    conflict_rows: string | number;
  }>(
    `
      with alias_values as (
        select *
        from jsonb_to_recordset($1::jsonb) as x(source_field text, alias_normalized text, entity_id uuid)
      ),
      matched as (
        select po.id as output_id, po.entity_id as current_entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'machine_center_no'
         and upper(regexp_replace(trim(coalesce(po.machine_center_no, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
        union all
        select po.id, po.entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'prod_line_description'
         and upper(regexp_replace(trim(coalesce(po.prod_line_description, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
        union all
        select po.id, po.entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'prod_line_no'
         and upper(regexp_replace(trim(coalesce(po.prod_line_no, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
      ),
      grouped as (
        select output_id,
               min(entity_id::text)::uuid as entity_id,
               count(distinct entity_id) as entity_count,
               bool_or(current_entity_id is not null) as already_mapped
        from matched
        group by output_id
      )
      select count(*) filter (where entity_count = 1) as matched_rows,
             count(*) filter (where entity_count = 1 and (not already_mapped or $3::boolean)) as updatable_rows,
             count(*) filter (where entity_count = 1 and already_mapped) as already_mapped_rows,
             count(*) filter (where entity_count > 1) as conflict_rows
      from grouped
    `,
    [JSON.stringify(aliasRows), SOURCE_SYSTEM, allowUpdate]
  );
  const row = result.rows[0];
  return {
    matchedRows: Number(row?.matched_rows ?? 0),
    updatedRows: Number(row?.updatable_rows ?? 0),
    alreadyMappedRows: Number(row?.already_mapped_rows ?? 0),
    conflictRows: Number(row?.conflict_rows ?? 0)
  };
}

async function updateOutputMapping(
  db: Queryable,
  aliases: readonly Array<V1AliasPlan & { entityId: string }>,
  allowUpdate: boolean
): Promise<ImportSummary["outputMappings"]> {
  const aliasRows = aliasRowsForSql(aliases);
  if (aliasRows.length === 0) return { matchedRows: 0, updatedRows: 0, alreadyMappedRows: 0, conflictRows: 0 };
  const result = await db.query<{
    matched_rows: string | number;
    updated_rows: string | number;
    already_mapped_rows: string | number;
    conflict_rows: string | number;
  }>(
    `
      with alias_values as (
        select *
        from jsonb_to_recordset($1::jsonb) as x(source_field text, alias_normalized text, entity_id uuid)
      ),
      matched as (
        select po.id as output_id, po.entity_id as current_entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'machine_center_no'
         and upper(regexp_replace(trim(coalesce(po.machine_center_no, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
        union all
        select po.id, po.entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'prod_line_description'
         and upper(regexp_replace(trim(coalesce(po.prod_line_description, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
        union all
        select po.id, po.entity_id, av.entity_id
        from production_outputs po
        inner join alias_values av
          on av.source_field = 'prod_line_no'
         and upper(regexp_replace(trim(coalesce(po.prod_line_no, '')), '[^A-Za-z0-9]+', '', 'g')) = av.alias_normalized
        where po.source_system = $2
      ),
      grouped as (
        select output_id,
               min(entity_id::text)::uuid as entity_id,
               count(distinct entity_id) as entity_count,
               bool_or(current_entity_id is not null) as already_mapped
        from matched
        group by output_id
      ),
      safe as (
        select output_id, entity_id
        from grouped
        where entity_count = 1 and (not already_mapped or $3::boolean)
      ),
      updated as (
        update production_outputs po
        set entity_id = safe.entity_id,
            updated_at = now()
        from safe
        where po.id = safe.output_id
        returning po.id
      )
      select (select count(*) from grouped where entity_count = 1) as matched_rows,
             (select count(*) from updated) as updated_rows,
             (select count(*) from grouped where entity_count = 1 and already_mapped) as already_mapped_rows,
             (select count(*) from grouped where entity_count > 1) as conflict_rows
    `,
    [JSON.stringify(aliasRows), SOURCE_SYSTEM, allowUpdate]
  );
  const row = result.rows[0];
  return {
    matchedRows: Number(row?.matched_rows ?? 0),
    updatedRows: Number(row?.updated_rows ?? 0),
    alreadyMappedRows: Number(row?.already_mapped_rows ?? 0),
    conflictRows: Number(row?.conflict_rows ?? 0)
  };
}

async function insertAuditLog(db: Queryable, summary: ImportSummary, plan: V1ImportPlan): Promise<void> {
  await db.query(
    `
      insert into audit_logs (action, entity_type, entity_id, before_value, after_value, user_agent)
      values ('v1.master_import.commit', 'master_data_migration', 'v1-master-import', $1::jsonb, $2::jsonb, 'v1-master-import-script')
    `,
    [
      JSON.stringify({
        sourceSystem: SOURCE_SYSTEM,
        dryRunRequired: true,
        rawMasterRows: plan.stats.rawMasterRows,
        rawItemLedgerRows: plan.stats.rawItemLedgerRows
      }),
      JSON.stringify(summary)
    ]
  );
  summary.auditLogged = true;
}

function printSummary(summary: ImportSummary): void {
  console.log("");
  console.log("Import summary");
  console.log(`Mode: ${summary.mode}`);
  console.log(`Allow update: ${summary.allowUpdate ? "yes" : "no"}`);
  console.log(`Target effective from: ${summary.effectiveFrom}`);
  for (const [label, counts] of Object.entries({
    entities: summary.entities,
    aliases: summary.aliases,
    targets: summary.targets,
    conversions: summary.conversions
  })) {
    console.log(
      `${label}: inserted=${counts.inserted}; updated=${counts.updated}; skipped=${counts.skipped}; conflicts=${counts.conflicts}`
    );
  }
  console.log(
    `output mappings: matched=${summary.outputMappings.matchedRows}; ${summary.mode === "COMMIT" ? "updated" : "would_update"}=${summary.outputMappings.updatedRows}; already_mapped=${summary.outputMappings.alreadyMappedRows}; conflicts=${summary.outputMappings.conflictRows}`
  );
  console.log(`Audit logged: ${summary.auditLogged ? "yes" : "no"}`);
  if (summary.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of summary.warnings.slice(0, 25)) console.log(`- ${warning}`);
  } else {
    console.log("Warnings: none");
  }
  if (summary.mode === "DRY_RUN") {
    console.log("");
    console.log("Dry-run only. Set V1_MASTER_IMPORT_COMMIT=true to mutate v2.");
  }
}

async function main(): Promise<void> {
  const commit = process.env.V1_MASTER_IMPORT_COMMIT === "true";
  const allowUpdate = process.env.V1_IMPORT_ALLOW_UPDATE === "true";
  const effectiveFrom = optionalDateEnv("V1_TARGET_EFFECTIVE_FROM", "2026-01-01");
  const plan = loadLocalV1Plan();
  const database = createV2Database();
  const summary: ImportSummary = {
    mode: commit ? "COMMIT" : "DRY_RUN",
    allowUpdate,
    effectiveFrom,
    entities: emptyCounts(),
    aliases: emptyCounts(),
    targets: emptyCounts(),
    conversions: emptyCounts(),
    outputMappings: { matchedRows: 0, updatedRows: 0, alreadyMappedRows: 0, conflictRows: 0 },
    auditLogged: false,
    warnings: []
  };

  console.log("V1 master data import");
  printPlanSummary(plan);

  const client = await database.pool.connect();
  try {
    if (commit) await client.query("begin");
    const { entityIds, unavailable } = await importEntities(client, plan, summary, commit, allowUpdate);
    await importTargets(client, plan, summary, entityIds, unavailable, commit, allowUpdate, effectiveFrom);
    const usableAliases = await importAliases(client, plan, summary, entityIds, unavailable, commit, allowUpdate);
    await importConversions(client, plan.conversions, summary, commit, allowUpdate);

    if (commit) {
      summary.outputMappings = await updateOutputMapping(client, usableAliases, allowUpdate);
      await insertAuditLog(client, summary, plan);
      await client.query("commit");
    } else {
      const v2Estimate = estimateV1Reconcile({ aliases: usableAliases }, await loadV2OutputRows(database.pool));
      const dbPreview = await previewOutputMapping(client, usableAliases, allowUpdate);
      summary.outputMappings = {
        matchedRows: v2Estimate.matchedRows || dbPreview.matchedRows,
        updatedRows: v2Estimate.matchedRows || dbPreview.updatedRows,
        alreadyMappedRows: dbPreview.alreadyMappedRows,
        conflictRows: v2Estimate.conflictRows + dbPreview.conflictRows
      };
      console.log(`Estimated OK quantity mapped by aliases: ${formatNumber(v2Estimate.matchedOkQty, 4)}`);
    }
  } catch (error) {
    if (commit) await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }

  printSummary(summary);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown v1 master import error";
  console.error(message);
  process.exitCode = 1;
});
