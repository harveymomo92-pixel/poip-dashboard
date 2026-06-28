import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopedDecisionValidation,
  type ScopedDecisionValidationInputRow
} from "./scoped-decision-validation.js";

const baseRow: ScopedDecisionValidationInputRow = {
  decision_id: "D00001",
  decision_family: "OMSO",
  decision_category: "ALIAS_CANONICAL_REVIEW",
  source_values: "OMSO 2-OZ",
  blocker_group_ids: "SB00004",
  blocker_categories: "OK_OUTPUT_ENTITY_BLOCKER",
  review_group_types: "ENTITY_HIGH_RISK",
  rows: 408,
  risk_levels: "HIGH",
  reason: "OMSO 2-OZ conflicts with OMSO 1-OZ current entities.",
  recommended_action: "Manually review OMSO alias/canonical conflict; never create broad/global aliases.",
  required_decision: "Approve exact canonical/alias decision manually; broad/global aliases are forbidden.",
  safe_to_auto_apply: "false",
  decision_status: "pending",
  p10_gate_effect: "BLOCKS_P1_0",
  sample_documents: "SPK2601/P0001",
  sample_items: "CR16OZOTPC"
};

function validate(rows: readonly ScopedDecisionValidationInputRow[]) {
  return buildScopedDecisionValidation({
    rows,
    sourceFolder: ".tmp/bc-scoped-decision-review",
    outputFolder: ".tmp/bc-scoped-decision-validation",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

test("pending decision rows keep validation status BLOCKED", () => {
  const validation = validate([baseRow]);

  assert.equal(validation.summary.validationStatus, "BLOCKED");
  assert.equal(validation.summary.pendingRows, 1);
  assert.equal(validation.summary.p10Gate.status, "BLOCKED");
});

test("approved row without reviewer is invalid", () => {
  const validation = validate([{ ...baseRow, approval_status: "approved", decision_status: "approved" }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.summary.invalidRows, 1);
  assert.equal(validation.validationErrors.some((row) => row.code === "APPROVED_REQUIRES_REVIEWER"), true);
});

test("OMSO conflict cannot be safe_to_auto_apply", () => {
  const validation = validate([{
    ...baseRow,
    approval_status: "approved",
    decision_status: "approved",
    safe_to_auto_apply: "true",
    reviewer: "qa",
    reviewer_notes: "Reviewed exact OMSO conflict."
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "OMSO_CANNOT_AUTO_APPLY"), true);
});

test("blank or UNMAPPED cannot be approved as canonical entity creation", () => {
  const validation = validate([{
    ...baseRow,
    decision_family: "(blank)/UNMAPPED",
    decision_category: "CANONICAL_ENTITY_NEEDED",
    source_values: "(blank)",
    approval_status: "approved",
    decision_status: "approved",
    reviewer: "qa",
    reviewer_notes: "Create canonical entity from blank source."
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "BLANK_SOURCE_CANNOT_CREATE_CANONICAL"), true);
});

test("target profile cannot be safe_to_seed while entity decision is pending", () => {
  const validation = validate([{
    ...baseRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    source_values: "OMSO 2-OZ - Printing 22 OZ",
    safe_to_seed_target_profile: "true",
    entity_decision_status: "pending",
    target_bucket: "OZ_LT_20",
    target_qty: "360000",
    unit: "PCS",
    reviewer: "qa",
    reviewer_notes: "Seed after review."
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_ENTITY_APPROVED"), true);
});

test("approved target profile seed requires target bucket, target qty, unit, reviewer, and notes", () => {
  const validation = validate([{
    ...baseRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    approval_status: "approved",
    decision_status: "approved",
    safe_to_seed_target_profile: "true",
    entity_decision_status: "approved"
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_BUCKET"), true);
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_QTY"), true);
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_UNIT"), true);
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_REVIEWER"), true);
  assert.equal(validation.validationErrors.some((row) => row.code === "TARGET_SEED_REQUIRES_NOTES"), true);
});

test("reject attachment row requires entity decision first when marked dependent", () => {
  const validation = validate([{
    ...baseRow,
    decision_category: "REJECT_ATTACHMENT_REVIEW",
    blocker_categories: "REJECT_SCOPE_BLOCKER",
    approval_status: "approved",
    decision_status: "approved",
    reviewer: "qa",
    reviewer_notes: "Reject attachment reviewed.",
    entity_decision_status: "pending",
    sample_items: "RJ008|RJ004"
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "REJECT_ATTACHMENT_REQUIRES_ENTITY_DECISION"), true);
});

test("unknown source blocking row cannot be resolved without reviewer notes", () => {
  const validation = validate([{
    ...baseRow,
    decision_family: "(blank)/UNMAPPED",
    decision_category: "SOURCE_DATA_REVIEW",
    source_values: "(blank)",
    approval_status: "approved",
    decision_status: "approved",
    reviewer: "qa"
  }]);

  assert.equal(validation.summary.validationStatus, "INVALID");
  assert.equal(validation.validationErrors.some((row) => row.code === "UNKNOWN_SOURCE_REQUIRES_NOTES"), true);
});

test("safety flags remain false", () => {
  const validation = validate([baseRow]);

  assert.deepEqual(validation.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false
  });
});

test("P1.0 remains blocked unless all blocking decisions are valid", () => {
  const blocked = validate([baseRow]);
  const pass = validate([{
    ...baseRow,
    approval_status: "deferred",
    decision_status: "deferred",
    reviewer: "qa",
    reviewer_notes: "Deferred safely; not executable in P1.0."
  }]);

  assert.equal(blocked.summary.p10Gate.status, "BLOCKED");
  assert.equal(pass.summary.p10Gate.status, "PASS");
  assert.equal(pass.summary.validationStatus, "PASS");
});
