import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { parseBody } from "../../common/validation.js";
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

@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post("odata/run")
  @RequirePermissions("sync.run")
  triggerODataSync(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(runSyncSchema, body ?? {});
    return this.syncService.triggerODataSync({
      mode: "incremental",
      requestedBy: request.user?.id ?? null,
      ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {})
    });
  }

  @Post("odata/resync-range")
  @RequirePermissions("sync.run")
  triggerODataRangeSync(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(resyncRangeSchema, body);
    return this.syncService.triggerODataSync({
      mode: "resync-range",
      requestedBy: request.user?.id ?? null,
      range: { from: input.from, to: input.to },
      ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {})
    });
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
}
