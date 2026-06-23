import { toAsiaJakartaBusinessDate } from "@poip/domain";
import { z } from "zod";
import type { DashboardFilters, OutputListFilters } from "./dashboard.types.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const baseQueryFields = {
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  entityId: z.string().uuid().optional(),
  machineCenterNo: z.string().trim().min(1).optional(),
  itemNo: z.string().trim().min(1).optional(),
  shiftCode: z.string().trim().min(1).optional(),
  sourceSystem: z.string().trim().min(1).optional()
} as const;

function defaultRange() {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setUTCDate(now.getUTCDate() - 6);
  return {
    from: toAsiaJakartaBusinessDate(fromDate),
    to: toAsiaJakartaBusinessDate(now)
  };
}

function toDashboardFilters(value: {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly entityId?: string | undefined;
  readonly machineCenterNo?: string | undefined;
  readonly itemNo?: string | undefined;
  readonly shiftCode?: string | undefined;
  readonly sourceSystem?: string | undefined;
}): DashboardFilters {
  const fallback = defaultRange();
  return {
    from: value.from ?? fallback.from,
    to: value.to ?? fallback.to,
    sourceSystem: value.sourceSystem ?? "business-central",
    ...(value.entityId ? { entityId: value.entityId } : {}),
    ...(value.machineCenterNo ? { machineCenterNo: value.machineCenterNo.toUpperCase() } : {}),
    ...(value.itemNo ? { itemNo: value.itemNo.toUpperCase() } : {}),
    ...(value.shiftCode ? { shiftCode: value.shiftCode.toUpperCase() } : {})
  };
}

function isValidRange(value: DashboardFilters): boolean {
  return value.from <= value.to;
}

export const dashboardQuerySchema = z.object(baseQueryFields).transform(toDashboardFilters).refine(isValidRange, {
  message: "from must be before or equal to to"
});

export const outputsQuerySchema = z
  .object({
    ...baseQueryFields,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sortBy: z
      .enum(["postingDate", "entryNo", "itemNo", "machineCenterNo", "quantity"])
      .default("postingDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc")
  })
  .transform((value): OutputListFilters => ({
    ...toDashboardFilters(value),
    page: value.page,
    pageSize: value.pageSize,
    sortBy: value.sortBy,
    sortDir: value.sortDir
  }))
  .refine(isValidRange, {
    message: "from must be before or equal to to"
  });

export const breakdownQuerySchema = z
  .object({
    ...baseQueryFields,
    groupBy: z.enum(["machine", "entity", "item", "shift"]).default("machine"),
    limit: z.coerce.number().int().min(1).max(50).default(10)
  })
  .transform((value) => ({
    ...toDashboardFilters(value),
    groupBy: value.groupBy,
    limit: value.limit
  }))
  .refine(isValidRange, {
    message: "from must be before or equal to to"
  });
