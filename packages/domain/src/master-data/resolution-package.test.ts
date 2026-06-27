import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAliasCleanupReviewPlanItem,
  buildBlockedGroupsChecklistItem,
  buildCanonicalEntityCreationPlanItem,
  buildManualApprovalQueueItem,
  buildResolutionPackageSummary,
  buildTargetProfileSeedDraftPlanItem
} from "./resolution-package.js";
import type { HighRiskReviewPlanGroup, P10Gate } from "./high-risk-review-plan.js";

const highRiskAliasGroup: HighRiskReviewPlanGroup = {
  reviewGroupType: "ENTITY_HIGH_RISK",
  sourceField: "gProdOrRotLineDescription",
  sourceValue: "OMSO 2-OZ",
  canonicalEntityCode: "OMSO 2-OZ",
  currentEntityCodes: [
    "OMSO 1-OZ - Printing 22 OZ",
    "OMSO 2-OZ - Printing 22 OZ"
  ],
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

const blockedGate: P10Gate = {
  status: "BLOCKED",
  reason: "Unresolved high-risk review remains.",
  blockers: ["Unresolved high-risk review remains."],
  canSwitchDashboard: false,
  canEnableResolverV2: false,
  canEnableTargetProfiles: false
};

test("high-risk alias conflict appears in alias cleanup plan", () => {
  const item = buildAliasCleanupReviewPlanItem({
    sourceField: highRiskAliasGroup.sourceField,
    sourceValue: highRiskAliasGroup.sourceValue,
    currentEntityCodes: highRiskAliasGroup.currentEntityCodes,
    proposedCanonicalEntityCode: highRiskAliasGroup.canonicalEntityCode,
    rows: highRiskAliasGroup.rows,
    riskLevel: highRiskAliasGroup.riskLevel,
    reason: highRiskAliasGroup.riskReason,
    recommendedAction: highRiskAliasGroup.recommendedAction,
    sampleDocuments: highRiskAliasGroup.sampleDocuments,
    sampleItems: highRiskAliasGroup.sampleItems
  });

  assert.equal(item.conflictType, "multiple_current_entities");
  assert.equal(item.approvalStatus, "needs_review");
});

test("canonical gap appears in canonical entity creation plan", () => {
  const item = buildCanonicalEntityCreationPlanItem({
    canonicalEntityCode: "THERMO HENGFENG-2-OZ",
    canonicalEntityDisplayName: "THERMO HENGFENG-2-OZ",
    sourceValues: ["THERMO HENGFENG-2-OZ"],
    currentEntityCodes: ["THERMO HENGFENG-2-OZ - Thermoforming"],
    rows: 4592,
    riskLevel: "LOW",
    reason: "Current entity is a legacy detailed target-variant name.",
    recommendedAction: "Create or expose the canonical entity in a reviewed migration plan.",
    sampleDocuments: ["DOC-2"],
    sampleItems: ["ITEM-2"]
  });

  assert.equal(item.canonicalEntityCode, "THERMO HENGFENG-2-OZ");
  assert.equal(item.areaCandidate, "THERMOFORMING");
  assert.equal(item.approvalStatus, "needs_review");
});

test("target profile candidate becomes draft, not approved", () => {
  const item = buildTargetProfileSeedDraftPlanItem({
    canonicalEntityCode: "POLYPRINT 2 PRINTING-OZ",
    canonicalEntityDisplayName: "POLYPRINT 2 PRINTING-OZ",
    targetBucket: "REG",
    machineCenterNo: "",
    machineCenterNoNormalized: "",
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    targetQty: 288000,
    unit: "PCS",
    sourceCurrentEntityCode: "POLYPRINT 2 PRINTING-OZ - Printing OZ < 20",
    sourceTargetValueOrigin: "production_targets",
    rows: 486,
    riskLevel: "LOW",
    reason: "Target profile candidate is derived from reviewed entity backfill.",
    recommendedAction: "Review dry-run candidate.",
    sampleDocuments: ["DOC-3"],
    sampleItems: ["ITEM-3"]
  });

  assert.equal(item.approvalStatus, "draft");
});

test("manual approval queue prioritizes high row blockers as P1", () => {
  const item = buildManualApprovalQueueItem(highRiskAliasGroup);

  assert.equal(item.priority, "P1");
  assert.equal(item.blocksP10, true);
});

test("blocked checklist defaults to pending and unresolved", () => {
  const item = buildBlockedGroupsChecklistItem(highRiskAliasGroup, 0);

  assert.equal(item.blockerId, "B0001");
  assert.equal(item.owner, "");
  assert.equal(item.approvalStatus, "pending");
  assert.equal(item.resolved, false);
});

test("resolution package summary safety flags remain false", () => {
  const summary = buildResolutionPackageSummary({
    generatedAt: "2026-06-27T00:00:00.000Z",
    sourceReports: {
      entityBackfillDryRun: ".tmp/bc-entity-v2-backfill-dry-run.json",
      targetProfileBackfillDryRun: ".tmp/bc-target-profile-backfill-dry-run.json",
      highRiskReviewPlan: ".tmp/bc-high-risk-review-plan.json"
    },
    canonicalEntityCreationCandidates: 1,
    aliasCleanupCandidates: 1,
    targetProfileSeedDraftCandidates: 1,
    manualApprovalItems: 1,
    blockedGroups: 1,
    scopeSummary: {
      outputKpiOkScopeRows: 1,
      outputKpiRejectScopeRows: 0,
      outOfCurrentKpiScopeRows: 0,
      unknownScopeReviewRows: 0,
      futureUseDomainCounts: [{ value: "PRODUCTION_OUTPUT_DASHBOARD", rows: 1 }],
      entitySourceBlankButClassifiedRows: 0,
      entitySourceBlankUnknownRows: 0,
      p10BlockingRowsBeforeScope: 1,
      p10BlockingRowsAfterScope: 1,
      excludedFromP10ButRetainedRows: 0
    },
    p10Gate: blockedGate
  });

  assert.equal(summary.p10Readiness.status, "BLOCKED");
  assert.deepEqual(summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false
  });
});
