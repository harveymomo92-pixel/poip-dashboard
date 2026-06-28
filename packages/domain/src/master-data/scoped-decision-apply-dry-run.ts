import {
  scopedDecisionAllowedApprovedActions,
  scopedDecisionForbiddenDirectMutationActions,
  type ScopedDecisionApprovalWorkbookRow,
  type ScopedDecisionApprovedAction
} from "./scoped-decision-approval-workspace.js";
import type {
  ScopedDecisionApprovalIntakeSummary,
  ScopedDecisionNormalizedReviewerDecisionRow
} from "./scoped-decision-approval-intake.js";

export type ScopedDecisionApplyDryRunStatus = "NO_EXECUTABLE_DECISIONS" | "BLOCKED" | "READY_FOR_REVIEW";
export type ScopedDecisionApplyApprovalStatus = "pending" | "approved" | "rejected" | "deferred";

export interface ScopedDecisionApplyDryRunInputRow {
  readonly decision_id: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly proposed_canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly grouped_rows: string | number;
  readonly affected_scopes: string;
  readonly affected_future_use_domains: string;
  readonly recommended_decision: string;
  readonly rationale: string;
  readonly risk_level: string;
  readonly blocks_p10_after_scope: string;
  readonly validation_status: string;
  readonly validation_warnings: string;
  readonly approval_status?: string;
  readonly approved_action?: string;
  readonly safe_to_auto_apply?: string;
  readonly safe_to_seed_target_profile?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
  readonly business_approval_reference?: string;
  readonly decision_date?: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly entity_dependency_status?: string;
  readonly target_qty?: string;
  readonly unit?: string;
}

export interface ScopedDecisionExecutablePlanRow {
  readonly plan_id: string;
  readonly decision_id: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly approved_action: string;
  readonly plan_type: "ALIAS_REVIEW_DRY_RUN" | "CANONICAL_ENTITY_DRY_RUN" | "REJECT_ATTACHMENT_DRY_RUN" | "TARGET_PROFILE_DRY_RUN" | "SOURCE_DATA_BACKLOG_DRY_RUN" | "NON_EXECUTING_DECISION_RECORD";
  readonly source_value: string;
  readonly grouped_rows: number;
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly business_approval_reference: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly p10_gate_effect: "BLOCKS_P1_0" | "NON_BLOCKING";
  readonly execution_mode: "DRY_RUN_ONLY";
}

export interface ScopedDecisionBlockedPlanRow {
  readonly block_id: string;
  readonly decision_id: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly approval_status: ScopedDecisionApplyApprovalStatus;
  readonly approved_action: string;
  readonly blocker_code: string;
  readonly blocker_reason: string;
  readonly required_before_execution: string;
  readonly grouped_rows: number;
  readonly source_value: string;
  readonly p10_gate_effect: "BLOCKS_P1_0" | "NON_BLOCKING";
}

export interface ScopedDecisionCategoryDryRunRow {
  readonly plan_id: string;
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly approved_action: string;
  readonly source_value: string;
  readonly grouped_rows: number;
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly dry_run_notes: string;
}

export interface ScopedDecisionP10ImpactEstimateRow {
  readonly metric: string;
  readonly value: number | string;
  readonly note: string;
}

export interface ScopedDecisionApplyDryRunSourceSummaryRow {
  readonly metric: string;
  readonly value: number | string;
  readonly note: string;
}

export interface ScopedDecisionApplyDryRunSummary {
  readonly generatedAt: string;
  readonly sourceApprovalWorkspace: string;
  readonly sourceApprovalIntake: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly totalWorkspaceRows: number;
  readonly totalReviewerInputRows: number;
  readonly acceptedReviewerRows: number;
  readonly blockedReviewerRows: number;
  readonly invalidReviewerRows: number;
  readonly missingReviewerRows: number;
  readonly totalInputRows: number;
  readonly approvedInputRows: number;
  readonly pendingInputRows: number;
  readonly rejectedInputRows: number;
  readonly deferredInputRows: number;
  readonly executableRows: number;
  readonly blockedRows: number;
  readonly aliasDryRunRows: number;
  readonly canonicalEntityDryRunRows: number;
  readonly rejectAttachmentDryRunRows: number;
  readonly targetProfileDryRunRows: number;
  readonly sourceDataBacklogRows: number;
  readonly invalidActionRows: number;
  readonly missingReviewerFieldRows: number;
  readonly missingReviewerNotesRows: number;
  readonly p10ImpactEstimate: {
    readonly currentBlockingDecisionRows: number;
    readonly executableBlockingDecisionRows: number;
    readonly blockedBlockingDecisionRows: number;
    readonly estimatedBlockingRowsRemaining: number;
    readonly estimatedBlockingRowsReleased: number;
  };
  readonly dryRunStatus: ScopedDecisionApplyDryRunStatus;
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
    readonly decisionsApplied: false;
  };
}

export function buildScopedDecisionApplyDryRun(input: {
  readonly rows: readonly ScopedDecisionApplyDryRunInputRow[];
  readonly generatedAt?: string;
  readonly sourceApprovalWorkspace: string;
  readonly sourceApprovalIntake?: string;
  readonly sourceValidationFolder: string;
  readonly outputFolder: string;
  readonly intakeSummary?: Pick<
    ScopedDecisionApprovalIntakeSummary,
    "totalWorkspaceRows"
    | "totalReviewerInputRows"
    | "acceptedReviewerRows"
    | "blockedReviewerRows"
    | "invalidReviewerRows"
    | "missingReviewerRows"
  >;
}): {
  readonly executableDecisionPlanRows: readonly ScopedDecisionExecutablePlanRow[];
  readonly blockedDecisionPlanRows: readonly ScopedDecisionBlockedPlanRow[];
  readonly aliasApplyDryRunRows: readonly ScopedDecisionCategoryDryRunRow[];
  readonly canonicalEntityApplyDryRunRows: readonly ScopedDecisionCategoryDryRunRow[];
  readonly rejectAttachmentApplyDryRunRows: readonly ScopedDecisionCategoryDryRunRow[];
  readonly targetProfileApplyDryRunRows: readonly ScopedDecisionCategoryDryRunRow[];
  readonly p10ImpactEstimateRows: readonly ScopedDecisionP10ImpactEstimateRow[];
  readonly intakeSourceSummaryRows: readonly ScopedDecisionApplyDryRunSourceSummaryRow[];
  readonly safetyReport: ScopedDecisionApplyDryRunSummary["safety"] & {
    readonly mode: "DRY_RUN_ONLY";
    readonly executableRows: number;
    readonly blockedRows: number;
  };
  readonly summary: ScopedDecisionApplyDryRunSummary;
} {
  const rows = input.rows.map(normalizeRow);
  const evaluatedRows = rows.map(evaluateRow);
  const executableRows = evaluatedRows.filter((row) => row.kind === "EXECUTABLE").map((row) => row.row);
  const blockedRows = evaluatedRows.filter((row) => row.kind === "BLOCKED").map((row) => row.row);
  const aliasApplyDryRunRows = executableRows.filter((row) => row.plan_type === "ALIAS_REVIEW_DRY_RUN").map(categoryRow);
  const canonicalEntityApplyDryRunRows = executableRows.filter((row) => row.plan_type === "CANONICAL_ENTITY_DRY_RUN").map(categoryRow);
  const rejectAttachmentApplyDryRunRows = executableRows.filter((row) => row.plan_type === "REJECT_ATTACHMENT_DRY_RUN").map(categoryRow);
  const targetProfileApplyDryRunRows = executableRows.filter((row) => row.plan_type === "TARGET_PROFILE_DRY_RUN").map(categoryRow);
  const sourceDataBacklogRows = executableRows.filter((row) => row.plan_type === "SOURCE_DATA_BACKLOG_DRY_RUN").length;
  const approvedInputRows = rows.filter((row) => row.approval === "approved").length;
  const pendingInputRows = rows.filter((row) => row.approval === "pending").length;
  const rejectedInputRows = rows.filter((row) => row.approval === "rejected").length;
  const deferredInputRows = rows.filter((row) => row.approval === "deferred").length;
  const currentBlockingDecisionRows = rows.filter((row) => row.blocksP10AfterScope).length;
  const executableBlockingDecisionRows = executableRows.filter((row) => row.p10_gate_effect === "BLOCKS_P1_0").length;
  const blockedBlockingDecisionRows = blockedRows.filter((row) => row.p10_gate_effect === "BLOCKS_P1_0").length;
  const dryRunStatus: ScopedDecisionApplyDryRunStatus = executableRows.length === 0
    ? "NO_EXECUTABLE_DECISIONS"
    : blockedRows.length > 0
      ? "BLOCKED"
      : "READY_FOR_REVIEW";
  const safety = {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    decisionsApplied: false
  } as const;
  const summary: ScopedDecisionApplyDryRunSummary = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceApprovalWorkspace: input.sourceApprovalWorkspace,
    sourceApprovalIntake: input.sourceApprovalIntake ?? "",
    sourceValidationFolder: input.sourceValidationFolder,
    outputFolder: input.outputFolder,
    totalWorkspaceRows: input.intakeSummary?.totalWorkspaceRows ?? rows.length,
    totalReviewerInputRows: input.intakeSummary?.totalReviewerInputRows ?? 0,
    acceptedReviewerRows: input.intakeSummary?.acceptedReviewerRows ?? approvedInputRows,
    blockedReviewerRows: input.intakeSummary?.blockedReviewerRows ?? 0,
    invalidReviewerRows: input.intakeSummary?.invalidReviewerRows ?? 0,
    missingReviewerRows: input.intakeSummary?.missingReviewerRows ?? 0,
    totalInputRows: rows.length,
    approvedInputRows,
    pendingInputRows,
    rejectedInputRows,
    deferredInputRows,
    executableRows: executableRows.length,
    blockedRows: blockedRows.length,
    aliasDryRunRows: aliasApplyDryRunRows.length,
    canonicalEntityDryRunRows: canonicalEntityApplyDryRunRows.length,
    rejectAttachmentDryRunRows: rejectAttachmentApplyDryRunRows.length,
    targetProfileDryRunRows: targetProfileApplyDryRunRows.length,
    sourceDataBacklogRows,
    invalidActionRows: blockedRows.filter((row) => ["APPROVED_ACTION_REQUIRED", "APPROVED_ACTION_NOT_ALLOWED", "INVALID_DIRECT_MUTATION_ACTION"].includes(row.blocker_code)).length,
    missingReviewerFieldRows: blockedRows.filter((row) => row.blocker_code === "APPROVED_REQUIRES_REVIEWER").length,
    missingReviewerNotesRows: blockedRows.filter((row) => row.blocker_code === "APPROVED_REQUIRES_REVIEWER_NOTES").length,
    p10ImpactEstimate: {
      currentBlockingDecisionRows,
      executableBlockingDecisionRows,
      blockedBlockingDecisionRows,
      estimatedBlockingRowsRemaining: blockedBlockingDecisionRows,
      estimatedBlockingRowsReleased: 0
    },
    dryRunStatus,
    p10Gate: {
      status: "BLOCKED",
      reason: executableRows.length === 0
        ? `P1.0 remains blocked: ${blockedRows.length} decision rows are not executable in dry-run and this command does not enable P1.0.`
        : `P1.0 remains blocked: ${blockedBlockingDecisionRows} blocking decision rows still remain after dry-run planning, and this command does not enable P1.0.`
    },
    safety
  };
  return {
    executableDecisionPlanRows: executableRows,
    blockedDecisionPlanRows: blockedRows,
    aliasApplyDryRunRows,
    canonicalEntityApplyDryRunRows,
    rejectAttachmentApplyDryRunRows,
    targetProfileApplyDryRunRows,
    p10ImpactEstimateRows: buildP10ImpactEstimateRows(summary),
    intakeSourceSummaryRows: buildIntakeSourceSummaryRows(summary),
    safetyReport: {
      ...safety,
      mode: "DRY_RUN_ONLY",
      executableRows: executableRows.length,
      blockedRows: blockedRows.length
    },
    summary
  };
}

export function applyAcceptedReviewerDecisionsToWorkspaceRows(input: {
  readonly workspaceRows: readonly ScopedDecisionApplyDryRunInputRow[];
  readonly acceptedReviewerRows: readonly ScopedDecisionNormalizedReviewerDecisionRow[];
}): readonly ScopedDecisionApplyDryRunInputRow[] {
  if (input.acceptedReviewerRows.length === 0) return input.workspaceRows;
  const acceptedByDecisionId = new Map(input.acceptedReviewerRows.map((row) => [row.decision_id, row]));
  return input.workspaceRows.map((workspaceRow) => {
    const acceptedRow = acceptedByDecisionId.get(workspaceRow.decision_id);
    if (!acceptedRow) return workspaceRow;
    return {
      ...workspaceRow,
      approval_status: "approved",
      approved_action: acceptedRow.approved_action,
      reviewer: acceptedRow.reviewer,
      reviewer_notes: acceptedRow.reviewer_notes,
      business_approval_reference: acceptedRow.business_approval_reference,
      decision_date: acceptedRow.decision_date,
      safe_to_auto_apply: acceptedRow.safe_to_auto_apply,
      safe_to_seed_target_profile: acceptedRow.safe_to_seed_target_profile,
      entity_dependency_status: acceptedRow.entity_dependency_status,
      target_bucket: acceptedRow.target_bucket || workspaceRow.target_bucket,
      target_qty: acceptedRow.target_qty,
      unit: acceptedRow.unit
    };
  });
}

export function applyAcceptedReviewerDecisionsToApprovalWorkbookRows(input: {
  readonly workspaceRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly acceptedReviewerRows: readonly ScopedDecisionNormalizedReviewerDecisionRow[];
}): readonly ScopedDecisionApplyDryRunInputRow[] {
  return applyAcceptedReviewerDecisionsToWorkspaceRows({
    workspaceRows: input.workspaceRows.map((row) => ({
      ...row,
      grouped_rows: row.grouped_rows,
      approval_status: row.approval_status,
      approved_action: row.approved_action,
      reviewer: row.reviewer,
      reviewer_notes: row.reviewer_notes,
      business_approval_reference: row.business_approval_reference,
      decision_date: row.decision_date
    })),
    acceptedReviewerRows: input.acceptedReviewerRows
  });
}

interface NormalizedRow extends ScopedDecisionApplyDryRunInputRow {
  readonly approval: ScopedDecisionApplyApprovalStatus;
  readonly approvedActionValue: string;
  readonly safeToAutoApply: boolean;
  readonly safeToSeedTargetProfile: boolean;
  readonly reviewerValue: string;
  readonly reviewerNotesValue: string;
  readonly entityDependencyStatusValue: string;
  readonly targetQtyValue: string;
  readonly unitValue: string;
  readonly rowCount: number;
  readonly blocksP10AfterScope: boolean;
}

function normalizeRow(row: ScopedDecisionApplyDryRunInputRow): NormalizedRow {
  return {
    ...row,
    approval: effectiveApprovalStatus(row),
    approvedActionValue: trimmed(row.approved_action),
    safeToAutoApply: booleanValue(row.safe_to_auto_apply),
    safeToSeedTargetProfile: booleanValue(row.safe_to_seed_target_profile),
    reviewerValue: trimmed(row.reviewer),
    reviewerNotesValue: trimmed(row.reviewer_notes),
    entityDependencyStatusValue: normalized(row.entity_dependency_status),
    targetQtyValue: trimmed(row.target_qty),
    unitValue: trimmed(row.unit),
    rowCount: numberValue(row.grouped_rows),
    blocksP10AfterScope: normalized(row.blocks_p10_after_scope) === "true"
  };
}

function evaluateRow(row: NormalizedRow):
  | { readonly kind: "EXECUTABLE"; readonly row: ScopedDecisionExecutablePlanRow }
  | { readonly kind: "BLOCKED"; readonly row: ScopedDecisionBlockedPlanRow } {
  if (row.approval !== "approved") {
    return { kind: "BLOCKED", row: blockedRow(row, approvalBlockCode(row.approval), approvalBlockReason(row.approval), requiredBeforeExecution(row)) };
  }
  if (!row.approvedActionValue) {
    return { kind: "BLOCKED", row: blockedRow(row, "APPROVED_ACTION_REQUIRED", "Approved decision rows require an allowed approved_action value.", "Fill approved_action with one review-only dry-run action.") };
  }
  if (isForbiddenDirectMutationAction(row.approvedActionValue)) {
    return { kind: "BLOCKED", row: blockedRow(row, "INVALID_DIRECT_MUTATION_ACTION", "Direct mutation actions are invalid in dry-run.", "Use a review-only approved_action; do not request live alias/entity/target/dashboard mutations.") };
  }
  if (!isAllowedApprovedAction(row.approvedActionValue)) {
    return { kind: "BLOCKED", row: blockedRow(row, "APPROVED_ACTION_NOT_ALLOWED", "approved_action is not in the allowed review-only dry-run action set.", "Replace approved_action with an allowed review-only value.") };
  }
  if (!row.reviewerValue) {
    return { kind: "BLOCKED", row: blockedRow(row, "APPROVED_REQUIRES_REVIEWER", "Approved decision rows require reviewer.", "Fill reviewer before dry-run planning.") };
  }
  if (!row.reviewerNotesValue) {
    return { kind: "BLOCKED", row: blockedRow(row, "APPROVED_REQUIRES_REVIEWER_NOTES", "Approved decision rows require reviewer_notes for apply dry-run.", "Add reviewer_notes describing the exact reviewed decision and evidence.") };
  }
  if (row.decision_family === "(blank)/UNMAPPED" && row.decision_category === "CANONICAL_ENTITY_NEEDED") {
    return { kind: "BLOCKED", row: blockedRow(row, "BLANK_SOURCE_CANNOT_CREATE_CANONICAL", "Blank or unmapped source cannot create a canonical entity automatically.", "Keep this as source-data review or backlog only.") };
  }
  if (row.safeToAutoApply) {
    const block = autoApplyBlock(row);
    if (block) return { kind: "BLOCKED", row: blockedRow(row, block.code, block.reason, block.required) };
  }
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW" && normalized(row.reviewerNotesValue).includes("ok output")) {
    return { kind: "BLOCKED", row: blockedRow(row, "REJECT_MUST_NOT_CONVERT_TO_OK_OUTPUT", "Reject rows must not be converted into OK output scope.", "Keep reject rows reject-related and revise reviewer_notes.") };
  }
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") {
    const targetBlock = targetProfileBlock(row);
    if (targetBlock) return { kind: "BLOCKED", row: blockedRow(row, targetBlock.code, targetBlock.reason, targetBlock.required) };
  }
  return { kind: "EXECUTABLE", row: executableRow(row) };
}

function autoApplyBlock(row: NormalizedRow): { readonly code: string; readonly reason: string; readonly required: string } | null {
  const text = normalized(`${row.source_value} ${row.rationale} ${row.recommended_decision}`);
  if (row.decision_family === "OMSO") return { code: "OMSO_CANNOT_AUTO_APPLY", reason: "OMSO conflicts cannot be auto-applied even in dry-run.", required: "Keep OMSO as manual review; safe_to_auto_apply must not be used here." };
  if (row.decision_family === "VFINE" || text.includes("vfine botol 600 ml")) return { code: "VFINE_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", reason: "VFINE size or variant mapping cannot be auto-applied.", required: "Use manual alias/canonical review only." };
  if (row.decision_family === "LONGSUN" || text.includes("longsun 1 botol 1500 ml")) return { code: "LONGSUN_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", reason: "LONGSUN size or variant mapping cannot be auto-applied.", required: "Use manual alias/canonical review only." };
  if (row.decision_family === "POLYPRINT") return { code: "POLYPRINT_REQUIRES_MANUAL_REVIEW", reason: "POLYPRINT naming normalization cannot be auto-applied.", required: "Use manual alias/canonical review only." };
  if (row.decision_family === "THERMO HENGFENG") return { code: "THERMO_HENGFENG_REQUIRES_MANUAL_REVIEW", reason: "THERMO HENGFENG legacy variant collapse cannot be auto-applied.", required: "Use reviewed canonical dry-run only after manual decision." };
  if (row.decision_family === "(blank)/UNMAPPED") return { code: "BLANK_SOURCE_CANNOT_AUTO_APPLY", reason: "Blank or unmapped source cannot be auto-applied.", required: "Keep this in source-data backlog or defer." };
  return null;
}

function targetProfileBlock(row: NormalizedRow): { readonly code: string; readonly reason: string; readonly required: string } | null {
  if (!["approved", "not_required"].includes(row.entityDependencyStatusValue)) {
    return { code: "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING", reason: "Target profile row remains blocked while entity dependency is pending.", required: "Approve entity/canonical dependency or mark it not required before target profile dry-run." };
  }
  if (!row.safeToSeedTargetProfile) return null;
  if (row.entityDependencyStatusValue !== "approved") return { code: "TARGET_SEED_REQUIRES_ENTITY_APPROVED", reason: "safe_to_seed_target_profile=true requires approved entity dependency.", required: "Set entity dependency to approved before dry-run seeding review." };
  if (!trimmed(row.target_bucket)) return { code: "TARGET_SEED_REQUIRES_BUCKET", reason: "safe_to_seed_target_profile=true requires target_bucket.", required: "Fill target_bucket before target profile dry-run." };
  if (!row.targetQtyValue) return { code: "TARGET_SEED_REQUIRES_QTY", reason: "safe_to_seed_target_profile=true requires target_qty.", required: "Fill target_qty before target profile dry-run." };
  if (!row.unitValue) return { code: "TARGET_SEED_REQUIRES_UNIT", reason: "safe_to_seed_target_profile=true requires unit.", required: "Fill unit before target profile dry-run." };
  return null;
}

function executableRow(row: NormalizedRow): ScopedDecisionExecutablePlanRow {
  return {
    plan_id: planId("X", row.decision_id),
    decision_id: row.decision_id,
    priority: row.priority,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    approved_action: row.approvedActionValue,
    plan_type: planType(row),
    source_value: row.source_value,
    grouped_rows: row.rowCount,
    reviewer: row.reviewerValue,
    reviewer_notes: row.reviewerNotesValue,
    business_approval_reference: trimmed(row.business_approval_reference),
    sample_documents: row.sample_documents,
    sample_items: row.sample_items,
    p10_gate_effect: row.blocksP10AfterScope ? "BLOCKS_P1_0" : "NON_BLOCKING",
    execution_mode: "DRY_RUN_ONLY"
  };
}

function blockedRow(row: NormalizedRow, blocker_code: string, blocker_reason: string, required_before_execution: string): ScopedDecisionBlockedPlanRow {
  return {
    block_id: planId("B", row.decision_id),
    decision_id: row.decision_id,
    priority: row.priority,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    approval_status: row.approval,
    approved_action: row.approvedActionValue,
    blocker_code,
    blocker_reason,
    required_before_execution,
    grouped_rows: row.rowCount,
    source_value: row.source_value,
    p10_gate_effect: row.blocksP10AfterScope ? "BLOCKS_P1_0" : "NON_BLOCKING"
  };
}

function planType(row: NormalizedRow): ScopedDecisionExecutablePlanRow["plan_type"] {
  if (row.approvedActionValue === "SOURCE_DATA_BACKLOG") return "SOURCE_DATA_BACKLOG_DRY_RUN";
  if (row.approvedActionValue === "DEFER" || row.approvedActionValue === "REJECT_DECISION") return "NON_EXECUTING_DECISION_RECORD";
  if (row.decision_category === "CANONICAL_ENTITY_NEEDED") return "CANONICAL_ENTITY_DRY_RUN";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "REJECT_ATTACHMENT_DRY_RUN";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "TARGET_PROFILE_DRY_RUN";
  return "ALIAS_REVIEW_DRY_RUN";
}

function categoryRow(row: ScopedDecisionExecutablePlanRow): ScopedDecisionCategoryDryRunRow {
  return {
    plan_id: row.plan_id,
    decision_id: row.decision_id,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    approved_action: row.approved_action,
    source_value: row.source_value,
    grouped_rows: row.grouped_rows,
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    dry_run_notes: "Dry-run only. No database, alias, entity, target profile, or dashboard mutation is performed."
  };
}

function buildP10ImpactEstimateRows(summary: ScopedDecisionApplyDryRunSummary): readonly ScopedDecisionP10ImpactEstimateRow[] {
  return [
    { metric: "current_blocking_decision_rows", value: summary.p10ImpactEstimate.currentBlockingDecisionRows, note: "Decision rows marked as blocking before apply dry-run evaluation." },
    { metric: "executable_blocking_decision_rows", value: summary.p10ImpactEstimate.executableBlockingDecisionRows, note: "Blocking decision rows that are executable in dry-run only." },
    { metric: "blocked_blocking_decision_rows", value: summary.p10ImpactEstimate.blockedBlockingDecisionRows, note: "Blocking decision rows that remain non-executable." },
    { metric: "estimated_blocking_rows_remaining", value: summary.p10ImpactEstimate.estimatedBlockingRowsRemaining, note: "P1.0 blockers remain because this command never mutates production state." },
    { metric: "estimated_blocking_rows_released", value: summary.p10ImpactEstimate.estimatedBlockingRowsReleased, note: "Always zero in P0.9j because apply dry-run does not execute decisions." }
  ];
}

function buildIntakeSourceSummaryRows(summary: ScopedDecisionApplyDryRunSummary): readonly ScopedDecisionApplyDryRunSourceSummaryRow[] {
  return [
    { metric: "total_workspace_rows", value: summary.totalWorkspaceRows, note: "Approval workspace rows available to apply dry-run." },
    { metric: "total_reviewer_input_rows", value: summary.totalReviewerInputRows, note: "Reviewer input rows seen by approval intake." },
    { metric: "accepted_reviewer_rows", value: summary.acceptedReviewerRows, note: "Intake-accepted reviewer rows merged into dry-run input." },
    { metric: "blocked_reviewer_rows", value: summary.blockedReviewerRows, note: "Reviewer rows blocked by approval intake and never executable." },
    { metric: "invalid_reviewer_rows", value: summary.invalidReviewerRows, note: "Reviewer rows marked invalid by approval intake and never executable." },
    { metric: "missing_reviewer_rows", value: summary.missingReviewerRows, note: "Workspace rows missing reviewer input and not executable." }
  ];
}

function approvalBlockCode(approval: ScopedDecisionApplyApprovalStatus): string {
  if (approval === "rejected") return "REJECTED_NOT_EXECUTABLE";
  if (approval === "deferred") return "DEFERRED_NOT_EXECUTABLE";
  return "PENDING_APPROVAL_STATUS";
}

function approvalBlockReason(approval: ScopedDecisionApplyApprovalStatus): string {
  if (approval === "rejected") return "Rejected decision rows are not executable in dry-run.";
  if (approval === "deferred") return "Deferred decision rows are not executable in dry-run.";
  return "Decision row is pending or empty and therefore not executable in dry-run.";
}

function requiredBeforeExecution(row: NormalizedRow): string {
  if (row.approval === "pending") return "Approve or otherwise resolve the decision row before building an executable dry-run plan.";
  if (row.approval === "rejected" || row.approval === "deferred") return "Keep as non-executable review record; do not treat as apply-ready.";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Confirm entity dependency and any target seed fields before target profile dry-run execution.";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "Keep reject evidence attached to reject scope; do not convert to OK output.";
  if (row.decision_family === "(blank)/UNMAPPED") return "Keep blank or unmapped source in source-data backlog or defer.";
  return "Manual review must remain exact, narrow, and non-mutating.";
}

function effectiveApprovalStatus(row: ScopedDecisionApplyDryRunInputRow): ScopedDecisionApplyApprovalStatus {
  const value = normalized(row.approval_status);
  if (value === "approved" || value === "rejected" || value === "deferred") return value;
  return "pending";
}

function isAllowedApprovedAction(value: string): value is ScopedDecisionApprovedAction {
  return scopedDecisionAllowedApprovedActions.includes(value as ScopedDecisionApprovedAction);
}

function isForbiddenDirectMutationAction(value: string): boolean {
  return scopedDecisionForbiddenDirectMutationActions.includes(value as (typeof scopedDecisionForbiddenDirectMutationActions)[number])
    || value === "APPLY_NOW"
    || value === "ENABLE_P1_NOW";
}

function planId(prefix: "B" | "X", decisionId: string): string {
  return `${prefix}${decisionId.replace(/\D/g, "").padStart(5, "0")}`;
}

function numberValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: string | undefined): boolean {
  return normalized(value) === "true";
}

function normalized(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function trimmed(value: string | undefined): string {
  return String(value ?? "").trim();
}
