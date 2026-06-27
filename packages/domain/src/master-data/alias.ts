export type MasterSourceField =
  | "machine_description"
  | "machine_center_no"
  | "prod_line_description"
  | "prod_line_no"
  | "item_no"
  | "uom";

export interface SourceAliasCandidate {
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
}

export const BC_ENTITY_SOURCE_FIELD_PRIMARY = "prod_line_description" as const satisfies MasterSourceField;
export const BC_ENTITY_SOURCE_FIELD_FALLBACKS = [
  "prod_line_no",
  "machine_center_no",
  "machine_description"
] as const satisfies readonly MasterSourceField[];
export const BC_ENTITY_SOURCE_FIELDS = [
  BC_ENTITY_SOURCE_FIELD_PRIMARY,
  ...BC_ENTITY_SOURCE_FIELD_FALLBACKS
] as const satisfies readonly MasterSourceField[];

const allowedSourceFields = [
  ...BC_ENTITY_SOURCE_FIELDS,
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
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo?: string | null;
  readonly uom?: string | null;
}): SourceAliasCandidate[] {
  const entries: Array<[MasterSourceField, string | null | undefined]> = [
    ["prod_line_description", row.prodLineDescription],
    ["prod_line_no", row.prodLineNo],
    ["machine_center_no", row.machineCenterNo],
    ["machine_description", row.machineDescription],
    ["item_no", row.itemNo],
    ["uom", row.uom]
  ];
  return entries.flatMap(([sourceField, rawValue]) => {
    const sourceValue = normalizeAliasDisplay(rawValue);
    const normalizedValue = normalizeAliasKey(sourceValue);
    return sourceValue && normalizedValue ? [{ sourceField, sourceValue, normalizedValue }] : [];
  });
}

export function entitySourceCandidates(row: {
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
}): SourceAliasCandidate[] {
  return sourceAliasCandidates(row).filter((candidate) =>
    (BC_ENTITY_SOURCE_FIELDS as readonly string[]).includes(candidate.sourceField)
  );
}

export function preferredEntitySource(row: {
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
}): SourceAliasCandidate | null {
  return entitySourceCandidates(row)[0] ?? null;
}
