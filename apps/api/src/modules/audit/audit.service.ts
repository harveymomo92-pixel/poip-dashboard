import { Inject, Injectable } from "@nestjs/common";
import { auditLogs } from "@poip/db";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";

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
}
