import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopedDecisionApplyDryRun,
  type ScopedDecisionApplyDryRunInputRow
} from "./scoped-decision-apply-dry-run.js";

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

function run(rows: readonly ScopedDecisionApplyDryRunInputRow[]) {
  return buildScopedDecisionApplyDryRun({
    rows,
    sourceApprovalWorkspace: ".tmp/bc-scoped-decision-approval-workspace",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-apply-dry-run",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

test("pending approval rows are blocked and not executable", () => {
  const result = run([baseRow]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.summary.blockedRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "PENDING_APPROVAL_STATUS");
});

test("empty approval status is treated as pending", () => {
  const result = run([{ ...baseRow, approval_status: "" }]);

  assert.equal(result.summary.pendingInputRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.approval_status, "pending");
});

test("approved row without reviewer is blocked", () => {
  const result = run([{ ...baseRow, approval_status: "approved", approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY" }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER");
});

test("approved row without reviewer notes is blocked", () => {
  const result = run([{
    ...baseRow,
    approval_status: "approved",
    approved_action: "APPROVE_ALIAS_CANONICAL_REVIEW_ONLY",
    reviewer: "qa"
  }]);

  assert.equal(result.summary.executableRows, 0);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "APPROVED_REQUIRES_REVIEWER_NOTES");
});

test("direct mutation action values are invalid and blocked", () => {
  const result = run([{
    ...baseRow,
    approval_status: "approved",
    approved_action: "CREATE_ALIAS_NOW",
    reviewer: "qa",
    reviewer_notes: "Reviewed."
  }]);

  assert.equal(result.summary.invalidActionRows, 1);
  assert.equal(result.blockedDecisionPlanRows[0]?.blocker_code, "INVALID_DIRECT_MUTATION_ACTION");
});

test("blank or UNMAPPED cannot create canonical entity", () => {
  const result = run([{
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
  const result = run([{
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
  const result = run([{
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

test("current raw workspace produces zero executable decisions", () => {
  const result = run([
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
  const result = run([baseRow]);

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
