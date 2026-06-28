import type {
  AuthoritativeLegacyEvidenceCrosswalkRow,
  AuthoritativeSeedReviewQueueRow
} from "./authoritative-master-seed-draft.js";
import type {
  AuthoritativeNormalizedCanonicalEntityRow,
  AuthoritativeNormalizedSourceMapRow,
  AuthoritativeNormalizedTargetProfileRow
} from "./authoritative-master-intake.js";
import type {
  FutureUseDomainCoverageRow,
  FutureUseRawRegistryRow,
  FutureUseReviewQueueRow,
  FutureUseSourceCoverageRow,
  FutureUseTargetProfileRequirementRow
} from "./future-use-raw-registry.js";

export type AuthoritativeReviewWorkspaceStatus = "GENERATED" | "GENERATED_WITH_WARNINGS" | "BLOCKED_MISSING_INPUTS";
export type AuthoritativeReviewPriority = "P1" | "P2" | "P3";
export type AuthoritativeReviewApprovalStatus = "pending" | "approved" | "rejected" | "deferred" | "needs_correction";

export interface AuthoritativeEntityReviewWorkbookRow {
  readonly review_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly entity_family: string;
  readonly proposed_canonical_entity_code: string;
  readonly proposed_canonical_entity_display_name: string;
  readonly proposed_entity_type: string;
  readonly row_coverage_count: number;
  readonly p10_output_rows: number;
  readonly reject_rows: number;
  readonly future_use_rows: number;
  readonly conflict_rows: number;
  readonly source_data_gap_rows: number;
  readonly legacy_current_entity_codes: string;
  readonly sample_source_values: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeSourceMappingReviewWorkbookRow {
  readonly review_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly source_system: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly mapping_type: string;
  readonly confidence: string;
  readonly rows_covered: number;
  readonly bc_future_use_domains: string;
  readonly p10_inclusion_statuses: string;
  readonly legacy_current_entity_codes: string;
  readonly conflict_flag: "true" | "false";
  readonly conflict_reason: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeTargetProfileReviewWorkbookRow {
  readonly review_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly affected_output_rows: number;
  readonly affected_reject_rows: number;
  readonly target_profile_required: "true" | "false";
  readonly target_profile_status: string;
  readonly proposed_target_qty: string;
  readonly proposed_unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeConflictReviewWorkbookRow {
  readonly review_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly conflict_type: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly legacy_current_entity_codes: string;
  readonly v2_entity_codes: string;
  readonly rows: number;
  readonly bc_future_use_domains: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly risk_level: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeSourceDataGapReviewWorkbookRow {
  readonly review_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly source_gap_type: string;
  readonly rows: number;
  readonly bc_future_use_domains: string;
  readonly p10_inclusion_statuses: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly item_category_codes: string;
  readonly machine_center_nos: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeFutureUseDomainReviewWorkbookRow {
  readonly review_id: string;
  readonly future_use_domain: string;
  readonly future_module_candidate: string;
  readonly rows: number;
  readonly authoritative_entity_status_counts: string;
  readonly target_profile_required_rows: number;
  readonly target_profile_not_required_rows: number;
  readonly unknown_rows: number;
  readonly source_data_gap_rows: number;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeReviewerDecisionTemplateRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approval_status: AuthoritativeReviewApprovalStatus;
  readonly approved_action: string;
  readonly approved_canonical_entity_code: string;
  readonly approved_source_field: string;
  readonly approved_source_value: string;
  readonly approved_mapping_type: string;
  readonly approved_target_bucket: string;
  readonly approved_machine_center_no: string;
  readonly approved_target_qty: string;
  readonly approved_unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeReviewPriorityBoardRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly rows: number;
  readonly review_subject: string;
  readonly review_reason: string;
  readonly recommended_action: string;
}

export interface AuthoritativeReviewChecklistRow {
  readonly checklist_id: string;
  readonly priority: AuthoritativeReviewPriority;
  readonly checklist_item: string;
  readonly status: "pending";
  readonly owner: string;
  readonly notes: string;
}

export interface AuthoritativeReviewImportManifest {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly files: readonly string[];
  readonly allowedApprovalStatuses: readonly AuthoritativeReviewApprovalStatus[];
  readonly allowedApprovedActions: readonly string[];
  readonly safetyNote: string;
}

export interface AuthoritativeMasterReviewWorkspaceSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly sourceFolders: readonly string[];
  readonly workspaceStatus: AuthoritativeReviewWorkspaceStatus;
  readonly entityReviewRows: number;
  readonly sourceMappingReviewRows: number;
  readonly targetProfileReviewRows: number;
  readonly conflictReviewRows: number;
  readonly sourceDataGapReviewRows: number;
  readonly futureUseDomainReviewRows: number;
  readonly reviewerDecisionRows: number;
  readonly p1Rows: number;
  readonly p2Rows: number;
  readonly p3Rows: number;
  readonly pendingRows: number;
  readonly approvedRows: number;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly aliasesChanged: false;
    readonly authoritativeMasterApproved: false;
    readonly conditionalRulesChanged: false;
    readonly dashboardChanged: false;
    readonly p10Enabled: false;
  };
}

export interface AuthoritativeMasterReviewWorkspaceResult {
  readonly summary: AuthoritativeMasterReviewWorkspaceSummary;
  readonly entityReviewRows: readonly AuthoritativeEntityReviewWorkbookRow[];
  readonly sourceMappingReviewRows: readonly AuthoritativeSourceMappingReviewWorkbookRow[];
  readonly targetProfileReviewRows: readonly AuthoritativeTargetProfileReviewWorkbookRow[];
  readonly conflictReviewRows: readonly AuthoritativeConflictReviewWorkbookRow[];
  readonly sourceDataGapReviewRows: readonly AuthoritativeSourceDataGapReviewWorkbookRow[];
  readonly futureUseDomainReviewRows: readonly AuthoritativeFutureUseDomainReviewWorkbookRow[];
  readonly reviewerDecisionTemplateRows: readonly AuthoritativeReviewerDecisionTemplateRow[];
  readonly reviewPriorityBoardRows: readonly AuthoritativeReviewPriorityBoardRow[];
  readonly reviewChecklistRows: readonly AuthoritativeReviewChecklistRow[];
  readonly importManifest: AuthoritativeReviewImportManifest;
}

interface RegistryGroup {
  rows: FutureUseRawRegistryRow[];
  rowCount: number;
  domains: Set<string>;
  p10Statuses: Set<string>;
  documents: Set<string>;
  items: Set<string>;
  itemCategories: Set<string>;
  machineCenters: Set<string>;
}

const allowedApprovalStatuses = ["pending", "approved", "rejected", "deferred", "needs_correction"] as const;
const allowedApprovedActions = [
  "APPROVE_CANONICAL_ENTITY",
  "APPROVE_SOURCE_MAPPING",
  "APPROVE_REVIEWED_ALIAS",
  "APPROVE_TARGET_PROFILE",
  "REJECT_CANDIDATE",
  "DEFER_REVIEW",
  "SOURCE_DATA_BACKLOG",
  "FUTURE_USE_ONLY",
  "NEEDS_CORRECTION"
] as const;

export function buildAuthoritativeMasterReviewWorkspace(input: {
  readonly seedCanonicalRows: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  readonly seedSourceMapRows: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly seedTargetProfileRows: readonly AuthoritativeNormalizedTargetProfileRow[];
  readonly seedReviewQueueRows: readonly AuthoritativeSeedReviewQueueRow[];
  readonly legacyCrosswalkRows: readonly AuthoritativeLegacyEvidenceCrosswalkRow[];
  readonly registryRows: readonly FutureUseRawRegistryRow[];
  readonly registrySourceCoverageRows: readonly FutureUseSourceCoverageRow[];
  readonly registryReviewQueueRows: readonly FutureUseReviewQueueRow[];
  readonly domainCoverageRows: readonly FutureUseDomainCoverageRow[];
  readonly targetProfileRequirementRows: readonly FutureUseTargetProfileRequirementRow[];
  readonly requiredInputsAvailable: boolean;
  readonly outputFolder: string;
  readonly sourceFolders: readonly string[];
  readonly generatedAt?: string;
}): AuthoritativeMasterReviewWorkspaceResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (!input.requiredInputsAvailable) return blockedMissingInputs(generatedAt, input.outputFolder, input.sourceFolders);

  const registryBySource = groupRegistryBySource(input.registryRows);
  const crosswalkBySource = new Map(input.legacyCrosswalkRows.map((row) => [normalizeKey(row.source_value), row]));
  const seedReviewBySource = new Map(input.seedReviewQueueRows.map((row) => [sourceKey(row.source_field, row.source_value), row]));
  const sourceMapsByCanonical = groupBy(input.seedSourceMapRows, (row) => normalizeKey(row.canonical_entity_code));

  const entityRows = input.seedCanonicalRows.map((row, index) => {
    const sourceMaps = sourceMapsByCanonical[normalizeKey(row.canonical_entity_code)] ?? [];
    const groups = sourceMaps.map((sourceMap) => registryBySource.get(sourceKey(sourceMap.source_field, sourceMap.source_value))).filter(Boolean) as RegistryGroup[];
    const allRows = groups.flatMap((group) => group.rows);
    const p10OutputRows = allRows.filter((registryRow) => registryRow.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD").length;
    const rejectRows = allRows.filter((registryRow) => registryRow.bc_future_use_domain === "REJECT_ATTACHMENT").length;
    const conflictRows = allRows.filter((registryRow) => registryRow.authoritative_entity_status === "CONFLICT_REVIEW").length;
    const sourceDataGapRows = allRows.filter((registryRow) => registryRow.authoritative_entity_status === "SOURCE_DATA_GAP").length;
    const priority = priorityForImpact({ p10OutputRows, rejectRows, conflictRows, sourceDataGapRows, rows: allRows.length });
    const sampleSourceValues = sourceMaps.map((sourceMap) => sourceMap.source_value).slice(0, 10).join("|");
    const relatedCrosswalk = sourceMaps.map((sourceMap) => crosswalkBySource.get(normalizeKey(sourceMap.source_value))).filter(Boolean) as AuthoritativeLegacyEvidenceCrosswalkRow[];
    return {
      review_id: `ER${String(index + 1).padStart(5, "0")}`,
      priority,
      entity_family: clean(row.entity_family) || "OTHER",
      proposed_canonical_entity_code: row.canonical_entity_code,
      proposed_canonical_entity_display_name: row.canonical_entity_display_name,
      proposed_entity_type: row.entity_type,
      row_coverage_count: allRows.length,
      p10_output_rows: p10OutputRows,
      reject_rows: rejectRows,
      future_use_rows: allRows.length - p10OutputRows - rejectRows,
      conflict_rows: conflictRows,
      source_data_gap_rows: sourceDataGapRows,
      legacy_current_entity_codes: joinUnique(relatedCrosswalk.flatMap((crosswalk) => splitPipe(crosswalk.legacy_current_entity_codes))),
      sample_source_values: sampleSourceValues,
      sample_documents: joinUnique(relatedCrosswalk.flatMap((crosswalk) => splitPipe(crosswalk.sample_documents)), 10),
      sample_items: joinUnique(relatedCrosswalk.flatMap((crosswalk) => splitPipe(crosswalk.sample_items)), 10),
      recommended_action: conflictRows > 0 ? "REVIEW_CANONICAL_CONFLICT" : "REVIEW_CANONICAL_ENTITY_DRAFT",
      approval_status: "pending" as const,
      reviewer: "",
      reviewer_notes: ""
    };
  });

  const sourceRows = input.seedSourceMapRows.map((row, index) => {
    const key = sourceKey(row.source_field, row.source_value);
    const group = registryBySource.get(key);
    const seedReview = seedReviewBySource.get(key);
    const crosswalk = crosswalkBySource.get(normalizeKey(row.source_value));
    const conflictRows = group?.rows.filter((registryRow) => registryRow.authoritative_entity_status === "CONFLICT_REVIEW").length ?? 0;
    const p10Rows = group?.rows.filter((registryRow) => registryRow.p10_inclusion_status !== "P10_EXCLUDED_FUTURE_USE").length ?? 0;
    const priority = priorityForImpact({ p10OutputRows: outputRows(group), rejectRows: rejectRows(group), conflictRows, sourceDataGapRows: 0, rows: group?.rowCount ?? 0 });
    return {
      review_id: `SM${String(index + 1).padStart(5, "0")}`,
      priority,
      source_system: row.source_system,
      source_field: row.source_field,
      source_value: row.source_value,
      proposed_canonical_entity_code: row.canonical_entity_code,
      mapping_type: row.mapping_type,
      confidence: row.confidence,
      rows_covered: group?.rowCount ?? 0,
      bc_future_use_domains: joinSet(group?.domains),
      p10_inclusion_statuses: joinSet(group?.p10Statuses),
      legacy_current_entity_codes: crosswalk?.legacy_current_entity_codes ?? "",
      conflict_flag: conflictRows > 0 || seedReview ? "true" as const : "false" as const,
      conflict_reason: seedReview?.review_reason ?? firstConflictReason(group),
      recommended_action: p10Rows > 0 || conflictRows > 0 ? "REVIEW_SOURCE_MAPPING_BEFORE_P1" : "REVIEW_SOURCE_MAPPING_FOR_FUTURE_USE",
      approval_status: "pending" as const,
      reviewer: "",
      reviewer_notes: ""
    };
  });

  const targetRows = buildTargetRows(input.seedTargetProfileRows, input.registryRows);
  const conflictRows = buildConflictRows(input.seedReviewQueueRows, input.registryReviewQueueRows, input.legacyCrosswalkRows);
  const sourceGapRows = buildSourceGapRows(input.registryRows, input.registryReviewQueueRows);
  const domainRows = buildFutureDomainRows(input.domainCoverageRows, input.targetProfileRequirementRows);
  const reviewerDecisionRows = [
    ...entityRows.map((row) => reviewerDecision(row.review_id, "ENTITY", { canonical: row.proposed_canonical_entity_code })),
    ...sourceRows.map((row) => reviewerDecision(row.review_id, "SOURCE_MAPPING", { canonical: row.proposed_canonical_entity_code, sourceField: row.source_field, sourceValue: row.source_value, mappingType: row.mapping_type })),
    ...targetRows.map((row) => reviewerDecision(row.review_id, "TARGET_PROFILE", { canonical: row.canonical_entity_code, targetBucket: row.target_bucket, machineCenter: row.machine_center_no, targetQty: row.proposed_target_qty, unit: row.proposed_unit, effectiveFrom: row.effective_from, effectiveTo: row.effective_to })),
    ...conflictRows.map((row) => reviewerDecision(row.review_id, "CONFLICT", { canonical: row.proposed_canonical_entity_code, sourceField: row.source_field, sourceValue: row.source_value })),
    ...sourceGapRows.map((row) => reviewerDecision(row.review_id, "SOURCE_DATA_GAP", {})),
    ...domainRows.map((row) => reviewerDecision(row.review_id, "FUTURE_USE_DOMAIN", {}))
  ];
  const priorityBoardRows = buildPriorityBoard(entityRows, sourceRows, targetRows, conflictRows, sourceGapRows, domainRows);
  const checklistRows = buildChecklistRows();
  const summary = summaryFor({
    generatedAt,
    outputFolder: input.outputFolder,
    sourceFolders: input.sourceFolders,
    entityRows,
    sourceRows,
    targetRows,
    conflictRows,
    sourceGapRows,
    domainRows,
    reviewerDecisionRows,
    priorityBoardRows,
    workspaceStatus: sourceGapRows.length > 0 || conflictRows.length > 0 || targetRows.some((row) => row.target_profile_status === "MISSING_TARGET_PROFILE") ? "GENERATED_WITH_WARNINGS" : "GENERATED"
  });

  return {
    summary,
    entityReviewRows: entityRows,
    sourceMappingReviewRows: sourceRows,
    targetProfileReviewRows: targetRows,
    conflictReviewRows: conflictRows,
    sourceDataGapReviewRows: sourceGapRows,
    futureUseDomainReviewRows: domainRows,
    reviewerDecisionTemplateRows: reviewerDecisionRows,
    reviewPriorityBoardRows: priorityBoardRows,
    reviewChecklistRows: checklistRows,
    importManifest: manifest(generatedAt, input.outputFolder)
  };
}

function buildTargetRows(targetProfiles: readonly AuthoritativeNormalizedTargetProfileRow[], registryRows: readonly FutureUseRawRegistryRow[]): AuthoritativeTargetProfileReviewWorkbookRow[] {
  const rows: AuthoritativeTargetProfileReviewWorkbookRow[] = [];
  const outputByCanonicalBucket = groupBy(registryRows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD"), (row) => targetKey(row.authoritative_entity_code, "", row.machine_center_no));
  const rejectByCanonical = groupBy(registryRows.filter((row) => row.bc_future_use_domain === "REJECT_ATTACHMENT"), (row) => normalizeKey(row.authoritative_entity_code));
  const seen = new Set<string>();

  for (const targetProfile of targetProfiles) {
    const key = targetKey(targetProfile.canonical_entity_code, targetProfile.target_bucket, targetProfile.machine_center_no);
    if (seen.has(key)) continue;
    seen.add(key);
    const outputRows = matchingTargetRows(registryRows, targetProfile, "PRODUCTION_OUTPUT_DASHBOARD").length;
    const affectedRejectRows = (rejectByCanonical[normalizeKey(targetProfile.canonical_entity_code)] ?? []).length;
    const targetRequired = outputRows > 0;
    rows.push({
      review_id: `TP${String(rows.length + 1).padStart(5, "0")}`,
      priority: targetRequired ? "P1" : affectedRejectRows > 0 ? "P2" : "P3",
      canonical_entity_code: targetProfile.canonical_entity_code,
      target_bucket: targetProfile.target_bucket,
      machine_center_no: targetProfile.machine_center_no,
      affected_output_rows: outputRows,
      affected_reject_rows: affectedRejectRows,
      target_profile_required: targetRequired ? "true" : "false",
      target_profile_status: targetRequired ? "MISSING_TARGET_PROFILE" : "CONDITIONAL_OR_FUTURE_USE",
      proposed_target_qty: targetProfile.target_qty,
      proposed_unit: targetProfile.unit,
      effective_from: targetProfile.effective_from,
      effective_to: targetProfile.effective_to,
      recommended_action: !targetProfile.target_qty || !targetProfile.unit ? "FILL_TARGET_PROFILE" : targetRequired ? "REVIEW_REQUIRED_PRODUCTION_TARGET_PROFILE" : "REVIEW_OPTIONAL_FUTURE_CONTEXT_TARGET_PROFILE",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  }

  for (const [key, groupedRows] of Object.entries(outputByCanonicalBucket)) {
    if (seen.has(key)) continue;
    const firstRow = groupedRows[0]!;
    rows.push({
      review_id: `TP${String(rows.length + 1).padStart(5, "0")}`,
      priority: "P1",
      canonical_entity_code: firstRow.authoritative_entity_code,
      target_bucket: "",
      machine_center_no: firstRow.machine_center_no,
      affected_output_rows: groupedRows.length,
      affected_reject_rows: 0,
      target_profile_required: "true",
      target_profile_status: "MISSING_TARGET_PROFILE",
      proposed_target_qty: "",
      proposed_unit: "",
      effective_from: "",
      effective_to: "",
      recommended_action: "FILL_TARGET_PROFILE",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  }
  return rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.affected_output_rows - a.affected_output_rows);
}

function buildConflictRows(
  seedReviewRows: readonly AuthoritativeSeedReviewQueueRow[],
  registryReviewRows: readonly FutureUseReviewQueueRow[],
  crosswalkRows: readonly AuthoritativeLegacyEvidenceCrosswalkRow[]
): AuthoritativeConflictReviewWorkbookRow[] {
  const crosswalkBySource = new Map(crosswalkRows.map((row) => [normalizeKey(row.source_value), row]));
  const rows: AuthoritativeConflictReviewWorkbookRow[] = [];
  for (const row of seedReviewRows.filter((candidate) => candidate.review_category !== "SOURCE_REVIEW")) {
    const crosswalk = crosswalkBySource.get(normalizeKey(row.source_value));
    rows.push({
      review_id: `CR${String(rows.length + 1).padStart(5, "0")}`,
      priority: conflictPriority(row.rows, row.review_reason),
      conflict_type: conflictType(row.review_reason),
      source_field: row.source_field,
      source_value: row.source_value,
      proposed_canonical_entity_code: row.proposed_canonical_entity_code,
      legacy_current_entity_codes: crosswalk?.legacy_current_entity_codes ?? "",
      v2_entity_codes: crosswalk?.v2_entity_codes ?? "",
      rows: row.rows,
      bc_future_use_domains: crosswalk?.target_bucket_candidates ?? "",
      sample_documents: row.sample_documents,
      sample_items: row.sample_items,
      risk_level: row.rows >= 1000 ? "HIGH" : row.rows >= 100 ? "MEDIUM" : "LOW",
      recommended_action: "MANUAL_REVIEW_REQUIRED",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  }
  for (const row of registryReviewRows.filter((candidate) => candidate.review_type === "CONFLICT_REVIEW")) {
    const duplicate = rows.some((existing) => normalizeKey(existing.source_value) === normalizeKey(row.source_value) && existing.source_field === row.source_field);
    if (duplicate) continue;
    const crosswalk = crosswalkBySource.get(normalizeKey(row.source_value));
    rows.push({
      review_id: `CR${String(rows.length + 1).padStart(5, "0")}`,
      priority: conflictPriority(row.rows, row.review_reason),
      conflict_type: conflictType(row.review_reason),
      source_field: row.source_field,
      source_value: row.source_value,
      proposed_canonical_entity_code: crosswalk?.proposed_canonical_entity_code ?? "",
      legacy_current_entity_codes: crosswalk?.legacy_current_entity_codes ?? "",
      v2_entity_codes: crosswalk?.v2_entity_codes ?? "",
      rows: row.rows,
      bc_future_use_domains: row.bc_future_use_domain,
      sample_documents: crosswalk?.sample_documents ?? "",
      sample_items: crosswalk?.sample_items ?? "",
      risk_level: row.rows >= 1000 ? "HIGH" : row.rows >= 100 ? "MEDIUM" : "LOW",
      recommended_action: "MANUAL_REVIEW_REQUIRED",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  }
  return rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.rows - a.rows);
}

function buildSourceGapRows(registryRows: readonly FutureUseRawRegistryRow[], reviewRows: readonly FutureUseReviewQueueRow[]): AuthoritativeSourceDataGapReviewWorkbookRow[] {
  const sourceGapReviewRows = reviewRows.filter((row) => row.review_type === "SOURCE_DATA_GAP" || row.review_type === "UNKNOWN_REVIEW");
  const registryByDomain = groupBy(registryRows.filter((row) => row.authoritative_entity_status === "SOURCE_DATA_GAP"), (row) => row.bc_future_use_domain);
  return sourceGapReviewRows.map((row, index) => {
    const groupedRows = registryByDomain[row.bc_future_use_domain] ?? [];
    const priority: AuthoritativeReviewPriority = row.bc_future_use_domain === "UNKNOWN_REVIEW" || row.review_reason.includes("P1") ? "P1" : row.rows >= 1000 ? "P2" : "P3";
    return {
      review_id: `SG${String(index + 1).padStart(5, "0")}`,
      priority,
      source_gap_type: row.bc_future_use_domain === "UNKNOWN_REVIEW" ? "UNKNOWN_SOURCE_GAP" : "FUTURE_USE_SOURCE_GAP",
      rows: row.rows,
      bc_future_use_domains: row.bc_future_use_domain,
      p10_inclusion_statuses: joinUnique(groupedRows.map((registryRow) => registryRow.p10_inclusion_status)),
      sample_documents: joinUnique(groupedRows.map((registryRow) => registryRow.document_no), 10),
      sample_items: joinUnique(groupedRows.map((registryRow) => registryRow.item_no), 10),
      item_category_codes: joinUnique(groupedRows.map((registryRow) => registryRow.item_category_code), 10),
      machine_center_nos: joinUnique(groupedRows.map((registryRow) => registryRow.machine_center_no), 10),
      recommended_action: row.bc_future_use_domain === "UNKNOWN_REVIEW" ? "SOURCE_DATA_BACKLOG_BEFORE_P1" : "SOURCE_DATA_BACKLOG_FOR_FUTURE_USE",
      approval_status: "pending" as const,
      reviewer: "",
      reviewer_notes: ""
    };
  }).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.rows - a.rows);
}

function buildFutureDomainRows(
  domainRows: readonly FutureUseDomainCoverageRow[],
  targetRows: readonly FutureUseTargetProfileRequirementRow[]
): AuthoritativeFutureUseDomainReviewWorkbookRow[] {
  const targetByDomain = new Map(targetRows.map((row) => [row.bc_future_use_domain, row]));
  return domainRows.map((row, index) => {
    const target = targetByDomain.get(row.bc_future_use_domain);
    return {
      review_id: `FD${String(index + 1).padStart(5, "0")}`,
      future_use_domain: row.bc_future_use_domain,
      future_module_candidate: moduleForDomain(row.bc_future_use_domain),
      rows: row.rows,
      authoritative_entity_status_counts: `AUTHORITATIVE_MAPPED=${row.authoritative_mapped_rows}|DRAFT_ENTITY_CANDIDATE=${row.draft_entity_candidate_rows}|SOURCE_DATA_GAP=${row.source_data_gap_rows}|CONFLICT_REVIEW=${row.conflict_review_rows}|UNKNOWN=${row.unknown_rows}`,
      target_profile_required_rows: target?.target_profile_required_rows ?? 0,
      target_profile_not_required_rows: target?.target_profile_not_required_rows ?? row.rows,
      unknown_rows: row.unknown_rows,
      source_data_gap_rows: row.source_data_gap_rows,
      recommended_action: row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "REVIEW_FOR_P1_OUTPUT_READINESS" : "REVIEW_FOR_FUTURE_MODULE_BACKLOG",
      approval_status: "pending" as const,
      reviewer: "",
      reviewer_notes: ""
    };
  }).sort((a, b) => b.rows - a.rows);
}

function reviewerDecision(reviewId: string, reviewType: string, values: {
  readonly canonical?: string;
  readonly sourceField?: string;
  readonly sourceValue?: string;
  readonly mappingType?: string;
  readonly targetBucket?: string;
  readonly machineCenter?: string;
  readonly targetQty?: string;
  readonly unit?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
}): AuthoritativeReviewerDecisionTemplateRow {
  return {
    review_id: reviewId,
    review_type: reviewType,
    approval_status: "pending",
    approved_action: "",
    approved_canonical_entity_code: values.canonical ?? "",
    approved_source_field: values.sourceField ?? "",
    approved_source_value: values.sourceValue ?? "",
    approved_mapping_type: values.mappingType ?? "",
    approved_target_bucket: values.targetBucket ?? "",
    approved_machine_center_no: values.machineCenter ?? "",
    approved_target_qty: values.targetQty ?? "",
    approved_unit: values.unit ?? "",
    effective_from: values.effectiveFrom ?? "",
    effective_to: values.effectiveTo ?? "",
    reviewer: "",
    reviewer_notes: ""
  };
}

function buildPriorityBoard(
  entityRows: readonly AuthoritativeEntityReviewWorkbookRow[],
  sourceRows: readonly AuthoritativeSourceMappingReviewWorkbookRow[],
  targetRows: readonly AuthoritativeTargetProfileReviewWorkbookRow[],
  conflictRows: readonly AuthoritativeConflictReviewWorkbookRow[],
  sourceGapRows: readonly AuthoritativeSourceDataGapReviewWorkbookRow[],
  domainRows: readonly AuthoritativeFutureUseDomainReviewWorkbookRow[]
): readonly AuthoritativeReviewPriorityBoardRow[] {
  return [
    ...entityRows.map((row) => priorityBoard(row.review_id, "ENTITY", row.priority, row.row_coverage_count, row.proposed_canonical_entity_code, row.recommended_action)),
    ...sourceRows.map((row) => priorityBoard(row.review_id, "SOURCE_MAPPING", row.priority, row.rows_covered, row.source_value, row.recommended_action)),
    ...targetRows.map((row) => priorityBoard(row.review_id, "TARGET_PROFILE", row.priority, row.affected_output_rows + row.affected_reject_rows, row.canonical_entity_code, row.recommended_action)),
    ...conflictRows.map((row) => priorityBoard(row.review_id, "CONFLICT", row.priority, row.rows, row.source_value, row.recommended_action)),
    ...sourceGapRows.map((row) => priorityBoard(row.review_id, "SOURCE_DATA_GAP", row.priority, row.rows, row.source_gap_type, row.recommended_action)),
    ...domainRows.map((row) => {
      const priority: AuthoritativeReviewPriority = row.future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "P1" : row.rows >= 1000 ? "P2" : "P3";
      return priorityBoard(row.review_id, "FUTURE_USE_DOMAIN", priority, row.rows, row.future_use_domain, row.recommended_action);
    })
  ].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.rows - a.rows);
}

function priorityBoard(review_id: string, review_type: string, priority: AuthoritativeReviewPriority, rows: number, subject: string, action: string): AuthoritativeReviewPriorityBoardRow {
  return {
    review_id,
    review_type,
    priority,
    rows,
    review_subject: subject,
    review_reason: action,
    recommended_action: action
  };
}

function buildChecklistRows(): readonly AuthoritativeReviewChecklistRow[] {
  return [
    checklist("CHK001", "P1", "Review P1 production output entity conflicts and missing target profiles."),
    checklist("CHK002", "P1", "Review source data gaps that affect P1.0 or unknown scope rows."),
    checklist("CHK003", "P2", "Review high-volume future-use source conflicts and draft source mappings."),
    checklist("CHK004", "P2", "Review target profile drafts for production output candidates."),
    checklist("CHK005", "P3", "Defer low-volume future-use and informational crosswalk rows as needed.")
  ];
}

function checklist(checklist_id: string, priority: AuthoritativeReviewPriority, checklist_item: string): AuthoritativeReviewChecklistRow {
  return { checklist_id, priority, checklist_item, status: "pending", owner: "", notes: "" };
}

function summaryFor(input: {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly sourceFolders: readonly string[];
  readonly entityRows: readonly AuthoritativeEntityReviewWorkbookRow[];
  readonly sourceRows: readonly AuthoritativeSourceMappingReviewWorkbookRow[];
  readonly targetRows: readonly AuthoritativeTargetProfileReviewWorkbookRow[];
  readonly conflictRows: readonly AuthoritativeConflictReviewWorkbookRow[];
  readonly sourceGapRows: readonly AuthoritativeSourceDataGapReviewWorkbookRow[];
  readonly domainRows: readonly AuthoritativeFutureUseDomainReviewWorkbookRow[];
  readonly reviewerDecisionRows: readonly AuthoritativeReviewerDecisionTemplateRow[];
  readonly priorityBoardRows: readonly AuthoritativeReviewPriorityBoardRow[];
  readonly workspaceStatus: AuthoritativeReviewWorkspaceStatus;
}): AuthoritativeMasterReviewWorkspaceSummary {
  return {
    generatedAt: input.generatedAt,
    outputFolder: input.outputFolder,
    sourceFolders: input.sourceFolders,
    workspaceStatus: input.workspaceStatus,
    entityReviewRows: input.entityRows.length,
    sourceMappingReviewRows: input.sourceRows.length,
    targetProfileReviewRows: input.targetRows.length,
    conflictReviewRows: input.conflictRows.length,
    sourceDataGapReviewRows: input.sourceGapRows.length,
    futureUseDomainReviewRows: input.domainRows.length,
    reviewerDecisionRows: input.reviewerDecisionRows.length,
    p1Rows: input.priorityBoardRows.filter((row) => row.priority === "P1").length,
    p2Rows: input.priorityBoardRows.filter((row) => row.priority === "P2").length,
    p3Rows: input.priorityBoardRows.filter((row) => row.priority === "P3").length,
    pendingRows: input.reviewerDecisionRows.filter((row) => row.approval_status === "pending").length,
    approvedRows: 0,
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked: authoritative master review workspace rows are pending and this command is export-only."
    },
    safety: safetyFlags()
  };
}

function blockedMissingInputs(generatedAt: string, outputFolder: string, sourceFolders: readonly string[]): AuthoritativeMasterReviewWorkspaceResult {
  const summary: AuthoritativeMasterReviewWorkspaceSummary = {
    generatedAt,
    outputFolder,
    sourceFolders,
    workspaceStatus: "BLOCKED_MISSING_INPUTS",
    entityReviewRows: 0,
    sourceMappingReviewRows: 0,
    targetProfileReviewRows: 0,
    conflictReviewRows: 0,
    sourceDataGapReviewRows: 0,
    futureUseDomainReviewRows: 0,
    reviewerDecisionRows: 0,
    p1Rows: 0,
    p2Rows: 0,
    p3Rows: 0,
    pendingRows: 0,
    approvedRows: 0,
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked: required P0.9n/P0.9o review workspace inputs are missing."
    },
    safety: safetyFlags()
  };
  return {
    summary,
    entityReviewRows: [],
    sourceMappingReviewRows: [],
    targetProfileReviewRows: [],
    conflictReviewRows: [],
    sourceDataGapReviewRows: [],
    futureUseDomainReviewRows: [],
    reviewerDecisionTemplateRows: [],
    reviewPriorityBoardRows: [],
    reviewChecklistRows: buildChecklistRows(),
    importManifest: manifest(generatedAt, outputFolder)
  };
}

function manifest(generatedAt: string, outputFolder: string): AuthoritativeReviewImportManifest {
  return {
    generatedAt,
    outputFolder,
    files: [
      "entity-review-workbook.csv",
      "source-mapping-review-workbook.csv",
      "target-profile-review-workbook.csv",
      "conflict-review-workbook.csv",
      "source-data-gap-review-workbook.csv",
      "future-use-domain-review-workbook.csv",
      "reviewer-decision-template.csv"
    ],
    allowedApprovalStatuses,
    allowedApprovedActions,
    safetyNote: "Review workspace/export only; no approved master data is applied by this command."
  };
}

function groupRegistryBySource(rows: readonly FutureUseRawRegistryRow[]): Map<string, RegistryGroup> {
  const groups = new Map<string, RegistryGroup>();
  for (const row of rows) {
    const key = sourceKey(row.source_field, row.source_value);
    const group = groups.get(key) ?? {
      rows: [],
      rowCount: 0,
      domains: new Set<string>(),
      p10Statuses: new Set<string>(),
      documents: new Set<string>(),
      items: new Set<string>(),
      itemCategories: new Set<string>(),
      machineCenters: new Set<string>()
    };
    group.rows.push(row);
    group.rowCount += 1;
    add(group.domains, row.bc_future_use_domain);
    add(group.p10Statuses, row.p10_inclusion_status);
    add(group.documents, row.document_no, 10);
    add(group.items, row.item_no, 10);
    add(group.itemCategories, row.item_category_code, 10);
    add(group.machineCenters, row.machine_center_no, 10);
    groups.set(key, group);
  }
  return groups;
}

function matchingTargetRows(rows: readonly FutureUseRawRegistryRow[], targetProfile: AuthoritativeNormalizedTargetProfileRow, domain: string): readonly FutureUseRawRegistryRow[] {
  return rows.filter((row) => row.bc_future_use_domain === domain
    && normalizeKey(row.authoritative_entity_code) === normalizeKey(targetProfile.canonical_entity_code)
    && (!targetProfile.machine_center_no || normalizeKey(row.machine_center_no) === normalizeKey(targetProfile.machine_center_no)));
}

function priorityForImpact(input: { readonly p10OutputRows: number; readonly rejectRows: number; readonly conflictRows: number; readonly sourceDataGapRows: number; readonly rows: number }): AuthoritativeReviewPriority {
  if (input.p10OutputRows > 0 && (input.conflictRows > 0 || input.sourceDataGapRows > 0)) return "P1";
  if (input.p10OutputRows > 0 || input.rejectRows > 0) return "P1";
  if (input.rows >= 1000 || input.conflictRows > 0 || input.sourceDataGapRows > 0) return "P2";
  return "P3";
}

function conflictPriority(rows: number, reason: string): AuthoritativeReviewPriority {
  const normalized = normalizeKey(reason);
  if (normalized.includes("OMSO") || normalized.includes("WRONG SIZE") || normalized.includes("P1")) return "P1";
  if (rows >= 1000 || normalized.includes("CONFLICT")) return "P2";
  return "P3";
}

function conflictType(reason: string): string {
  const normalized = normalizeKey(reason);
  if (normalized.includes("OMSO")) return "OMSO_CANONICAL_CONFLICT";
  if (normalized.includes("WRONG SIZE") || normalized.includes("VARIANT")) return "WRONG_SIZE_OR_VARIANT";
  if (normalized.includes("POLYPRINT")) return "POLYPRINT_NAMING_NORMALIZATION";
  if (normalized.includes("THERMO")) return "THERMO_HENGFENG_CANONICAL_GAP";
  if (normalized.includes("BORCH")) return "BORCH_SIZE_WEIGHT_VARIANT";
  if (normalized.includes("MACHINECENTER")) return "MACHINE_CENTER_FALLBACK_ONLY";
  if (normalized.includes("BROAD")) return "BROAD_UNSAFE_SOURCE_VALUE";
  return "LEGACY_CURRENT_ENTITY_CONFLICT";
}

function outputRows(group?: RegistryGroup): number {
  return group?.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD").length ?? 0;
}

function rejectRows(group?: RegistryGroup): number {
  return group?.rows.filter((row) => row.bc_future_use_domain === "REJECT_ATTACHMENT").length ?? 0;
}

function firstConflictReason(group?: RegistryGroup): string {
  return group?.rows.find((row) => row.authoritative_entity_status === "CONFLICT_REVIEW")?.review_reason ?? "";
}

function moduleForDomain(domain: string): string {
  return domain.toLowerCase().replaceAll("_or_", "-").replaceAll("_", "-");
}

function sourceKey(sourceField: string, sourceValue: string): string {
  return `${sourceField}|${normalizeKey(sourceValue)}`;
}

function targetKey(canonical: string, bucket: string, machineCenter: string): string {
  return [canonical, bucket, machineCenter].map(normalizeKey).join("|");
}

function groupBy<T>(rows: readonly T[], keyFor: (row: T) => string): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    const key = keyFor(row);
    groups[key] = groups[key] ?? [];
    groups[key].push(row);
    return groups;
  }, {});
}

function add(values: Set<string>, value: string, limit = 20): void {
  const cleaned = clean(value);
  if (!cleaned || values.size >= limit) return;
  values.add(cleaned);
}

function joinSet(values?: ReadonlySet<string>, limit = 20): string {
  return [...(values ?? new Set<string>())].slice(0, limit).join("|");
}

function joinUnique(values: readonly string[], limit = 20): string {
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit).join("|");
}

function splitPipe(value: string): readonly string[] {
  return clean(value).split("|").map(clean).filter(Boolean);
}

function priorityRank(priority: AuthoritativeReviewPriority): number {
  return priority === "P1" ? 1 : priority === "P2" ? 2 : 3;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

function safetyFlags(): AuthoritativeMasterReviewWorkspaceSummary["safety"] {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    authoritativeMasterApproved: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  };
}
