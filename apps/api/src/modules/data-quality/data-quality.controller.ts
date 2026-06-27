import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
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
  dataQualityActionSchema,
  dataQualityListQuerySchema,
  dataQualityResolutionSchema
} from "./data-quality.query.js";
import { DataQualityService } from "./data-quality.service.js";
import type {
  DataQualityIssueFilters,
  DataQualityStatus
} from "./data-quality.types.js";

const idSchema = z.string().uuid();

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("data-quality")
export class DataQualityController {
  constructor(
    @Inject(DataQualityService) private readonly dataQualityService: DataQualityService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  @Get("summary")
  @RequirePermissions("data_quality.view")
  getSummary() {
    return this.dataQualityService.getSummary();
  }

  @Get("issues")
  @RequirePermissions("data_quality.view")
  listIssues(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(dataQualityListQuerySchema, query) as DataQualityIssueFilters;
    return this.dataQualityService.listIssues(filters);
  }

  @Get("issues/:id")
  @RequirePermissions("data_quality.view")
  async getIssue(@Param("id") id: string) {
    const issue = await this.dataQualityService.getIssue(parseQuery(idSchema, id));
    if (!issue) throw new NotFoundException("Data quality issue not found");
    return issue;
  }

  @Post("business-central/generate")
  @RequirePermissions("settings.manage")
  async generateBusinessCentralIssues(@Req() request: AuthenticatedRequest) {
    const summary = await this.dataQualityService.generateBusinessCentralIssues({
      actorUserId: request.user?.id ?? null
    });
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action: "data_quality.business_central.generate",
      entityType: "data_quality_issue",
      entityId: "business-central",
      beforeValue: null,
      afterValue: summary,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
    return summary;
  }

  @Post("issues/:id/acknowledge")
  @RequirePermissions("settings.manage")
  acknowledge(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(dataQualityActionSchema, body ?? {});
    return this.changeStatus(parseQuery(idSchema, id), "ACKNOWLEDGED", input.note, request);
  }

  @Post("issues/:id/resolve")
  @RequirePermissions("settings.manage")
  resolve(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(dataQualityResolutionSchema, body);
    return this.changeStatus(parseQuery(idSchema, id), "RESOLVED", input.note, request);
  }

  @Post("issues/:id/ignore")
  @RequirePermissions("settings.manage")
  ignore(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(dataQualityResolutionSchema, body);
    return this.changeStatus(parseQuery(idSchema, id), "IGNORED", input.note, request);
  }

  @Post("issues/:id/reopen")
  @RequirePermissions("settings.manage")
  reopen(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.changeStatus(parseQuery(idSchema, id), "OPEN", undefined, request);
  }

  private async changeStatus(
    id: string,
    status: DataQualityStatus,
    note: string | undefined,
    request: AuthenticatedRequest
  ) {
    const before = await this.dataQualityService.getIssueOrThrow(id);
    const after = await this.dataQualityService.updateStatus(id, {
      status,
      actorUserId: request.user?.id ?? null,
      ...(note ? { note } : {})
    });
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action: `data_quality.${status.toLowerCase()}`,
      entityType: "data_quality_issue",
      entityId: id,
      beforeValue: before,
      afterValue: after,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
    return after;
  }
}
