import {
  Body,
  Controller,
  Delete,
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
  businessCentralMappingResetCommitSchema,
  businessCentralMappingResetSchema,
  conditionalMappingCommitSchema,
  conditionalMappingPreviewSchema,
  conditionalMappingRulesQuerySchema,
  conversionApplySchema,
  conversionGapsQuerySchema,
  createAliasSchema,
  createConversionSchema,
  createEntitySchema,
  listEntitiesQuerySchema,
  mappingCommitSchema,
  mappingPreviewSchema,
  suggestionsQuerySchema,
  targetCoverageQuerySchema,
  unmappedSourcesQuerySchema,
  updateAliasSchema,
  updateEntitySchema
} from "./master.query.js";
import { MasterService } from "./master.service.js";

const idSchema = z.string().uuid();

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("master")
export class MasterController {
  constructor(
    @Inject(MasterService) private readonly masterService: MasterService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  @Get("overview")
  @RequirePermissions("master_data.view")
  overview() {
    return this.masterService.overview();
  }

  @Get("entities")
  @RequirePermissions("master_data.view")
  listEntities(@Query() query: Record<string, unknown>) {
    return this.masterService.listEntities(parseQuery(listEntitiesQuerySchema, query));
  }

  @Post("entities")
  @RequirePermissions("master_data.manage")
  async createEntity(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(createEntitySchema, body);
    const entity = await this.masterService.createEntity({ ...input, actorUserId: request.user?.id ?? null });
    await this.logWrite(request, "master.entity.create", "master_entity", entity.id, null, entity);
    return entity;
  }

  @Get("entities/:id")
  @RequirePermissions("master_data.view")
  async getEntity(@Param("id") id: string) {
    const entity = await this.masterService.getEntity(parseQuery(idSchema, id));
    if (!entity) throw new NotFoundException("Master entity not found");
    return {
      ...entity,
      aliases: await this.masterService.listAliases(entity.id)
    };
  }

  @Patch("entities/:id")
  @RequirePermissions("master_data.manage")
  async updateEntity(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const entityId = parseQuery(idSchema, id);
    const before = await this.masterService.getEntityOrThrow(entityId);
    const entity = await this.masterService.updateEntity(entityId, {
      ...parseBody(updateEntitySchema, body),
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.entity.update", "master_entity", entity.id, before, entity);
    return entity;
  }

  @Post("entities/:id/aliases")
  @RequirePermissions("master_data.manage")
  async createAlias(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const entityId = parseQuery(idSchema, id);
    const alias = await this.masterService.createAlias(entityId, {
      ...parseBody(createAliasSchema, body),
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.alias.create", "master_entity_alias", alias.id, null, alias);
    return alias;
  }

  @Patch("entities/:id/aliases/:aliasId")
  @RequirePermissions("master_data.manage")
  async updateAlias(
    @Param("id") id: string,
    @Param("aliasId") aliasId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    const entityId = parseQuery(idSchema, id);
    const parsedAliasId = parseQuery(idSchema, aliasId);
    const before = await this.masterService.getAliasOrThrow(entityId, parsedAliasId);
    const alias = await this.masterService.updateAlias(entityId, parsedAliasId, {
      ...parseBody(updateAliasSchema, body),
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.alias.update", "master_entity_alias", alias.id, before, alias);
    return alias;
  }

  @Delete("entities/:id/aliases/:aliasId")
  @RequirePermissions("master_data.manage")
  async deactivateAlias(@Param("id") id: string, @Param("aliasId") aliasId: string, @Req() request: AuthenticatedRequest) {
    const entityId = parseQuery(idSchema, id);
    const parsedAliasId = parseQuery(idSchema, aliasId);
    const before = await this.masterService.getAliasOrThrow(entityId, parsedAliasId);
    const alias = await this.masterService.deactivateAlias(entityId, parsedAliasId, request.user?.id ?? null);
    await this.logWrite(request, "master.alias.deactivate", "master_entity_alias", alias.id, before, alias);
    return alias;
  }

  @Get("mapping/unmapped-sources")
  @RequirePermissions("master_data.view")
  unmappedSources(@Query() query: Record<string, unknown>) {
    return this.masterService.listUnmappedSources(parseQuery(unmappedSourcesQuerySchema, query));
  }

  @Get("mapping/suggestions")
  @RequirePermissions("master_data.view")
  suggestions(@Query() query: Record<string, unknown>) {
    const input = parseQuery(suggestionsQuerySchema, query);
    return this.masterService.suggestions(input);
  }

  @Post("mapping/apply/preview")
  @RequirePermissions("master_data.view")
  previewMapping(@Body() body: unknown) {
    return this.masterService.previewMapping(parseBody(mappingPreviewSchema, body));
  }

  @Post("mapping/apply/commit")
  @RequirePermissions("master_data.manage")
  async commitMapping(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(mappingCommitSchema, body);
    const result = await this.masterService.commitMapping({
      ...input,
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.mapping.commit", "production_output_mapping", `${input.sourceField}:${input.sourceValue}`, null, result);
    return result;
  }

  @Post("business-central/mapping-reset/preview")
  @RequirePermissions("master_data.view")
  previewBusinessCentralMappingReset(@Body() body: unknown) {
    return this.masterService.previewBusinessCentralMappingReset(parseBody(businessCentralMappingResetSchema, body));
  }

  @Post("business-central/mapping-reset/commit")
  @RequirePermissions("master_data.manage")
  async commitBusinessCentralMappingReset(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(businessCentralMappingResetCommitSchema, body);
    const result = await this.masterService.commitBusinessCentralMappingReset({
      ...input,
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.mapping-reset.commit", "production_output_mapping", `${input.sourceField}:${input.sourceValue}`, null, result);
    return result;
  }

  @Post("business-central/conditional-mapping/preview")
  @RequirePermissions("master_data.view")
  previewConditionalMapping(@Body() body: unknown) {
    return this.masterService.previewConditionalMapping(parseBody(conditionalMappingPreviewSchema, body));
  }

  @Get("business-central/conditional-mapping/rules")
  @RequirePermissions("master_data.view")
  listConditionalMappingRules(@Query() query: Record<string, unknown>) {
    return this.masterService.listConditionalMappingRules(parseQuery(conditionalMappingRulesQuerySchema, query));
  }

  @Post("business-central/conditional-mapping/commit")
  @RequirePermissions("master_data.manage")
  async commitConditionalMapping(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(conditionalMappingCommitSchema, body);
    const result = await this.masterService.commitConditionalMapping({
      ...input,
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(
      request,
      "master.conditional-mapping.commit",
      "master_entity_conditional_rule",
      `${input.sourceField}:${input.sourceValue}:${input.conditionType}:${input.conditionValue}`,
      null,
      result
    );
    return result;
  }

  @Get("mapping/target-coverage")
  @RequirePermissions("master_data.view")
  targetCoverage(@Query() query: Record<string, unknown>) {
    return this.masterService.targetCoverage(parseQuery(targetCoverageQuerySchema, query));
  }

  @Get("mapping/conversion-gaps")
  @RequirePermissions("master_data.view")
  conversionGaps(@Query() query: Record<string, unknown>) {
    return this.masterService.conversionGaps(parseQuery(conversionGapsQuerySchema, query));
  }

  @Post("mapping/conversions")
  @RequirePermissions("master_data.manage")
  async createConversion(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(createConversionSchema, body);
    const mapping = await this.masterService.createConversion({
      ...input,
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.conversion.create", "item_conversion_mapping", mapping.id, null, mapping);
    return mapping;
  }

  @Post("mapping/conversions/apply/preview")
  @RequirePermissions("master_data.view")
  previewConversion(@Body() body: unknown) {
    return this.masterService.previewConversion(parseBody(conversionApplySchema, body));
  }

  @Post("mapping/conversions/apply/commit")
  @RequirePermissions("master_data.manage")
  async commitConversion(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(conversionApplySchema, body);
    const result = await this.masterService.commitConversion({
      ...input,
      actorUserId: request.user?.id ?? null
    });
    await this.logWrite(request, "master.conversion.commit", "item_conversion_mapping", `${input.itemNo}:${input.uom ?? ""}`, null, result);
    return result;
  }

  private async logWrite(
    request: AuthenticatedRequest,
    action: string,
    entityType: string,
    entityId: string,
    beforeValue: unknown,
    afterValue: unknown
  ): Promise<void> {
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action,
      entityType,
      entityId,
      beforeValue,
      afterValue,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
  }
}
