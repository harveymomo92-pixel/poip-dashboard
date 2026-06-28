import type { ScopedDecisionReviewRow } from "./scoped-decision-review.js";
import type { ScopedDecisionValidationIssueRow } from "./scoped-decision-validation.js";

export type ScopedDecisionApprovalPriority = "P1" | "P2" | "P3";
export type ScopedDecisionApprovedAction =
  | ""
  | "DEFER"
  | "REJECT_DECISION"
  | "SOURCE_DATA_BACKLOG"
  | "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY"
  | "APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY"
  | "APPROVE_TARGET_PROFILE_REVIEW_ONLY"
  | "APPROVE_FOR_FUTURE_DRY_RUN";

export interface ScopedDecisionApprovalWorkbookRow {
  readonly decision_id: string;
  readonly priority: ScopedDecisionApprovalPriority;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly grouped_rows: number;
  readonly affected_scopes: string;
  readonly affected_future_use_domains: string;
  readonly recommended_decision: string;
  readonly rationale: string;
  readonly risk_level: string;
  readonly blocks_p10_after_scope: "true";
  readonly validation_status: "PENDING" | "WARNING" | "INVALID";
  readonly validation_warnings: string;
  readonly approval_status: "pending";
  readonly approved_action: ScopedDecisionApprovedAction;
  readonly safe_to_auto_apply: "false";
  readonly safe_to_seed_target_profile: "false";
  readonly reviewer: "";
  readonly reviewer_notes: string;
  readonly business_approval_reference: "";
  readonly decision_date: "";
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface ScopedDecisionReviewerChecklistRow {
  readonly checklist_id: string;
  readonly priority: ScopedDecisionApprovalPriority;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly action: string;
  readonly required_evidence: string;
  readonly status: "pending";
}

export interface ScopedDecisionApprovalWorkspaceSummary {
  readonly generatedAt: string;
  readonly sourceReviewFolder: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly totalApprovalRows: number;
  readonly p1Rows: number;
  readonly p2Rows: number;
  readonly sourceDataRows: number;
  readonly aliasCanonicalRows: number;
  readonly rejectAttachmentRows: number;
  readonly targetProfileRows: number;
  readonly pendingRows: number;
  readonly safeToAutoApplyRows: number;
  readonly safeToSeedTargetProfileRows: number;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly decisionsApproved: false;
  };
}

export interface ScopedDecisionApprovalWorkspaceManifest {
  readonly generatedAt: string;
  readonly sourceReviewFolder: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly files: readonly string[];
  readonly allowedApprovedActions: readonly Exclude<ScopedDecisionApprovedAction, "">[];
  readonly forbiddenDirectMutationActions: readonly string[];
  readonly safety: ScopedDecisionApprovalWorkspaceSummary["safety"];
}

export function buildScopedDecisionApprovalWorkspace(input: {
  readonly decisionRows: readonly ScopedDecisionReviewRow[];
  readonly validationWarnings: readonly ScopedDecisionValidationIssueRow[];
  readonly validationErrors: readonly ScopedDecisionValidationIssueRow[];
  readonly generatedAt?: string;
  readonly sourceReviewFolder: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly outputFiles: readonly string[];
}): {
  readonly workbookRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly p1Rows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly p2Rows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly sourceDataRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly aliasCanonicalRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly rejectAttachmentRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly targetProfileRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly reviewerChecklistRows: readonly ScopedDecisionReviewerChecklistRow[];
  readonly importManifest: ScopedDecisionApprovalWorkspaceManifest;
  readonly summary: ScopedDecisionApprovalWorkspaceSummary;
} {
  const warningMap = issueMap(input.validationWarnings);
  const errorMap = issueMap(input.validationErrors);
  const workbookRows = input.decisionRows
    .filter((row) => row.p10_gate_effect === "BLOCKS_P1_0")
    .map((row) => workbookRow(row, warningMap, errorMap));
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sourceDataRows = workbookRows.filter(isSourceDataRow);
  const rejectAttachmentRows = workbookRows.filter(isRejectAttachmentRow);
  const targetProfileRows = workbookRows.filter(isTargetProfileRow);
  const aliasCanonicalRows = workbookRows.filter(isAliasCanonicalRow);
  const summary: ScopedDecisionApprovalWorkspaceSummary = {
    generatedAt,
    sourceReviewFolder: input.sourceReviewFolder,
    sourceValidationFolder: input.sourceValidationFolder,
    outputFolder: input.outputFolder,
    totalApprovalRows: workbookRows.length,
    p1Rows: workbookRows.filter((row) => row.priority === "P1").length,
    p2Rows: workbookRows.filter((row) => row.priority === "P2").length,
    sourceDataRows: sourceDataRows.length,
    aliasCanonicalRows: aliasCanonicalRows.length,
    rejectAttachmentRows: rejectAttachmentRows.length,
    targetProfileRows: targetProfileRows.length,
    pendingRows: workbookRows.filter((row) => row.approval_status === "pending").length,
    safeToAutoApplyRows: 0,
    safeToSeedTargetProfileRows: 0,
    p10Gate: {
      status: "BLOCKED",
      reason: `P1.0 remains blocked: ${workbookRows.length} approval workspace rows are pending and no decisions are executable.`
    },
    safety: safetyFlags()
  };
  const importManifest: ScopedDecisionApprovalWorkspaceManifest = {
    generatedAt,
    sourceReviewFolder: input.sourceReviewFolder,
    sourceValidationFolder: input.sourceValidationFolder,
    outputFolder: input.outputFolder,
    files: input.outputFiles,
    allowedApprovedActions: allowedApprovedActions,
    forbiddenDirectMutationActions: forbiddenDirectMutationActions,
    safety: summary.safety
  };
  return {
    workbookRows,
    p1Rows: workbookRows.filter((row) => row.priority === "P1"),
    p2Rows: workbookRows.filter((row) => row.priority === "P2"),
    sourceDataRows,
    aliasCanonicalRows,
    rejectAttachmentRows,
    targetProfileRows,
    reviewerChecklistRows: reviewerChecklistRows(workbookRows),
    importManifest,
    summary
  };
}

export const allowedApprovedActions: readonly Exclude<ScopedDecisionApprovedAction, "">[] = [
  "DEFER",
  "REJECT_DECISION",
  "SOURCE_DATA_BACKLOG",
  "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
  "APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY",
  "APPROVE_TARGET_PROFILE_REVIEW_ONLY",
  "APPROVE_FOR_FUTURE_DRY_RUN"
];

export const forbiddenDirectMutationActions = [
  "CREATE_ALIAS_NOW",
  "UPDATE_ENTITY_NOW",
  "INSERT_TARGET_PROFILE_NOW",
  "SWITCH_DASHBOARD_NOW"
] as const;

function workbookRow(
  row: ScopedDecisionReviewRow,
  warningMap: Map<string, readonly ScopedDecisionValidationIssueRow[]>,
  errorMap: Map<string, readonly ScopedDecisionValidationIssueRow[]>
): ScopedDecisionApprovalWorkbookRow {
  const warnings = warningMap.get(row.decision_id) ?? [];
  const errors = errorMap.get(row.decision_id) ?? [];
  const targetDependencyNote = row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"
    ? " Entity/canonical approval is required first; do not seed target profiles from this workspace."
    : "";
  return {
    decision_id: row.decision_id,
    priority: priorityRank(row.decision_id),
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    source_value: row.source_values,
    proposed_canonical_entity_code: "",
    current_entity_codes: "",
    target_bucket: "",
    machine_center_no: "",
    grouped_rows: row.rows,
    affected_scopes: affectedScopes(row),
    affected_future_use_domains: affectedFutureUseDomains(row),
    recommended_decision: recommendedDecision(row),
    rationale: `${row.reason}${targetDependencyNote}`,
    risk_level: row.risk_levels,
    blocks_p10_after_scope: "true",
    validation_status: errors.length > 0 ? "INVALID" : warnings.length > 0 ? "WARNING" : "PENDING",
    validation_warnings: [...errors, ...warnings].map((issue) => `${issue.code}: ${issue.message}`).join("|"),
    approval_status: "pending",
    approved_action: "",
    safe_to_auto_apply: "false",
    safe_to_seed_target_profile: "false",
    reviewer: "",
    reviewer_notes: row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION" ? "Entity/canonical approval is required first." : "",
    business_approval_reference: "",
    decision_date: "",
    sample_documents: row.sample_documents,
    sample_items: row.sample_items
  };
}

function reviewerChecklistRows(rows: readonly ScopedDecisionApprovalWorkbookRow[]): readonly ScopedDecisionReviewerChecklistRow[] {
  return rows.slice(0, 50).map((row, index) => ({
    checklist_id: `C${String(index + 1).padStart(5, "0")}`,
    priority: row.priority,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    action: checklistAction(row),
    required_evidence: checklistEvidence(row),
    status: "pending"
  }));
}

function checklistAction(row: ScopedDecisionApprovalWorkbookRow): string {
  if (isSourceDataRow(row)) return "Decide whether this source-data gap is backlog, deferred, or rejected.";
  if (isRejectAttachmentRow(row)) return "Review reject attachment handling without converting reject rows to OK output.";
  if (isTargetProfileRow(row)) return "Review target profile dependency only after entity/canonical decision is approved.";
  return "Review exact alias/canonical decision; broad/global aliases are forbidden.";
}

function checklistEvidence(row: ScopedDecisionApprovalWorkbookRow): string {
  if (isSourceDataRow(row)) return "Reviewer, notes, and business reference for source-data backlog or defer decision.";
  if (isTargetProfileRow(row)) return "Approved entity/canonical decision, target bucket, target quantity, unit, reviewer, and notes before later dry-run.";
  return "Reviewer, notes, exact source/canonical evidence, and business approval reference.";
}

function issueMap(rows: readonly ScopedDecisionValidationIssueRow[]): Map<string, readonly ScopedDecisionValidationIssueRow[]> {
  const map = new Map<string, ScopedDecisionValidationIssueRow[]>();
  for (const row of rows) {
    const current = map.get(row.decision_id) ?? [];
    current.push(row);
    map.set(row.decision_id, current);
  }
  return map;
}

function priorityRank(decisionId: string): ScopedDecisionApprovalPriority {
  const number = Number(decisionId.replace(/\D/g, ""));
  if (Number.isFinite(number) && number > 0) {
    if (number <= 10) return "P1";
    if (number <= 30) return "P2";
  }
  return "P3";
}

function recommendedDecision(row: ScopedDecisionReviewRow): string {
  if (row.decision_category === "SOURCE_DATA_REVIEW") return "Use SOURCE_DATA_BACKLOG, DEFER, or REJECT_DECISION after review.";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "Use APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY only after reject handling evidence is reviewed.";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Use APPROVE_TARGET_PROFILE_REVIEW_ONLY only after entity/canonical dependency is approved.";
  return "Use APPROVE_ALIAS_CANONICAL_REVIEW_ONLY or APPROVE_FOR_FUTURE_DRY_RUN after manual review.";
}

function affectedScopes(row: ScopedDecisionReviewRow): string {
  if (row.decision_category === "SOURCE_DATA_REVIEW") return "UNKNOWN_SCOPE_REVIEW";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "OUTPUT_KPI_REJECT_SCOPE";
  return "OUTPUT_KPI_OK_SCOPE";
}

function affectedFutureUseDomains(row: ScopedDecisionReviewRow): string {
  if (row.decision_category === "SOURCE_DATA_REVIEW") return "UNKNOWN_REVIEW";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "REJECT_ATTACHMENT";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "PRODUCTION_TARGET_PROFILE";
  return "PRODUCTION_OUTPUT_DASHBOARD";
}

function isSourceDataRow(row: { readonly decision_family: string; readonly decision_category: string }): boolean {
  return row.decision_family === "(blank)/UNMAPPED" || row.decision_category === "SOURCE_DATA_REVIEW";
}

function isRejectAttachmentRow(row: { readonly decision_category: string }): boolean {
  return row.decision_category === "REJECT_ATTACHMENT_REVIEW";
}

function isTargetProfileRow(row: { readonly decision_category: string }): boolean {
  return row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION";
}

function isAliasCanonicalRow(row: { readonly decision_family: string; readonly decision_category: string }): boolean {
  return !isSourceDataRow(row) && !isRejectAttachmentRow(row) && !isTargetProfileRow(row);
}

function safetyFlags(): ScopedDecisionApprovalWorkspaceSummary["safety"] {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    decisionsApproved: false
  };
}
