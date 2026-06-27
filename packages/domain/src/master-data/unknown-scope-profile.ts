import type {
  BusinessCentralCurrentKpiScope,
  BusinessCentralEntitySourceStatus,
  BusinessCentralFutureUseDomain
} from "./bc-data-scope.js";

export type UnknownScopeRuleConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface BusinessCentralUnknownScopeProfileInputRow {
  readonly entryType: string;
  readonly locationCode: string;
  readonly itemCategoryCode: string;
  readonly unitOfMeasureCode: string;
  readonly documentNo: string;
  readonly itemNo: string;
  readonly sourceValue: string;
  readonly currentEntityCode: string;
  readonly canonicalEntityCode: string;
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly bcCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly blocksP10AfterScope: boolean;
}

export interface BusinessCentralUnknownScopeProfileGroup {
  readonly groupId: string;
  readonly rows: number;
  readonly blocksP10AfterScope: boolean;
  readonly entryType: string;
  readonly locationCode: string;
  readonly itemCategoryCode: string;
  readonly unitOfMeasureCode: string;
  readonly documentPrefix: string;
  readonly itemPrefix: string;
  readonly sourceValue: string;
  readonly currentEntityCodes: readonly string[];
  readonly canonicalEntityCode: string;
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly reasonUnknown: string;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
  readonly suggestedFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly suggestedCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly suggestedRule: string;
  readonly confidence: UnknownScopeRuleConfidence;
  readonly needsManualReview: boolean;
}

export interface BusinessCentralUnknownScopeProfileSummary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly unknownScopeRows: number;
  readonly unknownScopeBlockingRows: number;
  readonly unknownScopeNonBlockingRows: number;
  readonly unknownByEntryType: readonly TopCount[];
  readonly unknownByLocationCode: readonly TopCount[];
  readonly unknownByItemCategoryCode: readonly TopCount[];
  readonly unknownByUnitOfMeasure: readonly TopCount[];
  readonly unknownByDocumentPrefix: readonly TopCount[];
  readonly unknownByItemPrefix: readonly TopCount[];
  readonly unknownByEntitySourceStatus: readonly TopCount[];
  readonly unknownBySourceValue: readonly TopCount[];
  readonly unknownByCurrentEntityCode: readonly TopCount[];
  readonly unknownByTargetBucket: readonly TopCount[];
  readonly topUnknownSamples: readonly BusinessCentralUnknownScopeProfileGroup[];
  readonly topMissingEvidencePatterns: readonly MissingEvidencePattern[];
  readonly suggestedClassifierRuleCandidates: readonly SuggestedClassifierRuleCandidate[];
  readonly p10ImpactEstimate: {
    readonly blockingRowsBeforeProfiler: number;
    readonly blockingRowsAfterProfiler: number;
    readonly retainedBlockingRows: number;
    readonly candidateRowsHighConfidence: number;
    readonly candidateRowsMediumConfidence: number;
    readonly candidateRowsLowConfidence: number;
    readonly note: string;
  };
  readonly outputFiles?: {
    readonly csv: string;
    readonly json: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly classifierChanged: false;
  };
}

export interface TopCount {
  readonly value: string;
  readonly rows: number;
}

export interface MissingEvidencePattern {
  readonly pattern: string;
  readonly rows: number;
  readonly recommendedEvidence: string;
}

export interface SuggestedClassifierRuleCandidate {
  readonly suggestedRule: string;
  readonly suggestedCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly suggestedFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly confidence: UnknownScopeRuleConfidence;
  readonly rows: number;
  readonly needsManualReview: boolean;
}

export function buildBusinessCentralUnknownScopeProfile(input: {
  readonly rows: readonly BusinessCentralUnknownScopeProfileInputRow[];
  readonly generatedAt?: string;
  readonly outputFiles?: BusinessCentralUnknownScopeProfileSummary["outputFiles"];
}): {
  readonly groups: readonly BusinessCentralUnknownScopeProfileGroup[];
  readonly summary: BusinessCentralUnknownScopeProfileSummary;
} {
  const unknownRows = input.rows.filter((row) => row.bcCurrentKpiScope === "UNKNOWN_SCOPE_REVIEW");
  const groups = buildUnknownGroups(unknownRows);
  const unknownScopeBlockingRows = unknownRows.filter((row) => row.blocksP10AfterScope).length;
  const unknownScopeNonBlockingRows = unknownRows.length - unknownScopeBlockingRows;

  return {
    groups,
    summary: {
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      totalRows: input.rows.length,
      unknownScopeRows: unknownRows.length,
      unknownScopeBlockingRows,
      unknownScopeNonBlockingRows,
      unknownByEntryType: topCounts(unknownRows.map((row) => normalizedValue(row.entryType))),
      unknownByLocationCode: topCounts(unknownRows.map((row) => normalizedValue(row.locationCode))),
      unknownByItemCategoryCode: topCounts(unknownRows.map((row) => normalizedValue(row.itemCategoryCode))),
      unknownByUnitOfMeasure: topCounts(unknownRows.map((row) => normalizedValue(row.unitOfMeasureCode))),
      unknownByDocumentPrefix: topCounts(unknownRows.map((row) => documentPrefix(row.documentNo))),
      unknownByItemPrefix: topCounts(unknownRows.map((row) => itemPrefix(row.itemNo))),
      unknownByEntitySourceStatus: topCounts(unknownRows.map((row) => row.bcEntitySourceStatus)),
      unknownBySourceValue: topCounts(unknownRows.map((row) => normalizedValue(row.sourceValue))),
      unknownByCurrentEntityCode: topCounts(unknownRows.map((row) => normalizedValue(row.currentEntityCode))),
      unknownByTargetBucket: topCounts(unknownRows.map((row) => normalizedValue(row.targetBucket))),
      topUnknownSamples: groups.slice(0, 20),
      topMissingEvidencePatterns: missingEvidencePatterns(groups),
      suggestedClassifierRuleCandidates: suggestedClassifierRuleCandidates(groups),
      p10ImpactEstimate: {
        blockingRowsBeforeProfiler: unknownScopeBlockingRows,
        blockingRowsAfterProfiler: unknownScopeBlockingRows,
        retainedBlockingRows: unknownScopeBlockingRows,
        candidateRowsHighConfidence: countRowsByConfidence(groups, "HIGH"),
        candidateRowsMediumConfidence: countRowsByConfidence(groups, "MEDIUM"),
        candidateRowsLowConfidence: countRowsByConfidence(groups, "LOW"),
        note: "Profiler is read-only. Unknown rows remain blocking until classifier rules are explicitly implemented and reviewed later."
      },
      ...(input.outputFiles ? { outputFiles: input.outputFiles } : {}),
      safety: {
        databaseUpdated: false,
        productionOutputsUpdated: false,
        targetProfilesUpdated: false,
        dashboardChanged: false,
        aliasesChanged: false,
        conditionalRulesChanged: false,
        classifierChanged: false
      }
    }
  };
}

function buildUnknownGroups(
  rows: readonly BusinessCentralUnknownScopeProfileInputRow[]
): readonly BusinessCentralUnknownScopeProfileGroup[] {
  const groups = new Map<string, {
    row: BusinessCentralUnknownScopeProfileInputRow;
    rows: number;
    currentEntityCodes: Set<string>;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();

  for (const row of rows) {
    const key = [
      row.blocksP10AfterScope ? "BLOCK" : "NONBLOCK",
      normalizedValue(row.entryType),
      normalizedValue(row.locationCode),
      normalizedValue(row.itemCategoryCode),
      normalizedValue(row.unitOfMeasureCode),
      documentPrefix(row.documentNo),
      itemPrefix(row.itemNo),
      normalizedValue(row.sourceValue),
      normalizedValue(row.canonicalEntityCode),
      normalizedValue(row.targetBucket),
      normalizedValue(row.machineCenterNo),
      row.bcEntitySourceStatus
    ].join(":");
    const current = groups.get(key) ?? {
      row,
      rows: 0,
      currentEntityCodes: new Set<string>(),
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    current.rows += 1;
    if (row.currentEntityCode) current.currentEntityCodes.add(row.currentEntityCode);
    if (row.documentNo && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.documentNo);
    if (row.itemNo && current.sampleItems.size < 5) current.sampleItems.add(row.itemNo);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group, index) => {
      const suggestion = suggestClassifierRule(group.row);
      return {
        groupId: `U${String(index + 1).padStart(5, "0")}`,
        rows: group.rows,
        blocksP10AfterScope: group.row.blocksP10AfterScope,
        entryType: normalizedValue(group.row.entryType),
        locationCode: normalizedValue(group.row.locationCode),
        itemCategoryCode: normalizedValue(group.row.itemCategoryCode),
        unitOfMeasureCode: normalizedValue(group.row.unitOfMeasureCode),
        documentPrefix: documentPrefix(group.row.documentNo),
        itemPrefix: itemPrefix(group.row.itemNo),
        sourceValue: normalizedValue(group.row.sourceValue),
        currentEntityCodes: sortedStrings(group.currentEntityCodes),
        canonicalEntityCode: normalizedValue(group.row.canonicalEntityCode),
        targetBucket: normalizedValue(group.row.targetBucket),
        machineCenterNo: normalizedValue(group.row.machineCenterNo),
        bcEntitySourceStatus: group.row.bcEntitySourceStatus,
        reasonUnknown: reasonUnknown(group.row),
        sampleDocuments: [...group.sampleDocuments],
        sampleItems: [...group.sampleItems],
        ...suggestion
      };
    })
    .sort((left, right) => (
      Number(right.blocksP10AfterScope) - Number(left.blocksP10AfterScope)
      || right.rows - left.rows
      || left.entryType.localeCompare(right.entryType)
      || left.documentPrefix.localeCompare(right.documentPrefix)
      || left.itemPrefix.localeCompare(right.itemPrefix)
    ))
    .map((group, index) => ({
      ...group,
      groupId: `U${String(index + 1).padStart(5, "0")}`
    }));
}

function suggestClassifierRule(row: BusinessCentralUnknownScopeProfileInputRow): Pick<
  BusinessCentralUnknownScopeProfileGroup,
  "suggestedFutureUseDomain" | "suggestedCurrentKpiScope" | "suggestedRule" | "confidence" | "needsManualReview"
> {
  const entryType = normalizedValue(row.entryType);
  const locationCode = normalizedValue(row.locationCode);
  const itemCategoryCode = normalizedValue(row.itemCategoryCode);
  const unitOfMeasureCode = normalizedValue(row.unitOfMeasureCode);
  const docPrefix = documentPrefix(row.documentNo);
  const item = normalizedValue(row.itemNo);

  if (entryType === "SALE" || entryType === "SALES") {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "SALES_REPORT", "Entry type is sales-like; propose future sales report rule.", "HIGH", false);
  }
  if (entryType === "PURCHASE" || entryType === "POSITIVE ADJMT." || docPrefix === "PO" || docPrefix === "GRN") {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "PURCHASE_OR_RECEIVING", "Purchase/receiving ledger or document-prefix evidence.", entryType === "PURCHASE" ? "HIGH" : "MEDIUM", true);
  }
  if (entryType === "TRANSFER" || docPrefix === "TRF" || docPrefix === "MUT" || docPrefix === "ADJ") {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "TRANSFER_OR_INVENTORY_MOVEMENT", "Transfer/inventory movement evidence.", entryType === "TRANSFER" ? "HIGH" : "MEDIUM", true);
  }
  if (entryType === "CONSUMPTION") {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "CONSUMPTION_OR_MATERIAL_USAGE", "Consumption ledger evidence.", "HIGH", false);
  }
  if (docPrefix === "SO" || docPrefix === "DO" || docPrefix === "SJ" || docPrefix === "INV") {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "SALES_REPORT", "Sales-like document prefix evidence; review before classifier change.", "MEDIUM", true);
  }
  if (locationCode === "JADI" && unitOfMeasureCode === "PCS" && entryType === "OUTPUT") {
    return suggestion("OUTPUT_KPI_OK_SCOPE", "PRODUCTION_OUTPUT_DASHBOARD", "Output/JADI/PCS evidence looks deterministic for current KPI OK scope.", "HIGH", true);
  }
  if (locationCode === "REJECT" || item.startsWith("RJ")) {
    return suggestion("OUTPUT_KPI_REJECT_SCOPE", "REJECT_ATTACHMENT", "Reject location or RJ item prefix evidence.", "HIGH", true);
  }
  if (containsAny([itemCategoryCode, item, docPrefix], ["SP", "MAT", "INK", "RESIN", "BAHAN", "SPARE"])) {
    return suggestion("OUT_OF_CURRENT_KPI_SCOPE", "DOWNTIME_SPAREPART_OR_MATERIAL", "Material/sparepart-like evidence; weak text pattern needs review.", "MEDIUM", true);
  }

  return suggestion("UNKNOWN_SCOPE_REVIEW", "UNKNOWN_REVIEW", "No deterministic classifier rule candidate found; inspect missing OData evidence.", "LOW", true);
}

function suggestion(
  suggestedCurrentKpiScope: BusinessCentralCurrentKpiScope,
  suggestedFutureUseDomain: BusinessCentralFutureUseDomain,
  suggestedRule: string,
  confidence: UnknownScopeRuleConfidence,
  needsManualReview: boolean
) {
  return {
    suggestedFutureUseDomain,
    suggestedCurrentKpiScope,
    suggestedRule,
    confidence,
    needsManualReview
  };
}

function reasonUnknown(row: BusinessCentralUnknownScopeProfileInputRow): string {
  const missing: string[] = [];
  if (!normalizedValue(row.locationCode)) missing.push("location_code");
  if (!normalizedValue(row.itemCategoryCode)) missing.push("item_category_code");
  if (!normalizedValue(row.unitOfMeasureCode)) missing.push("unit_of_measure_code");
  if (!normalizedValue(row.documentNo)) missing.push("document_no");
  if (!normalizedValue(row.itemNo)) missing.push("item_no");
  if (row.bcEntitySourceStatus === "ENTITY_SOURCE_BLANK_UNKNOWN") missing.push("entity_source");
  if (missing.length === 0) return "Available evidence did not match any current classifier rule.";
  return `Missing or weak evidence: ${missing.join(", ")}.`;
}

function missingEvidencePatterns(groups: readonly BusinessCentralUnknownScopeProfileGroup[]): readonly MissingEvidencePattern[] {
  const counts = new Map<string, { rows: number; recommendedEvidence: string }>();
  for (const group of groups) {
    const pattern = [
      group.locationCode === "(blank)" ? "missing_location" : "",
      group.itemCategoryCode === "(blank)" ? "missing_item_category" : "",
      group.unitOfMeasureCode === "(blank)" ? "missing_uom" : "",
      group.documentPrefix === "(blank)" ? "missing_document_prefix" : "",
      group.itemPrefix === "(blank)" ? "missing_item_prefix" : "",
      group.bcEntitySourceStatus === "ENTITY_SOURCE_BLANK_UNKNOWN" ? "missing_entity_source" : ""
    ].filter(Boolean).join("+") || "evidence_present_but_unmatched";
    const current = counts.get(pattern) ?? {
      rows: 0,
      recommendedEvidence: recommendedEvidenceForPattern(pattern)
    };
    current.rows += group.rows;
    counts.set(pattern, current);
  }
  return [...counts.entries()]
    .map(([pattern, value]) => ({ pattern, rows: value.rows, recommendedEvidence: value.recommendedEvidence }))
    .sort((left, right) => right.rows - left.rows || left.pattern.localeCompare(right.pattern))
    .slice(0, 20);
}

function suggestedClassifierRuleCandidates(
  groups: readonly BusinessCentralUnknownScopeProfileGroup[]
): readonly SuggestedClassifierRuleCandidate[] {
  const counts = new Map<string, SuggestedClassifierRuleCandidate>();
  for (const group of groups) {
    const key = [
      group.suggestedRule,
      group.suggestedCurrentKpiScope,
      group.suggestedFutureUseDomain,
      group.confidence,
      group.needsManualReview ? "review" : "no-review"
    ].join(":");
    const current = counts.get(key) ?? {
      suggestedRule: group.suggestedRule,
      suggestedCurrentKpiScope: group.suggestedCurrentKpiScope,
      suggestedFutureUseDomain: group.suggestedFutureUseDomain,
      confidence: group.confidence,
      rows: 0,
      needsManualReview: group.needsManualReview
    };
    counts.set(key, { ...current, rows: current.rows + group.rows });
  }
  return [...counts.values()]
    .sort((left, right) => confidenceSort(right.confidence) - confidenceSort(left.confidence) || right.rows - left.rows)
    .slice(0, 20);
}

function countRowsByConfidence(
  groups: readonly BusinessCentralUnknownScopeProfileGroup[],
  confidence: UnknownScopeRuleConfidence
): number {
  return groups.filter((group) => group.confidence === confidence).reduce((sum, group) => sum + group.rows, 0);
}

function topCounts(values: readonly string[], limit = 20): readonly TopCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || "(blank)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, rows]) => ({ value, rows }))
    .sort((left, right) => right.rows - left.rows || left.value.localeCompare(right.value))
    .slice(0, limit);
}

function documentPrefix(value: string): string {
  return prefix(value);
}

function itemPrefix(value: string): string {
  return prefix(value);
}

function prefix(value: string): string {
  const text = normalizedValue(value);
  if (!text) return "(blank)";
  const match = text.match(/^[A-Z]+/);
  return match ? match[0] : text.slice(0, 8);
}

function normalizedValue(value: string): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ") || "(blank)";
}

function containsAny(values: readonly string[], tokens: readonly string[]): boolean {
  return values.some((value) => tokens.some((token) => value.includes(token)));
}

function confidenceSort(value: UnknownScopeRuleConfidence): number {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}

function recommendedEvidenceForPattern(pattern: string): string {
  if (pattern === "evidence_present_but_unmatched") return "Add or refine explicit classifier rule for this evidence combination.";
  if (pattern.includes("missing_entity_source")) return "Review gProdOrRotLine_Description, gProdOrRotLine_No, and Machine_Center_No population.";
  if (pattern.includes("missing_location")) return "Add Location_Code or a reviewed document/item rule.";
  if (pattern.includes("missing_item_category")) return "Review Item_Category_Code or item prefix/category mapping.";
  if (pattern.includes("missing_uom")) return "Review Unit_of_Measure_Code before quantity-based classification.";
  return "Review raw OData evidence before classifier changes.";
}

function sortedStrings(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
