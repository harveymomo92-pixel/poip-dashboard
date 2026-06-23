import { z } from "zod";
import type {
  CloseDowntimeInput,
  CreateDowntimeInput,
  DowntimeListFilters,
  UpdateDowntimeInput
} from "./downtime.types.js";
import { downtimeSeverities, downtimeStatuses } from "./downtime.types.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.coerce.date();
const nullableTextSchema = z.union([z.string().trim(), z.null(), z.literal("")]).transform((value) => {
  if (value === "") return null;
  return value;
});
const nullableUuidSchema = z.union([z.string().uuid(), z.null(), z.literal("")]).transform((value) => {
  if (value === "") return null;
  return value;
});
const statusSchema = z.enum(downtimeStatuses);
const severitySchema = z.enum(downtimeSeverities);

function hasCloseFields(value: {
  readonly endTime?: Date | null | undefined;
  readonly rootCause?: string | null | undefined;
  readonly actionTaken?: string | null | undefined;
}) {
  if (!value.endTime) return true;
  return Boolean(value.rootCause?.trim() && value.actionTaken?.trim());
}

function updateHasAnyValue(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

export const downtimeListQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    entityId: z.string().uuid().optional(),
    machine: z.string().trim().min(1).optional(),
    status: statusSchema.optional(),
    category: z.string().trim().min(1).optional(),
    shiftCode: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to"
  })
  .transform((value): DowntimeListFilters => ({
    ...(value.from ? { from: value.from } : {}),
    ...(value.to ? { to: value.to } : {}),
    ...(value.entityId ? { entityId: value.entityId } : {}),
    ...(value.machine ? { machine: value.machine } : {}),
    ...(value.status ? { status: value.status } : {}),
    ...(value.category ? { category: value.category } : {}),
    ...(value.shiftCode ? { shiftCode: value.shiftCode.toUpperCase() } : {}),
    page: value.page,
    pageSize: value.pageSize
  }));

export const createDowntimeSchema = z
  .object({
    eventDate: dateSchema,
    shiftCode: nullableTextSchema.optional(),
    area: nullableTextSchema.optional(),
    entityId: nullableUuidSchema.optional(),
    machineCode: nullableTextSchema.optional(),
    lineCode: nullableTextSchema.optional(),
    category: z.string().trim().min(1),
    startTime: dateTimeSchema,
    endTime: dateTimeSchema.nullable().optional(),
    severity: severitySchema.default("MEDIUM"),
    rootCause: nullableTextSchema.optional(),
    actionTaken: nullableTextSchema.optional(),
    sourceType: z.string().trim().min(1).default("MANUAL"),
    sourceLine: nullableTextSchema.optional()
  })
  .refine(hasCloseFields, {
    message: "rootCause and actionTaken are required when endTime is provided"
  })
  .transform((value): CreateDowntimeInput => ({
    eventDate: value.eventDate,
    shiftCode: value.shiftCode ?? null,
    area: value.area ?? null,
    entityId: value.entityId ?? null,
    machineCode: value.machineCode ? value.machineCode.toUpperCase() : null,
    lineCode: value.lineCode ? value.lineCode.toUpperCase() : null,
    category: value.category.toUpperCase(),
    startTime: value.startTime,
    endTime: value.endTime ?? null,
    severity: value.severity,
    rootCause: value.rootCause ?? null,
    actionTaken: value.actionTaken ?? null,
    sourceType: value.sourceType.toUpperCase(),
    sourceLine: value.sourceLine ?? null
  }));

export const updateDowntimeSchema = z
  .object({
    eventDate: dateSchema.optional(),
    shiftCode: nullableTextSchema.optional(),
    area: nullableTextSchema.optional(),
    entityId: nullableUuidSchema.optional(),
    machineCode: nullableTextSchema.optional(),
    lineCode: nullableTextSchema.optional(),
    category: z.string().trim().min(1).optional(),
    startTime: dateTimeSchema.optional(),
    severity: severitySchema.optional(),
    rootCause: nullableTextSchema.optional(),
    actionTaken: nullableTextSchema.optional()
  })
  .refine(updateHasAnyValue, { message: "At least one field is required" })
  .transform((value): UpdateDowntimeInput => ({
    ...(value.eventDate ? { eventDate: value.eventDate } : {}),
    ...(value.shiftCode !== undefined ? { shiftCode: value.shiftCode } : {}),
    ...(value.area !== undefined ? { area: value.area } : {}),
    ...(value.entityId !== undefined ? { entityId: value.entityId } : {}),
    ...(value.machineCode !== undefined
      ? { machineCode: value.machineCode ? value.machineCode.toUpperCase() : null }
      : {}),
    ...(value.lineCode !== undefined
      ? { lineCode: value.lineCode ? value.lineCode.toUpperCase() : null }
      : {}),
    ...(value.category ? { category: value.category.toUpperCase() } : {}),
    ...(value.startTime ? { startTime: value.startTime } : {}),
    ...(value.severity ? { severity: value.severity } : {}),
    ...(value.rootCause !== undefined ? { rootCause: value.rootCause } : {}),
    ...(value.actionTaken !== undefined ? { actionTaken: value.actionTaken } : {})
  }));

export const closeDowntimeSchema = z
  .object({
    endTime: dateTimeSchema.optional(),
    rootCause: z.string().trim().min(1),
    actionTaken: z.string().trim().min(1)
  })
  .transform((value): CloseDowntimeInput => ({
    endTime: value.endTime ?? new Date(),
    rootCause: value.rootCause,
    actionTaken: value.actionTaken
  }));
