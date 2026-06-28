import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAcceptedReviewerDecisionsToWorkspaceRows,
  buildScopedDecisionApplyDryRun,
  type ScopedDecisionApplyDryRunInputRow
} from "./scoped-decision-apply-dry-run.js";
import type { ScopedDecisionNormalizedReviewerDecisionRow } from "./scoped-decision-approval-intake.js";

const baseRow: ScopedDecisionApplyDryRunInputRow = {
  decision_id: "D00001",
  priority: "P1",
  decision_family: "OMSO",
  decision_category: "ALIAS_CANONICAL_REVIEW",
  source_value: "OMSO 2-OZ",
  proposed_canonical_entity_code: "",
  current_entity_codes: "",
  target_bucket: "",
  machine_center_no: "",
  grouped_rows: 408,
  affected_scopes: "OK_OUTPUT_ENTITY_BLOCKER",
  affected_future_use_domains: "",
  recommended_decision: "Use APPROVE_ALIAS_CANONICAL_REVIEW_ONLY for reviewed exact canonical decision, or DEFER.",
  rationale: "OMSO source conflicts require manual alias/canonical review; do not auto apply broad aliases.",
  risk_level: "HIGH",
  blocks_p10_after_scope: "true",
  validation_status: "WARNING",
  validation_warnings: "MISSING_APPROVAL_STATUS: approval_status is empty or missing; validation treats it as pending.",
  approval_status: "pending",
  approved_action: "",
  safe_to_auto_apply: "false",
  safe_to_seed_target_profile: "false",
  reviewer: "",
  reviewer_notes: "",
  business_approval_reference: "",
  decision_date: "",
  sample_documents: "SPK2601/P0001",
  sample_items: "CR16OZOTPC"
};

function dryRun(rows: readonly ScopedDecisionApplyDryRunInputRow[]) {
  return buildScopedDecisionApplyDryRun({
    rows,
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceApprovalIntake: ".tmp/bc-scoped-decision-approval-intake",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

function acceptedReviewerRow(overrides: Partial<ScopedDecisionNormalizedReviewerDecisionRow> = {}): ScopedDecisionNormalizedReviewerDecisionRow {
  return {
    intake_id: "N00001",
    decision_id: "D00001",
    stable_decision_key: "d00001|omso|alias_canonical_review|omso 2-oz|408",
    priority: "P1",
    decision_family: "OMSO",
    decision_category: "ALIAS_CANONICAL_REVIEW",
    source_value: "OMSO 2-OZ",
    grouped_rows: 408,
    approval_status: "approved",
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
    reviewer: "qa",
    reviewer_notes: "Reviewed exact source and canonical evidence.",
    business_approval_reference: "BR-1",
    decision_date: "2026-06-28",
    safe_to_auto_apply: "false",
    safe_to_seed_target_profile: "false",
    entity_dependency_status: "",
    target_bucket: "",
    target_qty: "",
    unit: "",
    intake_status: "ACCEPTED",
    intake_reason: "Approved reviewer decision passed intake validation for future dry-run review.",
    ...overrides
  };
}

test("pending approval rows are blocked and not executable", () => {
  const result = dryRun([baseRow]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.summary.blockedRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "PENDING_APPROVAL_STATUS");
});

test("empty approval_status is treated as pending", () => {
  const result = dryRun([{ ...baseRow, approval_status: "" }]);

  assert.equal(result.summary.pendingInputRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.approval_status, "pending");
});

test("approved row without reviewer is blocked", () => {
  const result = dryRun([{ ...baseRow, approval_status: "approved", approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY" }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER");
});

test("approved row without reviewer_notes is blocked", () => {
  const result = dryRun([{
    ...baseRow,
    approval_status: "approved",
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
    reviewer: "qa"
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER_NOTES");
});

test("direct mutation action values are invalid and blocked", () => {
  const result = dryRun([{
    ...baseRow,
    approval_status: "approved",
    approved_action: "CREATE_ALIAS_NOW",
    reviewer: "qa",
    reviewer_notes: "Reviewed exact source."
  }]);

  assert.equal(result.summary.invalidActionRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "INVALID_DIRECT_MUTATION_ACTION");
});

test("blank or UNMAPPED cannot create canonical entity", () => {
  const result = dryRun([{
    ...baseRow,
    decision_family: "(blank)/UNMAPPED",
    decision_category: "CANONICAL_ENTITY_NEEDED",
    source_value: "(blank)",
    approval_status: "approved",
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
    reviewer: "qa",
    reviewer_notes: "Reviewed blank source."
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "BLANK_SOURCE_CANNOT_CREATE_CANONICAL");
});

test("OMSO conflict cannot be auto-applied", () => {
  const result = dryRun([{
    ...baseRow,
    approval_status: "approved",
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
    safe_to_auto_apply: "true",
    reviewer: "qa",
    reviewer_notes: "Reviewed exact OMSO conflict."
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "OMSO_CANNOT_AUTO_APPLY");
});

test("target profile row remains blocked when entity dependency is pending", () => {
  const result = dryRun([{
    ...baseRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    approval_status: "approved",
    approved_action: "APPROVE_TARGET_PROFILE_REVIEW_ONLY",
    reviewer: "qa",
    reviewer_notes: "Reviewed target profile dependency.",
    entity_dependency_status: "pending"
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING");
});

test("target profile row remains blocked when entity dependency is missing", () => {
  const result = dryRun([{
    ...baseRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    approval_status: "approved",
    approved_action: "APPROVE_TARGET_PROFILE_REVIEW_ONLY",
    reviewer: "qa",
    reviewer_notes: "Reviewed target profile dependency.",
    entity_dependency_status: ""
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING");
});

test("no reviewer input produces zero executable decisions", () => {
  const result = buildScopedDecisionApplyDryRun({
    rows: [baseRow],
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceApprovalIntake: ".tmp/bc-scoped-decision-approval-intake",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z",
    intakeSummary: {
      totalWorkspaceRows: 1,
      totalReviewerInputRows: 0,
      acceptedReviewerRows: 0,
      blockedReviewerRows: 0,
      invalidReviewerRows: 0,
      missingReviewerRows: 1
    }
  });

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.summary.dryRunStatus, "NO_EXECUTABLE_DECISIONS");
  assert.equal(result.summary.missingReviewerRows, 1);
});

test("intake accepted decisions are considered by apply dry-run", () => {
  const rows = applyAcceptedReviewerDecisionsToWorkspaceRows({
    workspaceRows: [baseRow],
    acceptedReviewerRows: [acceptedReviewerRow()]
  });
  const result = dryRun(rows);

  assert.equal(result.summary.approvedInputRows, 1);
  assert.equal(result.summary.executableRows, 1);
  assert.equal(result.executableDecisionPlanRows[0]?.decision_id, "D00001");
});

test("invalid reviewer decisions are never executable", () => {
  const result = buildScopedDecisionApplyDryRun({
    rows: [baseRow],
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceApprovalIntake: ".tmp/bc-scoped-decision-approval-intake",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z",
    intakeSummary: {
      totalWorkspaceRows: 1,
      totalReviewerInputRows: 1,
      acceptedReviewerRows: 0,
      blockedReviewerRows: 0,
      invalidReviewerRows: 1,
      missingReviewerRows: 1
    }
  });

  assert.equal(result.summary.invalidReviewerRows, 1);
  assert.equal(result.summary.executableRows, 0);
});

test("duplicate reviewer decisions are never executable", () => {
  const result = buildScopedDecisionApplyDryRun({
    rows: [baseRow],
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceApprovalIntake: ".tmp/bc-scoped-decision-approval-intake",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z",
    intakeSummary: {
      totalWorkspaceRows: 1,
      totalReviewerInputRows: 2,
      acceptedReviewerRows: 0,
      blockedReviewerRows: 2,
      invalidReviewerRows: 2,
      missingReviewerRows: 0
    }
  });

  assert.equal(result.summary.blockedReviewerRows, 2);
  assert.equal(result.summary.executableRows, 0);
});

test("unknown reviewer decision IDs are never executable", () => {
  const result = buildScopedDecisionApplyDryRun({
    rows: [baseRow],
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceApprovalIntake: ".tmp/bc-scoped-decision-approval-intake",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z",
    intakeSummary: {
      totalWorkspaceRows: 1,
      totalReviewerInputRows: 1,
      acceptedReviewerRows: 0,
      blockedReviewerRows: 0,
      invalidReviewerRows: 1,
      missingReviewerRows: 1
    }
  });

  assert.equal(result.summary.invalidReviewerRows, 1);
  assert.equal(result.summary.executableRows, 0);
});

test("accepted row without reviewer is blocked", () => {
  const rows = applyAcceptedReviewerDecisionsToWorkspaceRows({
    workspaceRows: [baseRow],
    acceptedReviewerRows: [acceptedReviewerRow({ reviewer: "" })]
  });
  const result = dryRun(rows);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER");
});

test("accepted row without reviewer_notes is blocked", () => {
  const rows = applyAcceptedReviewerDecisionsToWorkspaceRows({
    workspaceRows: [baseRow],
    acceptedReviewerRows: [acceptedReviewerRow({ reviewer_notes: "" })]
  });
  const result = dryRun(rows);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER_NOTES");
});

test("current raw workspace produces zero executable decisions", () => {
  const result = dryRun([
    baseRow,
    {
      ...baseRow,
      decision_id: "D00002",
      priority: "P2",
      decision_family: "VFINE",
      decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
      source_value: "VFINE BOTOL 400 ML"
    }
  ]);

  assert.equal(result.summary.approvedInputRows, 0);
  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.summary.blockedRows, 2);
  assert.equal(result.summary.dryRunStatus, "NO_EXECUTABLE_DECISIONS");
});

test("safety flags remain false and P1.0 remains blocked", () => {
  const result = dryRun([baseRow]);

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    decisionsApplied: false
  });
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});
