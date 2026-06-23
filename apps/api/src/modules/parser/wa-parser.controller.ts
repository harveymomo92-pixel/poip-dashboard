import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody, parseQuery } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { waCommitSchema, waPreviewSchema } from "./wa-parser.query.js";
import { WaParserService } from "./wa-parser.service.js";
import type { WaParserCommitInput, WaParserPreviewInput } from "./wa-parser.types.js";

const idSchema = z.string().uuid();

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

function queryLimit(value: unknown): number {
  if (typeof value !== "string") return 20;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 20;
}

@Controller("parser/wa")
export class WaParserController {
  constructor(
    @Inject(WaParserService)
    private readonly parserService: WaParserService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Post("preview")
  @RequirePermissions("parser.preview")
  async preview(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(waPreviewSchema, body) as WaParserPreviewInput;
    const result = await this.parserService.preview({
      ...input,
      createdBy: request.user?.id ?? null
    });
    await this.logWrite(request, "parser.wa.preview", null, result.run.id, {
      runId: result.run.id,
      summary: result.summary
    });
    return result;
  }

  @Get("runs")
  @RequirePermissions("parser.preview")
  listRuns(@Query("limit") limit?: string) {
    return this.parserService.listRuns(queryLimit(limit));
  }

  @Get("runs/:id")
  @RequirePermissions("parser.preview")
  async getRun(@Param("id") id: string) {
    const run = await this.parserService.getRun(parseQuery(idSchema, id));
    if (!run) throw new NotFoundException("Parser run not found");
    return run;
  }

  @Post("runs/:id/commit")
  @RequirePermissions("parser.commit")
  async commit(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const runId = parseQuery(idSchema, id);
    const before = await this.parserService.getRunOrThrow(runId);
    const input = parseBody(waCommitSchema, body ?? {}) as WaParserCommitInput;
    const result = await this.parserService.commit(runId, {
      ...input,
      committedBy: request.user?.id ?? null
    });
    await this.logWrite(request, "parser.wa.commit", before, runId, result);
    return result;
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
      entityType: "wa_parser_run",
      entityId,
      beforeValue,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
