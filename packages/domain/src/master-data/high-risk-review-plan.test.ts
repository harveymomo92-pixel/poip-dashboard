import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHighRiskReviewPlanSummary,
  evaluateP10Gate,
  type HighRiskReviewPlanGroup
} from "./high-risk-review-plan.js";

const clearGateInput = {
  entityHighRiskRowsAfterScope: 0,
  targetProfileHighRiskRowsAfterScope: 0,
  unresolvedHighRiskGroupsAfterScope: 0,
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
  blocksP10AfterScope: true,
  bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
  bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
  bcScopeReason: "Current KPI scoped high-risk row.",
  bcScopeEvidenceFields: ["entryType", "locationCode", "gProdOrRotLineDescription"],
  bcEntitySourceStatus: "HAS_PRIMARY_ENTITY_SOURCE",
  sampleDocuments: ["DOC-1"],
  sampleItems: ["ITEM-1"]
};

test("high-risk rows block P1.0", () => {
  const gate = evaluateP10Gate({
    ...clearGateInput,
    entityHighRiskRowsAfterScope: 1,
    unresolvedHighRiskGroupsAfterScope: 1
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
    entityHighRiskRowsAfterScope: 30030,
    targetProfileHighRiskRowsAfterScope: 121,
    unresolvedHighRiskGroupsAfterScope: 42,
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

test("out-of-current-KPI rows are retained but do not block P1.0 after scope", () => {
  const summary = buildHighRiskReviewPlanSummary({
    ...clearGateInput,
    generatedAt: "2026-06-27T00:00:00.000Z",
    entityHighRiskRows: 10,
    targetProfileHighRiskRows: 0,
    groups: [{
      ...blockedGroup,
      rows: 10,
      blocksP10AfterScope: false,
      bcCurrentKpiScope: "OUT_OF_CURRENT_KPI_SCOPE",
      bcFutureUseDomain: "DOWNTIME_SPAREPART_OR_MATERIAL",
      bcEntitySourceStatus: "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED"
    }]
  });

  assert.equal(summary.p10BlockingRowsBeforeScope, 10);
  assert.equal(summary.p10BlockingRowsAfterScope, 0);
  assert.equal(summary.excludedFromP10ButRetainedRows, 10);
  assert.equal(summary.outOfCurrentKpiScopeRows, 10);
  assert.equal(summary.entitySourceBlankButClassifiedRows, 10);
  assert.deepEqual(summary.futureUseDomainCounts, [{ value: "DOWNTIME_SPAREPART_OR_MATERIAL", rows: 10 }]);
  assert.equal(summary.topExcludedFromP10ButRetainedGroups.length, 1);
});

test("scoped KPI high-risk rows still block P1.0", () => {
  const summary = buildHighRiskReviewPlanSummary({
    ...clearGateInput,
    generatedAt: "2026-06-27T00:00:00.000Z",
    entityHighRiskRows: 7,
    targetProfileHighRiskRows: 0,
    groups: [{ ...blockedGroup, rows: 7 }]
  });

  assert.equal(summary.p10BlockingRowsBeforeScope, 7);
  assert.equal(summary.p10BlockingRowsAfterScope, 7);
  assert.equal(summary.p10Gate.status, "BLOCKED");
  assert.equal(summary.topBlockedGroups.length, 1);
});

test("gate reason reports entity and target profile rows separately after scope", () => {
  const targetProfileGroup: HighRiskReviewPlanGroup = {
    ...blockedGroup,
    reviewGroupType: "TARGET_PROFILE_HIGH_RISK",
    sourceField: "target_profile_backfill",
    sourceValue: "OMSO 2-OZ",
    rows: 3
  };
  const summary = buildHighRiskReviewPlanSummary({
    ...clearGateInput,
    generatedAt: "2026-06-27T00:00:00.000Z",
    entityHighRiskRows: 7,
    targetProfileHighRiskRows: 3,
    groups: [{ ...blockedGroup, rows: 7 }, targetProfileGroup]
  });

  assert.equal(summary.p10BlockingRowsAfterScope, 10);
  assert.match(summary.p10Gate.reason, /entityHighRiskRows=7/);
  assert.match(summary.p10Gate.reason, /targetProfileHighRiskRows=3/);
});
