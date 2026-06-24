import { Inject, Injectable } from "@nestjs/common";
import { auditLogs, users } from "@poip/db";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL
} from "drizzle-orm";
import { redactSensitiveValue } from "../../common/redaction.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type { AuditListFilters } from "./audit.types.js";

export interface AuditEvent {
  readonly requestId?: string;
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly beforeValue?: unknown;
  readonly afterValue?: unknown;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

const entityLabels: Readonly<Record<string, string>> = {
  production_target: "target produksi",
  downtime_event: "downtime",
  import_run: "import",
  wa_parser_run: "parser WhatsApp",
  data_quality_issue: "isu kualitas data",
  sync_run: "sinkronisasi",
  user: "user"
};

const actionLabels: Readonly<Record<string, string>> = {
  create: "membuat",
  update: "memperbarui",
  submit: "mengajukan",
  approve: "menyetujui",
  reject: "menolak",
  deactivate: "menonaktifkan",
  supersede: "menggantikan",
  close: "menutup",
  preview: "membuat preview",
  commit: "melakukan commit",
  disable: "menonaktifkan",
  acknowledge: "mengakui",
  acknowledged: "mengakui",
  resolve: "menyelesaikan",
  resolved: "menyelesaikan",
  ignore: "mengabaikan",
  ignored: "mengabaikan",
  reopen: "membuka kembali",
  open: "membuka kembali",
  run: "menjalankan",
  resync_range: "menjalankan sinkronisasi ulang rentang",
  login: "masuk sebagai",
  logout: "keluar dari sesi"
};

function jakartaDateBoundary(value: string, endOfDay = false): Date {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
}

function changedFields(beforeValue: unknown, afterValue: unknown): readonly string[] {
  if (!beforeValue || !afterValue || typeof beforeValue !== "object" || typeof afterValue !== "object") {
    return [];
  }
  const before = beforeValue as Record<string, unknown>;
  const after = afterValue as Record<string, unknown>;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .filter((key) => !/(password|token|secret|credential|raw[_-]?payload|source[_-]?text)/i.test(key))
    .sort();
}

function summary(action: string, entityType: string, actorName: string | null): string {
  const actionPart = action.split(".").at(-1) ?? action;
  const actor = actorName ?? "System";
  const verb = actionLabels[actionPart] ?? action.replaceAll(".", " ");
  return `${actor} ${verb} ${entityLabels[entityType] ?? entityType.replaceAll("_", " ")}.`;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async log(event: AuditEvent): Promise<void> {
    await this.database.db.insert(auditLogs).values({
      requestId: event.requestId,
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      beforeValue: event.beforeValue,
      afterValue: event.afterValue,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent
    });
  }

  async list(filters: AuditListFilters) {
    const conditions: SQL[] = [];
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.action) conditions.push(ilike(auditLogs.action, `%${filters.action}%`));
    if (filters.entityId) conditions.push(ilike(auditLogs.entityId, `%${filters.entityId}%`));
    if (filters.actor) {
      const actorCondition = or(
        ilike(users.name, `%${filters.actor}%`),
        ilike(users.email, `%${filters.actor}%`)
      );
      if (actorCondition) conditions.push(actorCondition);
    }
    if (filters.from) conditions.push(gte(auditLogs.createdAt, jakartaDateBoundary(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, jakartaDateBoundary(filters.to, true)));
    const where = conditions.length ? and(...conditions) : undefined;

    const selection = {
      id: auditLogs.id,
      requestId: auditLogs.requestId,
      actorUserId: auditLogs.actorUserId,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeValue: auditLogs.beforeValue,
      afterValue: auditLogs.afterValue,
      createdAt: auditLogs.createdAt
    };

    const [rows, totals] = await Promise.all([
      this.database.db
        .select(selection)
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      this.database.db
        .select({ value: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(where)
    ]);

    const totalRows = Number(totals[0]?.value ?? 0);
    return {
      rows: rows.map((row) => this.serialize(row)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({
        id: auditLogs.id,
        requestId: auditLogs.requestId,
        actorUserId: auditLogs.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        beforeValue: auditLogs.beforeValue,
        afterValue: auditLogs.afterValue,
        createdAt: auditLogs.createdAt
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(eq(auditLogs.id, id))
      .limit(1);
    return row ? this.serialize(row) : null;
  }

  private serialize(row: {
    readonly id: string;
    readonly requestId: string | null;
    readonly actorUserId: string | null;
    readonly actorName: string | null;
    readonly actorEmail: string | null;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly beforeValue: unknown;
    readonly afterValue: unknown;
    readonly createdAt: Date;
  }) {
    const beforeValue = redactSensitiveValue(row.beforeValue);
    const afterValue = redactSensitiveValue(row.afterValue);
    return {
      id: row.id,
      requestId: row.requestId,
      actor: row.actorUserId
        ? { id: row.actorUserId, name: row.actorName ?? "Unknown user", email: row.actorEmail }
        : null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: summary(row.action, row.entityType, row.actorName),
      changedFields: changedFields(beforeValue, afterValue),
      beforeValue,
      afterValue,
      createdAt: row.createdAt.toISOString()
    };
  }
}
