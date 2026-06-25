import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { dataQualityIssues } from "@poip/db";
import { and, asc, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { redactSensitiveValue } from "../../common/redaction.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type {
  DataQualityIssueFilters,
  DataQualityStatusInput
} from "./data-quality.types.js";

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
  IMPORT_VALIDATION: "Baris import gagal memenuhi satu atau lebih aturan validasi."
};

function timestamp(value: Date | null): string | null {
  return value?.toISOString() ?? null;
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
    createdAt: issue.createdAt.toISOString()
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
      warningIssues: rows
        .filter((row) => row.severity === "WARNING" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.value), 0),
      mediumIssues: rows
        .filter((row) => row.severity === "MEDIUM" && ["OPEN", "ACKNOWLEDGED"].includes(row.status))
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
        resolutionNote: reopening ? null : input.note ?? null
      })
      .where(eq(dataQualityIssues.id, id))
      .returning();
    if (!updated) throw new NotFoundException("Data quality issue not found");
    return serializeIssue(updated);
  }
}
