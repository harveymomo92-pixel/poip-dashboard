import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopedDecisionApprovalIntake,
  type ScopedDecisionReviewerInputRow
} from "./scoped-decision-approval-intake.js";
import type { ScopedDecisionApprovalWorkbookRow } from "./scoped-decision-approval-workspace.js";

const baseWorkspaceRow: ScopedDecisionApprovalWorkbookRow = {
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
  validation_warnings: "MISSING_APPROVAL_STATUS",
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

function intake(
  reviewerRows: readonly ScopedDecisionReviewerInputRow[],
  workspaceRows: readonly ScopedDecisionApprovalWorkbookRow[] = [baseWorkspaceRow],
  reviewerInputExists = true
) {
  return buildScopedDecisionApprovalIntake({
    workspaceRows,
    reviewerRows,
    reviewerInputExists,
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    reviewerInputFolder: ".tmp/bc-scoped-decision-manual-approval-input",
    reviewerInputFile: ".tmp/bc-scoped-decision-manual-approval-input/reviewer-decisions.csv",
    outputFolder: ".tmp/bc-scoped-decision-approval-intake",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

const approvedReviewerRow: ScopedDecisionReviewerInputRow = {
  decision_id: "D00001",
  approval_status: "approved",
  approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
  reviewer: "qa",
  reviewer_notes: "Reviewed exact source and canonical evidence."
};

test("missing reviewer input file produces template and AWAITING_REVIEWER_INPUT", () => {
  const result = intake([], [baseWorkspaceRow], false);

  assert.equal(result.summary.readinessStatus, "AWAITING_REVIEWER_INPUT");
  assert.equal(result.summary.totalReviewerInputRows, 0);
  assert.equal(result.reviewerInputTemplateRows.length, 1);
  assert.equal(result.summary.missingReviewerRows, 1);
});

test("all current pending workspace rows are reported as missing reviewer decisions", () => {
  const result = intake([], [
    baseWorkspaceRow,
    { ...baseWorkspaceRow, decision_id: "D00002", decision_family: "VFINE", source_value: "VFINE BOTOL 400 ML" }
  ], false);

  assert.equal(result.missingReviewerDecisionRows.length, 2);
});

test("empty approval_status is treated as pending", () => {
  const result = intake([{ decision_id: "D00001", approval_status: "" }]);

  assert.equal(result.summary.pendingReviewerRows, 1);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "PENDING_NOT_ACCEPTED");
});

test("approved reviewer decision without reviewer is blocked", () => {
  const result = intake([{ ...approvedReviewerRow, reviewer: "" }]);

  assert.equal(result.summary.acceptedReviewerRows, 0);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER");
});

test("approved reviewer decision without reviewer_notes is blocked", () => {
  const result = intake([{ ...approvedReviewerRow, reviewer_notes: "   " }]);

  assert.equal(result.summary.acceptedReviewerRows, 0);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER_NOTES");
});

test("duplicate reviewer decision is blocked", () => {
  const result = intake([approvedReviewerRow, { ...approvedReviewerRow, reviewer: "qa2" }]);

  assert.equal(result.duplicateReviewerDecisionRows.length, 1);
  assert.equal(result.summary.duplicateReviewerRows, 1);
  assert.equal(result.blockedReviewerDecisionRows.length, 2);
});

test("unknown decision id or key is blocked", () => {
  const result = intake([{ ...approvedReviewerRow, decision_id: "D99999" }]);

  assert.equal(result.summary.unknownReviewerRows, 1);
  assert.equal(result.invalidReviewerDecisionRows[0]?.invalid_code, "UNKNOWN_DECISION_ID_OR_KEY");
});

test("direct mutation action values are invalid and blocked", () => {
  const result = intake([{ ...approvedReviewerRow, approved_action: "CREATE_ALIAS_NOW" }]);

  assert.equal(result.summary.invalidActionRows, 1);
  assert.equal(result.invalidReviewerDecisionRows[0]?.invalid_code, "INVALID_DIRECT_MUTATION_ACTION");
});

test("blank or UNMAPPED cannot create canonical entity approval automatically", () => {
  const result = intake([{
    ...approvedReviewerRow,
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY"
  }], [{
    ...baseWorkspaceRow,
    decision_family: "(blank)/UNMAPPED",
    decision_category: "CANONICAL_ENTITY_NEEDED",
    source_value: "(blank)"
  }]);

  assert.equal(result.summary.acceptedReviewerRows, 0);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "BLANK_SOURCE_CANNOT_CREATE_CANONICAL");
});

test("OMSO conflict cannot be auto-approved", () => {
  const result = intake([{ ...approvedReviewerRow, safe_to_auto_apply: "true" }]);

  assert.equal(result.summary.acceptedReviewerRows, 0);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "OMSO_CANNOT_AUTO_APPROVE");
});

test("target profile row remains blocked when entity dependency is pending", () => {
  const result = intake([{
    ...approvedReviewerRow,
    approved_action: "APPROVE_TARGET_PROFILE_REVIEW_ONLY",
    entity_dependency_status: "pending"
  }], [{
    ...baseWorkspaceRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    source_value: "OMSO 2-OZ - Printing 22 OZ"
  }]);

  assert.equal(result.summary.acceptedReviewerRows, 0);
  assert.equal(result.blockedReviewerDecisionRows[0]?.blocker_code, "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING");
});

test("safety flags remain false", () => {
  const result = intake([approvedReviewerRow]);

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    p10Enabled: false,
    approvalWorkspaceMutated: false,
    applyDryRunMutated: false,
    decisionsApplied: false
  });
});

test("P1.0 remains blocked", () => {
  const result = intake([approvedReviewerRow]);

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});

test("accepted reviewer decisions are exported only and do not mutate approval workspace rows", () => {
  const workspaceBefore = JSON.stringify(baseWorkspaceRow);
  const result = intake([approvedReviewerRow]);

  assert.equal(result.summary.acceptedReviewerRows, 1);
  assert.equal(result.acceptedReviewerDecisionRows.length, 1);
  assert.equal(JSON.stringify(baseWorkspaceRow), workspaceBefore);
  assert.equal(result.summary.safety.approvalWorkspaceMutated, false);
});
