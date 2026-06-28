import type {
  BusinessCentralCurrentKpiScope
} from "./bc-data-scope.js";

export type FutureUseRegistryStatus = "GENERATED" | "GENERATED_WITH_WARNINGS" | "BLOCKED_MISSING_SOURCE_REPORTS";
export type FutureUseRegistryGranularity = "ROW" | "GROUP" | "MIXED";

export type FutureUseRegistryDomain =
  | "PRODUCTION_OUTPUT_DASHBOARD"
  | "REJECT_ATTACHMENT"
  | "SALES_REPORT"
  | "PURCHASE_OR_RECEIVING"
  | "TRANSFER_OR_INVENTORY_MOVEMENT"
  | "CONSUMPTION_OR_MATERIAL_USAGE"
  | "DOWNTIME_SPAREPART_OR_MATERIAL"
  | "SCRAP_WASTE_OR_AVALAN"
  | "MASTER_DATA_QUALITY_REVIEW"
  | "UNKNOWN_REVIEW";

export type RawRegistryStatus =
  | "REGISTERED_FOR_P10_OUTPUT_KPI"
  | "REGISTERED_FOR_REJECT_ATTACHMENT"
  | "REGISTERED_FOR_FUTURE_SALES"
  | "REGISTERED_FOR_FUTURE_PURCHASE_RECEIVING"
  | "REGISTERED_FOR_FUTURE_TRANSFER_INVENTORY"
  | "REGISTERED_FOR_FUTURE_CONSUMPTION_MATERIAL_USAGE"
  | "REGISTERED_FOR_FUTURE_SPAREPART_MATERIAL"
  | "REGISTERED_FOR_FUTURE_SCRAP_WASTE"
  | "REGISTERED_FOR_MASTER_DATA_QUALITY_REVIEW"
  | "REGISTERED_FOR_UNKNOWN_REVIEW";

export type P10InclusionStatus =
  | "P10_INCLUDED_CANDIDATE"
  | "P10_REJECT_ATTACHMENT_CANDIDATE"
  | "P10_EXCLUDED_FUTURE_USE"
  | "P10_BLOCKED_UNKNOWN_REVIEW"
  | "P10_BLOCKED_SOURCE_DATA_GAP"
  | "P10_BLOCKED_HIGH_RISK_REVIEW";

export type FutureModuleCandidate =
  | "production-output-dashboard"
  | "reject-attachment"
  | "sales-report"
  | "purchase-receiving"
  | "transfer-inventory-movement"
  | "consumption-material-usage"
  | "downtime-sparepart-material"
  | "scrap-waste-avalan"
  | "master-data-quality"
  | "unknown-review";

export type AuthoritativeEntityCoverageStatus =
  | "AUTHORITATIVE_MAPPED"
  | "DRAFT_ENTITY_CANDIDATE"
  | "DRAFT_ALIAS_CANDIDATE"
  | "SOURCE_DATA_GAP"
  | "LEGACY_EVIDENCE_ONLY"
  | "NOT_REQUIRED_FOR_DOMAIN"
  | "CONFLICT_REVIEW"
  | "UNKNOWN";

export interface FutureUseRawEvidenceRow {
  readonly posting_date?: string;
  readonly document_no?: string;
  readonly entry_no?: string | number;
  readonly item_no?: string;
  readonly item_description?: string;
  readonly item_category_code?: string;
  readonly entry_type?: string;
  readonly location_code?: string;
  readonly g_prod_or_rot_line_description?: string;
  readonly g_prod_or_rot_line_no?: string;
  readonly machine_center_no?: string;
  readonly source_field?: string;
  readonly source_value?: string;
  readonly v2_source_field_used?: string;
  readonly v2_source_value_used?: string;
  readonly current_entity_code?: string;
  readonly v2_entity_code?: string;
  readonly v2_suggested_canonical_entity_code?: string;
  readonly v2_target_bucket_candidate?: string;
  readonly target_bucket?: string;
  readonly bc_current_kpi_scope?: string;
  readonly bc_future_use_domain?: string;
  readonly blocks_p10_after_scope?: string | boolean;
}

export interface FutureUseAuthoritativeMapRow {
  readonly source_system?: string;
  readonly source_field?: string;
  readonly source_value?: string;
  readonly canonical_entity_code?: string;
  readonly is_active?: string;
  readonly source_of_truth_status?: string;
}

export interface FutureUseAuthoritativeEntityRow {
  readonly canonical_entity_code?: string;
  readonly is_active?: string;
  readonly source_of_truth_status?: string;
}

export interface FutureUseTargetProfileRow {
  readonly canonical_entity_code?: string;
  readonly target_bucket?: string;
  readonly machine_center_no?: string;
  readonly is_active?: string;
  readonly approval_status?: string;
}

export interface FutureUseConflictEvidenceRow {
  readonly source_field?: string;
  readonly source_value?: string;
  readonly proposed_canonical_entity_code?: string;
  readonly canonical_entity_code?: string;
  readonly review_reason?: string;
  readonly conflict_reason?: string;
}

export interface FutureUseRawRegistryRow {
  readonly registry_key: string;
  readonly registry_granularity: FutureUseRegistryGranularity;
  readonly source_system: "business-central";
  readonly source_file: string;
  readonly posting_date: string;
  readonly document_no: string;
  readonly item_no: string;
  readonly item_description: string;
  readonly entry_type: string;
  readonly item_category_code: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly machine_center_no: string;
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: FutureUseRegistryDomain;
  readonly registry_status: RawRegistryStatus;
  readonly p10_inclusion_status: P10InclusionStatus;
  readonly future_module_candidate: FutureModuleCandidate;
  readonly authoritative_entity_status: AuthoritativeEntityCoverageStatus;
  readonly authoritative_entity_code: string;
  readonly target_profile_required: "true" | "false";
  readonly target_profile_status: "COVERED" | "MISSING_TARGET_PROFILE" | "NOT_REQUIRED";
  readonly review_required: "true" | "false";
  readonly review_reason: string;
  readonly safety_reason: string;
}

export interface FutureUseRollupRow {
  readonly rollup_key: string;
  readonly rows: number;
  readonly registered_rows: number;
}

export interface FutureUseModuleReadinessRollupRow {
  readonly future_module_candidate: FutureModuleCandidate;
  readonly rows: number;
  readonly authoritative_mapped_rows: number;
  readonly draft_entity_candidate_rows: number;
  readonly source_data_gap_rows: number;
  readonly conflict_review_rows: number;
  readonly target_profile_required_rows: number;
  readonly target_profile_missing_rows: number;
  readonly review_required_rows: number;
  readonly readiness_status: "READY_FOR_FUTURE_REVIEW" | "NEEDS_AUTHORITATIVE_MASTER" | "NEEDS_SOURCE_DATA_REVIEW" | "NEEDS_TARGET_PROFILE_REVIEW";
}

export interface FutureUseP10SplitRow {
  readonly split: "P10_PRODUCTION_OUTPUT" | "P10_REJECT_ATTACHMENT" | "FUTURE_USE" | "SOURCE_DATA_GAP" | "UNKNOWN_OR_HIGH_RISK_REVIEW";
  readonly rows: number;
}

export interface FutureUseSourceCoverageRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly bc_future_use_domain: FutureUseRegistryDomain;
  readonly rows: number;
  readonly authoritative_entity_status: AuthoritativeEntityCoverageStatus;
  readonly authoritative_entity_code: string;
  readonly review_required: "true" | "false";
  readonly review_reason: string;
}

export interface FutureUseReviewQueueRow {
  readonly review_id: string;
  readonly review_type: "SOURCE_DATA_GAP" | "UNKNOWN_REVIEW" | "CONFLICT_REVIEW" | "TARGET_PROFILE_REVIEW" | "MASTER_DATA_QUALITY_REVIEW";
  readonly source_field: string;
  readonly source_value: string;
  readonly bc_future_use_domain: FutureUseRegistryDomain;
  readonly rows: number;
  readonly review_reason: string;
  readonly recommended_action: string;
}

export interface FutureUseDomainCoverageRow {
  readonly bc_future_use_domain: FutureUseRegistryDomain;
  readonly rows: number;
  readonly authoritative_mapped_rows: number;
  readonly draft_entity_candidate_rows: number;
  readonly source_data_gap_rows: number;
  readonly conflict_review_rows: number;
  readonly unknown_rows: number;
}

export interface FutureUseTargetProfileRequirementRow {
  readonly bc_future_use_domain: FutureUseRegistryDomain;
  readonly rows: number;
  readonly target_profile_required_rows: number;
  readonly target_profile_covered_rows: number;
  readonly target_profile_missing_rows: number;
  readonly target_profile_not_required_rows: number;
}

export interface FutureUseRawRegistrySummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly inputSources: readonly string[];
  readonly registryStatus: FutureUseRegistryStatus;
  readonly registryGranularity: FutureUseRegistryGranularity;
  readonly totalRegisteredRows: number;
  readonly rowRegistryRows: number;
  readonly groupedRegistryRows: number;
  readonly domainCounts: Record<string, number>;
  readonly registryStatusCounts: Record<string, number>;
  readonly p10InclusionStatusCounts: Record<string, number>;
  readonly futureModuleCounts: Record<string, number>;
  readonly authoritativeCoverage: {
    readonly authoritativeMappedRows: number;
    readonly draftEntityCandidateRows: number;
    readonly draftAliasCandidateRows: number;
    readonly sourceDataGapRows: number;
    readonly conflictReviewRows: number;
    readonly unknownRows: number;
  };
  readonly targetProfileCoverage: {
    readonly targetProfileRequiredRows: number;
    readonly targetProfileCoveredRows: number;
    readonly targetProfileMissingRows: number;
    readonly targetProfileNotRequiredRows: number;
  };
  readonly reviewQueueRows: number;
  readonly sourceDataGapRows: number;
  readonly unknownReviewRows: number;
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
  };
}

export interface FutureUseRawRegistryResult {
  readonly summary: FutureUseRawRegistrySummary;
  readonly registryRows: readonly FutureUseRawRegistryRow[];
  readonly domainRollupRows: readonly FutureUseRollupRow[];
  readonly moduleReadinessRollupRows: readonly FutureUseModuleReadinessRollupRow[];
  readonly p10VsFutureSplitRows: readonly FutureUseP10SplitRow[];
  readonly futureUseSourceCoverageRows: readonly FutureUseSourceCoverageRow[];
  readonly futureUseReviewQueueRows: readonly FutureUseReviewQueueRow[];
  readonly sourceDataGapBacklogRows: readonly FutureUseReviewQueueRow[];
  readonly unknownReviewBacklogRows: readonly FutureUseReviewQueueRow[];
  readonly authoritativeEntityCoverageByDomainRows: readonly FutureUseDomainCoverageRow[];
  readonly targetProfileRequirementByDomainRows: readonly FutureUseTargetProfileRequirementRow[];
  readonly safetyReport: FutureUseRawRegistrySummary["safety"];
}

interface CoverageLookup {
  approvedMaps: Map<string, string>;
  draftMaps: Map<string, string>;
  conflictSources: Map<string, string>;
  approvedTargetProfileKeys: Set<string>;
}

const currentScopes = new Set(["OUTPUT_KPI_OK_SCOPE", "OUTPUT_KPI_REJECT_SCOPE", "OUT_OF_CURRENT_KPI_SCOPE", "UNKNOWN_SCOPE_REVIEW"]);
const futureDomains = new Set([
  "PRODUCTION_OUTPUT_DASHBOARD",
  "REJECT_ATTACHMENT",
  "SALES_REPORT",
  "PURCHASE_OR_RECEIVING",
  "TRANSFER_OR_INVENTORY_MOVEMENT",
  "CONSUMPTION_OR_MATERIAL_USAGE",
  "DOWNTIME_SPAREPART_OR_MATERIAL",
  "SCRAP_WASTE_OR_AVALAN",
  "MASTER_DATA_QUALITY_REVIEW",
  "UNKNOWN_REVIEW"
]);

export function buildFutureUseRawRegistry(input: {
  readonly rawRows: readonly FutureUseRawEvidenceRow[];
  readonly sourceReportsAvailable: boolean;
  readonly sourceFile: string;
  readonly outputFolder: string;
  readonly approvedSourceMaps?: readonly FutureUseAuthoritativeMapRow[];
  readonly approvedCanonicalEntities?: readonly FutureUseAuthoritativeEntityRow[];
  readonly seedDraftSourceMaps?: readonly FutureUseAuthoritativeMapRow[];
  readonly conflictEvidenceRows?: readonly FutureUseConflictEvidenceRow[];
  readonly targetProfileRows?: readonly FutureUseTargetProfileRow[];
  readonly generatedAt?: string;
}): FutureUseRawRegistryResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const lookup = buildCoverageLookup(input);

  if (!input.sourceReportsAvailable) {
    return emptyBlockedResult(generatedAt, input.outputFolder, input.sourceFile);
  }

  const registryRows = input.rawRows.map((row, index) => registryRow(row, index + 1, input.sourceFile, lookup));
  const domainRollupRows = rollup(registryRows.map((row) => row.bc_future_use_domain));
  const moduleReadinessRollupRows = moduleReadiness(registryRows);
  const p10VsFutureSplitRows = p10Split(registryRows);
  const futureUseSourceCoverageRows = sourceCoverage(registryRows);
  const futureUseReviewQueueRows = reviewQueue(futureUseSourceCoverageRows, registryRows);
  const sourceDataGapBacklogRows = futureUseReviewQueueRows.filter((row) => row.review_type === "SOURCE_DATA_GAP");
  const unknownReviewBacklogRows = futureUseReviewQueueRows.filter((row) => row.review_type === "UNKNOWN_REVIEW");
  const authoritativeEntityCoverageByDomainRows = domainCoverage(registryRows);
  const targetProfileRequirementByDomainRows = targetProfileRequirements(registryRows);
  const sourceDataGapRows = registryRows.filter((row) => row.authoritative_entity_status === "SOURCE_DATA_GAP").length;
  const unknownReviewRows = registryRows.filter((row) => row.bc_future_use_domain === "UNKNOWN_REVIEW").length;
  const registryStatus: FutureUseRegistryStatus = sourceDataGapRows > 0 || unknownReviewRows > 0 || futureUseReviewQueueRows.length > 0
    ? "GENERATED_WITH_WARNINGS"
    : "GENERATED";

  const summary: FutureUseRawRegistrySummary = {
    generatedAt,
    outputFolder: input.outputFolder,
    inputSources: [input.sourceFile],
    registryStatus,
    registryGranularity: "ROW",
    totalRegisteredRows: registryRows.length,
    rowRegistryRows: registryRows.length,
    groupedRegistryRows: 0,
    domainCounts: countBy(registryRows.map((row) => row.bc_future_use_domain)),
    registryStatusCounts: countBy(registryRows.map((row) => row.registry_status)),
    p10InclusionStatusCounts: countBy(registryRows.map((row) => row.p10_inclusion_status)),
    futureModuleCounts: countBy(registryRows.map((row) => row.future_module_candidate)),
    authoritativeCoverage: {
      authoritativeMappedRows: registryRows.filter((row) => row.authoritative_entity_status === "AUTHORITATIVE_MAPPED").length,
      draftEntityCandidateRows: registryRows.filter((row) => row.authoritative_entity_status === "DRAFT_ENTITY_CANDIDATE").length,
      draftAliasCandidateRows: registryRows.filter((row) => row.authoritative_entity_status === "DRAFT_ALIAS_CANDIDATE").length,
      sourceDataGapRows,
      conflictReviewRows: registryRows.filter((row) => row.authoritative_entity_status === "CONFLICT_REVIEW").length,
      unknownRows: registryRows.filter((row) => row.authoritative_entity_status === "UNKNOWN").length
    },
    targetProfileCoverage: {
      targetProfileRequiredRows: registryRows.filter((row) => row.target_profile_required === "true").length,
      targetProfileCoveredRows: registryRows.filter((row) => row.target_profile_status === "COVERED").length,
      targetProfileMissingRows: registryRows.filter((row) => row.target_profile_status === "MISSING_TARGET_PROFILE").length,
      targetProfileNotRequiredRows: registryRows.filter((row) => row.target_profile_status === "NOT_REQUIRED").length
    },
    reviewQueueRows: futureUseReviewQueueRows.length,
    sourceDataGapRows,
    unknownReviewRows,
    p10Gate: {
      status: "BLOCKED",
      reason: registryStatus === "GENERATED_WITH_WARNINGS"
        ? "P1.0 remains blocked: future-use registry contains source-data-gap, unknown, conflict, or target-profile review rows and this command is export-only."
        : "P1.0 remains blocked: future-use registry is export-only and does not approve authoritative master data or enable P1.0."
    },
    safety: safetyFlags()
  };

  return {
    summary,
    registryRows,
    domainRollupRows,
    moduleReadinessRollupRows,
    p10VsFutureSplitRows,
    futureUseSourceCoverageRows,
    futureUseReviewQueueRows,
    sourceDataGapBacklogRows,
    unknownReviewBacklogRows,
    authoritativeEntityCoverageByDomainRows,
    targetProfileRequirementByDomainRows,
    safetyReport: summary.safety
  };
}

function registryRow(row: FutureUseRawEvidenceRow, index: number, sourceFile: string, lookup: CoverageLookup): FutureUseRawRegistryRow {
  const currentScope = normalizeScope(row.bc_current_kpi_scope);
  const domain = normalizeDomain(row.bc_future_use_domain, currentScope);
  const source = preferredSource(row);
  const sourceKey = sourceMapKey(source.source_field, source.source_value);
  const isSourceGap = isBlankSource(source.source_value);
  const approvedEntity = lookup.approvedMaps.get(sourceKey) ?? "";
  const draftEntity = lookup.draftMaps.get(sourceKey) ?? "";
  const conflictReason = lookup.conflictSources.get(sourceKey) ?? "";
  const entityStatus = entityCoverageStatus({ domain, isSourceGap, approvedEntity, draftEntity, conflictReason });
  const entityCode = approvedEntity || draftEntity || clean(row.v2_entity_code) || clean(row.v2_suggested_canonical_entity_code);
  const targetBucket = clean(row.v2_target_bucket_candidate) || clean(row.target_bucket);
  const targetRequired = domain === "PRODUCTION_OUTPUT_DASHBOARD";
  const targetCovered = targetRequired && lookup.approvedTargetProfileKeys.has(targetProfileKey(entityCode, targetBucket, clean(row.machine_center_no)));
  const targetProfileStatus = targetRequired
    ? targetCovered ? "COVERED" : "MISSING_TARGET_PROFILE"
    : "NOT_REQUIRED";
  const reviewReason = [
    isSourceGap ? "Source data gap is registered for backlog review." : "",
    domain === "UNKNOWN_REVIEW" ? "Unknown future-use domain is registered for review." : "",
    conflictReason,
    targetProfileStatus === "MISSING_TARGET_PROFILE" ? "Production output candidate requires approved target profile coverage." : "",
    domain === "MASTER_DATA_QUALITY_REVIEW" ? "Master data quality review domain requires manual triage." : ""
  ].filter(Boolean).join(" ");
  const reviewRequired = reviewReason ? "true" : "false";

  return {
    registry_key: `BCROW-${String(index).padStart(6, "0")}`,
    registry_granularity: "ROW",
    source_system: "business-central",
    source_file: sourceFile,
    posting_date: clean(row.posting_date),
    document_no: clean(row.document_no),
    item_no: clean(row.item_no),
    item_description: clean(row.item_description),
    entry_type: clean(row.entry_type),
    item_category_code: clean(row.item_category_code),
    source_field: source.source_field,
    source_value: source.source_value || "(blank)",
    machine_center_no: clean(row.machine_center_no),
    bc_current_kpi_scope: currentScope,
    bc_future_use_domain: domain,
    registry_status: registryStatusForDomain(domain),
    p10_inclusion_status: p10Status(currentScope, domain, isSourceGap, row.blocks_p10_after_scope),
    future_module_candidate: moduleForDomain(domain),
    authoritative_entity_status: entityStatus,
    authoritative_entity_code: entityStatus === "AUTHORITATIVE_MAPPED" || entityStatus === "DRAFT_ENTITY_CANDIDATE" || entityStatus === "DRAFT_ALIAS_CANDIDATE" ? entityCode : "",
    target_profile_required: targetRequired ? "true" : "false",
    target_profile_status: targetProfileStatus,
    review_required: reviewRequired,
    review_reason: reviewReason,
    safety_reason: "Registry/export only; this row does not mutate production_outputs, aliases, target_profiles, or dashboard behavior."
  };
}

function buildCoverageLookup(input: {
  readonly approvedSourceMaps?: readonly FutureUseAuthoritativeMapRow[];
  readonly approvedCanonicalEntities?: readonly FutureUseAuthoritativeEntityRow[];
  readonly seedDraftSourceMaps?: readonly FutureUseAuthoritativeMapRow[];
  readonly conflictEvidenceRows?: readonly FutureUseConflictEvidenceRow[];
  readonly targetProfileRows?: readonly FutureUseTargetProfileRow[];
}): CoverageLookup {
  const approvedEntityCodes = new Set(
    (input.approvedCanonicalEntities ?? [])
      .filter((row) => clean(row.is_active).toLowerCase() === "true" && clean(row.source_of_truth_status).toLowerCase() === "approved")
      .map((row) => normalizeKey(row.canonical_entity_code))
  );
  const approvedMaps = new Map<string, string>();
  for (const row of input.approvedSourceMaps ?? []) {
    const canonical = clean(row.canonical_entity_code);
    if (clean(row.is_active).toLowerCase() !== "true") continue;
    if (!approvedEntityCodes.has(normalizeKey(canonical))) continue;
    approvedMaps.set(sourceMapKey(row.source_field, row.source_value), canonical);
  }
  const draftMaps = new Map<string, string>();
  for (const row of input.seedDraftSourceMaps ?? []) {
    const canonical = clean(row.canonical_entity_code);
    if (!canonical || clean(row.is_active).toLowerCase() === "false") continue;
    draftMaps.set(sourceMapKey(row.source_field, row.source_value), canonical);
  }
  const conflictSources = new Map<string, string>();
  for (const row of input.conflictEvidenceRows ?? []) {
    const key = sourceMapKey(row.source_field, row.source_value);
    if (key.endsWith("|")) continue;
    conflictSources.set(key, clean(row.review_reason) || clean(row.conflict_reason) || "Legacy/current entity conflict evidence requires review.");
  }
  const approvedTargetProfileKeys = new Set<string>();
  for (const row of input.targetProfileRows ?? []) {
    if (clean(row.is_active).toLowerCase() !== "true") continue;
    if (clean(row.approval_status).toLowerCase() !== "approved") continue;
    approvedTargetProfileKeys.add(targetProfileKey(row.canonical_entity_code, row.target_bucket, row.machine_center_no));
  }
  return { approvedMaps, draftMaps, conflictSources, approvedTargetProfileKeys };
}

function preferredSource(row: FutureUseRawEvidenceRow): { source_field: string; source_value: string } {
  const prodDescription = clean(row.g_prod_or_rot_line_description);
  if (prodDescription) return { source_field: "gProdOrRotLineDescription", source_value: prodDescription };
  const sourceField = normalizeSourceField(row.source_field || row.v2_source_field_used);
  const sourceValue = clean(row.source_value) || clean(row.v2_source_value_used);
  if (sourceField && sourceValue && normalizeKey(sourceValue) !== "UNMAPPED") return { source_field: sourceField, source_value: sourceValue };
  const prodLineNo = clean(row.g_prod_or_rot_line_no);
  if (prodLineNo) return { source_field: "gProdOrRotLineNo", source_value: prodLineNo };
  const machineCenter = clean(row.machine_center_no);
  if (machineCenter) return { source_field: "machineCenterNo", source_value: machineCenter };
  return { source_field: "UNMAPPED", source_value: "(blank)" };
}

function normalizeScope(value: unknown): BusinessCentralCurrentKpiScope {
  const scope = clean(value);
  return currentScopes.has(scope) ? scope as BusinessCentralCurrentKpiScope : "UNKNOWN_SCOPE_REVIEW";
}

function normalizeDomain(value: unknown, scope: BusinessCentralCurrentKpiScope): FutureUseRegistryDomain {
  const domain = clean(value);
  if (futureDomains.has(domain)) return domain as FutureUseRegistryDomain;
  if (scope === "OUTPUT_KPI_OK_SCOPE") return "PRODUCTION_OUTPUT_DASHBOARD";
  if (scope === "OUTPUT_KPI_REJECT_SCOPE") return "REJECT_ATTACHMENT";
  if (scope === "OUT_OF_CURRENT_KPI_SCOPE") return "MASTER_DATA_QUALITY_REVIEW";
  return "UNKNOWN_REVIEW";
}

function registryStatusForDomain(domain: FutureUseRegistryDomain): RawRegistryStatus {
  switch (domain) {
    case "PRODUCTION_OUTPUT_DASHBOARD": return "REGISTERED_FOR_P10_OUTPUT_KPI";
    case "REJECT_ATTACHMENT": return "REGISTERED_FOR_REJECT_ATTACHMENT";
    case "SALES_REPORT": return "REGISTERED_FOR_FUTURE_SALES";
    case "PURCHASE_OR_RECEIVING": return "REGISTERED_FOR_FUTURE_PURCHASE_RECEIVING";
    case "TRANSFER_OR_INVENTORY_MOVEMENT": return "REGISTERED_FOR_FUTURE_TRANSFER_INVENTORY";
    case "CONSUMPTION_OR_MATERIAL_USAGE": return "REGISTERED_FOR_FUTURE_CONSUMPTION_MATERIAL_USAGE";
    case "DOWNTIME_SPAREPART_OR_MATERIAL": return "REGISTERED_FOR_FUTURE_SPAREPART_MATERIAL";
    case "SCRAP_WASTE_OR_AVALAN": return "REGISTERED_FOR_FUTURE_SCRAP_WASTE";
    case "MASTER_DATA_QUALITY_REVIEW": return "REGISTERED_FOR_MASTER_DATA_QUALITY_REVIEW";
    case "UNKNOWN_REVIEW": return "REGISTERED_FOR_UNKNOWN_REVIEW";
  }
}

function moduleForDomain(domain: FutureUseRegistryDomain): FutureModuleCandidate {
  switch (domain) {
    case "PRODUCTION_OUTPUT_DASHBOARD": return "production-output-dashboard";
    case "REJECT_ATTACHMENT": return "reject-attachment";
    case "SALES_REPORT": return "sales-report";
    case "PURCHASE_OR_RECEIVING": return "purchase-receiving";
    case "TRANSFER_OR_INVENTORY_MOVEMENT": return "transfer-inventory-movement";
    case "CONSUMPTION_OR_MATERIAL_USAGE": return "consumption-material-usage";
    case "DOWNTIME_SPAREPART_OR_MATERIAL": return "downtime-sparepart-material";
    case "SCRAP_WASTE_OR_AVALAN": return "scrap-waste-avalan";
    case "MASTER_DATA_QUALITY_REVIEW": return "master-data-quality";
    case "UNKNOWN_REVIEW": return "unknown-review";
  }
}

function p10Status(scope: BusinessCentralCurrentKpiScope, domain: FutureUseRegistryDomain, sourceGap: boolean, blocksP10AfterScope: unknown): P10InclusionStatus {
  if (sourceGap && (scope === "OUTPUT_KPI_OK_SCOPE" || scope === "OUTPUT_KPI_REJECT_SCOPE" || scope === "UNKNOWN_SCOPE_REVIEW")) return "P10_BLOCKED_SOURCE_DATA_GAP";
  if (scope === "UNKNOWN_SCOPE_REVIEW" || domain === "UNKNOWN_REVIEW") return "P10_BLOCKED_UNKNOWN_REVIEW";
  if (String(blocksP10AfterScope).toLowerCase() === "true") return "P10_BLOCKED_HIGH_RISK_REVIEW";
  if (scope === "OUTPUT_KPI_REJECT_SCOPE") return "P10_REJECT_ATTACHMENT_CANDIDATE";
  if (scope === "OUTPUT_KPI_OK_SCOPE") return "P10_INCLUDED_CANDIDATE";
  return "P10_EXCLUDED_FUTURE_USE";
}

function entityCoverageStatus(input: {
  readonly domain: FutureUseRegistryDomain;
  readonly isSourceGap: boolean;
  readonly approvedEntity: string;
  readonly draftEntity: string;
  readonly conflictReason: string;
}): AuthoritativeEntityCoverageStatus {
  if (input.isSourceGap) return "SOURCE_DATA_GAP";
  if (input.approvedEntity) return "AUTHORITATIVE_MAPPED";
  if (input.conflictReason) return "CONFLICT_REVIEW";
  if (input.draftEntity) return "DRAFT_ENTITY_CANDIDATE";
  if (!domainRequiresEntity(input.domain)) return "NOT_REQUIRED_FOR_DOMAIN";
  return "UNKNOWN";
}

function domainRequiresEntity(domain: FutureUseRegistryDomain): boolean {
  return domain === "PRODUCTION_OUTPUT_DASHBOARD" || domain === "REJECT_ATTACHMENT" || domain === "MASTER_DATA_QUALITY_REVIEW";
}

function rollup(values: readonly string[]): readonly FutureUseRollupRow[] {
  return Object.entries(countBy(values))
    .map(([rollup_key, rows]) => ({ rollup_key, rows, registered_rows: rows }))
    .sort((a, b) => b.rows - a.rows || a.rollup_key.localeCompare(b.rollup_key));
}

function moduleReadiness(rows: readonly FutureUseRawRegistryRow[]): readonly FutureUseModuleReadinessRollupRow[] {
  return Object.entries(groupBy(rows, (row) => row.future_module_candidate)).map(([future_module_candidate, moduleRows]) => {
    const targetMissing = moduleRows.filter((row) => row.target_profile_status === "MISSING_TARGET_PROFILE").length;
    const sourceGap = moduleRows.filter((row) => row.authoritative_entity_status === "SOURCE_DATA_GAP").length;
    const reviewRequired = moduleRows.filter((row) => row.review_required === "true").length;
    const readinessStatus: FutureUseModuleReadinessRollupRow["readiness_status"] = sourceGap > 0
      ? "NEEDS_SOURCE_DATA_REVIEW"
      : targetMissing > 0
        ? "NEEDS_TARGET_PROFILE_REVIEW"
        : reviewRequired > 0
          ? "NEEDS_AUTHORITATIVE_MASTER"
          : "READY_FOR_FUTURE_REVIEW";
    return {
      future_module_candidate: future_module_candidate as FutureModuleCandidate,
      rows: moduleRows.length,
      authoritative_mapped_rows: moduleRows.filter((row) => row.authoritative_entity_status === "AUTHORITATIVE_MAPPED").length,
      draft_entity_candidate_rows: moduleRows.filter((row) => row.authoritative_entity_status === "DRAFT_ENTITY_CANDIDATE").length,
      source_data_gap_rows: sourceGap,
      conflict_review_rows: moduleRows.filter((row) => row.authoritative_entity_status === "CONFLICT_REVIEW").length,
      target_profile_required_rows: moduleRows.filter((row) => row.target_profile_required === "true").length,
      target_profile_missing_rows: targetMissing,
      review_required_rows: reviewRequired,
      readiness_status: readinessStatus
    };
  }).sort((a, b) => b.rows - a.rows || a.future_module_candidate.localeCompare(b.future_module_candidate));
}

function p10Split(rows: readonly FutureUseRawRegistryRow[]): readonly FutureUseP10SplitRow[] {
  const splits: FutureUseP10SplitRow["split"][] = rows.map((row) => {
    if (row.p10_inclusion_status === "P10_INCLUDED_CANDIDATE") return "P10_PRODUCTION_OUTPUT";
    if (row.p10_inclusion_status === "P10_REJECT_ATTACHMENT_CANDIDATE") return "P10_REJECT_ATTACHMENT";
    if (row.p10_inclusion_status === "P10_EXCLUDED_FUTURE_USE") return "FUTURE_USE";
    if (row.p10_inclusion_status === "P10_BLOCKED_SOURCE_DATA_GAP") return "SOURCE_DATA_GAP";
    return "UNKNOWN_OR_HIGH_RISK_REVIEW";
  });
  return Object.entries(countBy(splits)).map(([split, rows]) => ({ split: split as FutureUseP10SplitRow["split"], rows }));
}

function sourceCoverage(rows: readonly FutureUseRawRegistryRow[]): readonly FutureUseSourceCoverageRow[] {
  return Object.entries(groupBy(rows, (row) => [row.source_field, normalizeKey(row.source_value), row.bc_future_use_domain, row.authoritative_entity_status, row.authoritative_entity_code].join("|")))
    .map(([, groupRows]) => {
      const firstRow = groupRows[0]!;
      return {
        source_field: firstRow.source_field,
        source_value: firstRow.source_value,
        bc_future_use_domain: firstRow.bc_future_use_domain,
        rows: groupRows.length,
        authoritative_entity_status: firstRow.authoritative_entity_status,
        authoritative_entity_code: firstRow.authoritative_entity_code,
        review_required: groupRows.some((row) => row.review_required === "true") ? "true" as const : "false" as const,
        review_reason: firstNonEmpty(groupRows.map((row) => row.review_reason))
      };
    })
    .sort((a, b) => b.rows - a.rows || a.source_value.localeCompare(b.source_value));
}

function reviewQueue(sourceRows: readonly FutureUseSourceCoverageRow[], registryRows: readonly FutureUseRawRegistryRow[]): readonly FutureUseReviewQueueRow[] {
  const rows = sourceRows.filter((row) => row.review_required === "true").map((row, index) => ({
    review_id: `FUR${String(index + 1).padStart(5, "0")}`,
    review_type: reviewType(row),
    source_field: row.source_field,
    source_value: row.source_value,
    bc_future_use_domain: row.bc_future_use_domain,
    rows: row.rows,
    review_reason: row.review_reason,
    recommended_action: "Review and classify this source/domain in authoritative master or future module backlog; do not apply automatically."
  }));
  if (rows.length > 0) return rows;
  if (registryRows.length === 0) return [];
  return [];
}

function reviewType(row: FutureUseSourceCoverageRow): FutureUseReviewQueueRow["review_type"] {
  if (row.authoritative_entity_status === "SOURCE_DATA_GAP") return "SOURCE_DATA_GAP";
  if (row.bc_future_use_domain === "UNKNOWN_REVIEW") return "UNKNOWN_REVIEW";
  if (row.authoritative_entity_status === "CONFLICT_REVIEW") return "CONFLICT_REVIEW";
  if (row.review_reason.includes("target profile")) return "TARGET_PROFILE_REVIEW";
  return "MASTER_DATA_QUALITY_REVIEW";
}

function domainCoverage(rows: readonly FutureUseRawRegistryRow[]): readonly FutureUseDomainCoverageRow[] {
  return Object.entries(groupBy(rows, (row) => row.bc_future_use_domain)).map(([domain, groupRows]) => ({
    bc_future_use_domain: domain as FutureUseRegistryDomain,
    rows: groupRows.length,
    authoritative_mapped_rows: groupRows.filter((row) => row.authoritative_entity_status === "AUTHORITATIVE_MAPPED").length,
    draft_entity_candidate_rows: groupRows.filter((row) => row.authoritative_entity_status === "DRAFT_ENTITY_CANDIDATE").length,
    source_data_gap_rows: groupRows.filter((row) => row.authoritative_entity_status === "SOURCE_DATA_GAP").length,
    conflict_review_rows: groupRows.filter((row) => row.authoritative_entity_status === "CONFLICT_REVIEW").length,
    unknown_rows: groupRows.filter((row) => row.authoritative_entity_status === "UNKNOWN").length
  })).sort((a, b) => b.rows - a.rows || a.bc_future_use_domain.localeCompare(b.bc_future_use_domain));
}

function targetProfileRequirements(rows: readonly FutureUseRawRegistryRow[]): readonly FutureUseTargetProfileRequirementRow[] {
  return Object.entries(groupBy(rows, (row) => row.bc_future_use_domain)).map(([domain, groupRows]) => ({
    bc_future_use_domain: domain as FutureUseRegistryDomain,
    rows: groupRows.length,
    target_profile_required_rows: groupRows.filter((row) => row.target_profile_required === "true").length,
    target_profile_covered_rows: groupRows.filter((row) => row.target_profile_status === "COVERED").length,
    target_profile_missing_rows: groupRows.filter((row) => row.target_profile_status === "MISSING_TARGET_PROFILE").length,
    target_profile_not_required_rows: groupRows.filter((row) => row.target_profile_status === "NOT_REQUIRED").length
  })).sort((a, b) => b.rows - a.rows || a.bc_future_use_domain.localeCompare(b.bc_future_use_domain));
}

function emptyBlockedResult(generatedAt: string, outputFolder: string, sourceFile: string): FutureUseRawRegistryResult {
  const summary: FutureUseRawRegistrySummary = {
    generatedAt,
    outputFolder,
    inputSources: [],
    registryStatus: "BLOCKED_MISSING_SOURCE_REPORTS",
    registryGranularity: "ROW",
    totalRegisteredRows: 0,
    rowRegistryRows: 0,
    groupedRegistryRows: 0,
    domainCounts: {},
    registryStatusCounts: {},
    p10InclusionStatusCounts: {},
    futureModuleCounts: {},
    authoritativeCoverage: {
      authoritativeMappedRows: 0,
      draftEntityCandidateRows: 0,
      draftAliasCandidateRows: 0,
      sourceDataGapRows: 0,
      conflictReviewRows: 0,
      unknownRows: 0
    },
    targetProfileCoverage: {
      targetProfileRequiredRows: 0,
      targetProfileCoveredRows: 0,
      targetProfileMissingRows: 0,
      targetProfileNotRequiredRows: 0
    },
    reviewQueueRows: 0,
    sourceDataGapRows: 0,
    unknownReviewRows: 0,
    p10Gate: {
      status: "BLOCKED",
      reason: `P1.0 remains blocked: source report file is missing for future-use raw registry (${sourceFile}).`
    },
    safety: safetyFlags()
  };
  return {
    summary,
    registryRows: [],
    domainRollupRows: [],
    moduleReadinessRollupRows: [],
    p10VsFutureSplitRows: [],
    futureUseSourceCoverageRows: [],
    futureUseReviewQueueRows: [],
    sourceDataGapBacklogRows: [],
    unknownReviewBacklogRows: [],
    authoritativeEntityCoverageByDomainRows: [],
    targetProfileRequirementByDomainRows: [],
    safetyReport: summary.safety
  };
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((groups, value) => {
    const key = keyFor(value);
    groups[key] = groups[key] ?? [];
    groups[key].push(value);
    return groups;
  }, {});
}

function sourceMapKey(sourceField: unknown, sourceValue: unknown): string {
  return `${normalizeSourceField(sourceField)}|${normalizeKey(sourceValue)}`;
}

function targetProfileKey(canonical: unknown, bucket: unknown, machineCenter: unknown): string {
  return [canonical, bucket, machineCenter].map(normalizeKey).join("|");
}

function normalizeSourceField(value: unknown): string {
  const text = clean(value);
  if (text === "g_prod_or_rot_line_description") return "gProdOrRotLineDescription";
  if (text === "g_prod_or_rot_line_no") return "gProdOrRotLineNo";
  if (text === "machine_center_no") return "machineCenterNo";
  return text;
}

function isBlankSource(value: unknown): boolean {
  const key = normalizeKey(value);
  return !key || key === "(BLANK)" || key === "UNMAPPED";
}

function firstNonEmpty(values: readonly string[]): string {
  return values.find((value) => value.trim()) ?? "";
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

function safetyFlags(): FutureUseRawRegistrySummary["safety"] {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  };
}
