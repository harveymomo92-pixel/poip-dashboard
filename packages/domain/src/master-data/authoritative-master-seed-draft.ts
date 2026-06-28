import type {
  AuthoritativeNormalizedCanonicalEntityRow,
  AuthoritativeNormalizedSourceMapRow,
  AuthoritativeNormalizedTargetProfileRow
} from "./authoritative-master-intake.js";

export interface AuthoritativeSeedEvidenceRow {
  readonly source_field?: string;
  readonly source_value?: string;
  readonly current_entity_code?: string;
  readonly v2_entity_code?: string;
  readonly suggested_canonical_entity_code?: string;
  readonly suggested_canonical_entity_display_name?: string;
  readonly target_bucket_candidate?: string;
  readonly machine_center_no?: string;
  readonly document_no?: string;
  readonly item_no?: string;
  readonly bc_current_kpi_scope?: string;
  readonly review_classification?: string;
  readonly risk_level?: string;
}

export interface AuthoritativeTargetProfileSeedEvidenceRow {
  readonly canonical_entity_code?: string;
  readonly target_bucket?: string;
  readonly machine_center_no?: string;
  readonly target_qty?: string | number;
  readonly unit?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
  readonly rows?: string | number;
  readonly risk_level?: string;
}

export interface AuthoritativeSeedReviewQueueRow {
  readonly review_id: string;
  readonly review_category: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly rows: number;
  readonly review_reason: string;
  readonly recommended_action: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeLegacyEvidenceCrosswalkRow {
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly legacy_current_entity_codes: string;
  readonly v2_entity_codes: string;
  readonly target_bucket_candidates: string;
  readonly machine_center_nos: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly evidence_reason: string;
  readonly review_required: "true" | "false";
}

export interface AuthoritativeExcludedSourceValueRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly rows: number;
  readonly exclusion_reason: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeSeedQualityWarningRow {
  readonly warning_id: string;
  readonly warning_category: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly warning_reason: string;
  readonly recommended_action: string;
}

export interface AuthoritativeMasterSeedDraftSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly inputFolder: string;
  readonly wroteWorkingInputFiles: boolean;
  readonly wroteDraftFilesOnly: boolean;
  readonly canonicalSeedRows: number;
  readonly sourceMapSeedRows: number;
  readonly targetProfileSeedRows: number;
  readonly reviewQueueRows: number;
  readonly legacyEvidenceRows: number;
  readonly excludedSourceValueRows: number;
  readonly warningRows: number;
  readonly topGeneratedFamilies: readonly { readonly family: string; readonly rows: number }[];
  readonly topReviewReasons: readonly { readonly reason: string; readonly rows: number }[];
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly dashboardChanged: false;
    readonly p10Enabled: false;
    readonly generatedRowsApproved: false;
    readonly masterDataApplied: false;
  };
}

export interface AuthoritativeSeedWriteDecision {
  readonly writeWorkingInputFiles: boolean;
  readonly writeDraftFilesOnly: boolean;
}

interface SourceGroup {
  sourceField: string;
  sourceValue: string;
  rows: number;
  currentEntities: Set<string>;
  v2Entities: Set<string>;
  suggestedEntities: Set<string>;
  targetBuckets: Set<string>;
  machineCenters: Set<string>;
  scopes: Set<string>;
  classifications: Set<string>;
  riskLevels: Set<string>;
  sampleDocuments: Set<string>;
  sampleItems: Set<string>;
}

const protectedBroadSources = new Set(["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"]);

export function decideAuthoritativeSeedWriteTarget(input: {
  readonly canonicalInputHasData: boolean;
  readonly sourceMapInputHasData: boolean;
  readonly targetProfilesInputHasData: boolean;
  readonly forceWrite?: boolean;
}): AuthoritativeSeedWriteDecision {
  const anyExistingData = input.canonicalInputHasData || input.sourceMapInputHasData || input.targetProfilesInputHasData;
  return {
    writeWorkingInputFiles: Boolean(input.forceWrite) || !anyExistingData,
    writeDraftFilesOnly: anyExistingData && !input.forceWrite
  };
}

export function buildAuthoritativeMasterSeedDraft(input: {
  readonly entityEvidenceRows: readonly AuthoritativeSeedEvidenceRow[];
  readonly targetProfileEvidenceRows: readonly AuthoritativeTargetProfileSeedEvidenceRow[];
  readonly generatedAt?: string;
  readonly outputFolder: string;
  readonly inputFolder: string;
  readonly writeDecision?: AuthoritativeSeedWriteDecision;
}): {
  readonly summary: AuthoritativeMasterSeedDraftSummary;
  readonly canonicalSeedRows: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  readonly sourceMapSeedRows: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly targetProfileSeedRows: readonly AuthoritativeNormalizedTargetProfileRow[];
  readonly seedReviewQueueRows: readonly AuthoritativeSeedReviewQueueRow[];
  readonly legacyEvidenceCrosswalkRows: readonly AuthoritativeLegacyEvidenceCrosswalkRow[];
  readonly excludedSourceValueRows: readonly AuthoritativeExcludedSourceValueRow[];
  readonly seedQualityWarningRows: readonly AuthoritativeSeedQualityWarningRow[];
} {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const groups = groupEntityEvidence(input.entityEvidenceRows);
  const canonicalRows: AuthoritativeNormalizedCanonicalEntityRow[] = [];
  const sourceMapRows: AuthoritativeNormalizedSourceMapRow[] = [];
  const reviewRows: AuthoritativeSeedReviewQueueRow[] = [];
  const excludedRows: AuthoritativeExcludedSourceValueRow[] = [];
  const crosswalkRows: AuthoritativeLegacyEvidenceCrosswalkRow[] = [];
  const warnings: AuthoritativeSeedQualityWarningRow[] = [];
  const canonicalCodes = new Set<string>();

  for (const group of groups) {
    const exclusionReason = exclusionReasonForGroup(group);
    const proposedCanonical = proposedCanonicalForGroup(group);
    const reviewReason = reviewReasonForGroup(group);
    crosswalkRows.push({
      source_value: group.sourceValue || "(blank)",
      proposed_canonical_entity_code: proposedCanonical,
      legacy_current_entity_codes: joinSet(group.currentEntities),
      v2_entity_codes: joinSet(group.v2Entities),
      target_bucket_candidates: joinSet(group.targetBuckets),
      machine_center_nos: joinSet(group.machineCenters),
      sample_documents: joinSet(group.sampleDocuments, 5),
      sample_items: joinSet(group.sampleItems, 5),
      evidence_reason: reviewReason || "Exact reviewed OData source value seed candidate.",
      review_required: reviewReason ? "true" : "false"
    });

    if (exclusionReason) {
      excludedRows.push({
        source_field: group.sourceField || "(blank)",
        source_value: group.sourceValue || "(blank)",
        rows: group.rows,
        exclusion_reason: exclusionReason,
        sample_documents: joinSet(group.sampleDocuments, 5),
        sample_items: joinSet(group.sampleItems, 5)
      });
      reviewRows.push(reviewRow(reviewRows.length + 1, "SOURCE_REVIEW", group, proposedCanonical, exclusionReason));
      continue;
    }

    if (!canonicalCodes.has(normalizeKey(proposedCanonical))) {
      canonicalRows.push({
        canonical_entity_code: proposedCanonical,
        canonical_entity_display_name: displayNameForCanonical(proposedCanonical),
        entity_family: inferFamily(proposedCanonical),
        entity_type: inferEntityType(proposedCanonical),
        production_area: inferProductionArea(proposedCanonical),
        is_active: "true",
        source_of_truth_status: "draft",
        reviewer: "",
        reviewer_notes: "Generated draft from Business Central OData/report evidence; requires business review.",
        effective_from: "",
        effective_to: ""
      });
      canonicalCodes.add(normalizeKey(proposedCanonical));
    }

    sourceMapRows.push({
      source_system: "business-central",
      source_field: group.sourceField,
      source_value: group.sourceValue,
      canonical_entity_code: proposedCanonical,
      mapping_type: "EXACT_SOURCE_VALUE",
      confidence: reviewReason ? "MEDIUM" : "HIGH",
      is_active: "true",
      reviewer: "",
      reviewer_notes: "Generated draft exact source mapping from Business Central evidence; requires business review.",
      effective_from: "",
      effective_to: ""
    });

    if (reviewReason) {
      reviewRows.push(reviewRow(reviewRows.length + 1, "MAPPING_REVIEW", group, proposedCanonical, reviewReason));
      warnings.push(warning(warnings.length + 1, "SOURCE_MAPPING_REVIEW_REQUIRED", group.sourceValue, proposedCanonical, reviewReason));
    }
  }

  const targetProfileRows: AuthoritativeNormalizedTargetProfileRow[] = [];
  const targetProfileKeys = new Set<string>();
  for (const row of input.targetProfileEvidenceRows) {
    const canonical = clean(row.canonical_entity_code);
    if (!canonicalCodes.has(normalizeKey(canonical))) continue;
    const targetBucket = clean(row.target_bucket);
    const machineCenterNo = clean(row.machine_center_no);
    const key = [normalizeKey(canonical), normalizeKey(targetBucket), normalizeKey(machineCenterNo)].join("|");
    if (targetProfileKeys.has(key)) continue;
    targetProfileKeys.add(key);
    const targetQty = clean(row.target_qty);
    const unit = clean(row.unit);
    targetProfileRows.push({
      canonical_entity_code: canonical,
      target_bucket: targetBucket,
      machine_center_no: machineCenterNo,
      target_qty: targetQty,
      unit,
      effective_from: clean(row.effective_from),
      effective_to: clean(row.effective_to),
      is_active: "true",
      approval_status: "draft",
      reviewer: "",
      reviewer_notes: "Generated draft target profile from Business Central target evidence; requires business review."
    });
    if (!targetQty || !unit) {
      warnings.push(warning(warnings.length + 1, "TARGET_PROFILE_MISSING_QTY_OR_UNIT", canonical, canonical, "Target profile draft is missing target_qty or unit."));
      reviewRows.push({
        review_id: `R${String(reviewRows.length + 1).padStart(5, "0")}`,
        review_category: "TARGET_PROFILE_REVIEW",
        source_field: "target_profile_backfill",
        source_value: canonical,
        proposed_canonical_entity_code: canonical,
        rows: numberValue(row.rows) || 1,
        review_reason: "Target profile draft is missing target_qty or unit.",
        recommended_action: "Review target evidence before approving authoritative target profile.",
        sample_documents: "",
        sample_items: ""
      });
    }
  }

  const writeDecision = input.writeDecision ?? { writeWorkingInputFiles: true, writeDraftFilesOnly: false };
  const summary: AuthoritativeMasterSeedDraftSummary = {
    generatedAt,
    outputFolder: input.outputFolder,
    inputFolder: input.inputFolder,
    wroteWorkingInputFiles: writeDecision.writeWorkingInputFiles,
    wroteDraftFilesOnly: writeDecision.writeDraftFilesOnly,
    canonicalSeedRows: canonicalRows.length,
    sourceMapSeedRows: sourceMapRows.length,
    targetProfileSeedRows: targetProfileRows.length,
    reviewQueueRows: reviewRows.length,
    legacyEvidenceRows: crosswalkRows.length,
    excludedSourceValueRows: excludedRows.length,
    warningRows: warnings.length,
    topGeneratedFamilies: topCounts(canonicalRows.map((row) => row.entity_family), 10).map(({ value, rows }) => ({ family: value, rows })),
    topReviewReasons: topCounts(reviewRows.map((row) => row.review_reason), 10).map(({ value, rows }) => ({ reason: value, rows })),
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked: authoritative master seed rows are draft only and this command does not apply or approve master data."
    },
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      aliasesChanged: false,
      conditionalRulesChanged: false,
      dashboardChanged: false,
      p10Enabled: false,
      generatedRowsApproved: false,
      masterDataApplied: false
    }
  };

  return {
    summary,
    canonicalSeedRows: canonicalRows,
    sourceMapSeedRows: sourceMapRows,
    targetProfileSeedRows: targetProfileRows,
    seedReviewQueueRows: reviewRows,
    legacyEvidenceCrosswalkRows: crosswalkRows,
    excludedSourceValueRows: excludedRows,
    seedQualityWarningRows: warnings
  };
}

function groupEntityEvidence(rows: readonly AuthoritativeSeedEvidenceRow[]): readonly SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const row of rows) {
    const sourceField = normalizeSourceField(row.source_field);
    const sourceValue = clean(row.source_value);
    const key = [sourceField, normalizeKey(sourceValue)].join("|");
    const group = groups.get(key) ?? {
      sourceField,
      sourceValue,
      rows: 0,
      currentEntities: new Set<string>(),
      v2Entities: new Set<string>(),
      suggestedEntities: new Set<string>(),
      targetBuckets: new Set<string>(),
      machineCenters: new Set<string>(),
      scopes: new Set<string>(),
      classifications: new Set<string>(),
      riskLevels: new Set<string>(),
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    group.rows += 1;
    add(group.currentEntities, row.current_entity_code);
    add(group.v2Entities, row.v2_entity_code);
    add(group.suggestedEntities, row.suggested_canonical_entity_code);
    add(group.targetBuckets, row.target_bucket_candidate);
    add(group.machineCenters, row.machine_center_no);
    add(group.scopes, row.bc_current_kpi_scope);
    add(group.classifications, row.review_classification);
    add(group.riskLevels, row.risk_level);
    add(group.sampleDocuments, row.document_no, 5);
    add(group.sampleItems, row.item_no, 5);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows);
}

function exclusionReasonForGroup(group: SourceGroup): string {
  const value = group.sourceValue;
  const key = normalizeKey(value);
  if (!value || key === "(BLANK)" || key === "UNMAPPED") return "Blank/UNMAPPED source value requires source-data review.";
  if (group.sourceField === "machineCenterNo") return "machineCenterNo is fallback evidence only; do not seed as primary authoritative mapping.";
  if (protectedBroadSources.has(key)) return "Broad family-only source value is unsafe for authoritative mapping.";
  if (/^RJ[\w-]*/i.test(value)) return "Reject item/code-like value is not a canonical production entity source.";
  if (/^SP[\w-]*/i.test(value)) return "Sparepart/material item-code-like value is not a canonical production entity source.";
  if (group.scopes.size === 1 && group.scopes.has("OUT_OF_CURRENT_KPI_SCOPE")) return "Source value only appears out of current KPI scope.";
  if (looksTargetOnlyBucket(value)) return "Target bucket/variant label is not an entity by itself.";
  return "";
}

function reviewReasonForGroup(group: SourceGroup): string {
  const key = normalizeKey(group.sourceValue);
  if (key.includes("OMSO 2-OZ") && group.currentEntities.size > 1) return "OMSO conflict requires manual canonical review.";
  if ((key.includes("VFINE") || key.includes("LONGSUN")) && group.currentEntities.size > 0 && hasDifferentLegacyCode(group)) return "Wrong size/variant legacy mapping requires manual review.";
  if (key.includes("POLYPRINT") && group.currentEntities.size > 1) return "POLYPRINT naming conflict requires canonical normalization review.";
  if (key.includes("THERMO HENGFENG") && (group.suggestedEntities.size > 0 || group.currentEntities.size > 1)) return "THERMO HENGFENG canonical gap or legacy target-variant collapse requires review.";
  if (key.includes("BORCH") && group.currentEntities.size > 1) return "BORCH size/weight variant conflict requires review.";
  if (group.riskLevels.has("HIGH")) return "High-risk legacy/report evidence requires manual review.";
  if (group.classifications.has("LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED")) return "Old target variant is a clue only and requires review.";
  return "";
}

function proposedCanonicalForGroup(group: SourceGroup): string {
  const suggested = first(group.suggestedEntities);
  if (suggested) return suggested;
  const v2 = first(group.v2Entities);
  if (v2) return v2;
  return group.sourceValue;
}

function reviewRow(index: number, category: string, group: SourceGroup, canonical: string, reason: string): AuthoritativeSeedReviewQueueRow {
  return {
    review_id: `R${String(index).padStart(5, "0")}`,
    review_category: category,
    source_field: group.sourceField,
    source_value: group.sourceValue || "(blank)",
    proposed_canonical_entity_code: canonical,
    rows: group.rows,
    review_reason: reason,
    recommended_action: "Review with business owner before copying this draft into approved authoritative master.",
    sample_documents: joinSet(group.sampleDocuments, 5),
    sample_items: joinSet(group.sampleItems, 5)
  };
}

function warning(index: number, category: string, sourceValue: string, canonical: string, reason: string): AuthoritativeSeedQualityWarningRow {
  return {
    warning_id: `W${String(index).padStart(5, "0")}`,
    warning_category: category,
    source_value: sourceValue,
    canonical_entity_code: canonical,
    warning_reason: reason,
    recommended_action: "Keep as draft until reviewer evidence is complete."
  };
}

function hasDifferentLegacyCode(group: SourceGroup): boolean {
  const canonical = normalizeKey(proposedCanonicalForGroup(group));
  return [...group.currentEntities].some((value) => normalizeKey(value) !== canonical);
}

function inferFamily(value: string): string {
  const key = normalizeKey(value);
  if (key.includes("OMSO")) return "OMSO";
  if (key.includes("POLYPRINT")) return "POLYPRINT";
  if (key.includes("VFINE")) return "VFINE";
  if (key.includes("LONGSUN")) return "LONGSUN";
  if (key.includes("THERMO HENGFENG") || key.includes("HENGFENG")) return "THERMO HENGFENG";
  if (key.includes("BORCH")) return "BORCH";
  if (key.includes("NEWDO")) return "NEWDO";
  if (key.includes("GILING")) return "GILINGAN";
  if (key.includes("REPACKING")) return "REPACKING";
  return "OTHER";
}

function inferEntityType(value: string): string {
  const family = inferFamily(value);
  if (family === "GILINGAN" || family === "REPACKING") return "PROCESS";
  return family === "OTHER" ? "OTHER" : "MACHINE";
}

function inferProductionArea(value: string): string {
  const key = normalizeKey(value);
  if (key.includes("PRINTING") || key.includes("OMSO") || key.includes("POLYPRINT")) return "Printing";
  if (key.includes("THERMO") || key.includes("HENGFENG")) return "Thermoforming";
  if (key.includes("BOTOL") || key.includes("PREFORM") || key.includes("BORCH") || key.includes("LONGSUN") || key.includes("VFINE")) return "Bottle/Preform";
  return "";
}

function looksTargetOnlyBucket(value: string): boolean {
  const key = normalizeKey(value);
  return ["22 OZ", "OZ < 20", "600 ML", "1500 ML"].includes(key);
}

function displayNameForCanonical(value: string): string {
  return clean(value);
}

function normalizeSourceField(value: unknown): string {
  const cleanValue = clean(value);
  if (cleanValue === "g_prod_or_rot_line_description") return "gProdOrRotLineDescription";
  if (cleanValue === "g_prod_or_rot_line_no") return "gProdOrRotLineNo";
  if (cleanValue === "machine_center_no") return "machineCenterNo";
  return cleanValue || "UNMAPPED";
}

function first(values: ReadonlySet<string>): string {
  return [...values][0] ?? "";
}

function joinSet(values: ReadonlySet<string>, limit = 20): string {
  return [...values].filter(Boolean).slice(0, limit).join("|");
}

function add(values: Set<string>, value: unknown, limit = 20): void {
  const cleaned = clean(value);
  if (!cleaned || values.size >= limit) return;
  values.add(cleaned);
}

function topCounts(values: readonly string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "(blank)", (counts.get(value || "(blank)") ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, rows]) => ({ value, rows }))
    .sort((a, b) => b.rows - a.rows || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}
