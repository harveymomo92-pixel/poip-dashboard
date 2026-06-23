import { z } from "zod";
import type { WaParserCommitInput, WaParserPreviewInput } from "./wa-parser.types.js";

export const waPreviewSchema = z
  .object({
    sourceText: z.string().min(1).max(50_000),
    parserMode: z.literal("rules").default("rules")
  })
  .transform((value): WaParserPreviewInput => ({
    sourceText: value.sourceText,
    parserMode: value.parserMode
  }));

export const waCommitSchema = z
  .object({
    selectedRowIds: z.array(z.string().uuid()).min(1).optional()
  })
  .transform((value): WaParserCommitInput => ({
    ...(value.selectedRowIds ? { selectedRowIds: value.selectedRowIds } : {})
  }));
