import type { ScopedDecisionCategory } from "./scoped-decision-review.js";
import type { ScopedDecisionValidationIssueRow } from "./scoped-decision-validation.js";

export type ScopedDecisionApprovedAction =
  | "DEFER"
  | "REJECT_DECISION"
  | "SOURCE_DATA_BACKLOG"
  | "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY"
  | "APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY"
  | "APPROVE_TARGET_PROFILE_REVIEW_ONLY"
  | "APPROVE_FOR_FUTURE_DRY_RUN";

export type ScopedDecisionApprovalTemplate =
  | "SOURCE_DATA"
  | "ALIAS_CANONICAL"
  | "REJECT_ATTACHMENT"
  | "TARGET_PROFILE";

export interface ScopedDecisionApprovalInputRow {
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_values: string;
  readonly blocker_group_ids: string;
  readonly blocker_categories: string;
  readonly review_group_types: string;
  readonly rows: string | number;
  readonly risk_levels: string;
  readonly reason: string;
  readonly recommended_action: string;
  readonly required_decision: string;
  readonly safe_to_auto_apply: string;
  readonly decision_status: string;
  readonly p10_gate_effect: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface ScopedDecisionApprovalWorkbookRow {
  readonly decision_id: string;
  readonly priority: "P1" | "P2" | "P3";
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
  readonly blocks_p10_after_scope: "true" | "false";
  readonly validation_status: "ERROR" | "WARNING" | "PENDING";
  readonly validation_warnings: string;
  readonly approval_status: "pending";
  readonly approved_action: "";
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
  readonly approval_template: ScopedDecisionApprovalTemplate;
  readonly priority: "P1" | "P2" | "P3";
  readonly checklist_item: string;
  readonly required_before_approval: "true";
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
    readonly status: "BLOCKED" | "PASS";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly decisionsAutoApproved: false;
  };
}

export interface ScopedDecisionApprovalImportManifest {
  readonly generatedAt: string;
  readonly sourceReviewFolder: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly mode: "EXPORT_TEMPLATE_ONLY";
  readonly files: readonly string[];
  readonly allowedApprovedActions: readonly ScopedDecisionApprovedAction[];
  readonly editableColumns: readonly string[];
  readonly safety: ScopedDecisionApprovalWorkspaceSummary["safety"];
}

const manualReviewFamilies = new Set<string>(["OMSO", "VFINE", "LONGSUN", "POLYPRINT", "THERMO HENGFENG"]);

export const scopedDecisionAllowedApprovedActions: readonly ScopedDecisionApprovedAction[] = [
  "DEFER",
  "REJECT_DECISION",
  "SOURCE_DATA_BACKLOG",
  "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
  "APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY",
  "APPROVE_TARGET_PROFILE_REVIEW_ONLY",
  "APPROVE_FOR_FUTURE_DRY_RUN"
];

export const scopedDecisionForbiddenDirectMutationActions = [
  "CREATE_ALIAS_NOW",
  "UPDATE_ENTITY_NOW",
  "INSERT_TARGET_PROFILE_NOW",
  "SWITCH_DASHBOARD_NOW"
] as const;

export function buildScopedDecisionApprovalWorkspace(input: {
  readonly decisions: readonly ScopedDecisionApprovalInputRow[];
  readonly validationErrors?: readonly ScopedDecisionValidationIssueRow[];
  readonly validationWarnings?: readonly ScopedDecisionValidationIssueRow[];
  readonly generatedAt?: string;
  readonly sourceReviewFolder: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
}): {
  readonly approvalWorkbookRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly approvalWorkbookP1Rows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly approvalWorkbookP2Rows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly sourceDataTemplateRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly aliasCanonicalTemplateRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly rejectAttachmentTemplateRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly targetProfileTemplateRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly reviewerChecklistRows: readonly ScopedDecisionReviewerChecklistRow[];
  readonly importManifest: ScopedDecisionApprovalImportManifest;
  readonly summary: ScopedDecisionApprovalWorkspaceSummary;
} {
  const issueIndex = buildIssueIndex(input.validationErrors ?? [], input.validationWarnings ?? []);
  const approvalWorkbookRows = input.decisions
    .filter((row) => effectiveApprovalStatus(row) === "pending")
    .map((row) => workbookRow(row, issueIndex.get(row.decision_id)))
    .sort((left, right) => prioritySort(left.priority) - prioritySort(right.priority) || right.grouped_rows - left.grouped_rows || left.decision_id.localeCompare(right.decision_id));
  const sourceDataTemplateRows = approvalWorkbookRows.filter((row) => routeTemplate(row) === "SOURCE_DATA");
  const aliasCanonicalTemplateRows = approvalWorkbookRows.filter((row) => routeTemplate(row) === "ALIAS_CANONICAL");
  const rejectAttachmentTemplateRows = approvalWorkbookRows.filter((row) => routeTemplate(row) === "REJECT_ATTACHMENT");
  const targetProfileTemplateRows = approvalWorkbookRows.filter((row) => routeTemplate(row) === "TARGET_PROFILE");
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    decisionsAutoApproved: false
  } as const;
  const summary: ScopedDecisionApprovalWorkspaceSummary = {
    generatedAt,
    sourceReviewFolder: input.sourceReviewFolder,
    sourceValidationFolder: input.sourceValidationFolder,
    outputFolder: input.outputFolder,
    totalApprovalRows: approvalWorkbookRows.length,
    p1Rows: approvalWorkbookRows.filter((row) => row.priority === "P1").length,
    p2Rows: approvalWorkbookRows.filter((row) => row.priority === "P2").length,
    sourceDataRows: sourceDataTemplateRows.length,
    aliasCanonicalRows: aliasCanonicalTemplateRows.length,
    rejectAttachmentRows: rejectAttachmentTemplateRows.length,
    targetProfileRows: targetProfileTemplateRows.length,
    pendingRows: approvalWorkbookRows.filter((row) => row.approval_status === "pending").length,
    safeToAutoApplyRows: 0,
    safeToSeedTargetProfileRows: 0,
    p10Gate: {
      status: approvalWorkbookRows.length > 0 ? "BLOCKED" : "PASS",
      reason: approvalWorkbookRows.length > 0
        ? `P1.0 remains blocked: ${approvalWorkbookRows.length} approval workspace rows are pending and no decisions are executable.`
        : "No pending approval workspace rows remain; this command still does not enable P1.0."
    },
    safety
  };
  const importManifest: ScopedDecisionApprovalImportManifest = {
    generatedAt,
    sourceReviewFolder: input.sourceReviewFolder,
    sourceValidationFolder: input.sourceValidationFolder,
    outputFolder: input.outputFolder,
    mode: "EXPORT_TEMPLATE_ONLY",
    files: [
      "summary.json",
      "README.md",
      "approval-workbook.csv",
      "approval-workbook-p1.csv",
      "approval-workbook-p2.csv",
      "source-data-approval-template.csv",
      "alias-canonical-approval-template.csv",
      "reject-attachment-approval-template.csv",
      "target-profile-approval-template.csv",
      "reviewer-checklist.csv",
      "import-manifest.json"
    ],
    allowedApprovedActions: scopedDecisionAllowedApprovedActions,
    editableColumns: [
      "approval_status",
      "approved_action",
      "reviewer",
      "reviewer_notes",
      "business_approval_reference",
      "decision_date"
    ],
    safety
  };
  return {
    approvalWorkbookRows,
    approvalWorkbookP1Rows: approvalWorkbookRows.filter((row) => row.priority === "P1"),
    approvalWorkbookP2Rows: approvalWorkbookRows.filter((row) => row.priority === "P2"),
    sourceDataTemplateRows,
    aliasCanonicalTemplateRows,
    rejectAttachmentTemplateRows,
    targetProfileTemplateRows,
    reviewerChecklistRows: reviewerChecklistRows(),
    importManifest,
    summary
  };
}

function workbookRow(
  row: ScopedDecisionApprovalInputRow,
  issues: IssueSummary | undefined
): ScopedDecisionApprovalWorkbookRow {
  const category = row.decision_category as ScopedDecisionCategory;
  return {
    decision_id: row.decision_id,
    priority: priorityRank(row.decision_id),
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    source_value: row.source_values,
    proposed_canonical_entity_code: proposedCanonicalEntityCode(row),
    current_entity_codes: currentEntityCodes(row),
    target_bucket: targetBucket(row),
    machine_center_no: machineCenterNo(row),
    grouped_rows: numberValue(row.rows),
    affected_scopes: affectedScopes(row),
    affected_future_use_domains: "",
    recommended_decision: recommendedDecision(row),
    rationale: rationale(row),
    risk_level: row.risk_levels,
    blocks_p10_after_scope: row.p10_gate_effect === "BLOCKS_P1_0" ? "true" : "false",
    validation_status: issues?.hasError ? "ERROR" : issues?.warnings.length ? "WARNING" : "PENDING",
    validation_warnings: formatIssueMessages(issues),
    approval_status: "pending",
    approved_action: "",
    safe_to_auto_apply: "false",
    safe_to_seed_target_profile: "false",
    reviewer: "",
    reviewer_notes: category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"
      ? "Entity/canonical approval is required first; target profile rows remain dependency-blocked."
      : "",
    business_approval_reference: "",
    decision_date: "",
    sample_documents: row.sample_documents,
    sample_items: row.sample_items
  };
}

function routeTemplate(row: Pick<ScopedDecisionApprovalWorkbookRow, "decision_family" | "decision_category">): ScopedDecisionApprovalTemplate {
  if (row.decision_family === "(blank)/UNMAPPED" || row.decision_category === "SOURCE_DATA_REVIEW") return "SOURCE_DATA";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "REJECT_ATTACHMENT";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "TARGET_PROFILE";
  if (manualReviewFamilies.has(row.decision_family)) return "ALIAS_CANONICAL";
  return "ALIAS_CANONICAL";
}

function reviewerChecklistRows(): readonly ScopedDecisionReviewerChecklistRow[] {
  return [
    checklistRow(1, "SOURCE_DATA", "P1", "Confirm blank/unmapped rows are source-data backlog or explicitly deferred; do not create canonical entities from blank source."),
    checklistRow(2, "ALIAS_CANONICAL", "P1", "Review exact source and canonical evidence; never approve broad/global aliases from this workspace."),
    checklistRow(3, "REJECT_ATTACHMENT", "P2", "Confirm RJ/reject evidence stays reject-related and is not converted into OK output scope."),
    checklistRow(4, "TARGET_PROFILE", "P2", "Confirm entity/canonical decision is approved before any future target profile seed review.")
  ];
}

function checklistRow(
  index: number,
  approval_template: ScopedDecisionApprovalTemplate,
  priority: "P1" | "P2" | "P3",
  checklist_item: string
): ScopedDecisionReviewerChecklistRow {
  return {
    checklist_id: `C${String(index).padStart(5, "0")}`,
    approval_template,
    priority,
    checklist_item,
    required_before_approval: "true",
    status: "pending"
  };
}

interface IssueSummary {
  readonly hasError: boolean;
  readonly warnings: readonly string[];
}

function buildIssueIndex(
  errors: readonly ScopedDecisionValidationIssueRow[],
  warnings: readonly ScopedDecisionValidationIssueRow[]
): Map<string, IssueSummary> {
  const index = new Map<string, { hasError: boolean; warnings: string[] }>();
  for (const issue of errors) {
    const current = index.get(issue.decision_id) ?? { hasError: false, warnings: [] };
    current.hasError = true;
    current.warnings.push(`${issue.code}: ${issue.message}`);
    index.set(issue.decision_id, current);
  }
  for (const issue of warnings) {
    const current = index.get(issue.decision_id) ?? { hasError: false, warnings: [] };
    current.warnings.push(`${issue.code}: ${issue.message}`);
    index.set(issue.decision_id, current);
  }
  return index;
}

function formatIssueMessages(issues: IssueSummary | undefined): string {
  if (!issues) return "";
  return issues.warnings.join("|");
}

function effectiveApprovalStatus(row: ScopedDecisionApprovalInputRow): string {
  const status = normalized(row.decision_status);
  return status || "pending";
}

function recommendedDecision(row: ScopedDecisionApprovalInputRow): string {
  if (row.decision_category === "SOURCE_DATA_REVIEW") return "Use SOURCE_DATA_BACKLOG or DEFER after reviewer notes.";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "Use APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY only after reject/entity dependency review.";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Use APPROVE_TARGET_PROFILE_REVIEW_ONLY only after entity/canonical approval; no target profile insert here.";
  if (manualReviewFamilies.has(row.decision_family)) return "Use APPROVE_ALIAS_CANONICAL_REVIEW_ONLY for reviewed exact canonical decision, or DEFER.";
  return row.required_decision || "Manual reviewer decision required.";
}

function rationale(row: ScopedDecisionApprovalInputRow): string {
  const base = row.reason || row.recommended_action;
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") {
    return `${base} Entity/canonical approval is required first; do not seed target profiles from this workspace.`;
  }
  return base;
}

function affectedScopes(row: ScopedDecisionApprovalInputRow): string {
  return row.blocker_categories || row.review_group_types || row.decision_category;
}

function proposedCanonicalEntityCode(_row: ScopedDecisionApprovalInputRow): string {
  return "";
}

function currentEntityCodes(_row: ScopedDecisionApprovalInputRow): string {
  return "";
}

function targetBucket(_row: ScopedDecisionApprovalInputRow): string {
  return "";
}

function machineCenterNo(_row: ScopedDecisionApprovalInputRow): string {
  return "";
}

function priorityRank(decisionId: string): "P1" | "P2" | "P3" {
  const parsed = Number(decisionId.replace(/\D/g, ""));
  if (Number.isFinite(parsed) && parsed > 0) {
    if (parsed <= 10) return "P1";
    if (parsed <= 30) return "P2";
  }
  return "P3";
}

function prioritySort(priority: "P1" | "P2" | "P3"): number {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function numberValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
