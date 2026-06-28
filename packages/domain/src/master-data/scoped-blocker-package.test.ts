import assert from "node:assert/strict";
import test from "node:test";
import { buildBusinessCentralScopedBlockerPackage, type ScopedBlockerPackageInputRow } from "./scoped-blocker-package.js";

const baseRow: ScopedBlockerPackageInputRow = {
  sourceFile: "manual-approval-queue.csv",
  blockerId: "",
  blockerType: "ENTITY_HIGH_RISK",
  bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
  bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
  bcScopeReason: "scope reason",
  bcEntitySourceStatus: "HAS_PRIMARY_ENTITY_SOURCE",
  sourceValue: "BASE",
  canonicalEntityCode: "BASE",
  currentEntityCodes: ["BASE"],
  targetBucket: "",
  machineCenterNo: "",
  rows: 1,
  riskLevel: "LOW",
  decisionNeeded: "REVIEW",
  recommendedAction: "Review",
  blocksP10BeforeScope: true,
  blocksP10AfterScope: true,
  sampleDocuments: ["DOC-1"],
  sampleItems: ["ITEM-1"],
  approvalStatus: "pending",
  reviewer: "",
  reviewerNotes: ""
};

test("scoped blocker package excludes out-of-scope rows from true blockers and dedupes overlaps", () => {
  const result = buildBusinessCentralScopedBlockerPackage({
    totalRows: 102066,
    excludedFromP10ButRetainedRows: 24783,
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked.",
      blockers: ["P1.0 remains blocked."],
      canSwitchDashboard: false,
      canEnableResolverV2: false,
      canEnableTargetProfiles: false
    },
    rows: [
      {
        ...baseRow,
        sourceFile: "manual-approval-queue.csv",
        sourceValue: "UNKNOWN-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "UNKNOWN_SCOPE_REVIEW",
        bcFutureUseDomain: "UNKNOWN_REVIEW",
        rows: 10
      },
      {
        ...baseRow,
        sourceFile: "blocked-groups-checklist.csv",
        sourceValue: "OK-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        rows: 20
      },
      {
        ...baseRow,
        sourceFile: "manual-approval-queue.csv",
        sourceValue: "OK-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        rows: 7
      },
      {
        ...baseRow,
        sourceFile: "manual-approval-queue.csv",
        sourceValue: "REJECT-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_REJECT_SCOPE",
        bcFutureUseDomain: "REJECT_ATTACHMENT",
        rows: 30
      },
      {
        ...baseRow,
        sourceFile: "blocked-groups-checklist.csv",
        sourceValue: "TARGET-BLOCK",
        blockerType: "TARGET_PROFILE_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        rows: 40
      },
      {
        ...baseRow,
        sourceFile: "manual-approval-queue.csv",
        sourceValue: "RETAINED-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUT_OF_CURRENT_KPI_SCOPE",
        bcFutureUseDomain: "DOWNTIME_SPAREPART_OR_MATERIAL",
        blocksP10AfterScope: false,
        rows: 50
      },
      {
        ...baseRow,
        sourceFile: "blocked-groups-checklist.csv",
        sourceValue: "RETAINED-ROW",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUT_OF_CURRENT_KPI_SCOPE",
        bcFutureUseDomain: "DOWNTIME_SPAREPART_OR_MATERIAL",
        blocksP10AfterScope: false,
        rows: 60
      },
      {
        ...baseRow,
        sourceFile: "alias-cleanup-review-plan.csv",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        sourceValue: "ALIAS-ROW",
        rows: 12,
        blocksP10AfterScope: false,
        approvalStatus: "needs_review"
      },
      {
        ...baseRow,
        sourceFile: "alias-cleanup-review-plan.csv",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        sourceValue: "ALIAS-ROW",
        rows: 8,
        blocksP10AfterScope: false,
        approvalStatus: "needs_review"
      },
      {
        ...baseRow,
        sourceFile: "canonical-entity-creation-plan.csv",
        blockerType: "ENTITY_HIGH_RISK",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        sourceValue: "CANON-ROW",
        rows: 14,
        blocksP10AfterScope: false,
        approvalStatus: "needs_review"
      },
      {
        ...baseRow,
        sourceFile: "target-profile-seed-draft-plan.csv",
        blockerType: "TARGET_PROFILE_DRAFT",
        bcCurrentKpiScope: "OUTPUT_KPI_OK_SCOPE",
        bcFutureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
        sourceValue: "TP-ROW",
        rows: 16,
        blocksP10AfterScope: false,
        approvalStatus: "draft"
      }
    ]
  });

  assert.equal(result.summary.totalRows, 102066);
  assert.equal(result.summary.trueP10BlockerGroups, 4);
  assert.equal(result.summary.p10BlockingRowsAfterScope, 100);
  assert.equal(result.summary.unknownScopeBlockerRows, 10);
  assert.equal(result.summary.okOutputEntityBlockerRows, 20);
  assert.equal(result.summary.rejectScopeBlockerRows, 30);
  assert.equal(result.summary.targetProfileBlockerRows, 40);
  assert.equal(result.summary.aliasCleanupNeededRows, 12);
  assert.equal(result.summary.canonicalEntityNeededRows, 14);
  assert.equal(result.summary.targetProfileNeededRows, 16);
  assert.equal(result.summary.excludedFromP10ButRetainedRows, 24783);
  assert.equal(result.categories.retainedOutOfScope.length, 1);
  assert.equal(result.categories.retainedOutOfScope[0]?.rows, 60);
  assert.equal(result.categories.trueP10Blockers.length, 4);
  assert.equal(result.categories.unknownScopeBlockers.length, 1);
  assert.equal(result.categories.okOutputEntityBlockers.length, 1);
  assert.equal(result.categories.rejectScopeBlockers.length, 1);
  assert.equal(result.categories.targetProfileBlockers.length, 1);
  assert.equal(result.summary.topTrueP10Blockers[0]?.rows, 40);
  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false
  });
});
