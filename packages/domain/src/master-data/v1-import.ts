import {
  normalizeAliasDisplay,
  normalizeAliasKey,
  sourceAliasCandidates,
  type MasterSourceField
} from "./alias.js";

export const V1_TARGET_TYPE_LABELS: Readonly<Record<string, string>> = {
  target_botol_preform: "Botol/Preform",
  target_thermoforming: "Thermoforming",
  target_thermoforming_gw_gt_12: "Thermoforming GW > 12g",
  target_printing_non_oz: "Printing non-OZ",
  target_printing_oz_lt_20: "Printing OZ < 20",
  target_printing_22_oz: "Printing 22 OZ"
};

const SOURCE_FIELD_PRIORITY: readonly MasterSourceField[] = [
  "machine_description",
  "machine_center_no",
  "prod_line_description",
  "prod_line_no",
  "item_no",
  "uom"
];

export interface ParsedCsv {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
}

export interface V1MasterEntityPlan {
  readonly importKey: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly area: string;
  readonly lineCode: string;
  readonly productFamily: string;
  readonly reportGroup: string;
  readonly targetType: string;
  readonly targetLabel: string;
  readonly dailyTargetQty: number;
  readonly minAchievementPct: number;
  readonly rejectTargetPct: number | null;
  readonly sourceCodes: readonly string[];
  readonly sourceRows: number;
}

export interface V1AliasPlan {
  readonly entityImportKey: string;
  readonly entityCode: string;
  readonly sourceField: MasterSourceField;
  readonly alias: string;
  readonly aliasNormalized: string;
  readonly source: "v1-master-target" | "v1-machine-evidence" | "v1-prod-line-evidence";
  readonly evidenceRows: number;
  readonly evidenceQuantity: number;
}

export interface V1TargetPlan {
  readonly entityImportKey: string;
  readonly entityCode: string;
  readonly targetVersion: number;
  readonly dailyTargetQty: number;
  readonly rejectTargetPct: number | null;
  readonly minAchievementPct: number;
  readonly maxAchievementPct: number;
  readonly sourceTargetType: string;
}

export interface V1ConversionPlan {
  readonly itemNo: string;
  readonly uom: string;
  readonly grossWeightPerPcs: number;
  readonly evidenceRows: number;
}

export interface V1Conflict {
  readonly kind:
    | "source-code-ambiguous"
    | "machine-alias-ambiguous"
    | "prod-line-alias-ambiguous"
    | "alias-normalized-conflict"
    | "alias-unique-conflict"
    | "conversion-conflict";
  readonly sourceValue: string;
  readonly sourceField?: MasterSourceField;
  readonly entityCodes?: readonly string[];
  readonly details?: string;
}

export interface V1ImportPlan {
  readonly entities: readonly V1MasterEntityPlan[];
  readonly aliases: readonly V1AliasPlan[];
  readonly targets: readonly V1TargetPlan[];
  readonly conversions: readonly V1ConversionPlan[];
  readonly conflicts: readonly V1Conflict[];
  readonly stats: {
    readonly rawMasterRows: number;
    readonly rawMachineRows: number;
    readonly rawItemLedgerRows: number;
    readonly uniqueSourceCodes: number;
    readonly targetRows: number;
    readonly ambiguousSourceCodes: number;
    readonly ambiguousMachineAliases: number;
    readonly ambiguousProdLineAliases: number;
    readonly conversionConflicts: number;
  };
}

export interface V1OutputSourceRow {
  readonly id: string;
  readonly sourceSystem?: string | null;
  readonly entityId?: string | null;
  readonly postingDate?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo?: string | null;
  readonly uom?: string | null;
  readonly normalizedOutputType?: string | null;
  readonly quantity?: number | null;
}

export interface V1ReconcileEstimate {
  readonly matchedRows: number;
  readonly matchedOkRows: number;
  readonly matchedOkQty: number;
  readonly conflictRows: number;
  readonly remainingUnmappedRows: number;
  readonly topMatches: readonly {
    readonly sourceField: MasterSourceField;
    readonly sourceValue: string;
    readonly entityCode: string;
    readonly rows: number;
    readonly okQty: number;
  }[];
  readonly remainingGroups: readonly {
    readonly sourceField: MasterSourceField;
    readonly sourceValue: string;
    readonly rows: number;
    readonly okQty: number;
  }[];
}

interface V1MasterCsvRow {
  readonly area: string;
  readonly code: string;
  readonly display: string;
  readonly description: string;
  readonly targetType: string;
  readonly targetQty: number;
  readonly minAchievementPct: number;
  readonly rejectTargetPct: number | null;
}

interface EvidenceBucket {
  readonly sourceValue: string;
  rows: number;
  quantity: number;
  readonly entities: Map<string, { entityCode: string; rows: number; quantity: number }>;
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  const headers = rows[0]?.map((header) => cleanText(header)) ?? [];
  return {
    headers,
    rows: rows.slice(1).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
    )
  };
}

export function cleanText(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

export function numberOrNull(value: string | number | null | undefined): number | null {
  const text = cleanText(value).replace("%", "").replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rateToPercent(value: string | number | null | undefined): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

export function canonicalProductDescription(value: string | null | undefined): string {
  return cleanText(value)
    .replace(/\((?:Alias|Duplikasi)\s+Nama\s+Sistem\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsSecretLikeText(value: unknown): boolean {
  return /(authorization|bearer\s+[a-z0-9._~+/-]+|basic\s+[a-z0-9+/=]+|password|passwd|token|cookie|secret|api[_-]?key)/i.test(
    JSON.stringify(value)
  );
}

function normalizeKey(value: string): string {
  return normalizeAliasKey(value);
}

function sortableTargetQty(value: number): string {
  return value.toFixed(4);
}

function parseMasterRows(csvText: string): V1MasterCsvRow[] {
  return parseCsv(csvText).rows.flatMap((row) => {
    const area = cleanText(row.area_kerja_line);
    const code = normalizeAliasDisplay(row.kode_asli_sistem);
    const display = cleanText(row.display_laporan);
    const description = cleanText(row.deskripsi_produk);
    const targetType = cleanText(row.active_target_type);
    const targetQty = numberOrNull(row.active_target);
    if (!area || !code || !targetType || targetQty === null || targetQty <= 0) return [];
    return [
      {
        area,
        code,
        display,
        description,
        targetType,
        targetQty,
        minAchievementPct: rateToPercent(row.target_achievement_rate) ?? defaultMinAchievementPct(area),
        rejectTargetPct: rateToPercent(row.target_reject_rate)
      }
    ];
  });
}

function defaultMinAchievementPct(area: string): number {
  const normalized = normalizeAliasDisplay(area);
  if (normalized === "INJECTION" || normalized === "PREFORM") return 90;
  if (normalized === "PRINTING") return 85;
  if (normalized === "BLOWING" || normalized === "THERMOFORMING") return 80;
  return 80;
}

function masterGroupKey(row: V1MasterCsvRow): string {
  return [
    normalizeKey(row.area),
    normalizeKey(row.display),
    normalizeKey(canonicalProductDescription(row.description)),
    normalizeKey(row.targetType),
    sortableTargetQty(row.targetQty),
    row.rejectTargetPct === null ? "" : row.rejectTargetPct.toFixed(4),
    row.minAchievementPct.toFixed(4)
  ].join("|");
}

function preferCanonicalRow(rows: readonly V1MasterCsvRow[]): V1MasterCsvRow {
  return (
    rows.find((row) => !/\b(?:Alias|Duplikasi)\s+Nama\s+Sistem\b/i.test(row.description)) ??
    rows[0]!
  );
}

function displayNameFor(row: V1MasterCsvRow, duplicateBaseCode: boolean): string {
  const parts = [row.display || row.code, canonicalProductDescription(row.description)].filter(Boolean);
  const base = parts.join(" - ");
  const targetLabel = V1_TARGET_TYPE_LABELS[row.targetType] ?? row.targetType;
  return duplicateBaseCode ? `${base} - ${targetLabel}` : base;
}

function entityCodeFor(row: V1MasterCsvRow, duplicateBaseCode: boolean): string {
  if (!duplicateBaseCode) return row.code;
  return `${row.code} - ${V1_TARGET_TYPE_LABELS[row.targetType] ?? normalizeAliasDisplay(row.targetType)}`;
}

function addBucket(
  buckets: Map<string, EvidenceBucket>,
  sourceValue: string,
  entity: V1MasterEntityPlan,
  quantity: number
): void {
  const normalized = normalizeKey(sourceValue);
  if (!normalized) return;
  const bucket = buckets.get(normalized) ?? {
    sourceValue: normalizeAliasDisplay(sourceValue),
    rows: 0,
    quantity: 0,
    entities: new Map<string, { entityCode: string; rows: number; quantity: number }>()
  };
  bucket.rows += 1;
  bucket.quantity += quantity;
  const current = bucket.entities.get(entity.importKey) ?? {
    entityCode: entity.entityCode,
    rows: 0,
    quantity: 0
  };
  current.rows += 1;
  current.quantity += quantity;
  bucket.entities.set(entity.importKey, current);
  buckets.set(normalized, bucket);
}

function quantityFromRow(row: Record<string, string>): number {
  return numberOrNull(row.Quantity) ?? numberOrNull(row.Total_Quantity) ?? 0;
}

function addEvidenceAliases(
  aliases: V1AliasPlan[],
  conflicts: V1Conflict[],
  buckets: ReadonlyMap<string, EvidenceBucket>,
  sourceField: MasterSourceField,
  source: V1AliasPlan["source"]
): void {
  for (const bucket of buckets.values()) {
    const entities = [...bucket.entities.values()];
    if (entities.length !== 1) {
      conflicts.push({
        kind: sourceField === "machine_center_no" ? "machine-alias-ambiguous" : "prod-line-alias-ambiguous",
        sourceField,
        sourceValue: bucket.sourceValue,
        entityCodes: entities.map((entity) => entity.entityCode).sort(),
        details: `${bucket.rows} evidence rows across ${entities.length} entities`
      });
      continue;
    }
    const entity = entities[0]!;
    aliases.push({
      entityImportKey: [...bucket.entities.keys()][0]!,
      entityCode: entity.entityCode,
      sourceField,
      alias: bucket.sourceValue,
      aliasNormalized: normalizeKey(bucket.sourceValue),
      source,
      evidenceRows: bucket.rows,
      evidenceQuantity: bucket.quantity
    });
  }
}

function dedupeAliases(
  aliases: readonly V1AliasPlan[],
  conflicts: V1Conflict[]
): V1AliasPlan[] {
  const priority = (field: MasterSourceField): number => SOURCE_FIELD_PRIORITY.indexOf(field);
  const byFieldAndKey = new Map<string, V1AliasPlan>();
  for (const alias of aliases) {
    const key = `${alias.sourceField}|${alias.aliasNormalized}`;
    const current = byFieldAndKey.get(key);
    if (!current) {
      byFieldAndKey.set(key, alias);
      continue;
    }
    if (current.entityImportKey !== alias.entityImportKey) {
      conflicts.push({
        kind: "alias-normalized-conflict",
        sourceField: alias.sourceField,
        sourceValue: alias.alias,
        entityCodes: [current.entityCode, alias.entityCode].sort()
      });
      byFieldAndKey.delete(key);
      continue;
    }
    if (alias.evidenceRows > current.evidenceRows) byFieldAndKey.set(key, alias);
  }

  const byLiteralAlias = new Map<string, V1AliasPlan>();
  for (const alias of byFieldAndKey.values()) {
    const key = normalizeKey(alias.alias);
    const current = byLiteralAlias.get(key);
    if (!current) {
      byLiteralAlias.set(key, alias);
      continue;
    }
    if (current.entityImportKey !== alias.entityImportKey) {
      conflicts.push({
        kind: "alias-unique-conflict",
        sourceValue: alias.alias,
        entityCodes: [current.entityCode, alias.entityCode].sort(),
        details: "v2 currently has a global unique alias constraint"
      });
      byLiteralAlias.delete(key);
      continue;
    }
    const currentPriority = priority(current.sourceField);
    const nextPriority = priority(alias.sourceField);
    if (nextPriority >= 0 && (currentPriority < 0 || nextPriority < currentPriority)) {
      byLiteralAlias.set(key, alias);
    }
  }

  return [...byLiteralAlias.values()].sort((left, right) =>
    left.sourceField.localeCompare(right.sourceField) ||
    left.alias.localeCompare(right.alias) ||
    left.entityCode.localeCompare(right.entityCode)
  );
}

function buildConversions(itemLedgerCsvText?: string): {
  readonly conversions: V1ConversionPlan[];
  readonly conflicts: V1Conflict[];
  readonly rawRows: number;
} {
  if (!itemLedgerCsvText) return { conversions: [], conflicts: [], rawRows: 0 };
  const rows = parseCsv(itemLedgerCsvText).rows;
  const groups = new Map<string, { itemNo: string; uom: string; rows: number; values: number[] }>();
  for (const row of rows) {
    const itemNo = normalizeAliasDisplay(row.Item_No);
    const uom = normalizeAliasDisplay(row.Unit_of_Measure_Code);
    const gross = numberOrNull(row.Gross_Weight);
    if (!itemNo || gross === null || gross <= 0) continue;
    const key = `${itemNo}|${uom}`;
    const current = groups.get(key) ?? { itemNo, uom, rows: 0, values: [] };
    current.rows += 1;
    current.values.push(gross);
    groups.set(key, current);
  }

  const conversions: V1ConversionPlan[] = [];
  const conflicts: V1Conflict[] = [];
  for (const group of groups.values()) {
    const min = Math.min(...group.values);
    const max = Math.max(...group.values);
    if (max - min > 0.000001) {
      conflicts.push({
        kind: "conversion-conflict",
        sourceValue: `${group.itemNo}|${group.uom}`,
        details: `gross weight values range from ${min} to ${max}`
      });
      continue;
    }
    conversions.push({
      itemNo: group.itemNo,
      uom: group.uom,
      grossWeightPerPcs: group.values[0]!,
      evidenceRows: group.rows
    });
  }
  return {
    conversions: conversions.sort((left, right) => right.evidenceRows - left.evidenceRows || left.itemNo.localeCompare(right.itemNo)),
    conflicts,
    rawRows: rows.length
  };
}

export function buildV1ImportPlan(input: {
  readonly masterTargetCsvText: string;
  readonly machineCsvText?: string;
  readonly itemLedgerCsvText?: string;
}): V1ImportPlan {
  const masterRows = parseMasterRows(input.masterTargetCsvText);
  const grouped = new Map<string, V1MasterCsvRow[]>();
  for (const row of masterRows) {
    const key = masterGroupKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const baseCodeCounts = new Map<string, number>();
  for (const rows of grouped.values()) {
    const canonical = preferCanonicalRow(rows);
    baseCodeCounts.set(canonical.code, (baseCodeCounts.get(canonical.code) ?? 0) + 1);
  }

  const entities: V1MasterEntityPlan[] = [];
  const sourceCodeToEntities = new Map<string, V1MasterEntityPlan[]>();
  for (const [importKey, rows] of grouped.entries()) {
    const canonical = preferCanonicalRow(rows);
    const duplicateBaseCode = (baseCodeCounts.get(canonical.code) ?? 0) > 1;
    const sourceCodes = [...new Set(rows.map((row) => row.code))].sort();
    const entity: V1MasterEntityPlan = {
      importKey,
      entityCode: entityCodeFor(canonical, duplicateBaseCode),
      displayName: displayNameFor(canonical, duplicateBaseCode),
      area: canonical.area,
      lineCode: canonical.code,
      productFamily: canonicalProductDescription(canonical.description),
      reportGroup: canonical.display,
      targetType: canonical.targetType,
      targetLabel: V1_TARGET_TYPE_LABELS[canonical.targetType] ?? canonical.targetType,
      dailyTargetQty: canonical.targetQty,
      minAchievementPct: canonical.minAchievementPct,
      rejectTargetPct: canonical.rejectTargetPct,
      sourceCodes,
      sourceRows: rows.length
    };
    entities.push(entity);
    for (const sourceCode of sourceCodes) {
      const key = normalizeKey(sourceCode);
      sourceCodeToEntities.set(key, [...(sourceCodeToEntities.get(key) ?? []), entity]);
    }
  }

  const conflicts: V1Conflict[] = [];
  const aliases: V1AliasPlan[] = [];
  for (const [sourceCodeKey, mappedEntities] of sourceCodeToEntities.entries()) {
    if (mappedEntities.length !== 1) {
      conflicts.push({
        kind: "source-code-ambiguous",
        sourceField: "prod_line_description",
        sourceValue: mappedEntities[0]?.sourceCodes.find((code) => normalizeKey(code) === sourceCodeKey) ?? sourceCodeKey,
        entityCodes: mappedEntities.map((entity) => entity.entityCode).sort()
      });
      continue;
    }
    const entity = mappedEntities[0]!;
    const sourceCode = entity.sourceCodes.find((code) => normalizeKey(code) === sourceCodeKey) ?? entity.lineCode;
    aliases.push({
      entityImportKey: entity.importKey,
      entityCode: entity.entityCode,
      sourceField: "prod_line_description",
      alias: sourceCode,
      aliasNormalized: sourceCodeKey,
      source: "v1-master-target",
      evidenceRows: entity.sourceRows,
      evidenceQuantity: 0
    });
  }

  const itemRows = input.itemLedgerCsvText ? parseCsv(input.itemLedgerCsvText).rows : [];
  const machineBuckets = new Map<string, EvidenceBucket>();
  const prodLineNoBuckets = new Map<string, EvidenceBucket>();
  for (const row of itemRows) {
    const lineDescription = normalizeAliasDisplay(row.gProdOrRotLine_Description);
    const mappedEntities = sourceCodeToEntities.get(normalizeKey(lineDescription));
    if (!mappedEntities || mappedEntities.length !== 1) continue;
    const entity = mappedEntities[0]!;
    const quantity = quantityFromRow(row);
    addBucket(machineBuckets, row.Machine_Center_No ?? "", entity, quantity);
    addBucket(prodLineNoBuckets, row.gProdOrRotLine_No ?? "", entity, quantity);
  }
  addEvidenceAliases(aliases, conflicts, machineBuckets, "machine_center_no", "v1-machine-evidence");
  addEvidenceAliases(aliases, conflicts, prodLineNoBuckets, "prod_line_no", "v1-prod-line-evidence");

  const machineRows = input.machineCsvText ? parseCsv(input.machineCsvText).rows.length : 0;
  const conversionResult = buildConversions(input.itemLedgerCsvText);
  const allConflicts = [...conflicts, ...conversionResult.conflicts];
  const finalAliases = dedupeAliases(aliases, allConflicts);
  const targets = entities.map((entity): V1TargetPlan => ({
    entityImportKey: entity.importKey,
    entityCode: entity.entityCode,
    targetVersion: 1,
    dailyTargetQty: entity.dailyTargetQty,
    rejectTargetPct: entity.rejectTargetPct,
    minAchievementPct: entity.minAchievementPct,
    maxAchievementPct: 110,
    sourceTargetType: entity.targetType
  }));

  return {
    entities: entities.sort((left, right) => left.entityCode.localeCompare(right.entityCode)),
    aliases: finalAliases,
    targets: targets.sort((left, right) => left.entityCode.localeCompare(right.entityCode)),
    conversions: conversionResult.conversions,
    conflicts: allConflicts,
    stats: {
      rawMasterRows: masterRows.length,
      rawMachineRows: machineRows,
      rawItemLedgerRows: conversionResult.rawRows,
      uniqueSourceCodes: sourceCodeToEntities.size,
      targetRows: targets.length,
      ambiguousSourceCodes: allConflicts.filter((conflict) => conflict.kind === "source-code-ambiguous").length,
      ambiguousMachineAliases: allConflicts.filter((conflict) => conflict.kind === "machine-alias-ambiguous").length,
      ambiguousProdLineAliases: allConflicts.filter((conflict) => conflict.kind === "prod-line-alias-ambiguous").length,
      conversionConflicts: allConflicts.filter((conflict) => conflict.kind === "conversion-conflict").length
    }
  };
}

export function estimateV1Reconcile(
  plan: Pick<V1ImportPlan, "aliases">,
  rows: readonly V1OutputSourceRow[],
  limit = 15
): V1ReconcileEstimate {
  const aliasesByField = new Map<string, V1AliasPlan>();
  for (const alias of plan.aliases) aliasesByField.set(`${alias.sourceField}|${alias.aliasNormalized}`, alias);

  const matchedIds = new Set<string>();
  const conflictIds = new Set<string>();
  const topMatches = new Map<string, {
    sourceField: MasterSourceField;
    sourceValue: string;
    entityCode: string;
    rows: number;
    okQty: number;
  }>();
  const remainingGroups = new Map<string, {
    sourceField: MasterSourceField;
    sourceValue: string;
    rows: number;
    okQty: number;
  }>();
  let matchedOkRows = 0;
  let matchedOkQty = 0;

  for (const row of rows) {
    if (row.entityId) continue;
    const candidates = sourceAliasCandidates(row);
    const matches = candidates.flatMap((candidate) => {
      const alias = aliasesByField.get(`${candidate.sourceField}|${candidate.normalizedValue}`);
      return alias ? [{ candidate, alias }] : [];
    });
    const entityKeys = new Set(matches.map((match) => match.alias.entityImportKey));
    const isOk = row.normalizedOutputType === "OK" && (row.quantity ?? 0) > 0;
    const qty = isOk ? row.quantity ?? 0 : 0;
    if (entityKeys.size === 1 && matches[0]) {
      matchedIds.add(row.id);
      if (isOk) {
        matchedOkRows += 1;
        matchedOkQty += qty;
      }
      const first = matches
        .slice()
        .sort((left, right) => SOURCE_FIELD_PRIORITY.indexOf(left.candidate.sourceField) - SOURCE_FIELD_PRIORITY.indexOf(right.candidate.sourceField))[0]!;
      const key = `${first.candidate.sourceField}|${first.candidate.normalizedValue}|${first.alias.entityCode}`;
      const current = topMatches.get(key) ?? {
        sourceField: first.candidate.sourceField,
        sourceValue: first.candidate.sourceValue,
        entityCode: first.alias.entityCode,
        rows: 0,
        okQty: 0
      };
      current.rows += 1;
      current.okQty += qty;
      topMatches.set(key, current);
    } else {
      if (entityKeys.size > 1) conflictIds.add(row.id);
      const entityCandidates = candidates.filter(
        (candidate) => candidate.sourceField === "machine_description" ||
          candidate.sourceField === "machine_center_no" ||
          candidate.sourceField === "prod_line_description" ||
          candidate.sourceField === "prod_line_no"
      );
      const first = entityCandidates.find((candidate) => candidate.sourceField === "machine_description")
        ?? entityCandidates.find((candidate) => candidate.sourceField === "machine_center_no")
        ?? entityCandidates[0];
      if (!first) continue;
      const key = `${first.sourceField}|${first.normalizedValue}`;
      const current = remainingGroups.get(key) ?? {
        sourceField: first.sourceField,
        sourceValue: first.sourceValue,
        rows: 0,
        okQty: 0
      };
      current.rows += 1;
      current.okQty += qty;
      remainingGroups.set(key, current);
    }
  }

  return {
    matchedRows: matchedIds.size,
    matchedOkRows,
    matchedOkQty,
    conflictRows: conflictIds.size,
    remainingUnmappedRows: rows.filter((row) => !row.entityId).length - matchedIds.size,
    topMatches: [...topMatches.values()].sort((left, right) => right.okQty - left.okQty || right.rows - left.rows).slice(0, limit),
    remainingGroups: [...remainingGroups.values()].sort((left, right) => right.okQty - left.okQty || right.rows - left.rows).slice(0, limit)
  };
}
