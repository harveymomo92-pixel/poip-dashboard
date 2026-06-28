import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopedDecisionReview,
  decisionCategory,
  decisionFamily,
  type ScopedDecisionReviewInputRow
} from "./scoped-decision-review.js";

const baseRow: ScopedDecisionReviewInputRow = {
  blocker_group_id: "SB00001",
  blocker_category: "OK_OUTPUT_ENTITY_BLOCKER",
  review_group_type: "ENTITY_HIGH_RISK",
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  canonical_entity_code: "OMSO 2-OZ",
  current_entity_codes: "OMSO 1-OZ - Printing 22 OZ|OMSO 2-OZ - Printing 22 OZ",
  proposed_entity_code: "OMSO 2-OZ",
  target_bucket: "",
  machine_center_no: "(blank)",
  rows: 408,
  risk_level: "HIGH",
  risk_reason: "The same source value maps to multiple current entity codes.",
  review_decision: "NEEDS_ALIAS_CLEANUP",
  recommended_action: "Review aliases/catalog manually.",
  p10_blocker_before_scope: "true",
  blocks_p10_after_scope: "true",
  bc_current_kpi_scope: "OUTPUT_KPI_OK_SCOPE",
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  bc_scope_reason: "Output row has finished-goods evidence.",
  bc_scope_evidence_fields: "entryType|itemNo",
  bc_entity_source_status: "HAS_PRIMARY_ENTITY_SOURCE",
  sample_documents: "SPK2601/P0001",
  sample_items: "CR16OZOTPC"
};

test("decision review groups blockers by family", () => {
  const review = buildScopedDecisionReview({
    rows: [
      baseRow,
      { ...baseRow, blocker_group_id: "SB00002", source_value: "VFINE BOTOL 600 ML", canonical_entity_code: "VFINE BOTOL 600 ML", current_entity_codes: "VFINE BOTOL 400 ML", rows: 214 }
    ],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });

  assert.deepEqual(review.familyRollupRows.map((row) => row.decision_family).sort(), ["OMSO", "VFINE"]);
});

test("OMSO conflicts are manual review and not safe to auto apply", () => {
  const review = buildScopedDecisionReview({
    rows: [baseRow],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review"
  });

  assert.equal(decisionFamily(baseRow), "OMSO");
  assert.equal(review.decisionRows[0]?.decision_category, "ALIAS_CANONICAL_REVIEW");
  assert.equal(review.decisionRows[0]?.safe_to_auto_apply, "false");
  assert.match(review.decisionRows[0]?.recommended_action ?? "", /Manually review OMSO/);
});

test("wrong size or variant mappings are manual alias/canonical review", () => {
  for (const row of [
    { ...baseRow, source_value: "VFINE BOTOL 600 ML", canonical_entity_code: "VFINE BOTOL 600 ML", current_entity_codes: "VFINE BOTOL 400 ML" },
    { ...baseRow, source_value: "LONGSUN 1 BOTOL 1500 ML", canonical_entity_code: "LONGSUN 1 BOTOL 1500 ML", current_entity_codes: "LONGSUN 1 BOTOL 1000 ML|LONGSUN 1 BOTOL 600 ML" }
  ]) {
    const review = buildScopedDecisionReview({
      rows: [row],
      sourcePackage: ".tmp/bc-scoped-blocker-package",
      outputFolder: ".tmp/bc-scoped-decision-review"
    });

    assert.equal(review.decisionRows[0]?.decision_category, "ALIAS_CANONICAL_REVIEW");
    assert.match(review.decisionRows[0]?.reason ?? "", /wrong size\/variant/i);
    assert.equal(review.decisionRows[0]?.safe_to_auto_apply, "false");
  }
});

test("reject scope blockers are exported with reject attachment review", () => {
  const row = {
    ...baseRow,
    blocker_category: "REJECT_SCOPE_BLOCKER",
    bc_current_kpi_scope: "OUTPUT_KPI_REJECT_SCOPE",
    bc_future_use_domain: "REJECT_ATTACHMENT",
    sample_items: "RJ008|RJ004"
  };

  assert.equal(decisionCategory(row), "REJECT_ATTACHMENT_REVIEW");
});

test("target profile rows are dependency-blocked by entity decisions", () => {
  const row = {
    ...baseRow,
    blocker_category: "TARGET_PROFILE_BLOCKER",
    review_group_type: "TARGET_PROFILE_HIGH_RISK",
    source_value: "OMSO 2-OZ - Printing 22 OZ"
  };

  assert.equal(decisionCategory(row), "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION");
});

test("unknown blank source rows go to source-data review, not canonical entity creation", () => {
  const row = {
    ...baseRow,
    blocker_category: "UNKNOWN_SCOPE_BLOCKER",
    source_field: "UNMAPPED",
    source_value: "(blank)",
    canonical_entity_code: "(blank)",
    current_entity_codes: "",
    bc_current_kpi_scope: "UNKNOWN_SCOPE_REVIEW",
    bc_future_use_domain: "UNKNOWN_REVIEW"
  };
  const review = buildScopedDecisionReview({
    rows: [row],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review"
  });

  assert.equal(review.decisionRows[0]?.decision_family, "(blank)/UNMAPPED");
  assert.equal(review.decisionRows[0]?.decision_category, "SOURCE_DATA_REVIEW");
  assert.notEqual(review.decisionRows[0]?.decision_category, "CANONICAL_ENTITY_NEEDED");
});

test("safe_to_auto_apply is false by default", () => {
  const review = buildScopedDecisionReview({
    rows: [baseRow],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review"
  });

  assert.equal(review.decisionRows.every((row) => row.safe_to_auto_apply === "false"), true);
});

test("safety flags remain false", () => {
  const review = buildScopedDecisionReview({
    rows: [baseRow],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review"
  });

  assert.deepEqual(review.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false
  });
});

test("P1.0 remains blocked when decision rows remain pending", () => {
  const review = buildScopedDecisionReview({
    rows: [baseRow],
    sourcePackage: ".tmp/bc-scoped-blocker-package",
    outputFolder: ".tmp/bc-scoped-decision-review"
  });

  assert.equal(review.summary.p10Gate.status, "BLOCKED");
  assert.match(review.summary.p10Gate.reason, /pending scoped decision rows/);
});
