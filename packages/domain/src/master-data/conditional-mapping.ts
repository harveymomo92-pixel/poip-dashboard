import { inferResumeTargetBucket, type ResumeTargetBucket } from "../kpi/target-bucket.js";
import { normalizeAliasDisplay, normalizeAliasKey, type MasterSourceField } from "./alias.js";

export type ConditionalMappingConditionType =
  | "inferred_target_bucket"
  | "item_category_code"
  | "item_no_pattern"
  | "item_description_pattern"
  | "gross_weight_range";

export interface ConditionalMappingRowInput {
  readonly entityCode?: string | null;
  readonly entityDisplayName?: string | null;
  readonly machineLabel?: string | null;
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly grossWeightPerPcs?: number | null;
}

export interface ConditionalMappingRuleInput {
  readonly id?: string | undefined;
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly sourceValueNormalized?: string | null | undefined;
  readonly conditionType: ConditionalMappingConditionType;
  readonly conditionValue: string;
  readonly entityId: string;
}

export interface ConditionalMappingResolution {
  readonly status: "none" | "matched" | "conflict";
  readonly entityId: string | null;
  readonly matchingRules: readonly ConditionalMappingRuleInput[];
  readonly reason: string;
}

interface GrossWeightRange {
  readonly min: number | null;
  readonly max: number | null;
  readonly includeMin: boolean;
  readonly includeMax: boolean;
}

const bucketValues = new Set<ResumeTargetBucket>([
  "target_botol_preform",
  "target_thermoforming",
  "target_thermoforming_gw_gt_12",
  "target_printing_non_oz",
  "target_printing_oz_lt_20",
  "target_printing_22_oz"
]);

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalizedText(value: string | null | undefined): string {
  return normalizeAliasDisplay(value);
}

function conditionKey(value: string | null | undefined): string {
  return normalizeAliasKey(value);
}

function patternMatches(value: string | null | undefined, pattern: string): boolean {
  const text = normalizedText(value);
  const cleanPattern = normalizedText(pattern);
  if (!text || !cleanPattern) return false;
  if (!/[%*_]/.test(cleanPattern)) return text.includes(cleanPattern);
  const escaped = cleanPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[%*]/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(text);
}

export function normalizeConditionalMappingConditionValue(
  conditionType: ConditionalMappingConditionType,
  conditionValue: string
): string {
  const value = clean(conditionValue);
  if (conditionType === "gross_weight_range") {
    const range = parseGrossWeightRange(value);
    if (!range) return value;
    const min = range.min === null ? "" : String(range.min);
    const max = range.max === null ? "" : String(range.max);
    return `${range.includeMin ? "[" : "("}${min}..${max}${range.includeMax ? "]" : ")"}`;
  }
  if (conditionType === "inferred_target_bucket") return value.toLowerCase();
  if (conditionType === "item_no_pattern" || conditionType === "item_description_pattern") return normalizedText(value);
  return conditionKey(value);
}

export function isSupportedConditionalMappingConditionType(value: string): value is ConditionalMappingConditionType {
  return [
    "inferred_target_bucket",
    "item_category_code",
    "item_no_pattern",
    "item_description_pattern",
    "gross_weight_range"
  ].includes(value);
}

export function conditionalMappingRuleMatches(
  row: ConditionalMappingRowInput,
  rule: Pick<ConditionalMappingRuleInput, "conditionType" | "conditionValue">
): boolean {
  const value = clean(rule.conditionValue);
  if (!value) return false;

  if (rule.conditionType === "inferred_target_bucket") {
    const bucket = value.toLowerCase() as ResumeTargetBucket;
    if (!bucketValues.has(bucket)) return false;
    if (!printingBucketHasItemEvidence(row, bucket)) return false;
    return inferResumeTargetBucket(row).bucket === bucket;
  }

  if (rule.conditionType === "item_category_code") {
    return conditionKey(row.itemCategoryCode) === conditionKey(value);
  }

  if (rule.conditionType === "item_no_pattern") {
    return patternMatches(row.itemNo, value);
  }

  if (rule.conditionType === "item_description_pattern") {
    return patternMatches(row.itemDescription, value);
  }

  const range = parseGrossWeightRange(value);
  if (!range) return false;
  const grossWeight = row.grossWeightPerPcs;
  if (grossWeight === null || typeof grossWeight === "undefined" || !Number.isFinite(grossWeight)) return false;
  const minOk = range.min === null || (range.includeMin ? grossWeight >= range.min : grossWeight > range.min);
  const maxOk = range.max === null || (range.includeMax ? grossWeight <= range.max : grossWeight < range.max);
  return minOk && maxOk;
}

export function matchingConditionalMappingRules(
  row: ConditionalMappingRowInput,
  rules: readonly ConditionalMappingRuleInput[]
): readonly ConditionalMappingRuleInput[] {
  return rules.filter((rule) => {
    const sourceValue = valueForSourceField(row, rule.sourceField);
    if (!sourceValue) return false;
    if (normalizeAliasKey(sourceValue) !== (rule.sourceValueNormalized ?? normalizeAliasKey(rule.sourceValue))) return false;
    return conditionalMappingRuleMatches(row, rule);
  });
}

export function resolveConditionalMapping(
  row: ConditionalMappingRowInput,
  rules: readonly ConditionalMappingRuleInput[]
): ConditionalMappingResolution {
  const matchingRules = matchingConditionalMappingRules(row, rules);
  if (matchingRules.length === 0) {
    return {
      status: "none",
      entityId: null,
      matchingRules,
      reason: "No reviewed conditional mapping rule matched"
    };
  }
  if (matchingRules.length > 1) {
    return {
      status: "conflict",
      entityId: null,
      matchingRules,
      reason: "Multiple reviewed conditional mapping rules matched"
    };
  }
  return {
    status: "matched",
    entityId: matchingRules[0]?.entityId ?? null,
    matchingRules,
    reason: "Exactly one reviewed conditional mapping rule matched"
  };
}

export function reviewedAliasMatches(
  row: ConditionalMappingRowInput,
  sourceField: MasterSourceField,
  sourceValue: string,
  sourceValueNormalized?: string | null | undefined
): boolean {
  const value = valueForSourceField(row, sourceField);
  if (!value) return false;
  const display = normalizeAliasDisplay(value);
  const normalized = normalizeAliasKey(value);
  return display === normalizeAliasDisplay(sourceValue) || normalized === (sourceValueNormalized ?? normalizeAliasKey(sourceValue));
}

export function valueForSourceField(
  row: ConditionalMappingRowInput,
  sourceField: MasterSourceField
): string | null {
  if (sourceField === "machine_description") return row.machineDescription ?? null;
  if (sourceField === "machine_center_no") return row.machineCenterNo ?? null;
  if (sourceField === "prod_line_description") return row.prodLineDescription ?? null;
  if (sourceField === "prod_line_no") return row.prodLineNo ?? null;
  if (sourceField === "item_no") return row.itemNo ?? null;
  if (sourceField === "uom") return null;
  return null;
}

function parseGrossWeightRange(value: string): GrossWeightRange | null {
  const text = clean(value).replace(/\s+/g, "");
  if (!text) return null;

  const comparison = text.match(/^(<=|<|>=|>)(\d+(?:[.,]\d+)?)$/);
  if (comparison?.[1] && comparison[2]) {
    const amount = numberFromText(comparison[2]);
    if (amount === null) return null;
    if (comparison[1] === "<") return { min: null, max: amount, includeMin: true, includeMax: false };
    if (comparison[1] === "<=") return { min: null, max: amount, includeMin: true, includeMax: true };
    if (comparison[1] === ">") return { min: amount, max: null, includeMin: false, includeMax: true };
    return { min: amount, max: null, includeMin: true, includeMax: true };
  }

  const bracketed = text.match(/^(\(|\[)?(\d+(?:[.,]\d+)?)?\.\.(\d+(?:[.,]\d+)?)?(\)|\])?$/);
  if (bracketed) {
    const min = bracketed[2] ? numberFromText(bracketed[2]) : null;
    const max = bracketed[3] ? numberFromText(bracketed[3]) : null;
    if (min === null && max === null) return null;
    return {
      min,
      max,
      includeMin: bracketed[1] !== "(",
      includeMax: bracketed[4] !== ")"
    };
  }

  const dash = text.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/);
  if (dash?.[1] && dash[2]) {
    const min = numberFromText(dash[1]);
    const max = numberFromText(dash[2]);
    if (min === null || max === null) return null;
    return { min, max, includeMin: true, includeMax: true };
  }

  return null;
}

function numberFromText(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function printingBucketHasItemEvidence(row: ConditionalMappingRowInput, bucket: ResumeTargetBucket): boolean {
  if (!bucket.startsWith("target_printing_")) return true;
  const itemText = normalizedText([row.itemNo, row.itemDescription, row.itemCategoryCode].filter(Boolean).join(" "));
  if (bucket === "target_printing_22_oz") return /\b22\s*OZ\b/.test(itemText);
  if (bucket === "target_printing_oz_lt_20") return /\b(?:1[0-9]|[1-9])\s*OZ\b/.test(itemText) && !/\b22\s*OZ\b/.test(itemText);
  return /\b(PRINT|PRINTING|PRT|PRIN|SABLON)\b/.test(itemText) && !/\b\d+(?:[.,]\d+)?\s*OZ\b/.test(itemText);
}
