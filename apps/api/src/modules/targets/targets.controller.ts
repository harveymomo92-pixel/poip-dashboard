import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody, parseQuery } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { createTargetSchema, targetListQuerySchema, updateTargetSchema } from "./targets.query.js";
import { TargetsService } from "./targets.service.js";
import type { CreateTargetInput, TargetListFilters, UpdateTargetInput } from "./targets.types.js";

const idSchema = z.string().uuid();

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("targets")
export class TargetsController {
  constructor(
    @Inject(TargetsService)
    private readonly targetsService: TargetsService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Get("entities")
  @RequirePermissions("target.view")
  listEntities() {
    return this.targetsService.listEntities();
  }

  @Get()
  @RequirePermissions("target.view")
  listTargets(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(targetListQuerySchema, query) as TargetListFilters;
    return this.targetsService.listTargets(filters);
  }

  @Get(":id")
  @RequirePermissions("target.view")
  async getTarget(@Param("id") id: string) {
    const target = await this.targetsService.getTarget(parseQuery(idSchema, id));
    if (!target) throw new NotFoundException("Target not found");
    return target;
  }

  @Post()
  @RequirePermissions("target.create")
  async createTarget(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(createTargetSchema, body) as CreateTargetInput;
    const target = await this.targetsService.createTarget({
      ...input,
      createdBy: request.user?.id ?? null
    });
    await this.logWrite(request, "target.create", null, target.id, target);
    return target;
  }

  @Patch(":id")
  @RequirePermissions("target.create")
  async updateTarget(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    const targetId = parseQuery(idSchema, id);
    const before = await this.targetsService.getTargetOrThrow(targetId);
    const input = parseBody(updateTargetSchema, body) as UpdateTargetInput;
    const target = await this.targetsService.updateTarget(targetId, {
      ...input,
      createdBy: request.user?.id ?? null
    });
    await this.logWrite(request, "target.update", before, target.id, target);
    return target;
  }

  @Post(":id/submit")
  @RequirePermissions("target.create")
  async submitTarget(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const targetId = parseQuery(idSchema, id);
    const before = await this.targetsService.getTargetOrThrow(targetId);
    const target = await this.targetsService.submitTarget(targetId);
    await this.logWrite(request, "target.submit", before, target.id, target);
    return target;
  }

  @Post(":id/approve")
  @RequirePermissions("target.approve")
  async approveTarget(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const targetId = parseQuery(idSchema, id);
    const before = await this.targetsService.getTargetOrThrow(targetId);
    const supersededBefore = await this.targetsService.listOverlappingActiveTargetsForTarget(targetId);
    const target = await this.targetsService.approveTarget(targetId, request.user?.id ?? null);
    await this.logWrite(request, "target.approve", before, target.id, target);
    await Promise.all(
      supersededBefore.map((superseded) =>
        this.logWrite(request, "target.supersede", superseded, superseded.id, {
          ...superseded,
          status: "SUPERSEDED",
          supersededByTargetId: target.id
        })
      )
    );
    return target;
  }

  @Post(":id/reject")
  @RequirePermissions("target.approve")
  async rejectTarget(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const targetId = parseQuery(idSchema, id);
    const before = await this.targetsService.getTargetOrThrow(targetId);
    const target = await this.targetsService.rejectTarget(targetId);
    await this.logWrite(request, "target.reject", before, target.id, target);
    return target;
  }

  @Post(":id/deactivate")
  @RequirePermissions("target.create")
  async deactivateTarget(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const targetId = parseQuery(idSchema, id);
    const before = await this.targetsService.getTargetOrThrow(targetId);
    const target = await this.targetsService.deactivateTarget(targetId);
    await this.logWrite(request, "target.deactivate", before, target.id, target);
    return target;
  }

  private async logWrite(
    request: AuthenticatedRequest,
    action: string,
    beforeValue: unknown,
    entityId: string,
    afterValue: unknown
  ): Promise<void> {
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action,
      entityType: "production_target",
      entityId,
      beforeValue,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
