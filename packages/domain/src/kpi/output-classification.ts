import { isProductionEntryType } from "../constants/business-central.js";

export type OutputClassification =
  | "OK"
  | "REJECT"
  | "REJECT_UOM_MISMATCH"
  | "OK_UOM_MISMATCH"
  | "UNKNOWN_OUTPUT_CLASS"
  | "OTHER";

export interface OutputClassificationInput {
  readonly entryType?: string | null;
  readonly itemNo?: string | null;
  readonly uom?: string | null;
}

export function normalizeOutputToken(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim().toUpperCase();
}

export function isRejectItemNo(itemNo: string | null | undefined): boolean {
  return normalizeOutputToken(itemNo).startsWith("RJ");
}

export function classifyOutputRow(input: OutputClassificationInput): OutputClassification {
  if (!isProductionEntryType(input.entryType)) return "OTHER";

  const itemNo = normalizeOutputToken(input.itemNo);
  const uom = normalizeOutputToken(input.uom);
  if (!itemNo || !uom) return "UNKNOWN_OUTPUT_CLASS";

  const rejectItem = itemNo.startsWith("RJ");
  if (rejectItem && uom === "KG") return "REJECT";
  if (!rejectItem && uom === "PCS") return "OK";
  return rejectItem ? "REJECT_UOM_MISMATCH" : "OK_UOM_MISMATCH";
}

export function isOkOutputClassification(value: OutputClassification | string): boolean {
  return value === "OK";
}

export function isRejectOutputClassification(value: OutputClassification | string): boolean {
  return value === "REJECT";
}
