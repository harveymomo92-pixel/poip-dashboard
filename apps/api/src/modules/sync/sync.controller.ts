import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SyncService } from "./sync.service.js";

const runSyncSchema = z.object({
  sourceSystem: z.string().min(1).optional()
});

const resyncRangeSchema = z
  .object({
    sourceSystem: z.string().min(1).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
  .refine((value) => value.from <= value.to, {
    message: "from must be before or equal to to"
  });

function querySourceSystem(sourceSystem: unknown): string | undefined {
  return typeof sourceSystem === "string" && sourceSystem.trim() ? sourceSystem.trim() : undefined;
}

function queryLimit(limit: unknown): number {
  if (typeof limit !== "string") return 20;
  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? parsed : 20;
}

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("sync")
export class SyncController {
  constructor(
    @Inject(SyncService) private readonly syncService: SyncService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  @Post("odata/run")
  @RequirePermissions("sync.run")
  async triggerODataSync(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(runSyncSchema, body ?? {});
    const result = await this.syncService.triggerODataSync({
      mode: "incremental",
      requestedBy: request.user?.id ?? null,
      ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {})
    });
    await this.logRun(request, "sync.run", result.runId, result);
    return result;
  }

  @Post("odata/resync-range")
  @RequirePermissions("sync.run")
  async triggerODataRangeSync(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(resyncRangeSchema, body);
    const result = await this.syncService.triggerODataSync({
      mode: "resync-range",
      requestedBy: request.user?.id ?? null,
      range: { from: input.from, to: input.to },
      ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {})
    });
    await this.logRun(request, "sync.resync_range", result.runId, {
      ...result,
      range: { from: input.from, to: input.to }
    });
    return result;
  }

  @Get("status")
  @RequirePermissions("sync.view")
  getStatus(@Query("sourceSystem") sourceSystem?: string) {
    return this.syncService.getStatus(querySourceSystem(sourceSystem));
  }

  @Get("runs")
  @RequirePermissions("sync.view")
  listRuns(@Query("sourceSystem") sourceSystem?: string, @Query("limit") limit?: string) {
    return this.syncService.listRuns(querySourceSystem(sourceSystem), queryLimit(limit));
  }

  @Get("runs/:id")
  @RequirePermissions("sync.view")
  async getRun(@Param("id") id: string) {
    const run = await this.syncService.getRun(id);
    if (!run) throw new NotFoundException("Sync run not found");
    return run;
  }

  private async logRun(
    request: AuthenticatedRequest,
    action: string,
    entityId: string,
    afterValue: unknown
  ) {
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action,
      entityType: "sync_run",
      entityId,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
