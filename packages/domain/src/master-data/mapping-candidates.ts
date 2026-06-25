import { legacyMachineFamilyKey, normalizeAliasDisplay, normalizeAliasKey, type MasterSourceField } from "./alias.js";

export type MappingConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface CandidateEntityInput {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly aliasValues?: readonly string[] | null | undefined;
  readonly targetExists?: boolean | undefined;
  readonly lineCode?: string | null | undefined;
  readonly productFamily?: string | null | undefined;
  readonly reportGroup?: string | null | undefined;
}

export interface MappingSuggestion {
  readonly entityId: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly confidence: MappingConfidence;
  readonly score: number;
  readonly reason: string;
  readonly targetExists: boolean;
}

export interface MappingPlanGroupInput {
  readonly sourceSystem: string;
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly rowCount: number;
  readonly okQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly suggestions: readonly MappingSuggestion[];
}

export interface MappingPlanRow {
  readonly source_system: string;
  readonly source_field: MasterSourceField;
  readonly source_value: string;
  readonly source_value_normalized: string;
  readonly row_count: number;
  readonly ok_qty: number;
  readonly first_posting_date: string;
  readonly last_posting_date: string;
  readonly suggested_entity_id: string;
  readonly suggested_entity_code: string;
  readonly suggested_entity_name: string;
  readonly confidence: MappingConfidence | "";
  readonly reason: string;
  readonly target_exists: "TRUE" | "FALSE" | "";
  readonly action: "REVIEW" | "COMMIT" | "SKIP";
  readonly review_note: string;
}

export const mappingPlanHeaders = [
  "source_system",
  "source_field",
  "source_value",
  "source_value_normalized",
  "row_count",
  "ok_qty",
  "first_posting_date",
  "last_posting_date",
  "suggested_entity_id",
  "suggested_entity_code",
  "suggested_entity_name",
  "confidence",
  "reason",
  "target_exists",
  "action",
  "review_note"
] as const satisfies readonly (keyof MappingPlanRow)[];

export const mappingPlanSourceFields = [
  "machine_description",
  "machine_center_no",
  "prod_line_description",
  "prod_line_no"
] as const satisfies readonly MasterSourceField[];

const familyTokens = ["ILLIG", "NEWDO", "HENGFENG", "OMSO", "VFINE", "LONGSUN", "BORCHE", "CHUMPOWER", "POLYPRINT"] as const;
const weakContextTokens = new Set(["OZ", "REG", "LINE", "MESIN", "MACHINE", "CENTER", "NO"]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function tokenizeAliasValue(value: string | null | undefined): readonly string[] {
  const display = normalizeAliasDisplay(value).replace(/[^A-Z0-9]+/g, " ");
  const compact = normalizeAliasKey(value);
  if (!display && !compact) return [];

  const tokens = display
    .split(/\s+/)
    .flatMap((part) => part.match(/[A-Z]+|\d+/g) ?? []);
  const family = legacyMachineFamilyKey(value);
  const families = familyTokens.filter((token) => compact.includes(token) || family === token);
  return unique([...families, ...tokens]);
}

function tokenWeight(token: string): number {
  if (familyTokens.includes(token as (typeof familyTokens)[number])) return 4;
  if (/^\d+$/.test(token)) return 2;
  if (weakContextTokens.has(token)) return 1;
  return 2;
}

function entityValues(entity: CandidateEntityInput): readonly string[] {
  return [
    entity.entityCode,
    entity.displayName,
    ...(entity.aliasValues ?? []),
    entity.lineCode ?? "",
    entity.productFamily ?? "",
    entity.reportGroup ?? ""
  ].filter(Boolean);
}

function bestTokenOverlap(sourceTokens: readonly string[], entity: CandidateEntityInput) {
  let bestOverlap = 0;
  let bestTotal = 0;
  let bestValue = "";
  for (const value of entityValues(entity)) {
    const targetTokens = new Set(tokenizeAliasValue(value));
    const total = sourceTokens.reduce((sum, token) => sum + tokenWeight(token), 0);
    const overlap = sourceTokens.reduce((sum, token) => sum + (targetTokens.has(token) ? tokenWeight(token) : 0), 0);
    if (overlap > bestOverlap || (overlap === bestOverlap && total > bestTotal)) {
      bestOverlap = overlap;
      bestTotal = total;
      bestValue = value;
    }
  }
  return { overlap: bestOverlap, total: bestTotal, bestValue };
}

function bestNormalizedMatch(sourceKey: string, entity: CandidateEntityInput) {
  let exact = false;
  let containment = false;
  let exactValue = "";
  let containmentValue = "";
  for (const value of entityValues(entity)) {
    const key = normalizeAliasKey(value);
    if (!key) continue;
    if (key === sourceKey) {
      exact = true;
      exactValue = value;
      break;
    }
    if (sourceKey.includes(key) || key.includes(sourceKey)) {
      containment = true;
      containmentValue = value;
    }
  }
  return { exact, exactValue, containment, containmentValue };
}

export function suggestMappingCandidates(
  sourceValue: string | null | undefined,
  entities: readonly CandidateEntityInput[],
  options: { readonly limit?: number | undefined } = {}
): readonly MappingSuggestion[] {
  const sourceDisplay = normalizeAliasDisplay(sourceValue);
  const sourceKey = normalizeAliasKey(sourceDisplay);
  const limit = options.limit ?? 5;
  if (!sourceKey) return [];

  const sourceTokens = tokenizeAliasValue(sourceDisplay);
  const exactMatches = entities.flatMap((entity): MappingSuggestion[] => {
    const normalized = bestNormalizedMatch(sourceKey, entity);
    return normalized.exact
      ? [{
          entityId: entity.entityId,
          entityCode: entity.entityCode,
          displayName: entity.displayName,
          confidence: "HIGH",
          score: 100,
          reason: `Exact normalized match on ${normalizeAliasDisplay(normalized.exactValue)}`,
          targetExists: entity.targetExists ?? false
        }]
      : [];
  });
  if (exactMatches.length === 1) return exactMatches;
  if (exactMatches.length > 1) {
    return exactMatches
      .map((match) => ({ ...match, confidence: "LOW" as const, score: 55, reason: "Ambiguous exact normalized match across multiple entities" }))
      .slice(0, limit);
  }

  const scored = entities.flatMap((entity): MappingSuggestion[] => {
    const normalized = bestNormalizedMatch(sourceKey, entity);
    const overlap = bestTokenOverlap(sourceTokens, entity);
    const ratio = overlap.total > 0 ? overlap.overlap / overlap.total : 0;
    const family = legacyMachineFamilyKey(sourceDisplay);
    const entityFamilyHit = family && entityValues(entity).some((value) => legacyMachineFamilyKey(value) === family || normalizeAliasKey(value).includes(family));

    if (normalized.containment) {
      return [{
        entityId: entity.entityId,
        entityCode: entity.entityCode,
        displayName: entity.displayName,
        confidence: "MEDIUM",
        score: 88,
        reason: `Strong normalized containment with ${normalizeAliasDisplay(normalized.containmentValue)}`,
        targetExists: entity.targetExists ?? false
      }];
    }

    if (overlap.overlap <= 0) return [];
    const score = Math.min(85, Math.max(30, Math.round(35 + ratio * 50 + (entityFamilyHit ? 10 : 0))));
    const confidence: MappingConfidence = ratio >= 0.72 && entityFamilyHit ? "MEDIUM" : "LOW";
    return [{
      entityId: entity.entityId,
      entityCode: entity.entityCode,
      displayName: entity.displayName,
      confidence,
      score,
      reason: confidence === "MEDIUM"
        ? `Shared machine-family tokens with ${normalizeAliasDisplay(overlap.bestValue)}`
        : `Weak token overlap with ${normalizeAliasDisplay(overlap.bestValue)}`,
      targetExists: entity.targetExists ?? false
    }];
  }).sort((a, b) => b.score - a.score || a.entityCode.localeCompare(b.entityCode));

  const topScore = scored[0]?.score ?? 0;
  const tiedTop = scored.filter((candidate) => candidate.score === topScore);
  if (tiedTop.length > 1 && topScore >= 60) {
    return scored
      .slice(0, limit)
      .map((candidate) => ({
        ...candidate,
        confidence: "LOW" as const,
        score: Math.min(candidate.score, 60),
        reason: `Ambiguous candidate: ${candidate.reason}`
      }));
  }
  return scored.slice(0, limit);
}

export function buildMappingPlanRows(groups: readonly MappingPlanGroupInput[]): readonly MappingPlanRow[] {
  return groups.map((group) => {
    const suggestion = group.suggestions[0];
    return {
      source_system: group.sourceSystem,
      source_field: group.sourceField,
      source_value: normalizeAliasDisplay(group.sourceValue),
      source_value_normalized: normalizeAliasKey(group.sourceValue),
      row_count: group.rowCount,
      ok_qty: group.okQty,
      first_posting_date: group.firstPostingDate ?? "",
      last_posting_date: group.lastPostingDate ?? "",
      suggested_entity_id: suggestion?.entityId ?? "",
      suggested_entity_code: suggestion?.entityCode ?? "",
      suggested_entity_name: suggestion?.displayName ?? "",
      confidence: suggestion?.confidence ?? "",
      reason: suggestion?.reason ?? "",
      target_exists: suggestion ? (suggestion.targetExists ? "TRUE" : "FALSE") : "",
      action: "REVIEW",
      review_note: ""
    };
  });
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

export function mappingPlanRowsToCsv(rows: readonly MappingPlanRow[]): string {
  const lines = [
    mappingPlanHeaders.join(","),
    ...rows.map((row) => mappingPlanHeaders.map((header) => csvEscape(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function parseCsvLine(line: string): readonly string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseMappingPlanCsv(csv: string): readonly MappingPlanRow[] {
  const lines = csv.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0] ?? "");
  for (const expected of mappingPlanHeaders) {
    if (!headers.includes(expected)) throw new Error(`Mapping plan CSV is missing ${expected}`);
  }
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as Record<keyof MappingPlanRow, string>;
    return {
      source_system: record.source_system,
      source_field: record.source_field as MasterSourceField,
      source_value: record.source_value,
      source_value_normalized: record.source_value_normalized,
      row_count: Number(record.row_count || 0),
      ok_qty: Number(record.ok_qty || 0),
      first_posting_date: record.first_posting_date,
      last_posting_date: record.last_posting_date,
      suggested_entity_id: record.suggested_entity_id,
      suggested_entity_code: record.suggested_entity_code,
      suggested_entity_name: record.suggested_entity_name,
      confidence: record.confidence as MappingConfidence | "",
      reason: record.reason,
      target_exists: record.target_exists as MappingPlanRow["target_exists"],
      action: (record.action || "REVIEW").toUpperCase() as MappingPlanRow["action"],
      review_note: record.review_note
    };
  });
}

export function containsMappingSecretLikeText(value: string): boolean {
  return /\b(?:authorization|bearer\s+[a-z0-9._~+/-]+|basic\s+[a-z0-9+/=]+)\b|(?:password|passwd|secret|cookie|token|api[_-]?key)\s*[:=]/i.test(value);
}
