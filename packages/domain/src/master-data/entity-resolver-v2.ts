import { normalizeAliasDisplay, normalizeAliasKey, type MasterSourceField } from "./alias.js";

export type BusinessCentralEntityV2Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type BusinessCentralEntityV2SourceField =
  | "gProdOrRotLineDescription"
  | "gProdOrRotLineNo"
  | "machineCenterNo"
  | "UNMAPPED";

export type BusinessCentralTargetBucketCandidate =
  | "OZ_22"
  | "OZ_LT_20"
  | "REG"
  | "CUP_REG"
  | `BOTOL_SIZE_${string}_ML`
  | `PREFORM_WEIGHT_${string}_GR`
  | "UNKNOWN";

export interface BusinessCentralEntityV2Row {
  readonly entryType?: string | null;
  readonly postingDate?: string | null;
  readonly documentNo?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly locationCode?: string | null;
  readonly quantity?: number | string | null;
  readonly grossWeight?: number | string | null;
  readonly gProdOrRotLineNo?: string | null;
  readonly gProdOrRotLineDescription?: string | null;
  readonly machineCenterNo?: string | null;
}

export interface BusinessCentralCanonicalEntityAliasInput {
  readonly alias: string;
  readonly aliasNormalized?: string | null;
  readonly sourceSystem?: string | null;
  readonly sourceField?: MasterSourceField | string | null;
  readonly isActive?: boolean | null;
}

export interface BusinessCentralCanonicalEntityInput {
  readonly entityId?: string | null;
  readonly entityCode: string;
  readonly displayName: string;
  readonly lineCode?: string | null;
  readonly productFamily?: string | null;
  readonly reportGroup?: string | null;
  readonly isActive?: boolean | null;
  readonly aliases?: readonly BusinessCentralCanonicalEntityAliasInput[] | null;
  readonly canonicalMachineDescriptions?: readonly string[] | null;
}

export interface BusinessCentralCanonicalEntityCatalogEntry {
  readonly entityId: string | null;
  readonly entityCode: string;
  readonly displayName: string;
  readonly lineCode: string | null;
  readonly productFamily: string | null;
  readonly reportGroup: string | null;
}

export interface BusinessCentralCanonicalEntityCatalog {
  readonly entries: readonly BusinessCentralCanonicalEntityCatalogEntry[];
  readonly identityLookup: ReadonlyMap<string, readonly CatalogLookupRecord[]>;
  readonly sourceAliasLookup: ReadonlyMap<string, ReadonlyMap<string, readonly CatalogLookupRecord[]>>;
}

export interface BusinessCentralTargetBucketInference {
  readonly targetBucketCandidate: BusinessCentralTargetBucketCandidate;
  readonly targetRoutingEvidence: string;
}

export interface BusinessCentralEntityV2Resolution extends BusinessCentralTargetBucketInference {
  readonly resolvedEntityCode: string | null;
  readonly resolvedEntityDisplayName: string | null;
  readonly sourceFieldUsed: BusinessCentralEntityV2SourceField;
  readonly sourceValueUsed: string | null;
  readonly confidence: BusinessCentralEntityV2Confidence;
  readonly reason: string;
}

interface CatalogLookupRecord {
  readonly entity: BusinessCentralCanonicalEntityCatalogEntry;
  readonly lookupKind: "identity" | "source_alias";
  readonly sourceField?: string | undefined;
}

interface CatalogLookupResult {
  readonly status: "matched" | "ambiguous" | "none";
  readonly entity: BusinessCentralCanonicalEntityCatalogEntry | null;
  readonly records: readonly CatalogLookupRecord[];
}

const resolverSourceToAliasField = {
  gProdOrRotLineDescription: "prod_line_description",
  gProdOrRotLineNo: "prod_line_no",
  machineCenterNo: "machine_center_no"
} as const satisfies Record<Exclude<BusinessCentralEntityV2SourceField, "UNMAPPED">, MasterSourceField>;

const ozLt20Sizes = new Set([10, 12, 14, 16, 18]);

export function buildBusinessCentralCanonicalEntityCatalog(
  entities: readonly BusinessCentralCanonicalEntityInput[]
): BusinessCentralCanonicalEntityCatalog {
  const identityLookup = new Map<string, CatalogLookupRecord[]>();
  const sourceAliasLookup = new Map<string, Map<string, CatalogLookupRecord[]>>();
  const entries: BusinessCentralCanonicalEntityCatalogEntry[] = [];

  for (const entityInput of entities) {
    if (entityInput.isActive === false) continue;
    const entity = {
      entityId: entityInput.entityId ?? null,
      entityCode: clean(entityInput.entityCode),
      displayName: clean(entityInput.displayName),
      lineCode: cleanOrNull(entityInput.lineCode),
      productFamily: cleanOrNull(entityInput.productFamily),
      reportGroup: cleanOrNull(entityInput.reportGroup)
    } satisfies BusinessCentralCanonicalEntityCatalogEntry;
    if (!entity.entityCode || !entity.displayName) continue;

    entries.push(entity);
    const identityValues = [
      entity.entityCode,
      entity.displayName,
      entity.lineCode,
      ...(entityInput.canonicalMachineDescriptions ?? [])
    ];
    for (const value of identityValues) {
      addLookupRecord(identityLookup, normalizeKey(value), { entity, lookupKind: "identity" });
    }

    for (const alias of entityInput.aliases ?? []) {
      if (alias.isActive === false) continue;
      if (alias.sourceSystem && normalizeAliasDisplay(alias.sourceSystem) !== "BUSINESS-CENTRAL") continue;
      if (!alias.sourceField || !isResolverAliasSourceField(alias.sourceField)) continue;
      const aliasKey = alias.aliasNormalized?.trim() || normalizeKey(alias.alias);
      if (!aliasKey) continue;
      const sourceFieldLookup = sourceAliasLookup.get(alias.sourceField) ?? new Map<string, CatalogLookupRecord[]>();
      addLookupRecord(sourceFieldLookup, aliasKey, {
        entity,
        lookupKind: "source_alias",
        sourceField: alias.sourceField
      });
      sourceAliasLookup.set(alias.sourceField, sourceFieldLookup);
    }
  }

  return { entries, identityLookup, sourceAliasLookup };
}

export function resolveBusinessCentralEntityV2(
  row: BusinessCentralEntityV2Row,
  canonicalEntityCatalog: BusinessCentralCanonicalEntityCatalog | readonly BusinessCentralCanonicalEntityInput[]
): BusinessCentralEntityV2Resolution {
  const catalog = isBusinessCentralCanonicalEntityCatalog(canonicalEntityCatalog)
    ? canonicalEntityCatalog
    : buildBusinessCentralCanonicalEntityCatalog(canonicalEntityCatalog);
  const bucket = inferBusinessCentralTargetBucketCandidate(row);
  const description = cleanOrNull(row.gProdOrRotLineDescription);
  if (description) {
    return resolveFromSource(catalog, bucket, "gProdOrRotLineDescription", description, "HIGH", row);
  }

  const lineNo = cleanOrNull(row.gProdOrRotLineNo);
  if (lineNo) {
    return resolveFromSource(catalog, bucket, "gProdOrRotLineNo", lineNo, "MEDIUM", row);
  }

  const machineCenterNo = cleanOrNull(row.machineCenterNo);
  if (machineCenterNo) {
    return resolveFromSource(catalog, bucket, "machineCenterNo", machineCenterNo, "LOW", row);
  }

  return unresolved({
    bucket,
    sourceFieldUsed: "UNMAPPED",
    sourceValueUsed: null,
    reason: "No Business Central entity source field was populated; prefer UNKNOWN over guessing"
  });
}

export function inferBusinessCentralTargetBucketCandidate(
  row: BusinessCentralEntityV2Row
): BusinessCentralTargetBucketInference {
  const itemDescription = normalizedText(row.itemDescription);
  const machineCenter = normalizedText(row.machineCenterNo);
  const itemNo = normalizedText(row.itemNo);
  const itemCategory = normalizedText(row.itemCategoryCode);
  const lineDescription = normalizedText(row.gProdOrRotLineDescription);
  const lineNo = normalizedText(row.gProdOrRotLineNo);
  const context = joinText([lineDescription, lineNo, machineCenter, itemCategory, itemNo]);
  const family = inferMachineFamily(context);

  const preformWeight = itemDescription ? parsePreformWeightGr(itemDescription) : null;
  if (preformWeight) {
    return bucketResult(`PREFORM_WEIGHT_${preformWeight}_GR`, `itemDescription:${clean(row.itemDescription)}`);
  }

  const bottleSize = itemDescription ? parseBottleSizeMl(itemDescription) : null;
  if (bottleSize) {
    return bucketResult(`BOTOL_SIZE_${bottleSize}_ML`, `itemDescription:${clean(row.itemDescription)}`);
  }

  const itemOz = itemDescription ? ozSize(itemDescription) : null;
  if (itemOz === 22) {
    return bucketResult("OZ_22", `itemDescription:${clean(row.itemDescription)}`);
  }
  if (itemOz !== null && ozLt20Sizes.has(itemOz)) {
    return bucketResult("OZ_LT_20", `itemDescription:${clean(row.itemDescription)}`);
  }
  if (itemOz !== null) {
    return bucketResult("UNKNOWN", `itemDescription has unsupported OZ size ${itemOz}`);
  }

  if (contains22Oz(machineCenter)) {
    return bucketResult("OZ_22", `machineCenterNo:${clean(row.machineCenterNo)}`);
  }

  const machineHasUnsupportedOz = hasOzSignal(machineCenter);
  const hasAmbiguousFamily = family.printing && family.thermoforming;
  if (hasAmbiguousFamily) {
    return bucketResult("UNKNOWN", "multiple machine-family signals");
  }

  if (family.printing) {
    if (machineHasUnsupportedOz) return bucketResult("UNKNOWN", "machineCenterNo has unsupported OZ signal");
    if (hasRegSignal(machineCenter)) return bucketResult("REG", `machineCenterNo:${clean(row.machineCenterNo)}`);
    return bucketResult("REG", "printing family with no safe OZ signal");
  }

  if (family.thermoforming && isCupContext(joinText([itemDescription, itemCategory, itemNo]))) {
    if (machineHasUnsupportedOz) return bucketResult("UNKNOWN", "machineCenterNo has unsupported OZ signal");
    return bucketResult("CUP_REG", "thermoforming cup item without safe OZ classification");
  }

  return bucketResult("UNKNOWN", "no safe target bucket signal");
}

function resolveFromSource(
  catalog: BusinessCentralCanonicalEntityCatalog,
  bucket: BusinessCentralTargetBucketInference,
  sourceFieldUsed: Exclude<BusinessCentralEntityV2SourceField, "UNMAPPED">,
  sourceValueUsed: string,
  confidence: Exclude<BusinessCentralEntityV2Confidence, "NONE">,
  row: BusinessCentralEntityV2Row
): BusinessCentralEntityV2Resolution {
  const match = lookupCatalog(catalog, sourceFieldUsed, sourceValueUsed);
  if (match.status === "matched" && match.entity) {
    return {
      resolvedEntityCode: match.entity.entityCode,
      resolvedEntityDisplayName: match.entity.displayName,
      sourceFieldUsed,
      sourceValueUsed,
      confidence,
      reason: resolvedReason(sourceFieldUsed, row),
      ...bucket
    };
  }
  return unresolved({
    bucket,
    sourceFieldUsed,
    sourceValueUsed,
    reason: match.status === "ambiguous"
      ? `Ambiguous exact canonical match for ${sourceFieldUsed}; prefer UNKNOWN over guessing`
      : `No exact canonical match for ${sourceFieldUsed}; prefer UNKNOWN over guessing`
  });
}

function lookupCatalog(
  catalog: BusinessCentralCanonicalEntityCatalog,
  sourceField: Exclude<BusinessCentralEntityV2SourceField, "UNMAPPED">,
  sourceValue: string
): CatalogLookupResult {
  const key = normalizeKey(sourceValue);
  const aliasField = resolverSourceToAliasField[sourceField];
  const records = [
    ...(catalog.identityLookup.get(key) ?? []),
    ...(catalog.sourceAliasLookup.get(aliasField)?.get(key) ?? [])
  ];
  const uniqueByEntity = new Map<string, CatalogLookupRecord>();
  for (const record of records) {
    uniqueByEntity.set(record.entity.entityCode, record);
  }
  const unique = [...uniqueByEntity.values()];
  if (unique.length === 1) return { status: "matched", entity: unique[0]?.entity ?? null, records: unique };
  if (unique.length > 1) return { status: "ambiguous", entity: null, records: unique };
  return { status: "none", entity: null, records: [] };
}

function unresolved(input: {
  readonly bucket: BusinessCentralTargetBucketInference;
  readonly sourceFieldUsed: BusinessCentralEntityV2SourceField;
  readonly sourceValueUsed: string | null;
  readonly reason: string;
}): BusinessCentralEntityV2Resolution {
  return {
    resolvedEntityCode: null,
    resolvedEntityDisplayName: null,
    sourceFieldUsed: input.sourceFieldUsed,
    sourceValueUsed: input.sourceValueUsed,
    confidence: "NONE",
    reason: input.reason,
    ...input.bucket
  };
}

function resolvedReason(
  sourceFieldUsed: Exclude<BusinessCentralEntityV2SourceField, "UNMAPPED">,
  row: BusinessCentralEntityV2Row
): string {
  if (sourceFieldUsed === "gProdOrRotLineDescription") {
    return cleanOrNull(row.machineCenterNo)
      ? "Resolved by exact gProdOrRotLineDescription match; Machine_Center_No kept as routing evidence"
      : "Resolved by exact gProdOrRotLineDescription match";
  }
  if (sourceFieldUsed === "gProdOrRotLineNo") {
    return "Resolved by exact gProdOrRotLineNo fallback because gProdOrRotLineDescription is blank";
  }
  return "Resolved by Machine_Center_No fallback because production line description and line no are blank";
}

function addLookupRecord(
  lookup: Map<string, CatalogLookupRecord[]>,
  key: string,
  record: CatalogLookupRecord
): void {
  if (!key) return;
  const current = lookup.get(key) ?? [];
  current.push(record);
  lookup.set(key, current);
}

function clean(value: string | number | null | undefined): string {
  return (value ?? "").toString().replace(/\u00a0/g, " ").trim();
}

function cleanOrNull(value: string | number | null | undefined): string | null {
  const cleaned = clean(value);
  return cleaned ? cleaned : null;
}

function normalizeKey(value: string | number | null | undefined): string {
  return normalizeAliasKey(clean(value));
}

function normalizedText(value: string | number | null | undefined): string {
  return normalizeAliasDisplay(clean(value)).replace(/[^A-Z0-9]+/g, " ").trim();
}

function joinText(values: readonly string[]): string {
  return values.filter(Boolean).join(" ").trim();
}

function contains22Oz(text: string): boolean {
  return /\b22\s*OZ\b/.test(text);
}

function hasOzSignal(text: string): boolean {
  return /\b\d+(?:[.,]\d+)?\s*OZ\b/.test(text);
}

function ozSize(text: string): number | null {
  const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*OZ\b/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBottleSizeMl(text: string): string | null {
  if (!/\b(?:BOTOL|BTL)\b/.test(text)) return null;
  const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*ML\b/);
  return match?.[1] ? normalizeNumericToken(match[1]) : null;
}

function parsePreformWeightGr(text: string): string | null {
  if (!/\bPREFORM\b/.test(text)) return null;
  const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:GR|GRAM)\b/);
  return match?.[1] ? normalizeNumericToken(match[1]) : null;
}

function normalizeNumericToken(value: string): string {
  return value.replace(",", ".").replace(/\.0+$/, "").replace(".", "_");
}

function hasRegSignal(text: string): boolean {
  return /\bREG(?:ULAR)?\b/.test(text);
}

function isCupContext(text: string): boolean {
  return /\bCUP\b/.test(text);
}

function inferMachineFamily(text: string): { readonly printing: boolean; readonly thermoforming: boolean } {
  return {
    printing: /\b(?:PRINT|PRINTING|OMSO|POLYPRINT)\b/.test(text),
    thermoforming: /\b(?:THERMO|THERMOFORMING|ILLIG|HENGFENG)\b/.test(text)
  };
}

function bucketResult(
  targetBucketCandidate: BusinessCentralTargetBucketCandidate,
  targetRoutingEvidence: string
): BusinessCentralTargetBucketInference {
  return { targetBucketCandidate, targetRoutingEvidence };
}

function isResolverAliasSourceField(value: string): value is MasterSourceField {
  return value === "prod_line_description" || value === "prod_line_no" || value === "machine_center_no";
}

function isBusinessCentralCanonicalEntityCatalog(
  value: BusinessCentralCanonicalEntityCatalog | readonly BusinessCentralCanonicalEntityInput[]
): value is BusinessCentralCanonicalEntityCatalog {
  return "identityLookup" in value && "sourceAliasLookup" in value;
}
