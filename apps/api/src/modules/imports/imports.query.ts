import { z } from "zod";
import type { ImportCommitInput, ImportType } from "./imports.types.js";

export const importTypeSchema = z
  .enum(["downtime"])
  .default("downtime")
  .transform((value): ImportType => value);

export const importCommitSchema = z
  .object({
    selectedRowIds: z.array(z.string().uuid()).min(1).optional()
  })
  .transform((value): ImportCommitInput => ({
    ...(value.selectedRowIds ? { selectedRowIds: value.selectedRowIds } : {})
  }));

export function queryLimit(value: unknown): number {
  if (typeof value !== "string") return 20;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 20;
}
