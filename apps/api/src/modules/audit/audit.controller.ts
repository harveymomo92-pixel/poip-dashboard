import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { parseQuery } from "../../common/validation.js";
import { auditListQuerySchema } from "./audit.query.js";
import { AuditService } from "./audit.service.js";
import type { AuditListFilters } from "./audit.types.js";

const idSchema = z.string().uuid();

@Controller(["audit", "audit-logs"])
@RequirePermissions("audit.view")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(auditListQuerySchema, query) as AuditListFilters;
    return this.auditService.list(filters);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const event = await this.auditService.getById(parseQuery(idSchema, id));
    if (!event) throw new NotFoundException("Audit event not found");
    return event;
  }
}
