import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopedDecisionApprovalWorkspace,
  scopedDecisionForbiddenDirectMutationActions,
  type ScopedDecisionApprovalInputRow
} from "./scoped-decision-approval-workspace.js";

const baseRow: ScopedDecisionApprovalInputRow = {
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

function workspace(rows: readonly ScopedDecisionApprovalInputRow[]) {
  return buildScopedDecisionApprovalWorkspace({
    decisions: rows,
    sourceReviewFolder: ".tmp/bc-scoped-decision-review",
    sourceValidationFolder: ".tmp/bc-scoped-decision-validation",
    outputFolder: ".tmp/bc-scoped-decision-approval-workspace",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

test("approval workspace keeps approval_status as pending by default", () => {
  const result = workspace([baseRow]);

  assert.equal(result.approvalWorkbookRows[0]?.approval_status, "pending");
  assert.equal(result.summary.pendingRows, 1);
});

test("safe_to_auto_apply defaults to false", () => {
  const result = workspace([baseRow]);

  assert.equal(result.approvalWorkbookRows[0]?.safe_to_auto_apply, "false");
  assert.equal(result.summary.safeToAutoApplyRows, 0);
});

test("safe_to_seed_target_profile defaults to false", () => {
  const result = workspace([{ ...baseRow, decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION" }]);

  assert.equal(result.approvalWorkbookRows[0]?.safe_to_seed_target_profile, "false");
  assert.equal(result.summary.safeToSeedTargetProfileRows, 0);
});

test("blank or UNMAPPED routes to source-data template", () => {
  const result = workspace([{
    ...baseRow,
    decision_family: "(blank)/UNMAPPED",
    decision_category: "SOURCE_DATA_REVIEW",
    source_values: "(blank)"
  }]);

  assert.equal(result.sourceDataTemplateRows.length, 1);
  assert.equal(result.aliasCanonicalTemplateRows.length, 0);
});

test("OMSO conflict routes to alias/canonical template", () => {
  const result = workspace([baseRow]);

  assert.equal(result.aliasCanonicalTemplateRows.length, 1);
  assert.equal(result.aliasCanonicalTemplateRows[0]?.decision_family, "OMSO");
});

test("VFINE and LONGSUN wrong size variant rows route to alias/canonical template", () => {
  const result = workspace([
    {
      ...baseRow,
      decision_id: "D00002",
      decision_family: "VFINE",
      source_values: "VFINE BOTOL 600 ML",
      reason: "Potential wrong size/variant mapping against VFINE BOTOL 400 ML."
    },
    {
      ...baseRow,
      decision_id: "D00003",
      decision_family: "LONGSUN",
      source_values: "LONGSUN 1 BOTOL 1500 ML",
      reason: "Potential wrong size/variant mapping against 1000 ML or 600 ML."
    }
  ]);

  assert.equal(result.aliasCanonicalTemplateRows.length, 2);
});

test("reject blockers route to reject attachment template", () => {
  const result = workspace([{
    ...baseRow,
    decision_category: "REJECT_ATTACHMENT_REVIEW",
    blocker_categories: "REJECT_SCOPE_BLOCKER",
    sample_items: "RJ008"
  }]);

  assert.equal(result.rejectAttachmentTemplateRows.length, 1);
});

test("target profile blockers route to target profile template and remain dependency-blocked", () => {
  const result = workspace([{
    ...baseRow,
    decision_category: "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION",
    source_values: "OMSO 2-OZ - Printing 22 OZ"
  }]);

  assert.equal(result.targetProfileTemplateRows.length, 1);
  assert.match(result.targetProfileTemplateRows[0]?.reviewer_notes ?? "", /Entity\/canonical approval is required first/);
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("no direct mutation action values are generated", () => {
  const result = workspace([baseRow]);
  const serialized = JSON.stringify({
    rows: result.approvalWorkbookRows,
    manifest: result.importManifest
  });

  for (const action of scopedDecisionForbiddenDirectMutationActions) {
    assert.equal(result.approvalWorkbookRows.some((row) => String(row.approved_action) === action), false);
    assert.equal(result.importManifest.allowedApprovedActions.some((allowed) => String(allowed) === action), false);
    assert.equal(serialized.includes(action), false);
  }
});

test("P1.0 remains blocked", () => {
  const result = workspace([baseRow]);

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    decisionsAutoApproved: false
  });
});
