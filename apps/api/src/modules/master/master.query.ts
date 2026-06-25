import { isMasterSourceField } from "@poip/domain";
import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sourceFieldSchema = z.string().refine(isMasterSourceField, "Invalid source field");

export const listEntitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional()
});

export const unmappedSourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sourceField: sourceFieldSchema.optional(),
  search: z.string().trim().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional()
});

export const suggestionsQuerySchema = z.object({
  sourceField: sourceFieldSchema,
  sourceValue: z.string().trim().min(1)
});

export const targetCoverageQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

export const conversionGapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  itemNo: z.string().trim().optional(),
  uom: z.string().trim().optional()
});

export const createEntitySchema = z.object({
  entityCode: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(160),
  area: z.string().trim().max(80).nullable().optional(),
  lineCode: z.string().trim().max(80).nullable().optional(),
  productFamily: z.string().trim().max(80).nullable().optional(),
  reportGroup: z.string().trim().max(80).nullable().optional(),
  plannedRuntimeHours: z.coerce.number().positive().max(24 * 7).optional(),
  isActive: z.boolean().optional()
});

export const updateEntitySchema = createEntitySchema.partial();

export const createAliasSchema = z.object({
  alias: z.string().trim().min(1).max(160),
  sourceSystem: z.string().trim().min(1).default("business-central"),
  sourceField: sourceFieldSchema.default("machine_center_no"),
  source: z.string().trim().min(1).default("manual"),
  matchConfidence: z.coerce.number().min(0).max(100).nullable().optional()
});

export const updateAliasSchema = createAliasSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const mappingPreviewSchema = z.object({
  sourceSystem: z.string().trim().min(1).default("business-central"),
  sourceField: sourceFieldSchema.optional(),
  sourceValue: z.string().trim().min(1).optional(),
  entityId: z.string().uuid().optional(),
  remap: z.boolean().optional().default(false)
});

export const mappingCommitSchema = mappingPreviewSchema.extend({
  sourceField: sourceFieldSchema,
  sourceValue: z.string().trim().min(1),
  entityId: z.string().uuid(),
  note: z.string().trim().min(3).max(500).optional()
});

export const createConversionSchema = z.object({
  itemNo: z.string().trim().min(1).max(120),
  uom: z.string().trim().max(40).default(""),
  grossWeightPerPcs: z.coerce.number().positive(),
  source: z.string().trim().min(1).default("manual")
});

export const conversionApplySchema = z.object({
  itemNo: z.string().trim().min(1),
  uom: z.string().trim().optional().default(""),
  grossWeightPerPcs: z.coerce.number().positive().optional(),
  note: z.string().trim().min(3).max(500).optional()
});

