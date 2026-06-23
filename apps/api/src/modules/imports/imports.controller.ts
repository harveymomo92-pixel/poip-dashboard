import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody, parseQuery } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { importCommitSchema, importTypeSchema, queryLimit } from "./imports.query.js";
import { ImportsService } from "./imports.service.js";
import type { ImportCommitInput } from "./imports.types.js";

const idSchema = z.string().uuid();

interface UploadedImportFile {
  readonly originalname: string;
  readonly buffer: Buffer;
  readonly size: number;
}

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("imports")
export class ImportsController {
  constructor(
    @Inject(ImportsService)
    private readonly importsService: ImportsService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Post("preview")
  @RequirePermissions("import.preview")
  @UseInterceptors(FileInterceptor("file"))
  async preview(
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body("importType") importTypeValue: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    if (!file?.buffer || file.size === 0) throw new NotFoundException("Import file is required");
    const importType = parseQuery(importTypeSchema, importTypeValue);
    const result = await this.importsService.preview({
      importType,
      originalFilename: file.originalname,
      fileBuffer: file.buffer,
      createdBy: request.user?.id ?? null
    });
    await this.logWrite(request, "import.preview", null, result.run.id, {
      runId: result.run.id,
      summary: result.summary,
      originalFilename: result.run.originalFilename,
      fileHash: result.run.fileHash
    });
    return result;
  }

  @Get("runs")
  @RequirePermissions("import.preview")
  listRuns(@Query("limit") limit?: string) {
    return this.importsService.listRuns(queryLimit(limit));
  }

  @Get("runs/:id")
  @RequirePermissions("import.preview")
  async getRun(@Param("id") id: string) {
    const run = await this.importsService.getRun(parseQuery(idSchema, id));
    if (!run) throw new NotFoundException("Import run not found");
    return run;
  }

  @Get("runs/:id/errors")
  @RequirePermissions("import.preview")
  errorReport(@Param("id") id: string) {
    return this.importsService.errorReport(parseQuery(idSchema, id));
  }

  @Post("runs/:id/commit")
  @RequirePermissions("import.commit")
  async commit(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const runId = parseQuery(idSchema, id);
    const before = await this.importsService.getRunOrThrow(runId);
    const input = parseBody(importCommitSchema, body ?? {}) as ImportCommitInput;
    const result = await this.importsService.commit(runId, {
      ...input,
      committedBy: request.user?.id ?? null
    });
    await this.logWrite(request, "import.commit", before, runId, result);
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
      entityType: "import_run",
      entityId,
      beforeValue,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
