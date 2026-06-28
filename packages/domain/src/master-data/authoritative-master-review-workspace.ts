import type {
  AuthoritativeLegacyEvidenceCrosswalkRow,
  AuthoritativeSeedReviewQueueRow
} from "./authoritative-master-seed-draft.js";
import type {
  FutureUseRawRegistryRow,
  FutureUseReviewQueueRow,
  FutureUseTargetProfileRequirementRow
} from "./future-use-raw-registry.js";

export type AuthoritativeMasterReviewWorkspaceStatus = "GENERATED" | "GENERATED_WITH_WARNINGS" | "BLOCKED_MISSING_INPUTS";
export type AuthoritativeMasterReviewPriority = "P1" | "P2" | "P3";
export type AuthoritativeMasterReviewApprovalStatus = "pending" | "approved" | "rejected" | "deferred" | "needs_correction";

export interface AuthoritativeMasterReviewWorkspaceSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly sourceFolders: readonly string[];
  readonly workspaceStatus: AuthoritativeMasterReviewWorkspaceStatus;
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
  readonly safety: AuthoritativeMasterReviewWorkspaceSafety;
}

export interface AuthoritativeMasterReviewWorkspaceSafety {
  readonly databaseUpdated: false;
  readonly productionOutputsUpdated: false;
  readonly targetProfilesUpdated: false;
  readonly aliasesChanged: false;
  readonly authoritativeMasterApproved: false;
  readonly conditionalRulesChanged: false;
  readonly dashboardChanged: false;
  readonly p10Enabled: false;
}

interface SeedCanonicalRow {
  readonly canonical_entity_code?: string;
  readonly canonical_entity_display_name?: string;
  readonly entity_family?: string;
  readonly entity_type?: string;
}

interface SeedSourceMapRow {
  readonly source_system?: string;
  readonly source_field?: string;
  readonly source_value?: string;
  readonly canonical_entity_code?: string;
  readonly mapping_type?: string;
  readonly confidence?: string;
}

interface SeedTargetProfileRow {
  readonly canonical_entity_code?: string;
  readonly target_bucket?: string;
  readonly machine_center_no?: string;
  readonly target_qty?: string | number;
  readonly unit?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
}

export interface AuthoritativeMasterEntityReviewRow {
  readonly review_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
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
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterSourceMappingReviewRow {
  readonly review_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
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
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterTargetProfileReviewRow {
  readonly review_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly affected_output_rows: number;
  readonly affected_reject_rows: number;
  readonly target_profile_required: "true" | "false" | "conditional";
  readonly target_profile_status: string;
  readonly proposed_target_qty: string;
  readonly proposed_unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterConflictReviewRow {
  readonly review_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
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
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterSourceDataGapReviewRow {
  readonly review_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
  readonly source_gap_type: string;
  readonly rows: number;
  readonly bc_future_use_domains: string;
  readonly p10_inclusion_statuses: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly item_category_codes: string;
  readonly machine_center_nos: string;
  readonly recommended_action: string;
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterFutureUseDomainReviewRow {
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
  readonly approval_status: AuthoritativeMasterReviewApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterReviewerDecisionTemplateRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approval_status: "pending";
  readonly approved_action: "";
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
  readonly reviewer: "";
  readonly reviewer_notes: "";
}

export interface AuthoritativeMasterReviewPriorityBoardRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly priority: AuthoritativeMasterReviewPriority;
  readonly rows: number;
  readonly review_reason: string;
  readonly recommended_action: string;
}

export interface AuthoritativeMasterReviewChecklistRow {
  readonly checklist_id: string;
  readonly priority: AuthoritativeMasterReviewPriority;
  readonly review_area: string;
  readonly required_check: string;
  readonly completion_status: "pending";
}

export interface AuthoritativeMasterReviewWorkspaceResult {
  readonly summary: AuthoritativeMasterReviewWorkspaceSummary;
  readonly entityReviewRows: readonly AuthoritativeMasterEntityReviewRow[];
  readonly sourceMappingReviewRows: readonly AuthoritativeMasterSourceMappingReviewRow[];
  readonly targetProfileReviewRows: readonly AuthoritativeMasterTargetProfileReviewRow[];
  readonly conflictReviewRows: readonly AuthoritativeMasterConflictReviewRow[];
  readonly sourceDataGapReviewRows: readonly AuthoritativeMasterSourceDataGapReviewRow[];
  readonly futureUseDomainReviewRows: readonly AuthoritativeMasterFutureUseDomainReviewRow[];
  readonly reviewerDecisionTemplateRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly reviewPriorityBoardRows: readonly AuthoritativeMasterReviewPriorityBoardRow[];
  readonly reviewChecklistRows: readonly AuthoritativeMasterReviewChecklistRow[];
  readonly importManifest: {
    readonly generatedAt: string;
    readonly allowedActions: readonly string[];
    readonly sourceFiles: readonly string[];
    readonly safety: AuthoritativeMasterReviewWorkspaceSafety;
  };
}

export function buildAuthoritativeMasterReviewWorkspace(input: {
  readonly seedCanonicalRows: readonly SeedCanonicalRow[];
  readonly seedSourceMapRows: readonly SeedSourceMapRow[];
  readonly seedTargetProfileRows: readonly SeedTargetProfileRow[];
  readonly seedReviewQueueRows: readonly AuthoritativeSeedReviewQueueRow[];
  readonly legacyCrosswalkRows: readonly AuthoritativeLegacyEvidenceCrosswalkRow[];
  readonly registryRows: readonly FutureUseRawRegistryRow[];
  readonly sourceDataGapRows: readonly FutureUseReviewQueueRow[];
  readonly targetProfileRequirementRows: readonly FutureUseTargetProfileRequirementRow[];
  readonly sourceFolders: readonly string[];
  readonly outputFolder: string;
  readonly inputsAvailable: boolean;
  readonly generatedAt?: string;
}): AuthoritativeMasterReviewWorkspaceResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = safetyFlags();
  if (!input.inputsAvailable) return blockedResult(generatedAt, input.outputFolder, input.sourceFolders, safety);

  const registryByCanonical = groupRegistryByCanonical(input.registryRows);
  const registryBySource = groupRegistryBySource(input.registryRows);
  const sourceConflicts = new Map(input.seedReviewQueueRows.map((row) => [`${clean(row.source_field)}|${clean(row.source_value)}`, clean(row.review_reason)]));

  const entityRows = input.seedCanonicalRows.map((row, index) => {
    const canonical = clean(row.canonical_entity_code);
    const coverage = registryByCanonical.get(canonical) ?? emptyCoverage();
    const crosswalk = input.legacyCrosswalkRows.find((candidate) => clean(candidate.proposed_canonical_entity_code) === canonical);
    const priority = coverage.p10OutputRows > 0 && (coverage.conflictRows > 0 || coverage.targetMissingRows > 0) ? "P1" : coverage.rows >= 500 ? "P2" : "P3";
    return {
      review_id: reviewId("ENT", index + 1),
      priority,
      entity_family: clean(row.entity_family) || inferFamily(canonical),
      proposed_canonical_entity_code: canonical,
      proposed_canonical_entity_display_name: clean(row.canonical_entity_display_name) || canonical,
      proposed_entity_type: clean(row.entity_type) || "OTHER",
      row_coverage_count: coverage.rows,
      p10_output_rows: coverage.p10OutputRows,
      reject_rows: coverage.rejectRows,
      future_use_rows: coverage.futureUseRows,
      conflict_rows: coverage.conflictRows,
      source_data_gap_rows: coverage.sourceDataGapRows,
      legacy_current_entity_codes: crosswalk?.legacy_current_entity_codes ?? "",
      sample_source_values: join([...coverage.sourceValues], 5),
      sample_documents: crosswalk?.sample_documents ?? join([...coverage.documents], 5),
      sample_items: crosswalk?.sample_items ?? join([...coverage.items], 5),
      recommended_action: "REVIEW_CANONICAL_ENTITY",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterEntityReviewRow;
  });

  const sourceMappingRows = input.seedSourceMapRows.map((row, index) => {
    const key = `${clean(row.source_field)}|${clean(row.source_value)}`;
    const coverage = registryBySource.get(key) ?? emptyCoverage();
    const conflictReason = sourceConflicts.get(key) ?? (coverage.conflictRows > 0 ? "Legacy/current entity conflict evidence requires review." : "");
    const priority = coverage.p10OutputRows > 0 && conflictReason ? "P1" : coverage.rows >= 500 ? "P2" : "P3";
    return {
      review_id: reviewId("MAP", index + 1),
      priority,
      source_system: clean(row.source_system) || "business-central",
      source_field: clean(row.source_field),
      source_value: clean(row.source_value),
      proposed_canonical_entity_code: clean(row.canonical_entity_code),
      mapping_type: clean(row.mapping_type) || "EXACT_SOURCE_VALUE",
      confidence: clean(row.confidence) || "MEDIUM",
      rows_covered: coverage.rows,
      bc_future_use_domains: join([...coverage.domains]),
      p10_inclusion_statuses: join([...coverage.p10Statuses]),
      legacy_current_entity_codes: join([...coverage.legacyEntities], 5),
      conflict_flag: conflictReason ? "true" : "false",
      conflict_reason: conflictReason,
      recommended_action: conflictReason ? "REVIEW_SOURCE_MAPPING_CONFLICT" : "REVIEW_SOURCE_MAPPING",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterSourceMappingReviewRow;
  });

  const targetRows = buildTargetProfileRows(input.registryRows, input.seedTargetProfileRows);
  const conflictRows = buildConflictRows(input.seedReviewQueueRows, input.registryRows);
  const sourceGapRows = buildSourceGapRows(input.sourceDataGapRows, input.registryRows);
  const futureUseRows = buildFutureUseRows(input.registryRows, input.targetProfileRequirementRows);
  const decisionRows = [
    ...entityRows.map((row) => decisionTemplate(row.review_id, "ENTITY", row.proposed_canonical_entity_code)),
    ...sourceMappingRows.map((row) => decisionTemplate(row.review_id, "SOURCE_MAPPING", row.proposed_canonical_entity_code, row.source_field, row.source_value, row.mapping_type)),
    ...targetRows.map((row) => decisionTemplate(row.review_id, "TARGET_PROFILE", row.canonical_entity_code, "", "", "", row.target_bucket, row.machine_center_no, row.proposed_target_qty, row.proposed_unit, row.effective_from, row.effective_to)),
    ...conflictRows.map((row) => decisionTemplate(row.review_id, "CONFLICT", row.proposed_canonical_entity_code, row.source_field, row.source_value)),
    ...sourceGapRows.map((row) => decisionTemplate(row.review_id, "SOURCE_DATA_GAP")),
    ...futureUseRows.map((row) => decisionTemplate(row.review_id, "FUTURE_USE_DOMAIN"))
  ];
  const priorityRows = buildPriorityBoard([...entityRows, ...sourceMappingRows, ...targetRows, ...conflictRows, ...sourceGapRows], futureUseRows);
  const allPriorities = priorityRows.map((row) => row.priority);
  const workspaceStatus: AuthoritativeMasterReviewWorkspaceStatus = priorityRows.some((row) => row.priority === "P1" || row.priority === "P2")
    ? "GENERATED_WITH_WARNINGS"
    : "GENERATED";
  const summary: AuthoritativeMasterReviewWorkspaceSummary = {
    generatedAt,
    outputFolder: input.outputFolder,
    sourceFolders: input.sourceFolders,
    workspaceStatus,
    entityReviewRows: entityRows.length,
    sourceMappingReviewRows: sourceMappingRows.length,
    targetProfileReviewRows: targetRows.length,
    conflictReviewRows: conflictRows.length,
    sourceDataGapReviewRows: sourceGapRows.length,
    futureUseDomainReviewRows: futureUseRows.length,
    reviewerDecisionRows: decisionRows.length,
    p1Rows: allPriorities.filter((priority) => priority === "P1").length,
    p2Rows: allPriorities.filter((priority) => priority === "P2").length,
    p3Rows: allPriorities.filter((priority) => priority === "P3").length,
    pendingRows: decisionRows.length,
    approvedRows: 0,
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked: authoritative master review workspace rows are pending and this command is export-only."
    },
    safety
  };
  return {
    summary,
    entityReviewRows: entityRows,
    sourceMappingReviewRows: sourceMappingRows,
    targetProfileReviewRows: targetRows,
    conflictReviewRows: conflictRows,
    sourceDataGapReviewRows: sourceGapRows,
    futureUseDomainReviewRows: futureUseRows,
    reviewerDecisionTemplateRows: decisionRows,
    reviewPriorityBoardRows: priorityRows,
    reviewChecklistRows: checklistRows(),
    importManifest: {
      generatedAt,
      allowedActions: [
        "APPROVE_CANONICAL_ENTITY",
        "APPROVE_SOURCE_MAPPING",
        "APPROVE_REVIEWED_ALIAS",
        "APPROVE_TARGET_PROFILE",
        "REJECT_CANDIDATE",
        "DEFER_REVIEW",
        "SOURCE_DATA_BACKLOG",
        "FUTURE_USE_ONLY",
        "NEEDS_CORRECTION"
      ],
      sourceFiles: input.sourceFolders,
      safety
    }
  };
}

function buildTargetProfileRows(registryRows: readonly FutureUseRawRegistryRow[], seedRows: readonly SeedTargetProfileRow[]): AuthoritativeMasterTargetProfileReviewRow[] {
  const seedByKey = new Map(seedRows.map((row) => [targetKey(clean(row.canonical_entity_code), clean(row.target_bucket), clean(row.machine_center_no)), row]));
  const grouped = new Map<string, Coverage>();
  for (const row of registryRows) {
    if (row.bc_future_use_domain !== "PRODUCTION_OUTPUT_DASHBOARD" && row.bc_future_use_domain !== "REJECT_ATTACHMENT") continue;
    const required = row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD";
    if (!required && row.target_profile_status !== "MISSING_TARGET_PROFILE") continue;
    const candidateCanonical = row.authoritative_entity_code || row.source_value;
    const key = targetKey(candidateCanonical, "", row.machine_center_no);
    addCoverage(grouped, key, row);
  }
  return [...grouped.entries()].map(([key, coverage], index) => {
    const [canonical, targetBucket, machineCenter] = key.split("|");
    const seed = seedByKey.get(key);
    const required = coverage.p10OutputRows > 0;
    return {
      review_id: reviewId("TGT", index + 1),
      priority: required && coverage.targetMissingRows > 0 ? "P1" : coverage.rejectRows > 0 ? "P2" : "P3",
      canonical_entity_code: canonical ?? "",
      target_bucket: targetBucket ?? "",
      machine_center_no: machineCenter ?? "",
      affected_output_rows: coverage.p10OutputRows,
      affected_reject_rows: coverage.rejectRows,
      target_profile_required: required ? "true" : "conditional",
      target_profile_status: required && coverage.targetMissingRows > 0 ? "MISSING_TARGET_PROFILE" : "CONDITIONAL_REVIEW",
      proposed_target_qty: clean(seed?.target_qty),
      proposed_unit: clean(seed?.unit),
      effective_from: clean(seed?.effective_from),
      effective_to: clean(seed?.effective_to),
      recommended_action: required && (!clean(seed?.target_qty) || !clean(seed?.unit)) ? "FILL_TARGET_PROFILE" : "REVIEW_TARGET_PROFILE",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterTargetProfileReviewRow;
  }).sort(priorityThenRows);
}

function buildConflictRows(seedRows: readonly AuthoritativeSeedReviewQueueRow[], registryRows: readonly FutureUseRawRegistryRow[]): AuthoritativeMasterConflictReviewRow[] {
  const registryBySource = groupRegistryBySource(registryRows);
  return seedRows.map((row, index) => {
    const coverage = registryBySource.get(`${clean(row.source_field)}|${clean(row.source_value)}`) ?? emptyCoverage(Number(row.rows));
    const reason = clean(row.review_reason);
    return {
      review_id: reviewId("CON", index + 1),
      priority: coverage.p10OutputRows > 0 || reason.includes("OMSO") ? "P1" : coverage.rows >= 500 ? "P2" : "P3",
      conflict_type: clean(row.review_category) || "LEGACY_EVIDENCE_CONFLICT",
      source_field: clean(row.source_field),
      source_value: clean(row.source_value),
      proposed_canonical_entity_code: clean(row.proposed_canonical_entity_code),
      legacy_current_entity_codes: join([...coverage.legacyEntities], 5),
      v2_entity_codes: join([...coverage.v2Entities], 5),
      rows: Number(row.rows) || coverage.rows,
      bc_future_use_domains: join([...coverage.domains]),
      sample_documents: clean(row.sample_documents) || join([...coverage.documents], 5),
      sample_items: clean(row.sample_items) || join([...coverage.items], 5),
      risk_level: coverage.p10OutputRows > 0 ? "HIGH" : coverage.rows >= 500 ? "MEDIUM" : "LOW",
      recommended_action: clean(row.recommended_action) || "REVIEW_CONFLICT",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterConflictReviewRow;
  }).sort(priorityThenRows);
}

function buildSourceGapRows(queueRows: readonly FutureUseReviewQueueRow[], registryRows: readonly FutureUseRawRegistryRow[]): AuthoritativeMasterSourceDataGapReviewRow[] {
  const gapRows = queueRows.filter((row) => row.review_type === "SOURCE_DATA_GAP");
  return gapRows.map((row, index) => {
    const matching = registryRows.filter((registry) => registry.source_field === row.source_field && registry.source_value === row.source_value);
    const domains = new Set(matching.map((registry) => registry.bc_future_use_domain));
    const p10Statuses = new Set(matching.map((registry) => registry.p10_inclusion_status));
    const priority = p10Statuses.has("P10_BLOCKED_SOURCE_DATA_GAP") || domains.has("PRODUCTION_OUTPUT_DASHBOARD") ? "P1" : Number(row.rows) >= 500 ? "P2" : "P3";
    return {
      review_id: reviewId("GAP", index + 1),
      priority,
      source_gap_type: clean(row.review_reason) || "SOURCE_DATA_GAP",
      rows: Number(row.rows) || matching.length,
      bc_future_use_domains: join([...domains]),
      p10_inclusion_statuses: join([...p10Statuses]),
      sample_documents: join(matching.map((registry) => registry.document_no).filter(Boolean), 5),
      sample_items: join(matching.map((registry) => registry.item_no).filter(Boolean), 5),
      item_category_codes: join(matching.map((registry) => registry.item_category_code).filter(Boolean), 5),
      machine_center_nos: join(matching.map((registry) => registry.machine_center_no).filter(Boolean), 5),
      recommended_action: "SOURCE_DATA_BACKLOG",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterSourceDataGapReviewRow;
  }).sort(priorityThenRows);
}

function buildFutureUseRows(registryRows: readonly FutureUseRawRegistryRow[], targetRequirements: readonly FutureUseTargetProfileRequirementRow[]): AuthoritativeMasterFutureUseDomainReviewRow[] {
  const byDomain = new Map<FutureUseRawRegistryRow["bc_future_use_domain"], FutureUseRawRegistryRow[]>();
  for (const row of registryRows) {
    const current = byDomain.get(row.bc_future_use_domain) ?? [];
    current.push(row);
    byDomain.set(row.bc_future_use_domain, current);
  }
  const targetByDomain = new Map(targetRequirements.map((row) => [row.bc_future_use_domain, row]));
  return [...byDomain.entries()].map(([domain, rows], index) => {
    const target = targetByDomain.get(domain);
    const statusCounts = countStrings(rows.map((row) => row.authoritative_entity_status));
    const unknownRows = rows.filter((row) => row.bc_future_use_domain === "UNKNOWN_REVIEW" || row.authoritative_entity_status === "UNKNOWN").length;
    const sourceDataGapRows = rows.filter((row) => row.authoritative_entity_status === "SOURCE_DATA_GAP").length;
    return {
      review_id: reviewId("DOM", index + 1),
      future_use_domain: domain,
      future_module_candidate: rows[0]?.future_module_candidate ?? "",
      rows: rows.length,
      authoritative_entity_status_counts: [...statusCounts.entries()].map(([status, count]) => `${status}:${count}`).join("; "),
      target_profile_required_rows: Number(target?.target_profile_required_rows ?? rows.filter((row) => row.target_profile_required === "true").length),
      target_profile_not_required_rows: Number(target?.target_profile_not_required_rows ?? rows.filter((row) => row.target_profile_required === "false").length),
      unknown_rows: unknownRows,
      source_data_gap_rows: sourceDataGapRows,
      recommended_action: domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "REVIEW_P10_OUTPUT_READINESS" : "FUTURE_USE_ONLY",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    } satisfies AuthoritativeMasterFutureUseDomainReviewRow;
  }).sort((a, b) => b.rows - a.rows);
}

function groupRegistryByCanonical(rows: readonly FutureUseRawRegistryRow[]): Map<string, Coverage> {
  const grouped = new Map<string, Coverage>();
  for (const row of rows) if (row.authoritative_entity_code) addCoverage(grouped, row.authoritative_entity_code, row);
  return grouped;
}

function groupRegistryBySource(rows: readonly FutureUseRawRegistryRow[]): Map<string, Coverage> {
  const grouped = new Map<string, Coverage>();
  for (const row of rows) addCoverage(grouped, `${row.source_field}|${row.source_value}`, row);
  return grouped;
}

interface Coverage {
  rows: number;
  p10OutputRows: number;
  rejectRows: number;
  futureUseRows: number;
  conflictRows: number;
  sourceDataGapRows: number;
  targetMissingRows: number;
  domains: Set<string>;
  p10Statuses: Set<string>;
  sourceValues: Set<string>;
  legacyEntities: Set<string>;
  v2Entities: Set<string>;
  documents: Set<string>;
  items: Set<string>;
}

function emptyCoverage(rows = 0): Coverage {
  return {
    rows,
    p10OutputRows: 0,
    rejectRows: 0,
    futureUseRows: 0,
    conflictRows: 0,
    sourceDataGapRows: 0,
    targetMissingRows: 0,
    domains: new Set(),
    p10Statuses: new Set(),
    sourceValues: new Set(),
    legacyEntities: new Set(),
    v2Entities: new Set(),
    documents: new Set(),
    items: new Set()
  };
}

function addCoverage(grouped: Map<string, Coverage>, key: string, row: FutureUseRawRegistryRow) {
  const coverage = grouped.get(key) ?? emptyCoverage();
  coverage.rows += 1;
  if (row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD") coverage.p10OutputRows += 1;
  else if (row.bc_future_use_domain === "REJECT_ATTACHMENT") coverage.rejectRows += 1;
  else coverage.futureUseRows += 1;
  if (row.authoritative_entity_status === "CONFLICT_REVIEW") coverage.conflictRows += 1;
  if (row.authoritative_entity_status === "SOURCE_DATA_GAP") coverage.sourceDataGapRows += 1;
  if (row.target_profile_status === "MISSING_TARGET_PROFILE") coverage.targetMissingRows += 1;
  coverage.domains.add(row.bc_future_use_domain);
  coverage.p10Statuses.add(row.p10_inclusion_status);
  coverage.sourceValues.add(row.source_value);
  if (row.review_reason) coverage.legacyEntities.add(row.review_reason);
  if (row.authoritative_entity_code) coverage.v2Entities.add(row.authoritative_entity_code);
  if (row.document_no) coverage.documents.add(row.document_no);
  if (row.item_no) coverage.items.add(row.item_no);
  grouped.set(key, coverage);
}

function buildPriorityBoard(
  rows: readonly ({ readonly review_id: string; readonly priority: AuthoritativeMasterReviewPriority; readonly recommended_action: string } & Partial<{ readonly rows: number; readonly row_coverage_count: number; readonly affected_output_rows: number; readonly source_value: string; readonly review_reason: string; readonly conflict_reason: string }>)[],
  futureRows: readonly AuthoritativeMasterFutureUseDomainReviewRow[]
): AuthoritativeMasterReviewPriorityBoardRow[] {
  const board: AuthoritativeMasterReviewPriorityBoardRow[] = rows.map((row) => ({
    review_id: row.review_id,
    review_type: row.review_id.slice(0, 3),
    priority: row.priority,
    rows: Number(row.rows ?? row.row_coverage_count ?? row.affected_output_rows ?? 0),
    review_reason: clean(row.review_reason) || clean(row.conflict_reason) || clean(row.source_value) || row.recommended_action,
    recommended_action: row.recommended_action
  }));
  for (const row of futureRows) {
    const priority: AuthoritativeMasterReviewPriority = row.future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD"
      ? "P1"
      : row.rows >= 500 ? "P2" : "P3";
    board.push({
      review_id: row.review_id,
      review_type: "DOM",
      priority,
      rows: row.rows,
      review_reason: `${row.future_use_domain} module/domain review`,
      recommended_action: row.recommended_action
    });
  }
  return board.sort(priorityThenRows);
}

function priorityThenRows<T extends { readonly priority: AuthoritativeMasterReviewPriority; readonly rows?: number; readonly row_coverage_count?: number; readonly affected_output_rows?: number }>(a: T, b: T): number {
  const priority = priorityRank(a.priority) - priorityRank(b.priority);
  if (priority !== 0) return priority;
  return Number(b.rows ?? b.row_coverage_count ?? b.affected_output_rows ?? 0) - Number(a.rows ?? a.row_coverage_count ?? a.affected_output_rows ?? 0);
}

function priorityRank(value: AuthoritativeMasterReviewPriority): number {
  if (value === "P1") return 1;
  if (value === "P2") return 2;
  return 3;
}

function decisionTemplate(
  reviewIdValue: string,
  reviewType: string,
  canonical = "",
  sourceField = "",
  sourceValue = "",
  mappingType = "",
  targetBucket = "",
  machineCenterNo = "",
  targetQty = "",
  unit = "",
  effectiveFrom = "",
  effectiveTo = ""
): AuthoritativeMasterReviewerDecisionTemplateRow {
  return {
    review_id: reviewIdValue,
    review_type: reviewType,
    approval_status: "pending",
    approved_action: "",
    approved_canonical_entity_code: canonical,
    approved_source_field: sourceField,
    approved_source_value: sourceValue,
    approved_mapping_type: mappingType,
    approved_target_bucket: targetBucket,
    approved_machine_center_no: machineCenterNo,
    approved_target_qty: targetQty,
    approved_unit: unit,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    reviewer: "",
    reviewer_notes: ""
  };
}

function checklistRows(): AuthoritativeMasterReviewChecklistRow[] {
  return [
    {
      checklist_id: "CHK001",
      priority: "P1",
      review_area: "production-output",
      required_check: "Resolve production output entity conflicts before any target profile approval.",
      completion_status: "pending"
    },
    {
      checklist_id: "CHK002",
      priority: "P1",
      review_area: "target-profile",
      required_check: "Fill target_qty and unit for production output target profile candidates.",
      completion_status: "pending"
    },
    {
      checklist_id: "CHK003",
      priority: "P1",
      review_area: "source-data-gap",
      required_check: "Triage blank/UNMAPPED P1.0 source data gaps.",
      completion_status: "pending"
    },
    {
      checklist_id: "CHK004",
      priority: "P2",
      review_area: "future-use",
      required_check: "Review high-volume future-use entity candidates without requiring production target profiles.",
      completion_status: "pending"
    },
    {
      checklist_id: "CHK005",
      priority: "P3",
      review_area: "safety",
      required_check: "Confirm no row is approved or applied by this workspace.",
      completion_status: "pending"
    }
  ];
}

function blockedResult(generatedAt: string, outputFolder: string, sourceFolders: readonly string[], safety: AuthoritativeMasterReviewWorkspaceSafety): AuthoritativeMasterReviewWorkspaceResult {
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
    p10Gate: { status: "BLOCKED", reason: "P1.0 remains blocked: required P0.9n/P0.9o workspace inputs are missing." },
    safety
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
    reviewChecklistRows: checklistRows(),
    importManifest: { generatedAt, allowedActions: [], sourceFiles: sourceFolders, safety }
  };
}

function safetyFlags(): AuthoritativeMasterReviewWorkspaceSafety {
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

function reviewId(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(5, "0")}`;
}

function targetKey(canonical: string, bucket: string, machineCenter: string): string {
  return `${canonical}|${bucket}|${machineCenter}`;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function join(values: readonly string[], limit = 20): string {
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit).join("; ");
}

function countStrings(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function inferFamily(value: string): string {
  const text = value.toUpperCase();
  for (const family of ["OMSO", "POLYPRINT", "VFINE", "LONGSUN", "THERMO HENGFENG", "BORCH", "NEWDO", "GILINGAN", "REPACKING"]) {
    if (text.includes(family)) return family;
  }
  return "OTHER";
}
