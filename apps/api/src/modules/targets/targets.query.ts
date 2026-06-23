import { z } from "zod";
import type { CreateTargetInput, TargetListFilters, UpdateTargetInput } from "./targets.types.js";
import { targetStatuses } from "./targets.types.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateSchema = z.union([dateSchema, z.null(), z.literal("")]).transform((value) => {
  if (value === "") return null;
  return value;
});
const targetStatusSchema = z.enum(targetStatuses);

function validateDateRange(value: {
  readonly effectiveFrom?: string | undefined;
  readonly effectiveTo?: string | null | undefined;
}) {
  return !value.effectiveFrom || !value.effectiveTo || value.effectiveFrom <= value.effectiveTo;
}

function validateThresholds(value: {
  readonly minAchievementPct?: number | undefined;
  readonly maxAchievementPct?: number | undefined;
}) {
  if (typeof value.minAchievementPct !== "number" || typeof value.maxAchievementPct !== "number") {
    return true;
  }
  return value.minAchievementPct <= value.maxAchievementPct;
}

export const targetListQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    entityId: z.string().uuid().optional(),
    entity: z.string().trim().min(1).optional(),
    status: targetStatusSchema.optional(),
    itemNo: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to"
  })
  .transform((value): TargetListFilters => ({
    ...(value.from ? { from: value.from } : {}),
    ...(value.to ? { to: value.to } : {}),
    ...(value.entityId ? { entityId: value.entityId } : {}),
    ...(value.entity ? { entity: value.entity } : {}),
    ...(value.status ? { status: value.status } : {}),
    page: value.page,
    pageSize: value.pageSize
  }));

export const createTargetSchema = z
  .object({
    entityId: z.string().uuid(),
    effectiveFrom: dateSchema,
    effectiveTo: nullableDateSchema.optional(),
    dailyTargetQty: z.coerce.number().positive(),
    rejectTargetPct: z.coerce.number().min(0).max(100).nullable().optional(),
    minAchievementPct: z.coerce.number().min(0).max(999).default(95),
    maxAchievementPct: z.coerce.number().min(0).max(999).default(110)
  })
  .refine(validateDateRange, { message: "effectiveTo must be after effectiveFrom" })
  .refine(validateThresholds, { message: "minAchievementPct must be <= maxAchievementPct" })
  .transform((value): CreateTargetInput => ({
    entityId: value.entityId,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo ?? null,
    dailyTargetQty: value.dailyTargetQty,
    rejectTargetPct: value.rejectTargetPct ?? null,
    minAchievementPct: value.minAchievementPct,
    maxAchievementPct: value.maxAchievementPct
  }));

export const updateTargetSchema = z
  .object({
    effectiveFrom: dateSchema.optional(),
    effectiveTo: nullableDateSchema.optional(),
    dailyTargetQty: z.coerce.number().positive().optional(),
    rejectTargetPct: z.coerce.number().min(0).max(100).nullable().optional(),
    minAchievementPct: z.coerce.number().min(0).max(999).optional(),
    maxAchievementPct: z.coerce.number().min(0).max(999).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" })
  .refine(validateDateRange, { message: "effectiveTo must be after effectiveFrom" })
  .refine(validateThresholds, { message: "minAchievementPct must be <= maxAchievementPct" })
  .transform((value): UpdateTargetInput => ({
    ...(value.effectiveFrom ? { effectiveFrom: value.effectiveFrom } : {}),
    ...(value.effectiveTo !== undefined ? { effectiveTo: value.effectiveTo } : {}),
    ...(typeof value.dailyTargetQty === "number" ? { dailyTargetQty: value.dailyTargetQty } : {}),
    ...(value.rejectTargetPct !== undefined ? { rejectTargetPct: value.rejectTargetPct } : {}),
    ...(typeof value.minAchievementPct === "number" ? { minAchievementPct: value.minAchievementPct } : {}),
    ...(typeof value.maxAchievementPct === "number" ? { maxAchievementPct: value.maxAchievementPct } : {})
  }));
