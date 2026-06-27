import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHighRiskReviewPlanSummary,
  evaluateP10Gate,
  type HighRiskReviewPlanGroup
} from "./high-risk-review-plan.js";

const clearGateInput = {
  entityHighRiskRows: 0,
  targetProfileHighRiskRows: 0,
  unresolvedHighRiskGroups: 0,
  targetProfilesTableAvailable: true,
  approvedTargetProfileCount: 10,
  resolverV2ResolvedRows: 100,
  targetProfileNoActiveRows: 0,
  kpiComparisonReady: true,
  kpiComparisonReviewed: true
};

const blockedGroup: HighRiskReviewPlanGroup = {
  reviewGroupType: "ENTITY_HIGH_RISK",
  sourceField: "gProdOrRotLineDescription",
  sourceValue: "OMSO 2-OZ",
  canonicalEntityCode: "OMSO 2-OZ",
  currentEntityCodes: ["OMSO 1-OZ - Printing 22 OZ", "OMSO 2-OZ - Printing 22 OZ"],
  proposedEntityCode: "OMSO 2-OZ",
  targetBucket: "",
  machineCenterNo: "OMSO2 OZ",
  rows: 6036,
  riskLevel: "HIGH",
  riskReason: "The same source value maps to multiple current entity codes.",
  reviewDecision: "NEEDS_ALIAS_CLEANUP",
  recommendedAction: "Review aliases/catalog manually; do not migrate automatically.",
  p10Blocker: true,
  sampleDocuments: ["DOC-1"],
  sampleItems: ["ITEM-1"]
};

test("high-risk rows block P1.0", () => {
  const gate = evaluateP10Gate({
    ...clearGateInput,
    entityHighRiskRows: 1,
    unresolvedHighRiskGroups: 1
  });

  assert.equal(gate.status, "BLOCKED");
  assert.equal(gate.canSwitchDashboard, false);
  assert.match(gate.reason, /Unresolved high-risk review remains/);
});

test("empty target_profiles blocks P1.0", () => {
  const gate = evaluateP10Gate({
    ...clearGateInput,
    approvedTargetProfileCount: 0
  });

  assert.equal(gate.status, "BLOCKED");
  assert.match(gate.reason, /zero active approved profiles/);
});

test("no KPI compare readiness blocks P1.0", () => {
  const gate = evaluateP10Gate({
    ...clearGateInput,
    kpiComparisonReady: false,
    kpiComparisonReviewed: false
  });

  assert.equal(gate.status, "BLOCKED");
  assert.match(gate.reason, /KPI comparison is not ready/);
});

test("gate returns BLOCKED with clear combined reason", () => {
  const gate = evaluateP10Gate({
    ...clearGateInput,
    entityHighRiskRows: 30030,
    targetProfileHighRiskRows: 121,
    unresolvedHighRiskGroups: 42,
    approvedTargetProfileCount: 0,
    targetProfileNoActiveRows: 90,
    kpiComparisonReady: false,
    kpiComparisonReviewed: false
  });

  assert.equal(gate.status, "BLOCKED");
  assert.ok(gate.blockers.length >= 4);
  assert.match(gate.reason, /entityHighRiskRows=30030/);
  assert.match(gate.reason, /target_profiles has zero active approved profiles/);
  assert.match(gate.reason, /no active target profile for most resolved rows/);
  assert.match(gate.reason, /KPI comparison is not ready/);
});

test("high-risk review summary safety flags remain false", () => {
  const summary = buildHighRiskReviewPlanSummary({
    ...clearGateInput,
    generatedAt: "2026-06-27T00:00:00.000Z",
    entityHighRiskRows: 1,
    targetProfileHighRiskRows: 0,
    unresolvedHighRiskGroups: 1,
    groups: [blockedGroup]
  });

  assert.equal(summary.p10Gate.status, "BLOCKED");
  assert.equal(summary.blockedGroups, 1);
  assert.deepEqual(summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false
  });
});
