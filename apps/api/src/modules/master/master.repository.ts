import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  dataQualityIssues,
  itemConversionMappings,
  masterEntities,
  masterEntityAliases
} from "@poip/db";
import {
  normalizeAliasDisplay,
  normalizeAliasKey,
  type MasterSourceField
} from "@poip/domain";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type {
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
  machine_center_no: "machine_center_no",
  prod_line_no: "prod_line_no",
  prod_line_description: "prod_line_description",
  item_no: "item_no",
  uom: "uom"
};

function columnFor(sourceField: MasterSourceField): string {
  return sourceColumns[sourceField];
}

function sqlNormalizeExpression(column: string): string {
  return `upper(regexp_replace(trim(coalesce(${column}, '')), '[^A-Za-z0-9]+', '', 'g'))`;
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampText(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function pagination(page: number, pageSize: number, totalRows: number): Pagination {
  return { page, pageSize, totalRows, totalPages: Math.ceil(totalRows / pageSize) };
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

@Injectable()
export class MasterRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async overview() {
    const [entities, aliases, unmapped, targetCoverage, gaps] = await Promise.all([
      this.database.pool.query<{ total: string | number; active: string | number }>(
        "select count(*) as total, count(*) filter (where is_active) as active from master_entities"
      ),
      this.database.pool.query<{ active: string | number }>(
        "select count(*) filter (where is_active) as active from master_entity_aliases"
      ),
      this.database.pool.query<{ groups: string | number; rows: string | number }>(
        `
          select count(distinct coalesce(machine_center_no, prod_line_no, prod_line_description, '(blank)')) as groups,
                 count(*) as rows
          from production_outputs
          where source_system = $1 and entity_id is null and normalized_output_type = 'OK' and quantity > 0
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
      unmappedSourceGroups: numberValue(unmapped.rows[0]?.groups),
      unmappedRows: numberValue(unmapped.rows[0]?.rows),
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
    const dateClauses = ["source_system = $1", "entity_id is null", "normalized_output_type = 'OK'", "quantity > 0"];
    if (filters.from) {
      params.push(filters.from);
      dateClauses.push(`posting_date >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      dateClauses.push(`posting_date <= $${params.length}`);
    }
    const sourceFilterParams: unknown[] = [];
    const sourceClauses = ["source_value is not null", "source_value <> ''"];
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
        select 'machine_center_no'::text as source_field, machine_center_no as source_value, posting_date, document_no, item_no, uom, quantity
        from production_outputs where ${dateClauses.join(" and ")}
        union all
        select 'prod_line_no', prod_line_no, posting_date, document_no, item_no, uom, quantity
        from production_outputs where ${dateClauses.join(" and ")}
        union all
        select 'prod_line_description', prod_line_description, posting_date, document_no, item_no, uom, quantity
        from production_outputs where ${dateClauses.join(" and ")}
      ),
      grouped as (
        select source_field, source_value,
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
        group by source_field, source_value
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
            select id, source_system, 'machine_center_no'::text source_field, machine_center_no source_value, entity_id from production_outputs
            union all select id, source_system, 'prod_line_no', prod_line_no, entity_id from production_outputs
            union all select id, source_system, 'prod_line_description', prod_line_description, entity_id from production_outputs
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
            count(*) filter (where po.entity_id is null or $4::boolean) as affected_rows,
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
        [sourceSystem, normalized, sourceValue, input.remap ?? false]
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
      let aliasRow = await tx
        .select()
        .from(masterEntityAliases)
        .where(
          and(
            eq(masterEntityAliases.sourceSystem, sourceSystem),
            eq(masterEntityAliases.sourceField, sourceField),
            eq(masterEntityAliases.aliasNormalized, normalized),
            eq(masterEntityAliases.isActive, true)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (aliasRow && aliasRow.entityId !== input.entityId) {
        throw new ConflictException("Active alias already maps to another entity");
      }
      if (!aliasRow) {
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
      const entryNos = updated.rows.map((row) => String((row as { entry_no: string }).entry_no));
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
            and source_ref = any(${entryNos}::text[])
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
        alias: this.serializeAlias(aliasRow)
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
          coalesce(me.display_name, po.machine_center_no, po.prod_line_no, po.prod_line_description, 'Unmapped') as entity_name,
          coalesce(po.machine_center_no, po.prod_line_no, po.prod_line_description, 'Unmapped') as source_group,
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
        select month, entity_id::text, entity_name, source_group, reason, count(*) as rows, coalesce(sum(quantity), 0) as output_ok_qty
        from coverage
        group by month, entity_id, entity_name, source_group, reason
      )
    `;
    const [countResult, rowsResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(`${base} select count(*) as total from grouped`, params),
      this.database.pool.query<{
        month: string;
        entity_id: string | null;
        entity_name: string;
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

  private async activeEntityCandidates() {
    return this.database.pool.query<{
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
        order by me.entity_code asc
        limit 500
      `
    ).then((result) => result.rows);
  }

  private suggestCandidates(
    sourceValue: string,
    entities: readonly { readonly entity_id: string; readonly entity_code: string; readonly display_name: string; readonly alias_values: string[] | null }[]
  ): readonly MappingCandidateDto[] {
    return entities
      .flatMap((entity) => {
        const values = [entity.entity_code, entity.display_name, ...(entity.alias_values ?? [])];
        const score = Math.max(...values.map((value) => similarity(sourceValue, value)));
        return score >= 30
          ? [{
              entityId: entity.entity_id,
              entityCode: entity.entity_code,
              displayName: entity.display_name,
              reason: score >= 100 ? "Exact normalized match" : score >= 80 ? "Strong normalized similarity" : "Possible name similarity",
              score
            }]
          : [];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
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
