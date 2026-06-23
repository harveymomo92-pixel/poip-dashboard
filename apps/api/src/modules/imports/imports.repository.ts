import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { dataQualityIssues, downtimeEvents, importRows, importRuns, masterEntities, masterEntityAliases } from "@poip/db";
import {
  calculateDowntimeDurationMinutes,
  parseDowntimeImportRows,
  summarizeImportRows,
  type DowntimeImportPayload,
  type ImportIssue,
  type ParsedImportRow
} from "@poip/domain";
import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { DatabaseConnection } from "../database/database.module.js";
import type {
  ImportCommitInput,
  ImportCommitResult,
  ImportPreviewInput,
  ImportPreviewResult,
  ImportRowDto,
  ImportRunDto
} from "./imports.types.js";

interface ImportRunRow {
  readonly id: string;
  readonly import_type: "downtime";
  readonly original_filename: string;
  readonly file_hash: string;
  readonly status: string;
  readonly rows_total: number | string;
  readonly rows_valid: number | string;
  readonly rows_invalid: number | string;
  readonly rows_duplicate: number | string;
  readonly rows_conflict: number | string;
  readonly rows_inserted: number | string;
  readonly rows_updated: number | string;
  readonly validation_report: Record<string, unknown> | null;
  readonly created_by: string | null;
  readonly committed_by: string | null;
  readonly committed_at: Date | string | null;
  readonly created_at: Date | string;
}

interface ImportRowRow {
  readonly id: string;
  readonly row_number: number;
  readonly raw_payload: Record<string, string>;
  readonly normalized_payload: DowntimeImportPayload;
  readonly natural_key: string | null;
  readonly status: string;
  readonly issues: readonly ImportIssue[] | null;
  readonly committed_entity_type: string | null;
  readonly committed_entity_id: string | null;
  readonly created_at: Date | string;
}

interface EntityLookup {
  readonly byCode: ReadonlyMap<string, string>;
  readonly byAlias: ReadonlyMap<string, string>;
}

function timestampText(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function numberValue(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeRun(row: ImportRunRow, rows?: readonly ImportRowDto[]): ImportRunDto {
  return {
    id: row.id,
    importType: row.import_type,
    originalFilename: row.original_filename,
    fileHash: row.file_hash,
    status: row.status,
    rowsTotal: numberValue(row.rows_total),
    rowsValid: numberValue(row.rows_valid),
    rowsInvalid: numberValue(row.rows_invalid),
    rowsDuplicate: numberValue(row.rows_duplicate),
    rowsConflict: numberValue(row.rows_conflict),
    rowsInserted: numberValue(row.rows_inserted),
    rowsUpdated: numberValue(row.rows_updated),
    validationReport: row.validation_report ?? {},
    createdBy: row.created_by,
    committedBy: row.committed_by,
    committedAt: timestampText(row.committed_at),
    createdAt: timestampText(row.created_at) ?? new Date().toISOString(),
    ...(rows ? { rows } : {})
  };
}

function serializeRow(row: ImportRowRow): ImportRowDto {
  return {
    id: row.id,
    rowNumber: row.row_number,
    rawPayload: row.raw_payload,
    normalizedPayload: row.normalized_payload,
    naturalKey: row.natural_key,
    status: row.status as ImportRowDto["status"],
    issues: row.issues ?? [],
    committedEntityType: row.committed_entity_type,
    committedEntityId: row.committed_entity_id,
    createdAt: timestampText(row.created_at) ?? new Date().toISOString()
  };
}

@Injectable()
export class ImportsRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async preview(input: ImportPreviewInput, records: readonly Record<string, string>[]): Promise<ImportPreviewResult> {
    const parsed = parseDowntimeImportRows(records);
    const rows = await this.markExistingConflicts(parsed.rows);
    const summarized = summarizeImportRows(rows);
    const hash = fileHash(input.fileBuffer);
    const runId = await this.database.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(importRuns)
        .values({
          importType: input.importType,
          originalFilename: input.originalFilename,
          fileHash: hash,
          status: "PREVIEW",
          rowsTotal: summarized.summary.totalRows,
          rowsValid: summarized.summary.validRows,
          rowsInvalid: summarized.summary.invalidRows,
          rowsDuplicate: summarized.summary.duplicateRows,
          rowsConflict: summarized.summary.conflictRows,
          validationReport: summarized.summary,
          createdBy: input.createdBy ?? null
        })
        .returning({ id: importRuns.id });
      if (!run) throw new Error("Import run create failed");

      for (const row of rows) {
        await tx.insert(importRows).values({
          importRunId: run.id,
          rowNumber: row.rowNumber,
          rawPayload: row.raw,
          normalizedPayload: row.normalized,
          naturalKey: row.naturalKey,
          rowHash: row.rowHash,
          status: row.status,
          issues: row.issues
        });
        if (row.status !== "VALID") {
          await tx.insert(dataQualityIssues).values({
            issueCode: row.status === "CONFLICT" ? "IMPORT_CONFLICT" : "IMPORT_VALIDATION",
            severity: "MEDIUM",
            entityType: "import_row",
            sourceSystem: "import-center",
            sourceRef: `${run.id}:${row.rowNumber}`,
            description: `Import row ${row.rowNumber} has validation issues`,
            payload: { importRunId: run.id, rowNumber: row.rowNumber, issues: row.issues, raw: row.raw }
          });
        }
      }

      return run.id;
    });

    const run = await this.getRunOrThrow(runId);
    return { run, summary: summarized.summary };
  }

  async listRuns(limit = 20): Promise<readonly ImportRunDto[]> {
    const result = await this.database.pool.query<ImportRunRow>(
      `
        select id, import_type, original_filename, file_hash, status,
               rows_total, rows_valid, rows_invalid, rows_duplicate, rows_conflict,
               rows_inserted, rows_updated, validation_report, created_by, committed_by,
               committed_at, created_at
        from import_runs
        order by created_at desc
        limit $1
      `,
      [Math.min(Math.max(limit, 1), 100)]
    );
    return result.rows.map((row) => serializeRun(row));
  }

  async getRun(id: string): Promise<ImportRunDto | null> {
    const runResult = await this.database.pool.query<ImportRunRow>(
      `
        select id, import_type, original_filename, file_hash, status,
               rows_total, rows_valid, rows_invalid, rows_duplicate, rows_conflict,
               rows_inserted, rows_updated, validation_report, created_by, committed_by,
               committed_at, created_at
        from import_runs
        where id = $1
        limit 1
      `,
      [id]
    );
    const run = runResult.rows[0];
    if (!run) return null;
    const rowsResult = await this.database.pool.query<ImportRowRow>(
      `
        select id, row_number, raw_payload, normalized_payload, natural_key, status,
               issues, committed_entity_type, committed_entity_id, created_at
        from import_rows
        where import_run_id = $1
        order by row_number asc
      `,
      [id]
    );
    return serializeRun(run, rowsResult.rows.map(serializeRow));
  }

  async getRunOrThrow(id: string): Promise<ImportRunDto> {
    const run = await this.getRun(id);
    if (!run) throw new NotFoundException("Import run not found");
    return run;
  }

  async commit(runId: string, input: ImportCommitInput): Promise<ImportCommitResult> {
    const run = await this.getRunOrThrow(runId);
    if (run.status === "COMMITTED") {
      return { runId, committedRows: 0, insertedRows: 0, skippedRows: run.rows?.length ?? 0 };
    }
    const selectedRows = (run.rows ?? []).filter((row) =>
      input.selectedRowIds ? input.selectedRowIds.includes(row.id) : row.status === "VALID"
    );
    if (selectedRows.length === 0) throw new BadRequestException("No valid import rows selected");
    const invalidRows = selectedRows.filter((row) => row.status !== "VALID");
    if (invalidRows.length > 0) throw new BadRequestException("Selected rows contain invalid import rows");

    return this.database.db.transaction(async (tx) => {
      const lookup = await this.loadEntityLookup(tx);
      let insertedRows = 0;
      let skippedRows = 0;

      for (const row of selectedRows) {
        const payload = row.normalizedPayload;
        if (!payload.eventDate || !payload.category || !payload.startTime || !payload.naturalKey) {
          throw new ConflictException("Invalid import row payload");
        }
        const entityId = payload.machineCode ? this.resolveEntityId(payload.machineCode, lookup) : null;
        const startTime = new Date(payload.startTime);
        const endTime = payload.endTime ? new Date(payload.endTime) : null;
        const [inserted] = await tx
          .insert(downtimeEvents)
          .values({
            eventDate: payload.eventDate,
            shiftCode: payload.shiftCode,
            area: payload.area,
            entityId,
            machineCode: payload.machineCode,
            lineCode: payload.lineCode,
            category: payload.category,
            startTime,
            endTime,
            durationMinutes: endTime ? calculateDowntimeDurationMinutes({ startTime, endTime }) : null,
            status: payload.status,
            severity: payload.severity,
            rootCause: payload.rootCause,
            actionTaken: payload.actionTaken,
            sourceType: "IMPORT",
            sourceLine: JSON.stringify(row.rawPayload),
            naturalKey: payload.naturalKey,
            createdBy: input.committedBy ?? null
          })
          .onConflictDoNothing({ target: downtimeEvents.naturalKey })
          .returning({ id: downtimeEvents.id });

        const existingId = inserted?.id ?? (await this.findDowntimeIdByNaturalKey(payload.naturalKey));
        if (!existingId) throw new Error("Downtime import commit failed");
        await tx
          .update(importRows)
          .set({ status: "COMMITTED", committedEntityType: "downtime_event", committedEntityId: existingId })
          .where(eq(importRows.id, row.id));
        if (inserted) insertedRows += 1;
        else skippedRows += 1;
      }

      await tx
        .update(importRuns)
        .set({
          status: "COMMITTED",
          rowsInserted: insertedRows,
          rowsUpdated: 0,
          committedBy: input.committedBy ?? null,
          committedAt: new Date()
        })
        .where(eq(importRuns.id, runId));

      return { runId, committedRows: insertedRows, insertedRows, skippedRows };
    });
  }

  async errorReport(runId: string) {
    const run = await this.getRunOrThrow(runId);
    const rows = run.rows ?? [];
    const invalidRows = rows.filter((row) => row.status !== "VALID" && row.status !== "COMMITTED");
    const header = ["row_number", "status", "issues", "raw_payload"];
    const lines = [
      header.join(","),
      ...invalidRows.map((row) =>
        [row.rowNumber, row.status, row.issues.map((issue) => issue.code).join("|"), JSON.stringify(row.rawPayload)]
          .map(csvCell)
          .join(",")
      )
    ];
    return {
      filename: `${run.originalFilename.replace(/\.[^.]+$/, "")}-errors.csv`,
      contentType: "text/csv" as const,
      content: `${lines.join("\n")}\n`
    };
  }

  private async markExistingConflicts(rows: readonly ParsedImportRow[]): Promise<readonly ParsedImportRow[]> {
    const keys = rows.flatMap((row) => (row.naturalKey ? [row.naturalKey] : []));
    if (keys.length === 0) return rows;
    const existing = await this.database.db
      .select({ naturalKey: downtimeEvents.naturalKey })
      .from(downtimeEvents)
      .where(inArray(downtimeEvents.naturalKey, keys));
    const existingKeys = new Set(existing.map((row) => row.naturalKey));
    return rows.map((row) => {
      if (!row.naturalKey || row.status !== "VALID" || !existingKeys.has(row.naturalKey)) return row;
      return {
        ...row,
        status: "CONFLICT",
        issues: [
          ...row.issues,
          { code: "DOWNTIME_ALREADY_EXISTS", severity: "CRITICAL", message: "Downtime event already exists" }
        ]
      };
    });
  }

  private async findDowntimeIdByNaturalKey(naturalKey: string): Promise<string | null> {
    const [existing] = await this.database.db
      .select({ id: downtimeEvents.id })
      .from(downtimeEvents)
      .where(eq(downtimeEvents.naturalKey, naturalKey))
      .limit(1);
    return existing?.id ?? null;
  }

  private async loadEntityLookup(tx: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0]): Promise<EntityLookup> {
    const entities = await tx
      .select({ id: masterEntities.id, code: masterEntities.entityCode })
      .from(masterEntities)
      .where(eq(masterEntities.isActive, true));
    const aliases = await tx
      .select({ entityId: masterEntityAliases.entityId, alias: masterEntityAliases.alias })
      .from(masterEntityAliases)
      .where(eq(masterEntityAliases.isActive, true));
    return {
      byCode: new Map(entities.map((entity) => [entity.code.toUpperCase(), entity.id])),
      byAlias: new Map(aliases.map((alias) => [alias.alias.toUpperCase(), alias.entityId]))
    };
  }

  private resolveEntityId(machineCode: string, lookup: EntityLookup): string | null {
    const key = machineCode.toUpperCase();
    return lookup.byCode.get(key) ?? lookup.byAlias.get(key) ?? null;
  }
}
