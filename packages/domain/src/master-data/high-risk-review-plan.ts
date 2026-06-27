import type { BackfillRiskLevel } from "./entity-target-backfill-plan.js";
import type {
  BusinessCentralCurrentKpiScope,
  BusinessCentralEntitySourceStatus,
  BusinessCentralFutureUseDomain
} from "./bc-data-scope.js";

export type HighRiskReviewDecision =
  | "BLOCK_P1_SWITCH"
  | "MANUAL_APPROVAL_REQUIRED"
  | "CAN_CREATE_CANONICAL_ENTITY_LATER"
  | "CAN_CREATE_TARGET_PROFILE_DRAFT_LATER"
  | "CAN_AUTO_COLLAPSE_IN_FUTURE"
  | "NEEDS_SOURCE_DATA_FIX"
  | "NEEDS_ALIAS_CLEANUP"
  | "IGNORE_FOR_NOW";

export type P10GateStatus = "BLOCKED" | "PASS_WITH_WARNINGS" | "PASS";

export interface HighRiskReviewPlanGroup {
  readonly reviewGroupType: string;
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly canonicalEntityCode: string;
  readonly currentEntityCodes: readonly string[];
  readonly proposedEntityCode: string;
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly reviewDecision: HighRiskReviewDecision;
  readonly recommendedAction: string;
  readonly p10Blocker: boolean;
  readonly blocksP10AfterScope: boolean;
  readonly bcCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly bcFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly bcScopeReason: string;
  readonly bcScopeEvidenceFields: readonly string[];
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
}

export interface P10GateInput {
  readonly entityHighRiskRowsAfterScope: number;
  readonly targetProfileHighRiskRowsAfterScope: number;
  readonly unresolvedHighRiskGroupsAfterScope: number;
  readonly targetProfilesTableAvailable: boolean;
  readonly approvedTargetProfileCount: number;
  readonly resolverV2ResolvedRows: number;
  readonly targetProfileNoActiveRows: number;
  readonly kpiComparisonReady: boolean;
  readonly kpiComparisonReviewed: boolean;
}

export interface P10Gate {
  readonly status: P10GateStatus;
  readonly reason: string;
  readonly blockers: readonly string[];
  readonly canSwitchDashboard: boolean;
  readonly canEnableResolverV2: boolean;
  readonly canEnableTargetProfiles: boolean;
}

export interface HighRiskReviewPlanSummaryInput extends P10GateInput {
  readonly generatedAt?: string;
  readonly entityHighRiskRows: number;
  readonly targetProfileHighRiskRows: number;
  readonly groups: readonly HighRiskReviewPlanGroup[];
}

export interface HighRiskReviewPlanSummary {
  readonly generatedAt: string;
  readonly entityHighRiskRows: number;
  readonly targetProfileHighRiskRows: number;
  readonly blockedGroupsBeforeScope: number;
  readonly blockedGroupsAfterScope: number;
  readonly blockedGroups: number;
  readonly manualApprovalGroups: number;
  readonly safeAutoMigrationGroups: number;
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly { readonly value: string; readonly rows: number }[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly p10Gate: P10Gate;
  readonly topBlockedGroups: readonly HighRiskReviewPlanGroup[];
  readonly topManualApprovalGroups: readonly HighRiskReviewPlanGroup[];
  readonly topSafeAutoMigrationGroups: readonly HighRiskReviewPlanGroup[];
  readonly topExcludedFromP10ButRetainedGroups: readonly HighRiskReviewPlanGroup[];
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

export type KpiCompareV1V2Status =
  | "P1.0_BLOCKED_BY_HIGH_RISK_REVIEW"
  | "READY_FOR_COMPARISON";

export interface KpiCompareV1V2Summary {
  readonly generatedAt: string;
  readonly status: KpiCompareV1V2Status;
  readonly blockers: readonly string[];
  readonly safety: {
    readonly dashboardChanged: false;
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
  };
}

export function evaluateP10Gate(input: P10GateInput): P10Gate {
  const blockers: string[] = [];

  if (input.entityHighRiskRowsAfterScope > 0 || input.targetProfileHighRiskRowsAfterScope > 0 || input.unresolvedHighRiskGroupsAfterScope > 0) {
    blockers.push(
      `Unresolved high-risk review remains after scope filtering: entityHighRiskRows=${input.entityHighRiskRowsAfterScope}, targetProfileHighRiskRows=${input.targetProfileHighRiskRowsAfterScope}, blockedGroups=${input.unresolvedHighRiskGroupsAfterScope}.`
    );
  }

  if (!input.targetProfilesTableAvailable) {
    blockers.push("target_profiles table is not available, so target profile lookup cannot be enabled.");
  } else if (input.approvedTargetProfileCount === 0) {
    blockers.push("target_profiles has zero active approved profiles.");
  }

  if (input.resolverV2ResolvedRows > 0) {
    const noActiveRatio = input.targetProfileNoActiveRows / input.resolverV2ResolvedRows;
    if (noActiveRatio > 0.5) {
      blockers.push(
        `Target profile lookup has no active target profile for most resolved rows (${input.targetProfileNoActiveRows}/${input.resolverV2ResolvedRows}).`
      );
    }
  }

  if (!input.kpiComparisonReady) {
    blockers.push("KPI comparison is not ready; run and review pnpm bc:kpi-compare-v1-v2 before P1.0.");
  } else if (!input.kpiComparisonReviewed) {
    blockers.push("KPI comparison output exists but has not been reviewed/approved for P1.0.");
  }

  if (blockers.length > 0) {
    return {
      status: "BLOCKED",
      reason: blockers.join(" "),
      blockers,
      canSwitchDashboard: false,
      canEnableResolverV2: false,
      canEnableTargetProfiles: false
    };
  }

  return {
    status: "PASS",
    reason: "No high-risk review blockers remain, target profiles are active/approved, and KPI comparison is ready and reviewed.",
    blockers: [],
    canSwitchDashboard: true,
    canEnableResolverV2: true,
    canEnableTargetProfiles: true
  };
}

export function buildHighRiskReviewPlanSummary(input: HighRiskReviewPlanSummaryInput): HighRiskReviewPlanSummary {
  const blockedGroupsBeforeScope = input.groups.filter((group) => group.p10Blocker);
  const blockedGroups = input.groups.filter((group) => group.blocksP10AfterScope);
  const manualApprovalGroups = input.groups.filter((group) => (
    !group.blocksP10AfterScope
    && group.reviewDecision !== "CAN_AUTO_COLLAPSE_IN_FUTURE"
    && group.reviewDecision !== "IGNORE_FOR_NOW"
  ));
  const safeAutoMigrationGroups = input.groups.filter((group) => (
    !group.blocksP10AfterScope && group.reviewDecision === "CAN_AUTO_COLLAPSE_IN_FUTURE"
  ));
  const topExcludedFromP10ButRetainedGroups = sortReviewGroups(input.groups.filter((group) => (
    group.p10Blocker && !group.blocksP10AfterScope
  ))).slice(0, 20);
  const futureUseDomainCounts = countGroupRowsByValue(input.groups, (group) => group.bcFutureUseDomain);
  const outputKpiOkScopeRows = countScopeRows(input.groups, "OUTPUT_KPI_OK_SCOPE");
  const outputKpiRejectScopeRows = countScopeRows(input.groups, "OUTPUT_KPI_REJECT_SCOPE");
  const outOfCurrentKpiScopeRows = countScopeRows(input.groups, "OUT_OF_CURRENT_KPI_SCOPE");
  const unknownScopeReviewRows = countScopeRows(input.groups, "UNKNOWN_SCOPE_REVIEW");
  const entitySourceBlankButClassifiedRows = input.groups
    .filter((group) => group.bcEntitySourceStatus === "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED")
    .reduce((sum, group) => sum + group.rows, 0);
  const entitySourceBlankUnknownRows = input.groups
    .filter((group) => group.bcEntitySourceStatus === "ENTITY_SOURCE_BLANK_UNKNOWN")
    .reduce((sum, group) => sum + group.rows, 0);
  const p10BlockingRowsBeforeScope = input.groups.filter((group) => group.p10Blocker).reduce((sum, group) => sum + group.rows, 0);
  const p10BlockingRowsAfterScope = input.groups.filter((group) => group.blocksP10AfterScope).reduce((sum, group) => sum + group.rows, 0);
  const entityHighRiskRowsAfterScope = input.groups
    .filter((group) => group.reviewGroupType.startsWith("ENTITY") && group.blocksP10AfterScope)
    .reduce((sum, group) => sum + group.rows, 0);
  const targetProfileHighRiskRowsAfterScope = input.groups
    .filter((group) => group.reviewGroupType.startsWith("TARGET_PROFILE") && group.blocksP10AfterScope)
    .reduce((sum, group) => sum + group.rows, 0);
  const excludedFromP10ButRetainedRows = input.groups
    .filter((group) => group.p10Blocker && !group.blocksP10AfterScope)
    .reduce((sum, group) => sum + group.rows, 0);
  const p10Gate = evaluateP10Gate({
    entityHighRiskRowsAfterScope,
    targetProfileHighRiskRowsAfterScope,
    unresolvedHighRiskGroupsAfterScope: blockedGroups.length,
    targetProfilesTableAvailable: input.targetProfilesTableAvailable,
    approvedTargetProfileCount: input.approvedTargetProfileCount,
    resolverV2ResolvedRows: input.resolverV2ResolvedRows,
    targetProfileNoActiveRows: input.targetProfileNoActiveRows,
    kpiComparisonReady: input.kpiComparisonReady,
    kpiComparisonReviewed: input.kpiComparisonReviewed
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    entityHighRiskRows: input.entityHighRiskRows,
    targetProfileHighRiskRows: input.targetProfileHighRiskRows,
    blockedGroupsBeforeScope: blockedGroupsBeforeScope.length,
    blockedGroupsAfterScope: blockedGroups.length,
    blockedGroups: blockedGroups.length,
    manualApprovalGroups: manualApprovalGroups.length,
    safeAutoMigrationGroups: safeAutoMigrationGroups.length,
    outputKpiOkScopeRows,
    outputKpiRejectScopeRows,
    outOfCurrentKpiScopeRows,
    unknownScopeReviewRows,
    futureUseDomainCounts,
    entitySourceBlankButClassifiedRows,
    entitySourceBlankUnknownRows,
    p10BlockingRowsBeforeScope,
    p10BlockingRowsAfterScope,
    excludedFromP10ButRetainedRows,
    p10Gate,
    topBlockedGroups: sortReviewGroups(blockedGroups).slice(0, 20),
    topManualApprovalGroups: sortReviewGroups(manualApprovalGroups).slice(0, 20),
    topSafeAutoMigrationGroups: sortReviewGroups(safeAutoMigrationGroups).slice(0, 20),
    topExcludedFromP10ButRetainedGroups,
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };
}

export function buildKpiCompareV1V2Summary(input: {
  readonly generatedAt?: string;
  readonly p10Gate: P10Gate;
}): KpiCompareV1V2Summary {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: input.p10Gate.status === "BLOCKED"
      ? "P1.0_BLOCKED_BY_HIGH_RISK_REVIEW"
      : "READY_FOR_COMPARISON",
    blockers: input.p10Gate.blockers,
    safety: {
      dashboardChanged: false,
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false
    }
  };
}

function sortReviewGroups(groups: readonly HighRiskReviewPlanGroup[]): readonly HighRiskReviewPlanGroup[] {
  return [...groups].sort((left, right) => (
    Number(right.blocksP10AfterScope) - Number(left.blocksP10AfterScope)
    || Number(right.p10Blocker) - Number(left.p10Blocker)
    || riskSort(right.riskLevel) - riskSort(left.riskLevel)
    || right.rows - left.rows
    || left.reviewGroupType.localeCompare(right.reviewGroupType)
    || left.sourceValue.localeCompare(right.sourceValue)
  ));
}

function riskSort(value: BackfillRiskLevel): number {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}

function countScopeRows(
  groups: readonly HighRiskReviewPlanGroup[],
  scope: BusinessCentralCurrentKpiScope
): number {
  return groups.filter((group) => group.bcCurrentKpiScope === scope).reduce((sum, group) => sum + group.rows, 0);
}

function countGroupRowsByValue(
  groups: readonly HighRiskReviewPlanGroup[],
  selectValue: (group: HighRiskReviewPlanGroup) => string
): readonly { readonly value: string; readonly rows: number }[] {
  const counts = new Map<string, number>();
  for (const group of groups) {
    const value = selectValue(group);
    counts.set(value, (counts.get(value) ?? 0) + group.rows);
  }
  return [...counts.entries()]
    .map(([value, rows]) => ({ value, rows }))
    .sort((left, right) => right.rows - left.rows || left.value.localeCompare(right.value));
}
