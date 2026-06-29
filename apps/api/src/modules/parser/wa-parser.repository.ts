import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  bcLedgerEntries,
  downtimeEvents,
  masterEntities,
  masterEntityAliases,
  waParserRows,
  waParserRuns
} from "@poip/db";
import {
  calculateDowntimeDurationMinutes,
  parseWhatsAppOperationalText,
  type WaDowntimePayload,
  type WaProductionPayload
} from "@poip/domain";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../database/database.module.js";
import type {
  WaParserCommitInput,
  WaParserCommitResult,
  WaParserPreviewInput,
  WaParserPreviewResult,
  WaParserRowDto,
  WaParserRunDto
} from "./wa-parser.types.js";

const parserVersion = "rules-v1";
const sourceSystem = "wa-parser";

interface ParserRunRow {
  readonly id: string;
  readonly parser_mode: string;
  readonly parser_version: string;
  readonly status: string;
  readonly created_by: string | null;
  readonly committed_by: string | null;
  readonly committed_at: Date | string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: Date | string;
}

interface ParserRowRow {
  readonly id: string;
  readonly row_number: number;
  readonly source_line: string;
  readonly parsed_payload: Record<string, unknown>;
  readonly confidence: string | number;
  readonly warnings: readonly Record<string, unknown>[] | null;
  readonly status: string;
  readonly downtime_event_id: string | null;
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

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}

function rowHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function syntheticEntryNo(naturalKey: string): bigint {
  const value = BigInt(`0x${createHash("sha256").update(naturalKey).digest("hex").slice(0, 14)}`);
  return (value % 9_000_000_000_000n) + 1_000_000_000_000n;
}

function serializeRun(row: ParserRunRow, rows?: readonly WaParserRowDto[]): WaParserRunDto {
  return {
    id: row.id,
    parserMode: row.parser_mode,
    parserVersion: row.parser_version,
    status: row.status,
    createdBy: row.created_by,
    committedBy: row.committed_by,
    committedAt: timestampText(row.committed_at),
    metadata: row.metadata ?? {},
    createdAt: timestampText(row.created_at) ?? new Date().toISOString(),
    ...(rows ? { rows } : {})
  };
}

function serializeRow(row: ParserRowRow): WaParserRowDto {
  return {
    id: row.id,
    rowNumber: row.row_number,
    sourceLine: row.source_line,
    parsedPayload: row.parsed_payload,
    confidence: numberValue(row.confidence),
    warnings: row.warnings ?? [],
    status: row.status,
    downtimeEventId: row.downtime_event_id,
    createdAt: timestampText(row.created_at) ?? new Date().toISOString()
  };
}

function isProductionPayload(payload: unknown): payload is WaProductionPayload {
  return Boolean(payload && typeof payload === "object" && "type" in payload && payload.type === "PRODUCTION_OUTPUT");
}

function isDowntimePayload(payload: unknown): payload is WaDowntimePayload {
  return Boolean(payload && typeof payload === "object" && "type" in payload && payload.type === "DOWNTIME");
}

@Injectable()
export class WaParserRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async preview(input: WaParserPreviewInput): Promise<WaParserPreviewResult> {
    const parsed = parseWhatsAppOperationalText(input.sourceText);
    const runId = await this.database.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(waParserRuns)
        .values({
          sourceText: input.sourceText,
          parserMode: input.parserMode,
          parserVersion,
          status: "PREVIEW",
          createdBy: input.createdBy ?? null,
          metadata: parsed.summary
        })
        .returning({ id: waParserRuns.id });
      if (!run) throw new Error("Parser run create failed");

      for (const row of parsed.rows) {
        await tx.insert(waParserRows).values({
          parserRunId: run.id,
          rowNumber: row.rowNumber,
          sourceLine: row.sourceLine,
          parsedPayload: row.parsedPayload,
          confidence: row.confidence.toFixed(2),
          warnings: row.issues,
          status: row.status
        });
      }

      return run.id;
    });

    const run = await this.getRunOrThrow(runId);
    return { run, summary: parsed.summary };
  }

  async listRuns(limit = 20): Promise<readonly WaParserRunDto[]> {
    const result = await this.database.pool.query<ParserRunRow>(
      `
        select id, parser_mode, parser_version, status, created_by, committed_by, committed_at, metadata, created_at
        from wa_parser_runs
        order by created_at desc
        limit $1
      `,
      [Math.min(Math.max(limit, 1), 100)]
    );
    return result.rows.map((row) => serializeRun(row));
  }

  async getRun(id: string): Promise<WaParserRunDto | null> {
    const runResult = await this.database.pool.query<ParserRunRow>(
      `
        select id, parser_mode, parser_version, status, created_by, committed_by, committed_at, metadata, created_at
        from wa_parser_runs
        where id = $1
        limit 1
      `,
      [id]
    );
    const run = runResult.rows[0];
    if (!run) return null;
    const rowsResult = await this.database.pool.query<ParserRowRow>(
      `
        select id, row_number, source_line, parsed_payload, confidence, warnings, status, downtime_event_id, created_at
        from wa_parser_rows
        where parser_run_id = $1
        order by row_number asc
      `,
      [id]
    );
    return serializeRun(run, rowsResult.rows.map(serializeRow));
  }

  async getRunOrThrow(id: string): Promise<WaParserRunDto> {
    const run = await this.getRun(id);
    if (!run) throw new NotFoundException("Parser run not found");
    return run;
  }

  async commit(runId: string, input: WaParserCommitInput): Promise<WaParserCommitResult> {
    const run = await this.getRunOrThrow(runId);
    if (run.status === "COMMITTED") {
      return { runId, committedRows: 0, productionRowsCommitted: 0, downtimeRowsCommitted: 0, skippedRows: run.rows?.length ?? 0 };
    }
    const selectedRows = (run.rows ?? []).filter((row) =>
      input.selectedRowIds ? input.selectedRowIds.includes(row.id) : row.status === "VALID"
    );
    if (selectedRows.length === 0) throw new BadRequestException("No parser rows selected");
    const invalidRows = selectedRows.filter((row) => row.status !== "VALID");
    if (invalidRows.length > 0) throw new BadRequestException("Selected rows contain invalid parser rows");

    return this.database.db.transaction(async (tx) => {
      const lookup = await this.loadEntityLookup(tx);
      let productionRowsCommitted = 0;
      let downtimeRowsCommitted = 0;
      let skippedRows = 0;

      for (const row of selectedRows) {
        if (row.status === "COMMITTED") {
          skippedRows += 1;
          continue;
        }
        if (isProductionPayload(row.parsedPayload)) {
          const outputId = await this.commitProductionRow(tx, row, row.parsedPayload, lookup);
          await tx
            .update(waParserRows)
            .set({
              status: "COMMITTED",
              parsedPayload: { ...row.parsedPayload, committedOutputId: outputId }
            })
            .where(eq(waParserRows.id, row.id));
          productionRowsCommitted += 1;
        } else if (isDowntimePayload(row.parsedPayload)) {
          const downtimeId = await this.commitDowntimeRow(tx, row.parsedPayload, lookup);
          await tx
            .update(waParserRows)
            .set({ status: "COMMITTED", downtimeEventId: downtimeId })
            .where(eq(waParserRows.id, row.id));
          downtimeRowsCommitted += 1;
        } else {
          throw new ConflictException("Unsupported parser row type");
        }
      }

      await tx
        .update(waParserRuns)
        .set({
          status: "COMMITTED",
          committedBy: input.committedBy ?? null,
          committedAt: new Date(),
          metadata: {
            ...run.metadata,
            committedRows: productionRowsCommitted + downtimeRowsCommitted,
            productionRowsCommitted,
            downtimeRowsCommitted,
            skippedRows
          }
        })
        .where(eq(waParserRuns.id, runId));

      return {
        runId,
        committedRows: productionRowsCommitted + downtimeRowsCommitted,
        productionRowsCommitted,
        downtimeRowsCommitted,
        skippedRows
      };
    });
  }

  private async commitProductionRow(
    tx: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
    row: WaParserRowDto,
    payload: WaProductionPayload,
    lookup: EntityLookup
  ): Promise<string> {
    if (!payload.postingDate || !payload.itemNo) throw new ConflictException("Invalid production payload");
    const entityId = payload.machineCode ? this.resolveEntityId(payload.machineCode, lookup) : null;
    const entryNo = syntheticEntryNo(payload.naturalKey);
    const hash = rowHash(payload);
    const [output] = await tx
      .insert(bcLedgerEntries)
      .values({
        sourceSystem,
        entryNo,
        postingDate: payload.postingDate,
        documentDate: payload.postingDate,
        documentNo: payload.documentNo ?? `WA-${row.rowNumber}-${entryNo.toString()}`,
        entryType: "WA_OUTPUT",
        normalizedOutputType: payload.normalizedOutputType,
        itemNo: payload.itemNo,
        machineCenterNo: payload.machineCode,
        entityId,
        shiftCode: payload.shiftCode,
        quantity: decimal(payload.quantity),
        rejectKg: decimal(payload.rejectKg),
        rowHash: hash,
        rawPayload: payload,
        bcDomain: "PRODUCTION_OUTPUT",
        movementDomain: "PRODUCTION_OUTPUT",
        movementStatus: "CLASSIFIED",
        mappingStatus: entityId ? "MAPPED_READY" : "UNMAPPED_NEEDS_REVIEW",
        sourceIdentityField: payload.machineCode ? "machine_center_no" : null,
        sourceIdentityValue: payload.machineCode ?? null,
        dashboardReady: Boolean(entityId),
        futureUseReady: false,
        classificationReason: "WhatsApp parser production payload.",
        mappingReason: entityId
          ? "WhatsApp production payload matched an existing entity."
          : "WhatsApp production payload has no mapped entity.",
        classifiedAt: new Date(),
        mappedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [bcLedgerEntries.sourceSystem, bcLedgerEntries.entryNo],
        set: {
          postingDate: payload.postingDate,
          documentDate: payload.postingDate,
          documentNo: payload.documentNo ?? `WA-${row.rowNumber}-${entryNo.toString()}`,
          entryType: "WA_OUTPUT",
          normalizedOutputType: payload.normalizedOutputType,
          itemNo: payload.itemNo,
          machineCenterNo: payload.machineCode,
          entityId,
          shiftCode: payload.shiftCode,
          quantity: decimal(payload.quantity),
          rejectKg: decimal(payload.rejectKg),
          rowHash: hash,
          rawPayload: payload,
          bcDomain: "PRODUCTION_OUTPUT",
          movementDomain: "PRODUCTION_OUTPUT",
          movementStatus: "CLASSIFIED",
          mappingStatus: entityId ? "MAPPED_READY" : "UNMAPPED_NEEDS_REVIEW",
          sourceIdentityField: payload.machineCode ? "machine_center_no" : null,
          sourceIdentityValue: payload.machineCode ?? null,
          dashboardReady: Boolean(entityId),
          futureUseReady: false,
          classificationReason: "WhatsApp parser production payload.",
          mappingReason: entityId
            ? "WhatsApp production payload matched an existing entity."
            : "WhatsApp production payload has no mapped entity.",
          classifiedAt: sql`now()`,
          mappedAt: sql`now()`,
          updatedAt: sql`now()`
        }
      })
      .returning({ id: bcLedgerEntries.id });
    if (!output) throw new Error("Production output commit failed");
    return output.id;
  }

  private async commitDowntimeRow(
    tx: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
    payload: WaDowntimePayload,
    lookup: EntityLookup
  ): Promise<string> {
    if (!payload.eventDate || !payload.category || !payload.startTime || !payload.naturalKey) {
      throw new ConflictException("Invalid downtime payload");
    }
    const entityId = payload.machineCode ? this.resolveEntityId(payload.machineCode, lookup) : null;
    const startTime = new Date(payload.startTime);
    const endTime = payload.endTime ? new Date(payload.endTime) : null;
    const durationMinutes = endTime ? calculateDowntimeDurationMinutes({ startTime, endTime }) : null;
    const [downtime] = await tx
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
        durationMinutes,
        status: endTime ? "CLOSED" : "OPEN",
        severity: payload.severity,
        rootCause: payload.rootCause,
        actionTaken: payload.actionTaken,
        sourceType: "WA",
        naturalKey: payload.naturalKey
      })
      .onConflictDoNothing({ target: downtimeEvents.naturalKey })
      .returning({ id: downtimeEvents.id });
    if (downtime) return downtime.id;

    const [existing] = await tx
      .select({ id: downtimeEvents.id })
      .from(downtimeEvents)
      .where(eq(downtimeEvents.naturalKey, payload.naturalKey))
      .limit(1);
    if (!existing) throw new Error("Downtime commit failed");
    return existing.id;
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
