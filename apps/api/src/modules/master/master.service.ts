import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type {
  businessCentralMappingResetCommitSchema,
  businessCentralMappingResetSchema,
  conditionalMappingCommitSchema,
  conditionalMappingPreviewSchema,
  conversionApplySchema,
  conversionGapsQuerySchema,
  createAliasSchema,
  createConversionSchema,
  createEntitySchema,
  listEntitiesQuerySchema,
  mappingCommitSchema,
  mappingPreviewSchema,
  targetCoverageQuerySchema,
  unmappedSourcesQuerySchema,
  updateAliasSchema,
  updateEntitySchema
} from "./master.query.js";
import { MasterRepository } from "./master.repository.js";

@Injectable()
export class MasterService {
  constructor(@Inject(MasterRepository) private readonly repository: MasterRepository) {}

  overview() {
    return this.repository.overview();
  }

  listEntities(filters: z.infer<typeof listEntitiesQuerySchema>) {
    return this.repository.listEntities(filters);
  }

  getEntity(id: string) {
    return this.repository.getEntity(id);
  }

  getEntityOrThrow(id: string) {
    return this.repository.getEntityOrThrow(id);
  }

  createEntity(input: z.infer<typeof createEntitySchema> & { readonly actorUserId?: string | null }) {
    return this.repository.createEntity(input);
  }

  updateEntity(id: string, input: z.infer<typeof updateEntitySchema> & { readonly actorUserId?: string | null }) {
    return this.repository.updateEntity(id, input);
  }

  listAliases(entityId: string) {
    return this.repository.listAliases(entityId);
  }

  createAlias(entityId: string, input: z.infer<typeof createAliasSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.createAlias(entityId, input);
  }

  getAliasOrThrow(entityId: string, aliasId: string) {
    return this.repository.getAliasOrThrow(entityId, aliasId);
  }

  updateAlias(entityId: string, aliasId: string, input: z.infer<typeof updateAliasSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.updateAlias(entityId, aliasId, input);
  }

  deactivateAlias(entityId: string, aliasId: string, actorUserId?: string | null) {
    return this.repository.updateAlias(entityId, aliasId, { isActive: false, actorUserId });
  }

  listUnmappedSources(filters: z.infer<typeof unmappedSourcesQuerySchema>) {
    return this.repository.listUnmappedSources(filters);
  }

  suggestions(input: { readonly sourceValue: string }) {
    return this.repository.suggestions(input);
  }

  previewMapping(input: z.infer<typeof mappingPreviewSchema>) {
    return this.repository.previewMapping(input);
  }

  commitMapping(input: z.infer<typeof mappingCommitSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.commitMapping(input);
  }

  previewBusinessCentralMappingReset(input: z.infer<typeof businessCentralMappingResetSchema>) {
    return this.repository.previewBusinessCentralMappingReset(input);
  }

  commitBusinessCentralMappingReset(input: z.infer<typeof businessCentralMappingResetCommitSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.commitBusinessCentralMappingReset(input);
  }

  previewConditionalMapping(input: z.infer<typeof conditionalMappingPreviewSchema>) {
    return this.repository.previewConditionalMapping(input);
  }

  commitConditionalMapping(input: z.infer<typeof conditionalMappingCommitSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.commitConditionalMapping(input);
  }

  targetCoverage(filters: z.infer<typeof targetCoverageQuerySchema>) {
    return this.repository.targetCoverage(filters);
  }

  conversionGaps(filters: z.infer<typeof conversionGapsQuerySchema>) {
    return this.repository.conversionGaps(filters);
  }

  createConversion(input: z.infer<typeof createConversionSchema> & { readonly actorUserId?: string | null }) {
    return this.repository.createConversion(input);
  }

  previewConversion(input: z.infer<typeof conversionApplySchema>) {
    return this.repository.previewConversion(input);
  }

  commitConversion(input: z.infer<typeof conversionApplySchema> & { readonly actorUserId?: string | null }) {
    return this.repository.commitConversion(input);
  }
}
