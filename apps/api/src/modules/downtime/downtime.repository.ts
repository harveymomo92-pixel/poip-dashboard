import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { downtimeEvents, masterEntities } from "@poip/db";
import {
  calculateDowntimeDurationMinutes,
  canTransitionDowntimeStatus,
  createDowntimeNaturalKey,
  type DowntimeStatus as DomainDowntimeStatus
} from "@poip/domain";
import { eq, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../database/database.module.js";
import type {
  CloseDowntimeInput,
  CreateDowntimeInput,
  DowntimeEntityDto,
  DowntimeEventDto,
  DowntimeListFilters,
  DowntimeListResult,
  DowntimeSeverity,
  DowntimeStatus,
  UpdateDowntimeInput
} from "./downtime.types.js";

interface SqlParts {
  readonly where: string;
  readonly params: unknown[];
}

interface DowntimeRow {
  readonly id: string;
  readonly event_date: string;
  readonly shift_code: string | null;
  readonly area: string | null;
  readonly entity_id: string | null;
  readonly entity_code: string | null;
  readonly entity_name: string | null;
  readonly machine_code: string | null;
  readonly line_code: string | null;
  readonly category: string;
  readonly start_time: Date | string;
  readonly end_time: Date | string | null;
  readonly duration_minutes: string | number | null;
  readonly status: string;
  readonly severity: string;
  readonly root_cause: string | null;
  readonly action_taken: string | null;
  readonly source_type: string;
  readonly natural_key: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timestampText(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function maybeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildNaturalKey(input: {
  readonly eventDate: string;
  readonly shiftCode?: string | null;
  readonly area?: string | null;
  readonly machineCode?: string | null;
  readonly lineCode?: string | null;
  readonly category: string;
  readonly startTime: Date;
  readonly endTime?: Date | null;
  readonly sourceType?: string | null;
}) {
  return createDowntimeNaturalKey({
    eventDate: input.eventDate,
    ...(input.shiftCode !== undefined ? { shiftCode: input.shiftCode } : {}),
    ...(input.area !== undefined ? { area: input.area } : {}),
    ...(input.machineCode !== undefined ? { machineCode: input.machineCode } : {}),
    ...(input.lineCode !== undefined ? { lineCode: input.lineCode } : {}),
    category: input.category,
    startTime: input.startTime,
    ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
    sourceType: input.sourceType ?? "MANUAL"
  });
}

function durationOrThrow(startTime: Date, endTime: Date, now?: Date): number {
  const durationMinutes = calculateDowntimeDurationMinutes({
    startTime,
    endTime,
    ...(now ? { now } : {})
  });
  if (durationMinutes <= 0) {
    throw new ConflictException("Downtime duration must be greater than zero");
  }
  return durationMinutes;
}

function buildListWhere(filters: DowntimeListFilters): SqlParts {
  const clauses = ["de.deleted_at is null"];
  const params: unknown[] = [];

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`de.event_date >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`de.event_date <= $${params.length}`);
  }
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`de.entity_id = $${params.length}`);
  }
  if (filters.machine) {
    params.push(`%${filters.machine.toLowerCase()}%`);
    clauses.push(
      `(lower(de.machine_code) like $${params.length} or lower(me.entity_code) like $${params.length} or lower(me.display_name) like $${params.length})`
    );
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`de.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(`%${filters.category.toLowerCase()}%`);
    clauses.push(`lower(de.category) like $${params.length}`);
  }
  if (filters.shiftCode) {
    params.push(filters.shiftCode);
    clauses.push(`de.shift_code = $${params.length}`);
  }

  return { where: clauses.join(" and "), params };
}

function serializeDowntime(row: DowntimeRow, now = new Date()): DowntimeEventDto {
  const startTime = new Date(row.start_time);
  const endTime = row.end_time ? new Date(row.end_time) : null;
  const durationMinutes = endTime
    ? numberValue(row.duration_minutes) || calculateDowntimeDurationMinutes({ startTime, endTime })
    : calculateDowntimeDurationMinutes({ startTime, now });

  return {
    id: row.id,
    eventDate: dateText(row.event_date),
    shiftCode: row.shift_code,
    area: row.area,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityName: row.entity_name,
    machineCode: row.machine_code,
    lineCode: row.line_code,
    category: row.category,
    startTime: timestampText(row.start_time) ?? startTime.toISOString(),
    endTime: timestampText(row.end_time),
    durationMinutes,
    status: row.status as DowntimeStatus,
    severity: row.severity as DowntimeSeverity,
    rootCause: row.root_cause,
    actionTaken: row.action_taken,
    sourceType: row.source_type,
    naturalKey: row.natural_key,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: timestampText(row.created_at) ?? new Date().toISOString(),
    updatedAt: timestampText(row.updated_at) ?? new Date().toISOString()
  };
}

@Injectable()
export class DowntimeRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async listEntities(): Promise<readonly DowntimeEntityDto[]> {
    return this.database.db
      .select({
        id: masterEntities.id,
        entityCode: masterEntities.entityCode,
        displayName: masterEntities.displayName,
        area: masterEntities.area,
        lineCode: masterEntities.lineCode
      })
      .from(masterEntities)
      .where(eq(masterEntities.isActive, true))
      .orderBy(masterEntities.entityCode);
  }

  async listDowntime(filters: DowntimeListFilters): Promise<DowntimeListResult> {
    const where = buildListWhere(filters);
    const offset = (filters.page - 1) * filters.pageSize;
    const [countResult, listResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(
        `
          select count(*) as total
          from downtime_events de
          left join master_entities me on me.id = de.entity_id
          where ${where.where}
        `,
        where.params
      ),
      this.database.pool.query<DowntimeRow>(
        `
          select
            de.id,
            de.event_date::text,
            de.shift_code,
            de.area,
            de.entity_id,
            me.entity_code,
            me.display_name as entity_name,
            de.machine_code,
            de.line_code,
            de.category,
            de.start_time,
            de.end_time,
            de.duration_minutes,
            de.status,
            de.severity,
            de.root_cause,
            de.action_taken,
            de.source_type,
            de.natural_key,
            de.created_by,
            de.updated_by,
            de.created_at,
            de.updated_at
          from downtime_events de
          left join master_entities me on me.id = de.entity_id
          where ${where.where}
          order by de.event_date desc, de.start_time desc
          limit $${where.params.length + 1}
          offset $${where.params.length + 2}
        `,
        [...where.params, filters.pageSize, offset]
      )
    ]);
    const totalRows = numberValue(countResult.rows[0]?.total);
    return {
      rows: listResult.rows.map((row) => serializeDowntime(row)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async getDowntime(id: string): Promise<DowntimeEventDto | null> {
    const result = await this.database.pool.query<DowntimeRow>(
      `
        select
          de.id,
          de.event_date::text,
          de.shift_code,
          de.area,
          de.entity_id,
          me.entity_code,
          me.display_name as entity_name,
          de.machine_code,
          de.line_code,
          de.category,
          de.start_time,
          de.end_time,
          de.duration_minutes,
          de.status,
          de.severity,
          de.root_cause,
          de.action_taken,
          de.source_type,
          de.natural_key,
          de.created_by,
          de.updated_by,
          de.created_at,
          de.updated_at
        from downtime_events de
        left join master_entities me on me.id = de.entity_id
        where de.id = $1 and de.deleted_at is null
        limit 1
      `,
      [id]
    );
    return result.rows[0] ? serializeDowntime(result.rows[0]) : null;
  }

  async getDowntimeOrThrow(id: string): Promise<DowntimeEventDto> {
    const event = await this.getDowntime(id);
    if (!event) throw new NotFoundException("Downtime event not found");
    return event;
  }

  async createDowntime(input: CreateDowntimeInput): Promise<DowntimeEventDto> {
    if (input.entityId) await this.ensureEntityExists(input.entityId);
    const durationMinutes = input.endTime
      ? durationOrThrow(input.startTime, input.endTime)
      : null;
    const status = input.endTime ? "CLOSED" : "OPEN";
    const naturalKey = buildNaturalKey(input);
    await this.ensureNaturalKeyAvailable(naturalKey);

    const [created] = await this.database.db
      .insert(downtimeEvents)
      .values({
        eventDate: input.eventDate,
        shiftCode: maybeText(input.shiftCode),
        area: maybeText(input.area),
        entityId: input.entityId ?? null,
        machineCode: maybeText(input.machineCode),
        lineCode: maybeText(input.lineCode),
        category: input.category,
        startTime: input.startTime,
        endTime: input.endTime ?? null,
        durationMinutes,
        status,
        severity: input.severity,
        rootCause: maybeText(input.rootCause),
        actionTaken: maybeText(input.actionTaken),
        sourceType: input.sourceType ?? "MANUAL",
        sourceLine: maybeText(input.sourceLine),
        naturalKey,
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null
      })
      .returning({ id: downtimeEvents.id });
    if (!created) throw new Error("Downtime create failed");
    return this.getDowntimeOrThrow(created.id);
  }

  async updateDowntime(id: string, input: UpdateDowntimeInput): Promise<DowntimeEventDto> {
    const before = await this.getDowntimeOrThrow(id);
    if (before.status !== "OPEN") {
      throw new ConflictException("Only open downtime events can be updated");
    }
    if (input.entityId) await this.ensureEntityExists(input.entityId);

    const next = {
      eventDate: input.eventDate ?? before.eventDate,
      shiftCode: input.shiftCode !== undefined ? input.shiftCode : before.shiftCode,
      area: input.area !== undefined ? input.area : before.area,
      entityId: input.entityId !== undefined ? input.entityId : before.entityId,
      machineCode: input.machineCode !== undefined ? input.machineCode : before.machineCode,
      lineCode: input.lineCode !== undefined ? input.lineCode : before.lineCode,
      category: input.category ?? before.category,
      startTime: input.startTime ?? new Date(before.startTime),
      endTime: null,
      sourceType: before.sourceType
    };
    const naturalKey = buildNaturalKey(next);
    await this.ensureNaturalKeyAvailable(naturalKey, id);

    const [updated] = await this.database.db
      .update(downtimeEvents)
      .set({
        ...(input.eventDate ? { eventDate: input.eventDate } : {}),
        ...(input.shiftCode !== undefined ? { shiftCode: maybeText(input.shiftCode) } : {}),
        ...(input.area !== undefined ? { area: maybeText(input.area) } : {}),
        ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
        ...(input.machineCode !== undefined ? { machineCode: maybeText(input.machineCode) } : {}),
        ...(input.lineCode !== undefined ? { lineCode: maybeText(input.lineCode) } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.startTime ? { startTime: input.startTime } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.rootCause !== undefined ? { rootCause: maybeText(input.rootCause) } : {}),
        ...(input.actionTaken !== undefined ? { actionTaken: maybeText(input.actionTaken) } : {}),
        naturalKey,
        updatedBy: input.updatedBy ?? null,
        updatedAt: sql`now()`
      })
      .where(eq(downtimeEvents.id, id))
      .returning({ id: downtimeEvents.id });
    if (!updated) throw new NotFoundException("Downtime event not found");
    return this.getDowntimeOrThrow(updated.id);
  }

  async closeDowntime(id: string, input: CloseDowntimeInput): Promise<DowntimeEventDto> {
    const before = await this.getDowntimeOrThrow(id);
    if (!canTransitionDowntimeStatus(before.status as DomainDowntimeStatus, "CLOSED")) {
      throw new ConflictException("Only open downtime events can be closed");
    }
    if (before.status === "CLOSED") return before;
    const startTime = new Date(before.startTime);
    const durationMinutes = durationOrThrow(startTime, input.endTime);
    const naturalKey = buildNaturalKey({
      eventDate: before.eventDate,
      shiftCode: before.shiftCode,
      area: before.area,
      machineCode: before.machineCode,
      lineCode: before.lineCode,
      category: before.category,
      startTime,
      endTime: input.endTime,
      sourceType: before.sourceType
    });
    await this.ensureNaturalKeyAvailable(naturalKey, id);

    const [updated] = await this.database.db
      .update(downtimeEvents)
      .set({
        status: "CLOSED",
        endTime: input.endTime,
        durationMinutes,
        rootCause: input.rootCause.trim(),
        actionTaken: input.actionTaken.trim(),
        naturalKey,
        updatedBy: input.updatedBy ?? null,
        updatedAt: sql`now()`
      })
      .where(eq(downtimeEvents.id, id))
      .returning({ id: downtimeEvents.id });
    if (!updated) throw new NotFoundException("Downtime event not found");
    return this.getDowntimeOrThrow(updated.id);
  }

  private async ensureEntityExists(entityId: string): Promise<void> {
    const [entity] = await this.database.db
      .select({ id: masterEntities.id })
      .from(masterEntities)
      .where(eq(masterEntities.id, entityId))
      .limit(1);
    if (!entity) throw new NotFoundException("Master entity not found");
  }

  private async ensureNaturalKeyAvailable(naturalKey: string, excludedId?: string): Promise<void> {
    const result = await this.database.pool.query<{ id: string }>(
      `
        select id
        from downtime_events
        where natural_key = $1
          and deleted_at is null
          ${excludedId ? "and id <> $2" : ""}
        limit 1
      `,
      excludedId ? [naturalKey, excludedId] : [naturalKey]
    );
    if (result.rows[0]) {
      throw new ConflictException("Duplicate downtime event");
    }
  }
}
