import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { dataQualityIssues } from "@poip/db";
import { normalizeAliasKey, suggestMappingCandidates, type CandidateEntityInput } from "@poip/domain";
import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { redactSensitiveValue } from "../../common/redaction.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import {
  buildDailyItemResume,
  type DailyItemResumeSourceRow,
  type DailyItemResumeTarget
} from "../dashboard/daily-item-resume.js";
import {
  addBusinessCentralIssueSummary,
  businessCentralIssueCodes,
  businessCentralIssueSeverity,
  businessCentralIssueSourceRef,
  dedupeGeneratedBusinessCentralIssues,
  generatedBusinessCentralIssueChanged,
  newBusinessCentralIssueGenerationSummary,
  recommendedActionForUnmappedSource,
  type BusinessCentralIssueGenerationSummary,
  type GeneratedBusinessCentralIssue
} from "./business-central-generation.js";
import type {
  DataQualityIssueFilters,
  DataQualityStatusInput
} from "./data-quality.types.js";

const SOURCE_SYSTEM = "business-central";
type QueryClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

const explanations: Readonly<Record<string, string>> = {
  MISSING_ENTRY_NO: "Nomor entry sumber kosong sehingga deduplikasi utama tidak dapat digunakan.",
  DUPLICATE_ENTRY_NO: "Nomor entry yang sama ditemukan dengan payload yang berbeda.",
  MISSING_POSTING_DATE: "Tanggal posting wajib tersedia untuk menempatkan output pada periode produksi.",
  MISSING_DOCUMENT_NO: "Nomor dokumen sumber belum tersedia.",
  MISSING_ITEM_NO: "Nomor item kosong sehingga output tidak dapat ditelusuri ke item produksi.",
  UNKNOWN_MACHINE: "Kode mesin belum terhubung dengan master entity.",
  UNKNOWN_ITEM: "Nomor item belum dikenali oleh master data.",
  MISSING_TARGET: "Entity produksi tidak memiliki target aktif pada tanggal terkait.",
  MISSING_GROSS_WEIGHT: "Konversi reject ke PCS ekuivalen tidak dapat dihitung tanpa gross weight.",
  NEGATIVE_QUANTITY: "Kuantitas negatif perlu diverifikasi terhadap transaksi sumber.",
  OUTPUT_CORRECTION: "Kuantitas Output negatif diperlakukan sebagai koreksi/reversal produksi OK.",
  REJECT_UOM_MISMATCH: "Item reject RJ terdeteksi, tetapi UOM bukan KG.",
  OK_UOM_MISMATCH: "Item output non-RJ terdeteksi, tetapi UOM bukan PCS.",
  UNKNOWN_OUTPUT_CLASS: "Output tidak dapat diklasifikasikan sebagai OK atau Reject dari item dan UOM.",
  ZERO_QUANTITY: "Transaksi memiliki kuantitas nol.",
  INVALID_DATE: "Nilai tanggal dari sumber tidak dapat diparse sebagai tanggal valid.",
  IMPORT_CONFLICT: "Baris import berbenturan dengan downtime yang sudah tersimpan.",
  IMPORT_VALIDATION: "Baris import gagal memenuhi satu atau lebih aturan validasi.",
  BC_UNMAPPED_SOURCE: "Grup sumber Business Central belum dipetakan ke master entity.",
  BC_CONDITIONAL_MAPPING_REVIEW: "Grup sumber Business Central membutuhkan review conditional mapping.",
  BC_TARGET_MISSING: "Target Business Central tidak usable untuk entity dan periode terkait.",
  BC_NO_ACTIVE_TARGET: "Entity Business Central belum memiliki target aktif yang disetujui.",
  BC_REJECT_PCS_INCOMPLETE: "Reject PCS equivalent belum lengkap sehingga KPI reject rate tidak lengkap.",
  BC_AMBIGUOUS_REJECT_ATTACHMENT: "Reject Business Central memiliki lebih dari satu kandidat output OK."
};

function timestamp(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function timestampOptional(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function dateText(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function outputEntryTypePredicate(alias = "po"): string {
  return `upper(coalesce(${alias}.entry_type, '')) = 'OUTPUT'`;
}

function okOutputPredicate(alias = "po"): string {
  return `upper(coalesce(${alias}.item_no, '')) not like 'RJ%' and upper(coalesce(${alias}.uom, '')) = 'PCS'`;
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

function jakartaDateBoundary(value: string, endOfDay = false): Date {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
}

function serializeIssue(issue: typeof dataQualityIssues.$inferSelect) {
  return {
    id: issue.id,
    issueCode: issue.issueCode,
    severity: issue.severity,
    entityType: issue.entityType,
    entityId: issue.entityId,
    sourceSystem: issue.sourceSystem,
    sourceRef: issue.sourceRef,
    description: issue.description,
    explanation: explanations[issue.issueCode] ?? issue.description,
    payload: redactSensitiveValue(issue.payload),
    status: issue.status,
    resolvedBy: issue.resolvedBy,
    resolvedAt: timestamp(issue.resolvedAt),
    resolutionNote: issue.resolutionNote,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: timestampOptional(issue.updatedAt) ?? issue.createdAt.toISOString()
  };
}

@Injectable()
export class DataQualityRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async getSummary() {
    const rows = await this.database.db
      .select({
        status: dataQualityIssues.status,
        severity: dataQualityIssues.severity,
        issueCode: dataQualityIssues.issueCode,
        value: count()
      })
      .from(dataQualityIssues)
      .groupBy(dataQualityIssues.status, dataQualityIssues.severity, dataQualityIssues.issueCode)
      .orderBy(asc(dataQualityIssues.status), asc(dataQualityIssues.severity));

    const statusCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const row of rows) {
      const value = Number(row.value);
      statusCounts[row.status] = (statusCounts[row.status] ?? 0) + value;
      severityCounts[row.severity] = (severityCounts[row.severity] ?? 0) + value;
      categoryCounts[row.issueCode] = (categoryCounts[row.issueCode] ?? 0) + value;
    }

    return {
      openIssues: statusCounts.OPEN ?? 0,
      acknowledgedIssues: statusCounts.ACKNOWLEDGED ?? 0,
      resolvedIssues: statusCounts.RESOLVED ?? 0,
      ignoredIssues: statusCounts.IGNORED ?? 0,
      criticalIssues: rows
        .filter((row) => row.severity === "CRITICAL" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      highIssues: rows
        .filter((row) => row.severity === "HIGH" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      warningIssues: rows
        .filter((row) => row.severity === "WARNING" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      mediumIssues: rows
        .filter((row) => row.severity === "MEDIUM" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      lowIssues: rows
        .filter((row) => row.severity === "LOW" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      infoIssues: rows
        .filter((row) => row.severity === "INFO" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      byStatus: Object.entries(statusCounts).map(([status, issueCount]) => ({ status, issueCount })),
      bySeverity: Object.entries(severityCounts).map(([severity, issueCount]) => ({ severity, issueCount })),
      byCode: Object.entries(categoryCounts)
        .map(([issueCode, issueCount]) => ({ issueCode, issueCount }))
        .sort((a, b) => b.issueCount - a.issueCount || a.issueCode.localeCompare(b.issueCode))
    };
  }

  async list(filters: DataQualityIssueFilters) {
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(dataQualityIssues.status, filters.status));
    if (filters.severity) conditions.push(eq(dataQualityIssues.severity, filters.severity));
    if (filters.source) conditions.push(eq(dataQualityIssues.sourceSystem, filters.source));
    if (filters.issueCode) conditions.push(eq(dataQualityIssues.issueCode, filters.issueCode));
    if (filters.from) conditions.push(gte(dataQualityIssues.createdAt, jakartaDateBoundary(filters.from)));
    if (filters.to) conditions.push(lte(dataQualityIssues.createdAt, jakartaDateBoundary(filters.to, true)));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      this.database.db
        .select()
        .from(dataQualityIssues)
        .where(where)
        .orderBy(desc(dataQualityIssues.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      this.database.db.select({ value: count() }).from(dataQualityIssues).where(where)
    ]);
    const totalRows = Number(totals[0]?.value ?? 0);
    return {
      rows: rows.map(serializeIssue),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async getById(id: string) {
    const [issue] = await this.database.db
      .select()
      .from(dataQualityIssues)
      .where(eq(dataQualityIssues.id, id))
      .limit(1);
    return issue ? serializeIssue(issue) : null;
  }

  async getByIdOrThrow(id: string) {
    const issue = await this.getById(id);
    if (!issue) throw new NotFoundException("Data quality issue not found");
    return issue;
  }

  async updateStatus(id: string, input: DataQualityStatusInput) {
    await this.getByIdOrThrow(id);
    const reopening = input.status === "OPEN";
    const [updated] = await this.database.db
      .update(dataQualityIssues)
      .set({
        status: input.status,
        resolvedBy: reopening ? null : input.actorUserId,
        resolvedAt: reopening ? null : new Date(),
        resolutionNote: reopening ? null : input.note ?? null,
        updatedAt: sql`now()`
      })
      .where(eq(dataQualityIssues.id, id))
      .returning();
    if (!updated) throw new NotFoundException("Data quality issue not found");
    return serializeIssue(updated);
  }

  async generateBusinessCentralIssues(input: {
    readonly actorUserId?: string | null | undefined;
  } = {}): Promise<BusinessCentralIssueGenerationSummary> {
    const generated = dedupeGeneratedBusinessCentralIssues([
      ...await this.buildUnmappedSourceIssues(),
      ...await this.buildConditionalMappingReviewIssues(),
      ...await this.buildTargetCoverageIssues(),
      ...await this.buildRejectConversionIssues()
    ]);
    const summary = newBusinessCentralIssueGenerationSummary();
    const client = await this.database.pool.connect();
    try {
      await client.query("begin");
      for (const issue of generated) {
        await this.upsertGeneratedIssue(client, issue, summary, input.actorUserId ?? null);
      }
      await this.resolveDisappearedGeneratedIssues(
        client,
        new Set(generated.map((issue) => issue.sourceRef)),
        summary,
        input.actorUserId ?? null
      );
      await client.query("commit");
      return summary;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async buildUnmappedSourceIssues(): Promise<readonly GeneratedBusinessCentralIssue[]> {
    const [rows, entities] = await Promise.all([
      this.database.pool.query<{
        month: string;
        source_field: string;
        source_value: string;
        normalized_value: string;
        row_count: string | number;
        ok_qty: string | number;
        first_posting_date: string | null;
        last_posting_date: string | null;
        sample_document_nos: string[] | null;
        sample_item_nos: string[] | null;
      }>(
        `
          with source_rows as (
            select date_trunc('month', po.posting_date)::date::text as month,
                   ${preferredEntitySourceFieldSql("po")}::text as source_field,
                   ${preferredEntitySourceValueSql("po")} as source_value,
                   po.posting_date,
                   po.document_no,
                   po.item_no,
                   po.quantity
            from production_outputs po
            where po.source_system = $1
              and ${outputEntryTypePredicate("po")}
              and po.entity_id is null
              and ${okOutputPredicate("po")}
          )
          select month,
                 source_field,
                 coalesce(source_value, '') as source_value,
                 upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
                 count(*) as row_count,
                 coalesce(sum(quantity), 0) as ok_qty,
                 min(posting_date)::text as first_posting_date,
                 max(posting_date)::text as last_posting_date,
                 array_remove((array_agg(distinct document_no))[1:5], null) as sample_document_nos,
                 array_remove((array_agg(distinct item_no))[1:5], null) as sample_item_nos
          from source_rows
          group by month, source_field, coalesce(source_value, '')
          order by ok_qty desc, row_count desc
        `,
        [SOURCE_SYSTEM]
      ),
      this.activeEntityCandidates()
    ]);
    return rows.rows.map((row) => {
      const suggestions = suggestMappingCandidates(row.source_value, entities).slice(0, 5);
      const rowCount = numberValue(row.row_count);
      const okQty = numberValue(row.ok_qty);
      const sampleItemNos = row.sample_item_nos ?? [];
      const payload = {
        sourceSystem: SOURCE_SYSTEM,
        sourceField: row.source_field,
        sourceValue: row.source_value,
        normalizedValue: row.normalized_value,
        rowCount,
        okQty,
        firstPostingDate: row.first_posting_date,
        lastPostingDate: row.last_posting_date,
        sampleDocumentNos: row.sample_document_nos ?? [],
        sampleItemNos,
        suggestedTargetEntities: suggestions.map((suggestion) => ({
          entityId: suggestion.entityId,
          entityCode: suggestion.entityCode,
          displayName: suggestion.displayName,
          confidence: suggestion.confidence,
          score: suggestion.score,
          reason: suggestion.reason,
          targetExists: suggestion.targetExists
        })),
        recommendedAction: recommendedActionForUnmappedSource({
          sourceValue: row.source_value,
          sampleItemNos,
          suggestedTargetEntities: suggestions
        }),
        relatedEndpoint: `/master-data?sourceField=${encodeURIComponent(row.source_field)}&sourceValue=${encodeURIComponent(row.source_value)}`
      };
      return {
        issueCode: "BC_UNMAPPED_SOURCE",
        severity: businessCentralIssueSeverity({ okQty }),
        entityType: "business_central_source_group",
        entityId: null,
        sourceSystem: SOURCE_SYSTEM,
        sourceRef: businessCentralIssueSourceRef("unmapped-source", [
          row.source_field,
          row.normalized_value,
          row.month
        ]),
        description: `Unmapped Business Central source ${row.source_field}=${row.source_value || "(blank)"}`,
        payload
      };
    });
  }

  private async buildConditionalMappingReviewIssues(): Promise<readonly GeneratedBusinessCentralIssue[]> {
    const result = await this.database.pool.query<{
      month: string;
      source_field: string;
      source_value: string;
      normalized_value: string;
      row_count: string | number;
      ok_qty: string | number;
      first_posting_date: string | null;
      last_posting_date: string | null;
      sample_document_nos: string[] | null;
      sample_item_nos: string[] | null;
      sample_reasons: string[] | null;
    }>(
      `
        with issue_rows as (
          select date_trunc('month', po.posting_date)::date::text as month,
                 ${preferredEntitySourceFieldSql("po")}::text as source_field,
                 ${preferredEntitySourceValueSql("po")} as source_value,
                 po.posting_date,
                 po.document_no,
                 po.item_no,
                 po.uom,
                 po.quantity,
                 dqi.description
          from data_quality_issues dqi
          inner join production_outputs po
            on po.source_system = dqi.source_system
           and po.entry_no::text = dqi.source_ref
          where dqi.source_system = $1
            and dqi.issue_code = 'CONDITIONAL_MAPPING_REVIEW'
            and dqi.status in ('OPEN', 'ACKNOWLEDGED')
            and ${outputEntryTypePredicate("po")}
        )
        select month,
               source_field,
               coalesce(source_value, '') as source_value,
               upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
               count(*) as row_count,
               coalesce(sum(quantity) filter (where ${okOutputPredicate("issue_rows")}), 0) as ok_qty,
               min(posting_date)::text as first_posting_date,
               max(posting_date)::text as last_posting_date,
               array_remove((array_agg(distinct document_no))[1:5], null) as sample_document_nos,
               array_remove((array_agg(distinct item_no))[1:5], null) as sample_item_nos,
               array_remove((array_agg(distinct description))[1:3], null) as sample_reasons
        from issue_rows
        group by month, source_field, coalesce(source_value, '')
        order by ok_qty desc, row_count desc
      `,
      [SOURCE_SYSTEM]
    );
    return result.rows.map((row) => {
      const rowCount = numberValue(row.row_count);
      const okQty = numberValue(row.ok_qty);
      return {
        issueCode: "BC_CONDITIONAL_MAPPING_REVIEW",
        severity: businessCentralIssueSeverity({ okQty }),
        entityType: "business_central_conditional_mapping",
        entityId: null,
        sourceSystem: SOURCE_SYSTEM,
        sourceRef: businessCentralIssueSourceRef("conditional-mapping-review", [
          row.source_field,
          row.normalized_value,
          row.month
        ]),
        description: `Conditional mapping review required for ${row.source_field}=${row.source_value || "(blank)"}`,
        payload: {
          sourceSystem: SOURCE_SYSTEM,
          sourceField: row.source_field,
          sourceValue: row.source_value,
          normalizedValue: row.normalized_value,
          rowCount,
          okQty,
          firstPostingDate: row.first_posting_date,
          lastPostingDate: row.last_posting_date,
          sampleDocumentNos: row.sample_document_nos ?? [],
          sampleItemNos: row.sample_item_nos ?? [],
          suggestedTargetEntities: [],
          recommendedAction: "Use Conditional Mapping Rule, not broad alias.",
          relatedEndpoint: `/master-data?sourceField=${encodeURIComponent(row.source_field)}&sourceValue=${encodeURIComponent(row.source_value)}`,
          sampleReasons: row.sample_reasons ?? []
        }
      };
    });
  }

  private async buildTargetCoverageIssues(): Promise<readonly GeneratedBusinessCentralIssue[]> {
    const result = await this.database.pool.query<{
      month: string;
      entity_id: string | null;
      entity_code: string | null;
      entity_name: string;
      source_field: string;
      source_value: string;
      normalized_value: string;
      reason: string;
      row_count: string | number;
      ok_qty: string | number;
      first_posting_date: string | null;
      last_posting_date: string | null;
      sample_document_nos: string[] | null;
      sample_item_nos: string[] | null;
    }>(
      `
        with coverage as (
          select date_trunc('month', po.posting_date)::date::text as month,
                 po.entity_id,
                 me.entity_code,
                 coalesce(me.display_name, ${preferredEntitySourceValueSql("po")}, 'Unmapped') as entity_name,
                 ${preferredEntitySourceFieldSql("po")}::text as source_field,
                 coalesce(${preferredEntitySourceValueSql("po")}, '') as source_value,
                 po.posting_date,
                 po.document_no,
                 po.item_no,
                 po.quantity,
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
                     where pt.entity_id = po.entity_id
                       and pt.status in ('APPROVED', 'ACTIVE')
                   ) then 'OUTSIDE_EFFECTIVE_DATE'
                   else 'NO_ACTIVE_TARGET'
                 end as reason
          from production_outputs po
          left join master_entities me on me.id = po.entity_id
          where po.source_system = $1
            and ${outputEntryTypePredicate("po")}
            and ${okOutputPredicate("po")}
        )
        select month,
               entity_id::text,
               entity_code,
               entity_name,
               source_field,
               source_value,
               upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
               reason,
               count(*) as row_count,
               coalesce(sum(quantity), 0) as ok_qty,
               min(posting_date)::text as first_posting_date,
               max(posting_date)::text as last_posting_date,
               array_remove((array_agg(distinct document_no))[1:5], null) as sample_document_nos,
               array_remove((array_agg(distinct item_no))[1:5], null) as sample_item_nos
        from coverage
        where entity_id is not null
          and reason in ('NO_ACTIVE_TARGET', 'TARGET_NOT_APPROVED', 'OUTSIDE_EFFECTIVE_DATE', 'TARGET_ZERO')
        group by month, entity_id, entity_code, entity_name, source_field, source_value, reason
        order by ok_qty desc, row_count desc
      `,
      [SOURCE_SYSTEM]
    );
    return result.rows.map((row) => {
      const rowCount = numberValue(row.row_count);
      const okQty = numberValue(row.ok_qty);
      const issueCode = row.reason === "NO_ACTIVE_TARGET" ? "BC_NO_ACTIVE_TARGET" : "BC_TARGET_MISSING";
      return {
        issueCode,
        severity: businessCentralIssueSeverity({ okQty, targetBlocksAchievement: true }),
        entityType: "business_central_target_coverage",
        entityId: row.entity_id,
        sourceSystem: SOURCE_SYSTEM,
        sourceRef: businessCentralIssueSourceRef(issueCode.toLowerCase(), [
          row.entity_id ?? row.entity_code ?? row.entity_name,
          row.reason,
          row.month
        ]),
        description: `${row.reason} for ${row.entity_name} in ${row.month}`,
        payload: {
          sourceSystem: SOURCE_SYSTEM,
          sourceField: row.source_field,
          sourceValue: row.source_value,
          normalizedValue: row.normalized_value,
          rowCount,
          okQty,
          firstPostingDate: row.first_posting_date,
          lastPostingDate: row.last_posting_date,
          sampleDocumentNos: row.sample_document_nos ?? [],
          sampleItemNos: row.sample_item_nos ?? [],
          suggestedTargetEntities: row.entity_id ? [{
            entityId: row.entity_id,
            entityCode: row.entity_code,
            displayName: row.entity_name
          }] : [],
          recommendedAction: "Create or approve target for this entity-day/month.",
          relatedEndpoint: `/settings/targets?entityId=${encodeURIComponent(row.entity_id ?? "")}`,
          targetReason: row.reason,
          entityCode: row.entity_code,
          entityName: row.entity_name,
          month: row.month
        }
      };
    });
  }

  private async buildRejectConversionIssues(): Promise<readonly GeneratedBusinessCentralIssue[]> {
    const range = await this.businessCentralOutputRange();
    if (!range) return [];
    const [sourceRows, targets] = await Promise.all([
      this.queryDailyItemResumeSourceRows(range),
      this.queryDailyItemResumeTargets()
    ]);
    if (sourceRows.length === 0) return [];
    const rows = buildDailyItemResume(sourceRows, targets, {
      from: range.from,
      to: range.to,
      sourceSystem: SOURCE_SYSTEM,
      page: 1,
      pageSize: Math.max(sourceRows.length, 1),
      sort: "postingDate.desc"
    }).rows;
    const aggregates = new Map<string, {
      issueCode: "BC_REJECT_PCS_INCOMPLETE" | "BC_AMBIGUOUS_REJECT_ATTACHMENT";
      documentNo: string;
      rejectItemNo: string;
      postingDate: string;
      attachmentStatus: string;
      reason: string;
      rowCount: number;
      okQty: number;
      rejectKg: number;
      firstPostingDate: string | null;
      lastPostingDate: string | null;
      sampleDocumentNos: Set<string>;
      sampleItemNos: Set<string>;
      candidateRows: unknown[];
    }>();

    for (const row of rows) {
      for (const detail of row.rejectDetails) {
        if (detail.conversionStatus !== "INCOMPLETE") continue;
        const reason = typeof detail.conversionGapReason === "string"
          ? detail.conversionGapReason
          : "MISSING_OK_GROSS_WEIGHT";
        const attachmentStatus = typeof detail.attachmentStatus === "string"
          ? detail.attachmentStatus
          : row.rejectAttachmentStatus;
        const issueCode = reason === "AMBIGUOUS_REJECT_ATTACHMENT"
          ? "BC_AMBIGUOUS_REJECT_ATTACHMENT"
          : "BC_REJECT_PCS_INCOMPLETE";
        const documentNo = typeof detail.documentNo === "string" && detail.documentNo
          ? detail.documentNo
          : row.documentSummary;
        const rejectItemNo = typeof detail.itemNo === "string" && detail.itemNo ? detail.itemNo : row.itemNo;
        const postingDate = typeof detail.postingDate === "string" ? detail.postingDate : row.postingDate;
        const sourceRef = businessCentralIssueSourceRef(issueCode.toLowerCase(), [
          documentNo,
          rejectItemNo,
          issueCode === "BC_AMBIGUOUS_REJECT_ATTACHMENT" ? postingDate : attachmentStatus,
          reason
        ]);
        const aggregate = aggregates.get(sourceRef) ?? {
          issueCode,
          documentNo,
          rejectItemNo,
          postingDate,
          attachmentStatus,
          reason,
          rowCount: 0,
          okQty: 0,
          rejectKg: 0,
          firstPostingDate: null,
          lastPostingDate: null,
          sampleDocumentNos: new Set<string>(),
          sampleItemNos: new Set<string>(),
          candidateRows: []
        };
        aggregate.rowCount += 1;
        aggregate.okQty += row.netOutputQty;
        aggregate.rejectKg += numberValue(detail.rejectKg as string | number | null | undefined);
        aggregate.firstPostingDate = aggregate.firstPostingDate === null || postingDate < aggregate.firstPostingDate
          ? postingDate
          : aggregate.firstPostingDate;
        aggregate.lastPostingDate = aggregate.lastPostingDate === null || postingDate > aggregate.lastPostingDate
          ? postingDate
          : aggregate.lastPostingDate;
        if (documentNo) aggregate.sampleDocumentNos.add(documentNo);
        if (rejectItemNo) aggregate.sampleItemNos.add(rejectItemNo);
        if (row.itemNo) aggregate.sampleItemNos.add(row.itemNo);
        if (Array.isArray(detail.attachmentCandidates)) {
          aggregate.candidateRows.push(...detail.attachmentCandidates.slice(0, 5));
        }
        aggregates.set(sourceRef, aggregate);
      }
    }

    return [...aggregates.entries()].map(([sourceRef, aggregate]) => ({
      issueCode: aggregate.issueCode,
      severity: businessCentralIssueSeverity({ okQty: aggregate.okQty, rejectPcsGap: true }),
      entityType: "business_central_reject_gap",
      entityId: null,
      sourceSystem: SOURCE_SYSTEM,
      sourceRef,
      description: aggregate.issueCode === "BC_AMBIGUOUS_REJECT_ATTACHMENT"
        ? `Ambiguous reject attachment for ${aggregate.documentNo}`
        : `Reject PCS equivalent incomplete for ${aggregate.documentNo}`,
      payload: {
        sourceSystem: SOURCE_SYSTEM,
        sourceField: "document_no",
        sourceValue: aggregate.documentNo,
        normalizedValue: normalizeAliasKey(aggregate.documentNo),
        rowCount: aggregate.rowCount,
        okQty: aggregate.okQty,
        firstPostingDate: aggregate.firstPostingDate,
        lastPostingDate: aggregate.lastPostingDate,
        sampleDocumentNos: [...aggregate.sampleDocumentNos].slice(0, 5),
        sampleItemNos: [...aggregate.sampleItemNos].slice(0, 5),
        suggestedTargetEntities: [],
        recommendedAction: aggregate.issueCode === "BC_AMBIGUOUS_REJECT_ATTACHMENT"
          ? "Review candidate OK rows and attach deterministically."
          : "Review reject attachment or gross-weight conversion source.",
        relatedEndpoint: `/overview?search=${encodeURIComponent(aggregate.documentNo)}`,
        rejectItemNo: aggregate.rejectItemNo,
        rejectKg: aggregate.rejectKg,
        attachmentStatus: aggregate.attachmentStatus,
        conversionGapReason: aggregate.reason,
        candidateRows: aggregate.candidateRows.slice(0, 8)
      }
    }));
  }

  private async upsertGeneratedIssue(
    client: QueryClient,
    issue: GeneratedBusinessCentralIssue,
    summary: BusinessCentralIssueGenerationSummary,
    actorUserId: string | null
  ): Promise<void> {
    const existing = await client.query<{
      id: string;
      issue_code: string;
      severity: string;
      description: string;
      payload: unknown;
      status: string;
    }>(
      `
        select id, issue_code, severity, description, payload, status
        from data_quality_issues
        where issue_code = $1
          and source_system = $2
          and source_ref = $3
        order by
          case when status in ('OPEN', 'ACKNOWLEDGED', 'IGNORED') then 0 else 1 end,
          created_at asc
      `,
      [issue.issueCode, issue.sourceSystem, issue.sourceRef]
    );
    const canonical = existing.rows[0];
    if (!canonical) {
      await client.query(
        `
          insert into data_quality_issues (
            issue_code, severity, entity_type, entity_id, source_system, source_ref,
            description, payload, status, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'OPEN', now(), now())
        `,
        [
          issue.issueCode,
          issue.severity,
          issue.entityType,
          issue.entityId,
          issue.sourceSystem,
          issue.sourceRef,
          issue.description,
          JSON.stringify(issue.payload)
        ]
      );
      addBusinessCentralIssueSummary(summary, issue.issueCode, issue.severity, "created");
      return;
    }

    if (generatedBusinessCentralIssueChanged({
      issueCode: canonical.issue_code,
      severity: canonical.severity,
      description: canonical.description,
      payload: canonical.payload,
      status: canonical.status
    }, issue)) {
      await client.query(
        `
          update data_quality_issues
          set severity = $2,
              entity_type = $3,
              entity_id = $4,
              description = $5,
              payload = $6::jsonb,
              status = case when status = 'RESOLVED' then 'OPEN' else status end,
              resolved_by = case when status = 'RESOLVED' then null else resolved_by end,
              resolved_at = case when status = 'RESOLVED' then null else resolved_at end,
              resolution_note = case when status = 'RESOLVED' then null else resolution_note end,
              updated_at = now()
          where id = $1
        `,
        [
          canonical.id,
          issue.severity,
          issue.entityType,
          issue.entityId,
          issue.description,
          JSON.stringify(issue.payload)
        ]
      );
      addBusinessCentralIssueSummary(summary, issue.issueCode, issue.severity, "updated");
    } else {
      addBusinessCentralIssueSummary(summary, issue.issueCode, issue.severity, "unchanged");
    }

    for (const duplicate of existing.rows.slice(1).filter((row) => ["OPEN", "ACKNOWLEDGED"].includes(row.status))) {
      await client.query(
        `
          update data_quality_issues
          set status = 'RESOLVED',
              resolved_by = $2,
              resolved_at = now(),
              resolution_note = 'Resolved by Business Central DQ generation: duplicate generated issue',
              updated_at = now()
          where id = $1
        `,
        [duplicate.id, actorUserId]
      );
      addBusinessCentralIssueSummary(summary, duplicate.issue_code, duplicate.severity, "resolved");
    }
  }

  private async resolveDisappearedGeneratedIssues(
    client: QueryClient,
    activeSourceRefs: ReadonlySet<string>,
    summary: BusinessCentralIssueGenerationSummary,
    actorUserId: string | null
  ): Promise<void> {
    const resolved = await client.query<{ issue_code: string; severity: string }>(
      `
        update data_quality_issues
        set status = 'RESOLVED',
            resolved_by = $3,
            resolved_at = now(),
            resolution_note = 'Resolved by Business Central DQ generation: source gap no longer present',
            updated_at = now()
        where source_system = $1
          and issue_code = any($2::text[])
          and status in ('OPEN', 'ACKNOWLEDGED')
          and source_ref is not null
          and (
            cardinality($4::text[]) = 0
            or not (source_ref = any($4::text[]))
          )
        returning issue_code, severity
      `,
      [SOURCE_SYSTEM, businessCentralIssueCodes, actorUserId, [...activeSourceRefs]]
    );
    for (const row of resolved.rows) {
      addBusinessCentralIssueSummary(summary, row.issue_code, row.severity, "resolved");
    }
  }

  private async activeEntityCandidates(): Promise<readonly CandidateEntityInput[]> {
    const result = await this.database.pool.query<{
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

  private async businessCentralOutputRange(): Promise<{ readonly from: string; readonly to: string } | null> {
    const result = await this.database.pool.query<{ from_date: string | null; to_date: string | null }>(
      `
        select min(posting_date)::text as from_date,
               max(posting_date)::text as to_date
        from production_outputs po
        where po.source_system = $1
          and ${outputEntryTypePredicate("po")}
      `,
      [SOURCE_SYSTEM]
    );
    const row = result.rows[0];
    if (!row?.from_date || !row.to_date) return null;
    return { from: dateText(row.from_date), to: dateText(row.to_date) };
  }

  private async queryDailyItemResumeSourceRows(
    range: { readonly from: string; readonly to: string }
  ): Promise<DailyItemResumeSourceRow[]> {
    const result = await this.database.pool.query<{
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
        where po.source_system = $1
          and ${outputEntryTypePredicate("po")}
          and po.posting_date >= $2
          and po.posting_date <= $3
        order by po.posting_date desc, po.id asc
      `,
      [SOURCE_SYSTEM, range.from, range.to]
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

  private async queryDailyItemResumeTargets(): Promise<DailyItemResumeTarget[]> {
    const result = await this.database.pool.query<{
      entity_id: string;
      effective_from: string;
      effective_to: string | null;
      daily_target_qty: string | number;
      status: string | null;
    }>(
      `
        select entity_id, effective_from::text, effective_to::text, daily_target_qty, status
        from production_targets
        order by entity_id, effective_from desc
      `
    );
    return result.rows.map((row) => ({
      entityId: row.entity_id,
      effectiveFrom: dateText(row.effective_from),
      effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
      dailyTargetQty: numberValue(row.daily_target_qty),
      status: row.status
    }));
  }
}
