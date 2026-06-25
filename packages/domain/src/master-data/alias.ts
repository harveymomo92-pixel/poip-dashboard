export type MasterSourceField = "machine_center_no" | "prod_line_no" | "prod_line_description" | "item_no" | "uom";

export interface SourceAliasCandidate {
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
}

const allowedSourceFields = [
  "machine_center_no",
  "prod_line_no",
  "prod_line_description",
  "item_no",
  "uom"
] as const satisfies readonly MasterSourceField[];

export function isMasterSourceField(value: string): value is MasterSourceField {
  return (allowedSourceFields as readonly string[]).includes(value);
}

export function normalizeAliasDisplay(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeAliasKey(value: string | null | undefined): string {
  return normalizeAliasDisplay(value).replace(/[^A-Z0-9]+/g, "");
}

export function legacyMachineFamilyKey(value: string | null | undefined): string {
  const compact = normalizeAliasKey(value);
  if (!compact) return "";
  if (compact.startsWith("LONGSUNG")) return "LONGSUN";
  if (compact.startsWith("BORCH")) return "BORCHE";
  if (compact.startsWith("HENGFENG") || /^HF\d*/.test(compact)) return "HENGFENG";
  if (compact.startsWith("TF") || compact.startsWith("ILLIG")) return "ILLIG";
  if (compact.startsWith("VFINE") || compact.startsWith("VF")) return "VFINE";
  if (compact.startsWith("CHUMPOWER") || /^CP\d*/.test(compact)) return "CHUMPOWER";
  if (compact.startsWith("POLY")) return "POLYPRINT";
  if (compact.startsWith("NEWDO")) return "NEWDO";
  if (compact.startsWith("OMSO")) return "OMSO";
  return compact;
}

export function sourceAliasCandidates(row: {
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo?: string | null;
  readonly uom?: string | null;
}): SourceAliasCandidate[] {
  const entries: Array<[MasterSourceField, string | null | undefined]> = [
    ["machine_center_no", row.machineCenterNo],
    ["prod_line_no", row.prodLineNo],
    ["prod_line_description", row.prodLineDescription],
    ["item_no", row.itemNo],
    ["uom", row.uom]
  ];
  return entries.flatMap(([sourceField, rawValue]) => {
    const sourceValue = normalizeAliasDisplay(rawValue);
    const normalizedValue = normalizeAliasKey(sourceValue);
    return sourceValue && normalizedValue ? [{ sourceField, sourceValue, normalizedValue }] : [];
  });
}

