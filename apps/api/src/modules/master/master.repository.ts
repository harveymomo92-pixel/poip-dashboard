import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  dataQualityIssues,
  itemConversionMappings,
  masterEntityConditionalRules,
  masterEntities,
  masterEntityAliases
} from "@poip/db";
import {
  conditionalMappingRuleMatches,
  normalizeConditionalMappingConditionValue,
  normalizeAliasDisplay,
  normalizeAliasKey,
  suggestMappingCandidates,
  type ConditionalMappingConditionType,
  type ConditionalMappingRuleInput,
  type CandidateEntityInput,
  type MasterSourceField
} from "@poip/domain";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type {
  BusinessCentralMappingResetDto,
  BusinessCentralMappingResetSourceField,
  ConditionalMappingPreviewDto,
  ConditionalMappingRuleDto,
  ConditionalMappingSampleDto,
  ConditionalMappingTargetEntityDto,
  ConversionGapDto,
  ConversionMappingDto,
  MappingCandidateDto,
  MappingCommitDto,
  MappingPreviewDto,
  MasterAliasDto,
  MasterEntityDto,
  Pagination,
  TargetCoverageRowDto,
  UnmappedSourceGroupDto
} from "./master.types.js";

const SOURCE_SYSTEM = "business-central";

const sourceColumns: Record<MasterSourceField, string> = {
  machine_description: "machine_description",
  machine_center_no: "machine_center_no",
  prod_line_description: "prod_line_description",
  prod_line_no: "prod_line_no",
  item_no: "item_no",
  uom: "uom"
};

const resettableSourceColumns: Record<BusinessCentralMappingResetSourceField, string> = {
  machine_description: "machine_description",
  machine_center_no: "machine_center_no",
  prod_line_description: "prod_line_description",
  prod_line_no: "prod_line_no"
};

const MAPPING_RESET_WARNINGS = [
  "KPI quantities are not changed. Output quantity, reject quantity, item fields, document fields, targets, sync runs, and raw Business Central source fields remain unchanged."
] as const;

type ConditionalMappingSourceField = BusinessCentralMappingResetSourceField;

interface ConditionalMappingOutputRow {
  readonly id: string;
  readonly entityId: string | null;
  readonly entryNo: string | null;
  readonly documentNo: string | null;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly machineDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly prodLineNo: string | null;
  readonly prodLineDescription: string | null;
  readonly grossWeightPerPcs: number | null;
  readonly normalizedOutputType: string;
  readonly quantity: number;
}

function columnFor(sourceField: MasterSourceField): string {
  return sourceColumns[sourceField];
}

function resetColumnFor(sourceField: BusinessCentralMappingResetSourceField): string {
  return resettableSourceColumns[sourceField];
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
      else 'machine_description'
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

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sqlNumberValue(value: unknown): number {
  return numberValue(value as string | number | null | undefined);
}

function sqlNullableNumberValue(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueSourceRefs(values: readonly unknown[]): string[] {
  const refs = new Set<string>();
  for (const value of values) {
    if (value === null || typeof value === "undefined") continue;
    const ref = String(value).trim();
    if (ref) refs.add(ref);
  }
  return [...refs];
}

function textArraySql(values: readonly string[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

function uuidArraySql(values: readonly string[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::uuid[]`;
}

function timestampText(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function pagination(page: number, pageSize: number, totalRows: number): Pagination {
  return { page, pageSize, totalRows, totalPages: Math.ceil(totalRows / pageSize) };
}

@Injectable()
export class MasterRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async overview() {
    const [entities, aliases, outputSummary, unmapped, targetCoverage, gaps] = await Promise.all([
      this.database.pool.query<{ total: string | number; active: string | number }>(
        "select count(*) as total, count(*) filter (where is_active) as active from master_entities"
      ),
      this.database.pool.query<{ active: string | number }>(
        "select count(*) filter (where is_active) as active from master_entity_aliases"
      ),
      this.database.pool.query<{ total_rows: string | number; mapped_rows: string | number; unmapped_rows: string | number }>(
        `
          select count(*) as total_rows,
                 count(*) filter (where entity_id is not null) as mapped_rows,
                 count(*) filter (where entity_id is null) as unmapped_rows
          from production_outputs
          where source_system = $1
        `,
        [SOURCE_SYSTEM]
      ),
      this.database.pool.query<{ groups: string | number; rows: string | number }>(
        `
          with preferred_sources as (
            select ${preferredEntitySourceFieldSql("po")} as source_field,
                   coalesce(${preferredEntitySourceValueSql("po")}, '') as source_value
            from production_outputs po
            where po.source_system = $1 and po.entity_id is null and po.normalized_output_type = 'OK' and po.quantity > 0
          )
          select count(distinct source_field || ':' || source_value) as groups,
                 count(*) as rows
          from preferred_sources
        `,
        [SOURCE_SYSTEM]
      ),
      this.database.pool.query<{ uncovered: string | number }>(
        `
          select count(*) as uncovered
          from production_outputs po
          where po.source_system = $1
            and po.normalized_output_type = 'OK'
            and po.quantity > 0
            and (
              po.entity_id is null
              or not exists (
                select 1 from production_targets pt
                where pt.entity_id = po.entity_id
                  and pt.status in ('APPROVED', 'ACTIVE')
                  and pt.daily_target_qty > 0
                  and pt.effective_from <= po.posting_date
                  and (pt.effective_to is null or pt.effective_to >= po.posting_date)
              )
            )
        `,
        [SOURCE_SYSTEM]
      ),
      this.database.pool.query<{ gaps: string | number }>(
        `
          select count(*) as gaps
          from production_outputs
          where source_system = $1
            and reject_kg > 0
            and (reject_pcs_eq is null or gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)
        `,
        [SOURCE_SYSTEM]
      )
    ]);
    return {
      totalEntities: numberValue(entities.rows[0]?.total),
      activeEntities: numberValue(entities.rows[0]?.active),
      activeAliases: numberValue(aliases.rows[0]?.active),
      totalOutputRows: numberValue(outputSummary.rows[0]?.total_rows),
      mappedRows: numberValue(outputSummary.rows[0]?.mapped_rows),
      unmappedSourceGroups: numberValue(unmapped.rows[0]?.groups),
      unmappedRows: numberValue(outputSummary.rows[0]?.unmapped_rows),
      mappingCoveragePct: numberValue(outputSummary.rows[0]?.total_rows) > 0
        ? (numberValue(outputSummary.rows[0]?.mapped_rows) / numberValue(outputSummary.rows[0]?.total_rows)) * 100
        : null,
      targetCoverageGapRows: numberValue(targetCoverage.rows[0]?.uncovered),
      conversionGaps: numberValue(gaps.rows[0]?.gaps)
    };
  }

  async listEntities(filters: { readonly page: number; readonly pageSize: number; readonly search?: string | undefined; readonly isActive?: boolean | undefined }) {
    const params: unknown[] = [];
    const clauses = ["1 = 1"];
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(lower(me.entity_code) like $${params.length} or lower(me.display_name) like $${params.length})`);
    }
    if (typeof filters.isActive === "boolean") {
      params.push(filters.isActive);
      clauses.push(`me.is_active = $${params.length}`);
    }
    const where = clauses.join(" and ");
    const offset = (filters.page - 1) * filters.pageSize;
    const [countResult, rowsResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(`select count(*) as total from master_entities me where ${where}`, params),
      this.database.pool.query<{
        id: string;
        entity_code: string;
        display_name: string;
        area: string | null;
        line_code: string | null;
        product_family: string | null;
        report_group: string | null;
        planned_runtime_hours: string | number;
        is_active: boolean;
        alias_count: string | number;
        target_count: string | number;
        output_row_count: string | number;
        created_at: Date;
        updated_at: Date;
      }>(
        `
          select me.id, me.entity_code, me.display_name, me.area, me.line_code, me.product_family,
                 me.report_group, me.planned_runtime_hours, me.is_active, me.created_at, me.updated_at,
                 count(distinct mea.id) as alias_count,
                 count(distinct pt.id) as target_count,
                 count(distinct po.id) as output_row_count
          from master_entities me
          left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active
          left join production_targets pt on pt.entity_id = me.id
          left join production_outputs po on po.entity_id = me.id and po.source_system = $${params.length + 1}
          where ${where}
          group by me.id
          order by me.entity_code asc
          limit $${params.length + 2}
          offset $${params.length + 3}
        `,
        [...params, SOURCE_SYSTEM, filters.pageSize, offset]
      )
    ]);
    const totalRows = numberValue(countResult.rows[0]?.total);
    return {
      rows: rowsResult.rows.map((row) => this.serializeEntity(row)),
      pagination: pagination(filters.page, filters.pageSize, totalRows)
    };
  }

  async getEntity(id: string): Promise<MasterEntityDto | null> {
    const result = await this.database.pool.query<Parameters<typeof this.serializeEntity>[0]>(
      `
        select me.id, me.entity_code, me.display_name, me.area, me.line_code, me.product_family,
               me.report_group, me.planned_runtime_hours, me.is_active, me.created_at, me.updated_at,
               count(distinct mea.id) as alias_count,
               count(distinct pt.id) as target_count,
               count(distinct po.id) as output_row_count
        from master_entities me
        left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active
        left join production_targets pt on pt.entity_id = me.id
        left join production_outputs po on po.entity_id = me.id and po.source_system = $2
        where me.id = $1
        group by me.id
        limit 1
      `,
      [id, SOURCE_SYSTEM]
    );
    return result.rows[0] ? this.serializeEntity(result.rows[0]) : null;
  }

  async getEntityOrThrow(id: string): Promise<MasterEntityDto> {
    const entity = await this.getEntity(id);
    if (!entity) throw new NotFoundException("Master entity not found");
    return entity;
  }

  async createEntity(input: {
    readonly entityCode: string;
    readonly displayName: string;
    readonly area?: string | null | undefined;
    readonly lineCode?: string | null | undefined;
    readonly productFamily?: string | null | undefined;
    readonly reportGroup?: string | null | undefined;
    readonly plannedRuntimeHours?: number | undefined;
    readonly isActive?: boolean | undefined;
    readonly actorUserId?: string | null | undefined;
  }): Promise<MasterEntityDto> {
    const [entity] = await this.database.db
      .insert(masterEntities)
      .values({
        entityCode: normalizeAliasDisplay(input.entityCode),
        displayName: input.displayName.trim(),
        area: input.area ?? null,
        lineCode: input.lineCode ?? null,
        productFamily: input.productFamily ?? null,
        reportGroup: input.reportGroup ?? null,
        plannedRuntimeHours: String(input.plannedRuntimeHours ?? 24),
        isActive: input.isActive ?? true,
        createdBy: input.actorUserId ?? null,
        updatedBy: input.actorUserId ?? null
      })
      .returning({ id: masterEntities.id });
    if (!entity) throw new BadRequestException("Unable to create master entity");
    return this.getEntityOrThrow(entity.id);
  }

  async updateEntity(id: string, input: {
    readonly entityCode?: string | undefined;
    readonly displayName?: string | undefined;
    readonly area?: string | null | undefined;
    readonly lineCode?: string | null | undefined;
    readonly productFamily?: string | null | undefined;
    readonly reportGroup?: string | null | undefined;
    readonly plannedRuntimeHours?: number | undefined;
    readonly isActive?: boolean | undefined;
    readonly actorUserId?: string | null | undefined;
  }): Promise<MasterEntityDto> {
    const values = {
      ...(input.entityCode ? { entityCode: normalizeAliasDisplay(input.entityCode) } : {}),
      ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.lineCode !== undefined ? { lineCode: input.lineCode } : {}),
      ...(input.productFamily !== undefined ? { productFamily: input.productFamily } : {}),
      ...(input.reportGroup !== undefined ? { reportGroup: input.reportGroup } : {}),
      ...(input.plannedRuntimeHours !== undefined ? { plannedRuntimeHours: String(input.plannedRuntimeHours) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: input.actorUserId ?? null,
      updatedAt: sql`now()`
    };
    await this.database.db.update(masterEntities).set(values).where(eq(masterEntities.id, id));
    return this.getEntityOrThrow(id);
  }

  async listAliases(entityId: string): Promise<readonly MasterAliasDto[]> {
    const rows = await this.database.db
      .select()
      .from(masterEntityAliases)
      .where(eq(masterEntityAliases.entityId, entityId))
      .orderBy(masterEntityAliases.sourceField, masterEntityAliases.alias);
    return rows.map((row) => this.serializeAlias(row));
  }

  async createAlias(entityId: string, input: {
    readonly alias: string;
    readonly sourceSystem: string;
    readonly sourceField: MasterSourceField;
    readonly source?: string | undefined;
    readonly matchConfidence?: number | null | undefined;
    readonly actorUserId?: string | null | undefined;
  }): Promise<MasterAliasDto> {
    await this.getEntityOrThrow(entityId);
    await this.ensureAliasAvailable({
      entityId,
      sourceSystem: input.sourceSystem,
      sourceField: input.sourceField,
      aliasNormalized: normalizeAliasKey(input.alias)
    });
    const [alias] = await this.database.db
      .insert(masterEntityAliases)
      .values({
        entityId,
        alias: normalizeAliasDisplay(input.alias),
        sourceSystem: input.sourceSystem,
        sourceField: input.sourceField,
        aliasNormalized: normalizeAliasKey(input.alias),
        source: input.source ?? "manual",
        confidence: input.matchConfidence === undefined || input.matchConfidence === null ? null : String(input.matchConfidence),
        matchConfidence: input.matchConfidence === undefined || input.matchConfidence === null ? null : String(input.matchConfidence),
        createdBy: input.actorUserId ?? null,
        updatedBy: input.actorUserId ?? null
      })
      .returning();
    if (!alias) throw new BadRequestException("Unable to create alias");
    return this.serializeAlias(alias);
  }

  async updateAlias(entityId: string, aliasId: string, input: {
    readonly alias?: string | undefined;
    readonly sourceSystem?: string | undefined;
    readonly sourceField?: MasterSourceField | undefined;
    readonly source?: string | undefined;
    readonly matchConfidence?: number | null | undefined;
    readonly isActive?: boolean | undefined;
    readonly actorUserId?: string | null | undefined;
  }): Promise<MasterAliasDto> {
    const before = await this.getAliasOrThrow(entityId, aliasId);
    const nextSourceSystem = input.sourceSystem ?? before.sourceSystem;
    const nextSourceField = input.sourceField ?? before.sourceField;
    const nextAlias = input.alias ?? before.alias;
    const nextNormalized = normalizeAliasKey(nextAlias);
    if (input.isActive !== false) {
      await this.ensureAliasAvailable({
        entityId,
        aliasId,
        sourceSystem: nextSourceSystem,
        sourceField: nextSourceField,
        aliasNormalized: nextNormalized
      });
    }
    const [alias] = await this.database.db
      .update(masterEntityAliases)
      .set({
        ...(input.alias ? { alias: normalizeAliasDisplay(input.alias), aliasNormalized: nextNormalized } : {}),
        ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
        ...(input.sourceField ? { sourceField: input.sourceField } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.matchConfidence !== undefined ? {
          confidence: input.matchConfidence === null ? null : String(input.matchConfidence),
          matchConfidence: input.matchConfidence === null ? null : String(input.matchConfidence)
        } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: input.actorUserId ?? null,
        updatedAt: sql`now()`
      })
      .where(and(eq(masterEntityAliases.id, aliasId), eq(masterEntityAliases.entityId, entityId)))
      .returning();
    if (!alias) throw new NotFoundException("Alias not found");
    return this.serializeAlias(alias);
  }

  async getAliasOrThrow(entityId: string, aliasId: string): Promise<MasterAliasDto> {
    const [alias] = await this.database.db
      .select()
      .from(masterEntityAliases)
      .where(and(eq(masterEntityAliases.id, aliasId), eq(masterEntityAliases.entityId, entityId)))
      .limit(1);
    if (!alias) throw new NotFoundException("Alias not found");
    return this.serializeAlias(alias);
  }

  async listUnmappedSources(filters: {
    readonly page: number;
    readonly pageSize: number;
    readonly sourceField?: MasterSourceField | undefined;
    readonly search?: string | undefined;
    readonly from?: string | undefined;
    readonly to?: string | undefined;
  }) {
    const params: unknown[] = [SOURCE_SYSTEM];
    const dateClauses = ["po.source_system = $1", "po.entity_id is null", "po.normalized_output_type = 'OK'", "po.quantity > 0"];
    if (filters.from) {
      params.push(filters.from);
      dateClauses.push(`po.posting_date >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      dateClauses.push(`po.posting_date <= $${params.length}`);
    }
    const sourceFilterParams: unknown[] = [];
    const sourceClauses = ["1 = 1"];
    if (filters.sourceField) {
      sourceFilterParams.push(filters.sourceField);
      sourceClauses.push(`source_field = $${params.length + sourceFilterParams.length}`);
    }
    if (filters.search) {
      sourceFilterParams.push(`%${filters.search.toLowerCase()}%`);
      sourceClauses.push(`lower(source_value) like $${params.length + sourceFilterParams.length}`);
    }
    const allParams = [...params, ...sourceFilterParams];
    const baseSql = `
      with source_rows as (
        select ${preferredEntitySourceFieldSql("po")}::text as source_field,
               ${preferredEntitySourceValueSql("po")} as source_value,
               po.posting_date,
               po.document_no,
               po.item_no,
               po.uom,
               po.quantity
        from production_outputs po
        where ${dateClauses.join(" and ")}
      ),
      grouped as (
        select source_field, coalesce(source_value, '') as source_value,
               upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
               count(*) as row_count,
               coalesce(sum(quantity), 0) as output_ok_qty,
               min(posting_date)::text as first_posting_date,
               max(posting_date)::text as last_posting_date,
               array_remove((array_agg(distinct document_no))[1:5], null) as sample_document_nos,
               array_remove((array_agg(distinct item_no))[1:5], null) as item_nos,
               array_remove((array_agg(distinct uom))[1:5], null) as uoms
        from source_rows
        where ${sourceClauses.join(" and ")}
        group by source_field, coalesce(source_value, '')
      )
    `;
    const [countResult, rowsResult, entities] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(
        `${baseSql} select count(*) as total from grouped`,
        [...params, ...sourceFilterParams]
      ),
      this.database.pool.query<{
        source_field: MasterSourceField;
        source_value: string;
        normalized_value: string;
        row_count: string | number;
        output_ok_qty: string | number;
        first_posting_date: string | null;
        last_posting_date: string | null;
        sample_document_nos: string[] | null;
        item_nos: string[] | null;
        uoms: string[] | null;
      }>(
        `${baseSql} select * from grouped order by output_ok_qty desc, row_count desc limit $${allParams.length + 1} offset $${allParams.length + 2}`,
        [...allParams, filters.pageSize, (filters.page - 1) * filters.pageSize]
      ),
      this.activeEntityCandidates()
    ]);
    const totalRows = numberValue(countResult.rows[0]?.total);
    return {
      rows: rowsResult.rows.map((row): UnmappedSourceGroupDto => ({
        sourceField: row.source_field,
        sourceValue: row.source_value,
        normalizedValue: row.normalized_value,
        rowCount: numberValue(row.row_count),
        outputOkQty: numberValue(row.output_ok_qty),
        firstPostingDate: row.first_posting_date,
        lastPostingDate: row.last_posting_date,
        sampleDocumentNos: row.sample_document_nos ?? [],
        itemNos: row.item_nos ?? [],
        uoms: row.uoms ?? [],
        candidates: this.suggestCandidates(row.source_value, entities)
      })),
      pagination: pagination(filters.page, filters.pageSize, totalRows)
    };
  }

  async suggestions(input: { readonly sourceValue: string }): Promise<readonly MappingCandidateDto[]> {
    return this.suggestCandidates(input.sourceValue, await this.activeEntityCandidates());
  }

  async previewMapping(input: {
    readonly sourceSystem?: string | undefined;
    readonly sourceField?: MasterSourceField | undefined;
    readonly sourceValue?: string | undefined;
    readonly entityId?: string | undefined;
    readonly remap?: boolean | undefined;
  }): Promise<MappingPreviewDto> {
    if (!input.sourceField || !input.sourceValue) {
      const result = await this.database.pool.query<{ affected: string | number }>(
        `
          with source_values as (
            select id, source_system, 'machine_description'::text source_field, machine_description source_value, entity_id from production_outputs
            union all select id, source_system, 'machine_center_no', machine_center_no, entity_id from production_outputs
            union all select id, source_system, 'prod_line_description', prod_line_description, entity_id from production_outputs
            union all select id, source_system, 'prod_line_no', prod_line_no, entity_id from production_outputs
          )
          select count(distinct sv.id) as affected
          from source_values sv
          inner join master_entity_aliases mea
            on mea.is_active
           and mea.source_system = sv.source_system
           and mea.source_field = sv.source_field
           and mea.alias_normalized = upper(regexp_replace(trim(coalesce(sv.source_value, '')), '[^A-Za-z0-9]+', '', 'g'))
          where sv.source_system = $1 and sv.entity_id is null
        `,
        [input.sourceSystem ?? SOURCE_SYSTEM]
      );
      return {
        sourceSystem: input.sourceSystem ?? SOURCE_SYSTEM,
        affectedRows: numberValue(result.rows[0]?.affected),
        alreadyMappedRows: 0,
        unresolvedIssueCount: 0,
        sampleEntryNos: [],
        commitRequired: true
      };
    }
    const sourceField = input.sourceField;
    const sourceValue = input.sourceValue;
    const sourceSystem = input.sourceSystem ?? SOURCE_SYSTEM;
    const column = columnFor(sourceField);
    const normalized = normalizeAliasKey(sourceValue);
    const [counts, samples] = await Promise.all([
      this.database.pool.query<{
        affected_rows: string | number;
        already_mapped_rows: string | number;
        unresolved_issue_count: string | number;
      }>(
        `
          select
            count(*) filter (where po.entity_id is null or $3::boolean) as affected_rows,
            count(*) filter (where po.entity_id is not null) as already_mapped_rows,
            (
              select count(*)
              from data_quality_issues dqi
              where dqi.source_system = $1
                and dqi.status in ('OPEN', 'ACKNOWLEDGED')
                and dqi.issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
                and exists (
                  select 1 from production_outputs x
                  where x.source_system = $1
                    and ${sqlNormalizeExpression(`x.${column}`)} = $2
                    and x.entry_no::text = dqi.source_ref
                )
            ) as unresolved_issue_count
          from production_outputs po
          where po.source_system = $1
            and ${sqlNormalizeExpression(`po.${column}`)} = $2
        `,
        [sourceSystem, normalized, input.remap ?? false]
      ),
      this.database.pool.query<{ entry_no: string | number | null }>(
        `
          select entry_no::text
          from production_outputs po
          where po.source_system = $1
            and ${sqlNormalizeExpression(`po.${column}`)} = $2
            and (po.entity_id is null or $3::boolean)
          order by po.posting_date desc, po.entry_no desc
          limit 5
        `,
        [sourceSystem, normalized, input.remap ?? false]
      )
    ]);
    return {
      sourceSystem,
      sourceField,
      sourceValue: normalizeAliasDisplay(sourceValue),
      entityId: input.entityId,
      affectedRows: numberValue(counts.rows[0]?.affected_rows),
      alreadyMappedRows: numberValue(counts.rows[0]?.already_mapped_rows),
      unresolvedIssueCount: numberValue(counts.rows[0]?.unresolved_issue_count),
      sampleEntryNos: samples.rows.flatMap((row) => (row.entry_no === null ? [] : [String(row.entry_no)])),
      commitRequired: true
    };
  }

  async commitMapping(input: {
    readonly sourceSystem?: string | undefined;
    readonly sourceField: MasterSourceField;
    readonly sourceValue: string;
    readonly entityId: string;
    readonly actorUserId?: string | null | undefined;
    readonly remap?: boolean | undefined;
  }): Promise<MappingCommitDto> {
    await this.getEntityOrThrow(input.entityId);
    const sourceSystem = input.sourceSystem ?? SOURCE_SYSTEM;
    const sourceValue = normalizeAliasDisplay(input.sourceValue);
    const sourceField = input.sourceField;
    const normalized = normalizeAliasKey(sourceValue);
    const column = columnFor(sourceField);
    return this.database.db.transaction(async (tx) => {
      const findAlias = (includeSourceField: boolean) => tx
        .select()
        .from(masterEntityAliases)
        .where(
          includeSourceField
            ? and(
                eq(masterEntityAliases.sourceSystem, sourceSystem),
                eq(masterEntityAliases.sourceField, sourceField),
                eq(masterEntityAliases.aliasNormalized, normalized)
              )
            : and(
                eq(masterEntityAliases.sourceSystem, sourceSystem),
                eq(masterEntityAliases.aliasNormalized, normalized)
              )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      let aliasCommitStatus: MappingCommitDto["aliasCommitStatus"] = "inserted";
      let aliasRow = await findAlias(true);
      if (!aliasRow) aliasRow = await findAlias(false);
      if (aliasRow && aliasRow.entityId !== input.entityId) {
        throw new ConflictException({
          code: "ALIAS_ALREADY_MAPPED",
          message: `Alias ${sourceValue} is already mapped to another entity.`,
          alias: sourceValue,
          sourceField,
          existingEntityId: aliasRow.entityId,
          requestedEntityId: input.entityId
        });
      }
      if (aliasRow) {
        const wasActive = aliasRow.isActive;
        const [updatedAlias] = await tx
          .update(masterEntityAliases)
          .set({
            alias: sourceValue,
            sourceSystem,
            sourceField,
            aliasNormalized: normalized,
            source: "mapping-center",
            confidence: "100",
            matchConfidence: "100",
            isActive: true,
            updatedBy: input.actorUserId ?? null,
            updatedAt: sql`now()`
          })
          .where(eq(masterEntityAliases.id, aliasRow.id))
          .returning();
        if (!updatedAlias) throw new BadRequestException("Unable to update mapping alias");
        aliasRow = updatedAlias;
        aliasCommitStatus = wasActive ? "already_mapped" : "reactivated";
      } else {
        const [insertedAlias] = await tx
          .insert(masterEntityAliases)
          .values({
            entityId: input.entityId,
            alias: sourceValue,
            sourceSystem,
            sourceField,
            aliasNormalized: normalized,
            source: "mapping-center",
            confidence: "100",
            matchConfidence: "100",
            createdBy: input.actorUserId ?? null,
            updatedBy: input.actorUserId ?? null
          })
          .returning();
        if (!insertedAlias) throw new BadRequestException("Unable to create mapping alias");
        aliasRow = insertedAlias;
      }
      const updated = await tx.execute(sql`
        update production_outputs po
        set entity_id = ${input.entityId}::uuid,
            updated_at = now()
        where po.source_system = ${sourceSystem}
          and ${sql.raw(sqlNormalizeExpression(`po.${column}`))} = ${normalized}
          and (po.entity_id is null or ${input.remap ?? false})
        returning po.entry_no::text
      `);
      const entryNos = uniqueSourceRefs(updated.rows.map((row) => (row as { entry_no?: unknown }).entry_no));
      let resolvedIssues = 0;
      if (entryNos.length > 0) {
        const issueUpdate = await tx.execute(sql`
          update ${dataQualityIssues}
          set status = 'RESOLVED',
              resolved_by = ${input.actorUserId ?? null},
              resolved_at = now(),
              resolution_note = 'Resolved by Master Data Mapping Center'
          where source_system = ${sourceSystem}
            and status in ('OPEN', 'ACKNOWLEDGED')
            and issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
            and source_ref = any(${textArraySql(entryNos)})
        `);
        resolvedIssues = issueUpdate.rowCount ?? 0;
      }
      const preview = await this.previewMapping({
        sourceSystem,
        sourceField,
        sourceValue,
        entityId: input.entityId,
        ...(input.remap !== undefined ? { remap: input.remap } : {})
      });
      return {
        ...preview,
        affectedRows: entryNos.length,
        updatedRows: entryNos.length,
        resolvedIssues,
        alias: this.serializeAlias(aliasRow),
        aliasCommitStatus
      };
    });
  }

  async previewBusinessCentralMappingReset(input: {
    readonly sourceField: BusinessCentralMappingResetSourceField;
    readonly sourceValue: string;
  }): Promise<BusinessCentralMappingResetDto> {
    const sourceField = input.sourceField;
    const sourceValue = input.sourceValue.trim();
    const column = resetColumnFor(sourceField);
    const [counts, affectedEntities] = await Promise.all([
      this.database.pool.query<{
        total_output_rows: string | number;
        mapped_output_rows_before: string | number;
        aliases_matched: string | number;
      }>(
        `
          select
            (
              select count(*)
              from production_outputs po
              where po.source_system = $1
                and btrim(coalesce(po.${column}, '')) = $2
            ) as total_output_rows,
            (
              select count(*)
              from production_outputs po
              where po.source_system = $1
                and btrim(coalesce(po.${column}, '')) = $2
                and po.entity_id is not null
            ) as mapped_output_rows_before,
            (
              select count(*)
              from master_entity_aliases mea
              where mea.source_system = $1
                and mea.source_field = $3
                and mea.alias = $2
                and mea.is_active
            ) as aliases_matched
        `,
        [SOURCE_SYSTEM, sourceValue, sourceField]
      ),
      this.database.pool.query<{
        entity_id: string;
        entity_code: string;
        display_name: string;
        mapped_output_rows: string | number;
        active_alias_rows: string | number;
      }>(
        `
          with output_entities as (
            select me.id as entity_id, me.entity_code, me.display_name,
                   count(*) as mapped_output_rows,
                   0::bigint as active_alias_rows
            from production_outputs po
            inner join master_entities me on me.id = po.entity_id
            where po.source_system = $1
              and btrim(coalesce(po.${column}, '')) = $2
            group by me.id, me.entity_code, me.display_name
          ),
          alias_entities as (
            select me.id as entity_id, me.entity_code, me.display_name,
                   0::bigint as mapped_output_rows,
                   count(*) as active_alias_rows
            from master_entity_aliases mea
            inner join master_entities me on me.id = mea.entity_id
            where mea.source_system = $1
              and mea.source_field = $3
              and mea.alias = $2
              and mea.is_active
            group by me.id, me.entity_code, me.display_name
          ),
          combined as (
            select * from output_entities
            union all
            select * from alias_entities
          )
          select entity_id, entity_code, display_name,
                 sum(mapped_output_rows) as mapped_output_rows,
                 sum(active_alias_rows) as active_alias_rows
          from combined
          group by entity_id, entity_code, display_name
          order by sum(mapped_output_rows) desc, sum(active_alias_rows) desc, entity_code asc
        `,
        [SOURCE_SYSTEM, sourceValue, sourceField]
      )
    ]);
    const row = counts.rows[0];
    const aliasesMatched = numberValue(row?.aliases_matched);
    return {
      sourceSystem: SOURCE_SYSTEM,
      sourceField,
      sourceValue,
      mode: "preview",
      totalOutputRows: numberValue(row?.total_output_rows),
      mappedOutputRowsBefore: numberValue(row?.mapped_output_rows_before),
      mappedOutputRowsAfter: 0,
      aliasesMatched,
      aliasesDeactivated: aliasesMatched,
      aliasesActiveAfter: 0,
      affectedEntities: affectedEntities.rows.map((entity) => ({
        entityId: entity.entity_id,
        entityCode: entity.entity_code,
        displayName: entity.display_name,
        mappedOutputRows: numberValue(entity.mapped_output_rows),
        activeAliasRows: numberValue(entity.active_alias_rows)
      })),
      warnings: MAPPING_RESET_WARNINGS
    };
  }

  async commitBusinessCentralMappingReset(input: {
    readonly sourceField: BusinessCentralMappingResetSourceField;
    readonly sourceValue: string;
    readonly actorUserId?: string | null | undefined;
  }): Promise<BusinessCentralMappingResetDto> {
    const sourceField = input.sourceField;
    const sourceValue = input.sourceValue.trim();
    const column = resetColumnFor(sourceField);
    return this.database.db.transaction(async (tx) => {
      const affectedEntitiesResult = await tx.execute(sql`
        with output_entities as (
          select me.id as entity_id, me.entity_code, me.display_name,
                 count(*) as mapped_output_rows,
                 0::bigint as active_alias_rows
          from production_outputs po
          inner join master_entities me on me.id = po.entity_id
          where po.source_system = ${SOURCE_SYSTEM}
            and ${sql.raw(`btrim(coalesce(po.${column}, ''))`)} = ${sourceValue}
          group by me.id, me.entity_code, me.display_name
        ),
        alias_entities as (
          select me.id as entity_id, me.entity_code, me.display_name,
                 0::bigint as mapped_output_rows,
                 count(*) as active_alias_rows
          from ${masterEntityAliases} mea
          inner join ${masterEntities} me on me.id = mea.entity_id
          where mea.source_system = ${SOURCE_SYSTEM}
            and mea.source_field = ${sourceField}
            and mea.alias = ${sourceValue}
            and mea.is_active
          group by me.id, me.entity_code, me.display_name
        ),
        combined as (
          select * from output_entities
          union all
          select * from alias_entities
        )
        select entity_id::text, entity_code, display_name,
               sum(mapped_output_rows) as mapped_output_rows,
               sum(active_alias_rows) as active_alias_rows
        from combined
        group by entity_id, entity_code, display_name
        order by sum(mapped_output_rows) desc, sum(active_alias_rows) desc, entity_code asc
      `);
      const before = await tx.execute(sql`
        select
          (
            select count(*)
            from production_outputs po
            where po.source_system = ${SOURCE_SYSTEM}
              and ${sql.raw(`btrim(coalesce(po.${column}, ''))`)} = ${sourceValue}
          ) as total_output_rows,
          (
            select count(*)
            from production_outputs po
            where po.source_system = ${SOURCE_SYSTEM}
              and ${sql.raw(`btrim(coalesce(po.${column}, ''))`)} = ${sourceValue}
              and po.entity_id is not null
          ) as mapped_output_rows_before,
          (
            select count(*)
            from ${masterEntityAliases} mea
            where mea.source_system = ${SOURCE_SYSTEM}
              and mea.source_field = ${sourceField}
              and mea.alias = ${sourceValue}
              and mea.is_active
          ) as aliases_matched
      `);
      await tx.execute(sql`
        update production_outputs po
        set entity_id = null,
            updated_at = now()
        where po.source_system = ${SOURCE_SYSTEM}
          and ${sql.raw(`btrim(coalesce(po.${column}, ''))`)} = ${sourceValue}
          and po.entity_id is not null
      `);
      const aliasUpdate = await tx.execute(sql`
        update ${masterEntityAliases} mea
        set is_active = false,
            updated_by = ${input.actorUserId ?? null},
            updated_at = now()
        where mea.source_system = ${SOURCE_SYSTEM}
          and mea.source_field = ${sourceField}
          and mea.alias = ${sourceValue}
          and mea.is_active
      `);
      const after = await tx.execute(sql`
        select
          (
            select count(*)
            from production_outputs po
            where po.source_system = ${SOURCE_SYSTEM}
              and ${sql.raw(`btrim(coalesce(po.${column}, ''))`)} = ${sourceValue}
              and po.entity_id is not null
          ) as mapped_output_rows_after,
          (
            select count(*)
            from ${masterEntityAliases} mea
            where mea.source_system = ${SOURCE_SYSTEM}
              and mea.source_field = ${sourceField}
              and mea.alias = ${sourceValue}
              and mea.is_active
          ) as aliases_active_after
      `);
      const beforeRow = before.rows[0] as {
        total_output_rows?: unknown;
        mapped_output_rows_before?: unknown;
        aliases_matched?: unknown;
      } | undefined;
      const afterRow = after.rows[0] as {
        mapped_output_rows_after?: unknown;
        aliases_active_after?: unknown;
      } | undefined;
      return {
        sourceSystem: SOURCE_SYSTEM,
        sourceField,
        sourceValue,
        mode: "commit",
        totalOutputRows: sqlNumberValue(beforeRow?.total_output_rows),
        mappedOutputRowsBefore: sqlNumberValue(beforeRow?.mapped_output_rows_before),
        mappedOutputRowsAfter: sqlNumberValue(afterRow?.mapped_output_rows_after),
        aliasesMatched: sqlNumberValue(beforeRow?.aliases_matched),
        aliasesDeactivated: aliasUpdate.rowCount ?? Math.max(0, sqlNumberValue(beforeRow?.aliases_matched) - sqlNumberValue(afterRow?.aliases_active_after)),
        aliasesActiveAfter: sqlNumberValue(afterRow?.aliases_active_after),
        affectedEntities: affectedEntitiesResult.rows.map((row) => {
          const entity = row as {
            entity_id: unknown;
            entity_code: unknown;
            display_name: unknown;
            mapped_output_rows: unknown;
            active_alias_rows: unknown;
          };
          return {
            entityId: String(entity.entity_id),
            entityCode: String(entity.entity_code),
            displayName: String(entity.display_name),
            mappedOutputRows: sqlNumberValue(entity.mapped_output_rows),
            activeAliasRows: sqlNumberValue(entity.active_alias_rows)
          };
        }),
        warnings: MAPPING_RESET_WARNINGS
      };
    });
  }

  async previewConditionalMapping(input: {
    readonly sourceField: ConditionalMappingSourceField;
    readonly sourceValue: string;
    readonly conditionType: ConditionalMappingConditionType;
    readonly conditionValue: string;
    readonly entityId: string;
  }): Promise<ConditionalMappingPreviewDto> {
    const [entity, rows, targetExists] = await Promise.all([
      this.getEntityOrThrow(input.entityId),
      this.fetchConditionalSourceRows(input.sourceField, input.sourceValue),
      this.entityHasActiveTarget(input.entityId)
    ]);
    return this.buildConditionalMappingPreview({
      input,
      rows,
      targetEntity: {
        entityId: entity.id,
        entityCode: entity.entityCode,
        displayName: entity.displayName
      },
      targetExists,
      mode: "preview"
    });
  }

  async commitConditionalMapping(input: {
    readonly sourceField: ConditionalMappingSourceField;
    readonly sourceValue: string;
    readonly conditionType: ConditionalMappingConditionType;
    readonly conditionValue: string;
    readonly entityId: string;
    readonly actorUserId?: string | null | undefined;
  }): Promise<ConditionalMappingPreviewDto> {
    const entity = await this.getEntityOrThrow(input.entityId);
    const targetEntity = {
      entityId: entity.id,
      entityCode: entity.entityCode,
      displayName: entity.displayName
    };
    const targetExists = await this.entityHasActiveTarget(input.entityId);
    const sourceValue = normalizeAliasDisplay(input.sourceValue);
    const sourceValueNormalized = normalizeAliasKey(sourceValue);
    const conditionValue = input.conditionValue.trim();
    const conditionValueNormalized = normalizeConditionalMappingConditionValue(input.conditionType, conditionValue);
    const column = resetColumnFor(input.sourceField);

    return this.database.db.transaction(async (tx) => {
      const sourceRowsResult = await tx.execute(sql`
        select po.id::text,
               po.entity_id::text,
               po.entry_no::text,
               po.document_no,
               po.item_no,
               po.item_description,
               po.item_category_code,
               po.machine_description,
               po.machine_center_no,
               po.prod_line_no,
               po.prod_line_description,
               po.gross_weight_per_pcs,
               po.normalized_output_type,
               po.quantity
        from production_outputs po
        where po.source_system = ${SOURCE_SYSTEM}
          and ${sql.raw(sqlNormalizeExpression(`po.${column}`))} = ${sourceValueNormalized}
        order by po.posting_date desc, po.entry_no desc nulls last
      `);
      const rows = sourceRowsResult.rows.map((row) => this.serializeConditionalOutputRow(row));
      const preview = this.buildConditionalMappingPreview({
        input: {
          ...input,
          sourceValue,
          conditionValue
        },
        rows,
        targetEntity,
        targetExists,
        mode: "commit"
      });
      const matchingRows = this.matchConditionalRows(rows, input);
      const eligibleIds = matchingRows.flatMap((row) => (row.entityId === null ? [row.id] : []));

      const [existingRule] = await tx
        .select()
        .from(masterEntityConditionalRules)
        .where(and(
          eq(masterEntityConditionalRules.sourceSystem, SOURCE_SYSTEM),
          eq(masterEntityConditionalRules.sourceField, input.sourceField),
          eq(masterEntityConditionalRules.sourceValueNormalized, sourceValueNormalized),
          eq(masterEntityConditionalRules.conditionType, input.conditionType),
          eq(masterEntityConditionalRules.conditionValueNormalized, conditionValueNormalized),
          eq(masterEntityConditionalRules.isActive, true)
        ))
        .limit(1);

      const ruleValues = {
        entityId: input.entityId,
        sourceSystem: SOURCE_SYSTEM,
        sourceField: input.sourceField,
        sourceValue,
        sourceValueNormalized,
        conditionType: input.conditionType,
        conditionValue,
        conditionValueNormalized,
        source: "conditional-mapping-center",
        isActive: true,
        updatedBy: input.actorUserId ?? null,
        updatedAt: sql`now()`
      };
      const [rule] = existingRule
        ? await tx
          .update(masterEntityConditionalRules)
          .set(ruleValues)
          .where(eq(masterEntityConditionalRules.id, existingRule.id))
          .returning()
        : await tx
          .insert(masterEntityConditionalRules)
          .values({
            ...ruleValues,
            createdBy: input.actorUserId ?? null
          })
          .returning();
      if (!rule) throw new BadRequestException("Unable to create conditional mapping rule");

      let updatedRows = 0;
      let entryNos: string[] = [];
      if (eligibleIds.length > 0) {
        const updated = await tx.execute(sql`
          update production_outputs po
          set entity_id = ${input.entityId}::uuid,
              updated_at = now()
          where po.id = any(${uuidArraySql(eligibleIds)})
            and po.source_system = ${SOURCE_SYSTEM}
            and po.entity_id is null
          returning po.entry_no::text
        `);
        entryNos = uniqueSourceRefs(updated.rows.map((row) => (row as { entry_no?: unknown }).entry_no));
        updatedRows = updated.rowCount ?? entryNos.length;
      }

      let resolvedIssues = 0;
      if (entryNos.length > 0) {
        const issueUpdate = await tx.execute(sql`
          update ${dataQualityIssues}
          set status = 'RESOLVED',
              resolved_by = ${input.actorUserId ?? null},
              resolved_at = now(),
              resolution_note = 'Resolved by reviewed conditional mapping rule'
          where source_system = ${SOURCE_SYSTEM}
            and status in ('OPEN', 'ACKNOWLEDGED')
            and issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
            and source_ref = any(${textArraySql(entryNos)})
        `);
        resolvedIssues = issueUpdate.rowCount ?? 0;
      }

      return {
        ...preview,
        rule: this.serializeConditionalRule(rule),
        updatedRows,
        resolvedIssues,
        outputOkQtyAfter: preview.outputOkQtyBefore
      };
    });
  }

  async targetCoverage(filters: { readonly from?: string | undefined; readonly to?: string | undefined; readonly page: number; readonly pageSize: number }) {
    const params: unknown[] = [SOURCE_SYSTEM];
    const clauses = ["po.source_system = $1", "po.normalized_output_type = 'OK'", "po.quantity > 0"];
    if (filters.from) {
      params.push(filters.from);
      clauses.push(`po.posting_date >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      clauses.push(`po.posting_date <= $${params.length}`);
    }
    const base = `
      with coverage as (
        select
          date_trunc('month', po.posting_date)::date::text as month,
          po.entity_id,
          ${preferredEntitySourceFieldSql("po")}::text as source_field,
          coalesce(me.display_name, ${preferredEntitySourceValueSql("po")}, 'Unmapped') as entity_name,
          coalesce(${preferredEntitySourceValueSql("po")}, 'Unmapped') as source_group,
          case
            when po.entity_id is null then 'UNMAPPED_ENTITY'
            when exists (
              select 1 from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
                and pt.daily_target_qty = 0
            ) then 'TARGET_ZERO'
            when exists (
              select 1 from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
                and pt.daily_target_qty > 0
            ) then 'COVERED'
            when exists (
              select 1 from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status not in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            ) then 'TARGET_NOT_APPROVED'
            when exists (
              select 1 from production_targets pt
              where pt.entity_id = po.entity_id and pt.status in ('APPROVED', 'ACTIVE')
            ) then 'OUTSIDE_EFFECTIVE_DATE'
            else 'NO_ACTIVE_TARGET'
          end as reason,
          po.quantity
        from production_outputs po
        left join master_entities me on me.id = po.entity_id
        where ${clauses.join(" and ")}
      ),
      grouped as (
        select month, entity_id::text, entity_name, source_field, source_group, reason, count(*) as rows, coalesce(sum(quantity), 0) as output_ok_qty
        from coverage
        group by month, entity_id, entity_name, source_field, source_group, reason
      )
    `;
    const [countResult, rowsResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(`${base} select count(*) as total from grouped`, params),
      this.database.pool.query<{
        month: string;
        entity_id: string | null;
        entity_name: string;
        source_field: MasterSourceField;
        source_group: string;
        reason: TargetCoverageRowDto["reason"];
        rows: string | number;
        output_ok_qty: string | number;
      }>(
        `${base} select * from grouped order by month desc, reason desc, output_ok_qty desc limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
      )
    ]);
    return {
      rows: rowsResult.rows.map((row): TargetCoverageRowDto => ({
        month: row.month,
        entityId: row.entity_id,
        entityName: row.entity_name,
        sourceField: row.source_field,
        sourceGroup: row.source_group,
        reason: row.reason,
        rows: numberValue(row.rows),
        outputOkQty: numberValue(row.output_ok_qty)
      })),
      pagination: pagination(filters.page, filters.pageSize, numberValue(countResult.rows[0]?.total))
    };
  }

  async conversionGaps(filters: { readonly page: number; readonly pageSize: number; readonly itemNo?: string | undefined; readonly uom?: string | undefined }) {
    const params: unknown[] = [SOURCE_SYSTEM];
    const clauses = [
      "po.source_system = $1",
      "po.reject_kg > 0",
      "(po.reject_pcs_eq is null or po.gross_weight_per_pcs is null or po.gross_weight_per_pcs <= 0)"
    ];
    if (filters.itemNo) {
      params.push(filters.itemNo.toUpperCase());
      clauses.push(`po.item_no = $${params.length}`);
    }
    if (filters.uom) {
      params.push(filters.uom.toUpperCase());
      clauses.push(`coalesce(po.uom, '') = $${params.length}`);
    }
    const where = clauses.join(" and ");
    const [countResult, rowsResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(
        `select count(*) as total from (select po.item_no, coalesce(po.uom, '') from production_outputs po where ${where} group by 1,2) x`,
        params
      ),
      this.database.pool.query<{
        item_no: string;
        uom: string;
        row_count: string | number;
        reject_kg: string | number;
        first_posting_date: string | null;
        last_posting_date: string | null;
        mapped_gross_weight_per_pcs: string | number | null;
      }>(
        `
          select po.item_no,
                 coalesce(po.uom, '') as uom,
                 count(*) as row_count,
                 coalesce(sum(po.reject_kg), 0) as reject_kg,
                 min(po.posting_date)::text as first_posting_date,
                 max(po.posting_date)::text as last_posting_date,
                 max(icm.gross_weight_per_pcs) as mapped_gross_weight_per_pcs
          from production_outputs po
          left join item_conversion_mappings icm
            on icm.is_active
           and upper(icm.item_no) = upper(po.item_no)
           and upper(coalesce(icm.uom, '')) = upper(coalesce(po.uom, ''))
          where ${where}
          group by po.item_no, coalesce(po.uom, '')
          order by reject_kg desc, row_count desc
          limit $${params.length + 1}
          offset $${params.length + 2}
        `,
        [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
      )
    ]);
    return {
      rows: rowsResult.rows.map((row): ConversionGapDto => ({
        itemNo: row.item_no,
        uom: row.uom,
        rowCount: numberValue(row.row_count),
        rejectKg: numberValue(row.reject_kg),
        firstPostingDate: row.first_posting_date,
        lastPostingDate: row.last_posting_date,
        mappedGrossWeightPerPcs: row.mapped_gross_weight_per_pcs === null ? null : numberValue(row.mapped_gross_weight_per_pcs)
      })),
      pagination: pagination(filters.page, filters.pageSize, numberValue(countResult.rows[0]?.total))
    };
  }

  async createConversion(input: {
    readonly itemNo: string;
    readonly uom: string;
    readonly grossWeightPerPcs: number;
    readonly source?: string | undefined;
    readonly actorUserId?: string | null | undefined;
  }): Promise<ConversionMappingDto> {
    const [mapping] = await this.database.db
      .insert(itemConversionMappings)
      .values({
        itemNo: normalizeAliasDisplay(input.itemNo),
        uom: normalizeAliasDisplay(input.uom),
        grossWeightPerPcs: String(input.grossWeightPerPcs),
        source: input.source ?? "manual",
        createdBy: input.actorUserId ?? null,
        updatedBy: input.actorUserId ?? null
      })
      .returning();
    if (!mapping) throw new BadRequestException("Unable to create conversion mapping");
    return this.serializeConversion(mapping);
  }

  async previewConversion(input: { readonly itemNo: string; readonly uom: string; readonly grossWeightPerPcs?: number | undefined }) {
    const gross = input.grossWeightPerPcs ?? (await this.findConversion(input.itemNo, input.uom))?.grossWeightPerPcs;
    const count = await this.database.pool.query<{ affected_rows: string | number; reject_kg: string | number }>(
      `
        select count(*) as affected_rows, coalesce(sum(reject_kg), 0) as reject_kg
        from production_outputs
        where source_system = $1
          and item_no = $2
          and coalesce(uom, '') = $3
          and reject_kg > 0
          and (reject_pcs_eq is null or gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)
      `,
      [SOURCE_SYSTEM, normalizeAliasDisplay(input.itemNo), normalizeAliasDisplay(input.uom)]
    );
    return {
      itemNo: normalizeAliasDisplay(input.itemNo),
      uom: normalizeAliasDisplay(input.uom),
      grossWeightPerPcs: gross ?? null,
      affectedRows: numberValue(count.rows[0]?.affected_rows),
      rejectKg: numberValue(count.rows[0]?.reject_kg),
      commitRequired: true
    };
  }

  async commitConversion(input: { readonly itemNo: string; readonly uom: string; readonly grossWeightPerPcs?: number | undefined; readonly actorUserId?: string | null | undefined }) {
    const itemNo = normalizeAliasDisplay(input.itemNo);
    const uom = normalizeAliasDisplay(input.uom);
    const gross = input.grossWeightPerPcs ?? (await this.findConversion(itemNo, uom))?.grossWeightPerPcs;
    if (!gross) throw new BadRequestException("Conversion mapping is required before commit");
    const result = await this.database.pool.query<{ entry_no: string }>(
      `
        update production_outputs
        set gross_weight_per_pcs = $4,
            reject_pcs_eq = reject_kg / $4,
            updated_at = now()
        where source_system = $1
          and item_no = $2
          and coalesce(uom, '') = $3
          and reject_kg > 0
          and (reject_pcs_eq is null or gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)
        returning entry_no::text
      `,
      [SOURCE_SYSTEM, itemNo, uom, gross]
    );
    const entryNos = result.rows.map((row) => row.entry_no);
    let resolvedIssues = 0;
    if (entryNos.length > 0) {
      const issueUpdate = await this.database.pool.query(
        `
          update data_quality_issues
          set status = 'RESOLVED',
              resolved_by = $2,
              resolved_at = now(),
              resolution_note = 'Resolved by item conversion mapping'
          where source_system = $1
            and status in ('OPEN', 'ACKNOWLEDGED')
            and issue_code = 'MISSING_GROSS_WEIGHT'
            and source_ref = any($3::text[])
        `,
        [SOURCE_SYSTEM, input.actorUserId ?? null, entryNos]
      );
      resolvedIssues = issueUpdate.rowCount ?? 0;
    }
    return {
      itemNo,
      uom,
      grossWeightPerPcs: gross,
      updatedRows: entryNos.length,
      resolvedIssues
    };
  }

  private async ensureAliasAvailable(input: {
    readonly entityId: string;
    readonly aliasId?: string | undefined;
    readonly sourceSystem: string;
    readonly sourceField: MasterSourceField;
    readonly aliasNormalized: string;
  }) {
    if (!input.aliasNormalized) throw new BadRequestException("Alias cannot be blank after normalization");
    const [existing] = await this.database.db
      .select()
      .from(masterEntityAliases)
      .where(
        and(
          eq(masterEntityAliases.sourceSystem, input.sourceSystem),
          eq(masterEntityAliases.sourceField, input.sourceField),
          eq(masterEntityAliases.aliasNormalized, input.aliasNormalized),
          eq(masterEntityAliases.isActive, true)
        )
      )
      .limit(1);
    if (existing && existing.id !== input.aliasId && existing.entityId !== input.entityId) {
      throw new ConflictException("Active alias already maps to another entity");
    }
    if (existing && existing.id !== input.aliasId) {
      throw new ConflictException("Active alias already exists for this entity");
    }
  }

  private async fetchConditionalSourceRows(
    sourceField: ConditionalMappingSourceField,
    sourceValue: string
  ): Promise<readonly ConditionalMappingOutputRow[]> {
    const column = resetColumnFor(sourceField);
    const result = await this.database.pool.query(
      `
        select po.id::text,
               po.entity_id::text,
               po.entry_no::text,
               po.document_no,
               po.item_no,
               po.item_description,
               po.item_category_code,
               po.machine_description,
               po.machine_center_no,
               po.prod_line_no,
               po.prod_line_description,
               po.gross_weight_per_pcs,
               po.normalized_output_type,
               po.quantity
        from production_outputs po
        where po.source_system = $1
          and ${sqlNormalizeExpression(`po.${column}`)} = $2
        order by po.posting_date desc, po.entry_no desc nulls last
      `,
      [SOURCE_SYSTEM, normalizeAliasKey(sourceValue)]
    );
    return result.rows.map((row) => this.serializeConditionalOutputRow(row));
  }

  private async entityHasActiveTarget(entityId: string): Promise<boolean> {
    const result = await this.database.pool.query<{ exists: boolean }>(
      `
        select exists (
          select 1
          from production_targets pt
          where pt.entity_id = $1
            and pt.status in ('APPROVED', 'ACTIVE')
            and pt.daily_target_qty > 0
        ) as exists
      `,
      [entityId]
    );
    return result.rows[0]?.exists ?? false;
  }

  private buildConditionalMappingPreview(input: {
    readonly input: {
      readonly sourceField: ConditionalMappingSourceField;
      readonly sourceValue: string;
      readonly conditionType: ConditionalMappingConditionType;
      readonly conditionValue: string;
      readonly entityId: string;
    };
    readonly rows: readonly ConditionalMappingOutputRow[];
    readonly targetEntity: ConditionalMappingTargetEntityDto;
    readonly targetExists: boolean;
    readonly mode: "preview" | "commit";
  }): ConditionalMappingPreviewDto {
    const matchingRows = this.matchConditionalRows(input.rows, input.input);
    const currentlyMappedRows = matchingRows.filter((row) => row.entityId !== null).length;
    const alreadyMappedDifferentEntityRows = matchingRows.filter((row) => row.entityId !== null && row.entityId !== input.input.entityId).length;
    const eligibleRows = matchingRows.filter((row) => row.entityId === null).length;
    const conditionMatchingOkQty = matchingRows
      .filter((row) => row.normalizedOutputType === "OK")
      .reduce((total, row) => total + row.quantity, 0);
    return {
      sourceSystem: SOURCE_SYSTEM,
      sourceField: input.input.sourceField,
      sourceValue: normalizeAliasDisplay(input.input.sourceValue),
      conditionType: input.input.conditionType,
      conditionValue: input.input.conditionValue.trim(),
      targetEntity: input.targetEntity,
      mode: input.mode,
      totalMatchingRows: input.rows.length,
      conditionMatchingRows: matchingRows.length,
      currentlyMappedRows,
      alreadyMappedDifferentEntityRows,
      eligibleRows,
      estimatedTargetEligibilityChange: input.targetExists ? eligibleRows : 0,
      conditionMatchingOkQty,
      outputOkQtyBefore: conditionMatchingOkQty,
      outputOkQtyAfter: conditionMatchingOkQty,
      samples: matchingRows.slice(0, 8).map((row): ConditionalMappingSampleDto => ({
        entryNo: row.entryNo,
        itemNo: row.itemNo,
        itemDescription: row.itemDescription,
        documentNo: row.documentNo
      })),
      warnings: this.conditionalMappingWarnings({
        totalRows: input.rows.length,
        matchingRows: matchingRows.length,
        alreadyMappedDifferentEntityRows,
        targetExists: input.targetExists,
        conditionType: input.input.conditionType,
        conditionValue: input.input.conditionValue
      })
    };
  }

  private matchConditionalRows(
    rows: readonly ConditionalMappingOutputRow[],
    input: {
      readonly sourceField: ConditionalMappingSourceField;
      readonly sourceValue: string;
      readonly conditionType: ConditionalMappingConditionType;
      readonly conditionValue: string;
      readonly entityId: string;
    }
  ): readonly ConditionalMappingOutputRow[] {
    const rule: ConditionalMappingRuleInput = {
      sourceField: input.sourceField,
      sourceValue: normalizeAliasDisplay(input.sourceValue),
      sourceValueNormalized: normalizeAliasKey(input.sourceValue),
      conditionType: input.conditionType,
      conditionValue: input.conditionValue,
      entityId: input.entityId
    };
    return rows.filter((row) => conditionalMappingRuleMatches(this.conditionalRowInput(row), rule));
  }

  private conditionalRowInput(row: ConditionalMappingOutputRow) {
    return {
      machineDescription: row.machineDescription,
      machineCenterNo: row.machineCenterNo,
      prodLineNo: row.prodLineNo,
      prodLineDescription: row.prodLineDescription,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      grossWeightPerPcs: row.grossWeightPerPcs
    };
  }

  private conditionalMappingWarnings(input: {
    readonly totalRows: number;
    readonly matchingRows: number;
    readonly alreadyMappedDifferentEntityRows: number;
    readonly targetExists: boolean;
    readonly conditionType: ConditionalMappingConditionType;
    readonly conditionValue: string;
  }): string[] {
    const warnings = [
      "KPI quantities are not changed. Output quantity, reject quantity, item fields, document fields, targets, sync runs, and raw Business Central source fields remain unchanged."
    ];
    if (input.matchingRows === 0) {
      warnings.push("No rows match this condition. Commit would only save the reviewed rule; no output rows would be mapped.");
    }
    if (input.totalRows > 0 && input.matchingRows === input.totalRows) {
      warnings.push("Condition matches every row for this source value. Review samples carefully so this does not become a broad alias.");
    }
    if (input.alreadyMappedDifferentEntityRows > 0) {
      warnings.push("Rows already mapped to a different entity will not be overwritten. Use Reset / Remap Source first if those rows need review.");
    }
    if (!input.targetExists) {
      warnings.push("Target entity has no approved active target yet, so target eligibility may still show N/A after mapping.");
    }
    const normalizedCondition = normalizeConditionalMappingConditionValue(input.conditionType, input.conditionValue);
    if ((input.conditionType === "item_no_pattern" || input.conditionType === "item_description_pattern") && normalizeAliasKey(normalizedCondition).length < 3) {
      warnings.push("Pattern condition is very short and may be broad.");
    }
    if (input.conditionType === "item_category_code" && input.matchingRows > 100) {
      warnings.push("Item category condition affects many rows. Confirm the category is specific enough for this source value.");
    }
    if (input.conditionType === "inferred_target_bucket" && input.conditionValue.toLowerCase() === "target_printing_non_oz") {
      warnings.push("Printing non-OZ inference requires item/category printing evidence, but still needs sample review before commit.");
    }
    return warnings;
  }

  private serializeConditionalOutputRow(row: Record<string, unknown>): ConditionalMappingOutputRow {
    return {
      id: String(row.id),
      entityId: row.entity_id === null || typeof row.entity_id === "undefined" ? null : String(row.entity_id),
      entryNo: row.entry_no === null || typeof row.entry_no === "undefined" ? null : String(row.entry_no),
      documentNo: row.document_no === null || typeof row.document_no === "undefined" ? null : String(row.document_no),
      itemNo: row.item_no === null || typeof row.item_no === "undefined" ? "" : String(row.item_no),
      itemDescription: row.item_description === null || typeof row.item_description === "undefined" ? null : String(row.item_description),
      itemCategoryCode: row.item_category_code === null || typeof row.item_category_code === "undefined" ? null : String(row.item_category_code),
      machineDescription: row.machine_description === null || typeof row.machine_description === "undefined" ? null : String(row.machine_description),
      machineCenterNo: row.machine_center_no === null || typeof row.machine_center_no === "undefined" ? null : String(row.machine_center_no),
      prodLineNo: row.prod_line_no === null || typeof row.prod_line_no === "undefined" ? null : String(row.prod_line_no),
      prodLineDescription: row.prod_line_description === null || typeof row.prod_line_description === "undefined" ? null : String(row.prod_line_description),
      grossWeightPerPcs: sqlNullableNumberValue(row.gross_weight_per_pcs),
      normalizedOutputType: row.normalized_output_type === null || typeof row.normalized_output_type === "undefined" ? "" : String(row.normalized_output_type),
      quantity: sqlNumberValue(row.quantity)
    };
  }

  private serializeConditionalRule(row: typeof masterEntityConditionalRules.$inferSelect): ConditionalMappingRuleDto {
    return {
      id: row.id,
      entityId: row.entityId,
      sourceSystem: row.sourceSystem,
      sourceField: row.sourceField as ConditionalMappingSourceField,
      sourceValue: row.sourceValue,
      sourceValueNormalized: row.sourceValueNormalized,
      conditionType: row.conditionType as ConditionalMappingConditionType,
      conditionValue: row.conditionValue,
      conditionValueNormalized: row.conditionValueNormalized,
      source: row.source,
      isActive: row.isActive,
      createdAt: timestampText(row.createdAt) ?? new Date().toISOString(),
      updatedAt: timestampText(row.updatedAt) ?? new Date().toISOString()
    };
  }

  private async activeEntityCandidates() {
    return this.database.pool.query<{
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
        order by me.entity_code asc
        limit 500
      `
    ).then((result) => result.rows);
  }

  private suggestCandidates(
    sourceValue: string,
    entities: readonly {
      readonly entity_id: string;
      readonly entity_code: string;
      readonly display_name: string;
      readonly line_code: string | null;
      readonly product_family: string | null;
      readonly report_group: string | null;
      readonly alias_values: string[] | null;
      readonly target_exists: boolean;
    }[]
  ): readonly MappingCandidateDto[] {
    const candidates: readonly CandidateEntityInput[] = entities.map((entity) => ({
      entityId: entity.entity_id,
      entityCode: entity.entity_code,
      displayName: entity.display_name,
      aliasValues: entity.alias_values ?? [],
      targetExists: entity.target_exists,
      lineCode: entity.line_code,
      productFamily: entity.product_family,
      reportGroup: entity.report_group
    }));
    return suggestMappingCandidates(sourceValue, candidates);
  }

  private async findConversion(itemNo: string, uom: string): Promise<ConversionMappingDto | null> {
    const [mapping] = await this.database.db
      .select()
      .from(itemConversionMappings)
      .where(
        and(
          eq(itemConversionMappings.itemNo, normalizeAliasDisplay(itemNo)),
          eq(itemConversionMappings.uom, normalizeAliasDisplay(uom)),
          eq(itemConversionMappings.isActive, true)
        )
      )
      .limit(1);
    return mapping ? this.serializeConversion(mapping) : null;
  }

  private serializeEntity(row: {
    readonly id: string;
    readonly entity_code: string;
    readonly display_name: string;
    readonly area: string | null;
    readonly line_code: string | null;
    readonly product_family: string | null;
    readonly report_group: string | null;
    readonly planned_runtime_hours: string | number;
    readonly is_active: boolean;
    readonly alias_count: string | number;
    readonly target_count: string | number;
    readonly output_row_count: string | number;
    readonly created_at: Date | string;
    readonly updated_at: Date | string;
  }): MasterEntityDto {
    return {
      id: row.id,
      entityCode: row.entity_code,
      displayName: row.display_name,
      area: row.area,
      lineCode: row.line_code,
      productFamily: row.product_family,
      reportGroup: row.report_group,
      plannedRuntimeHours: numberValue(row.planned_runtime_hours),
      isActive: row.is_active,
      aliasCount: numberValue(row.alias_count),
      targetCount: numberValue(row.target_count),
      outputRowCount: numberValue(row.output_row_count),
      createdAt: timestampText(row.created_at) ?? new Date().toISOString(),
      updatedAt: timestampText(row.updated_at) ?? new Date().toISOString()
    };
  }

  private serializeAlias(row: typeof masterEntityAliases.$inferSelect): MasterAliasDto {
    return {
      id: row.id,
      entityId: row.entityId,
      alias: row.alias,
      sourceSystem: row.sourceSystem,
      sourceField: row.sourceField as MasterSourceField,
      aliasNormalized: row.aliasNormalized,
      source: row.source,
      matchConfidence: row.matchConfidence === null ? null : numberValue(row.matchConfidence),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null
    };
  }

  private serializeConversion(row: typeof itemConversionMappings.$inferSelect): ConversionMappingDto {
    return {
      id: row.id,
      itemNo: row.itemNo,
      uom: row.uom,
      grossWeightPerPcs: numberValue(row.grossWeightPerPcs),
      source: row.source,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
