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
import {
  closeDowntimeSchema,
  createDowntimeSchema,
  downtimeListQuerySchema,
  updateDowntimeSchema
} from "./downtime.query.js";
import { DowntimeService } from "./downtime.service.js";
import type {
  CloseDowntimeInput,
  CreateDowntimeInput,
  DowntimeListFilters,
  UpdateDowntimeInput
} from "./downtime.types.js";

const idSchema = z.string().uuid();

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("downtime")
export class DowntimeController {
  constructor(
    @Inject(DowntimeService)
    private readonly downtimeService: DowntimeService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Get("entities")
  @RequirePermissions("downtime.view")
  listEntities() {
    return this.downtimeService.listEntities();
  }

  @Get()
  @RequirePermissions("downtime.view")
  listDowntime(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(downtimeListQuerySchema, query) as DowntimeListFilters;
    return this.downtimeService.listDowntime(filters);
  }

  @Get(":id")
  @RequirePermissions("downtime.view")
  async getDowntime(@Param("id") id: string) {
    const event = await this.downtimeService.getDowntime(parseQuery(idSchema, id));
    if (!event) throw new NotFoundException("Downtime event not found");
    return event;
  }

  @Post()
  @RequirePermissions("downtime.create")
  async createDowntime(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(createDowntimeSchema, body) as CreateDowntimeInput;
    const event = await this.downtimeService.createDowntime({
      ...input,
      createdBy: request.user?.id ?? null
    });
    await this.logWrite(request, "downtime.create", null, event.id, event);
    return event;
  }

  @Patch(":id")
  @RequirePermissions("downtime.update")
  async updateDowntime(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    const eventId = parseQuery(idSchema, id);
    const before = await this.downtimeService.getDowntimeOrThrow(eventId);
    const input = parseBody(updateDowntimeSchema, body) as UpdateDowntimeInput;
    const event = await this.downtimeService.updateDowntime(eventId, {
      ...input,
      updatedBy: request.user?.id ?? null
    });
    await this.logWrite(request, "downtime.update", before, event.id, event);
    return event;
  }

  @Post(":id/close")
  @RequirePermissions("downtime.close")
  async closeDowntime(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    const eventId = parseQuery(idSchema, id);
    const before = await this.downtimeService.getDowntimeOrThrow(eventId);
    const input = parseBody(closeDowntimeSchema, body ?? {}) as CloseDowntimeInput;
    const event = await this.downtimeService.closeDowntime(eventId, {
      ...input,
      updatedBy: request.user?.id ?? null
    });
    await this.logWrite(request, "downtime.close", before, event.id, event);
    return event;
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
      entityType: "downtime_event",
      entityId,
      beforeValue,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
