import type { BackfillRiskLevel } from "./entity-target-backfill-plan.js";
import type {
  BusinessCentralCurrentKpiScope,
  BusinessCentralEntitySourceStatus,
  BusinessCentralFutureUseDomain
} from "./bc-data-scope.js";
import type { P10Gate } from "./high-risk-review-plan.js";

export type ScopedBlockerPackageCategory =
  | "TRUE_P10_BLOCKER"
  | "UNKNOWN_SCOPE_BLOCKER"
  | "OUTPUT_OK_ENTITY_BLOCKER"
  | "OUTPUT_REJECT_SCOPE_BLOCKER"
  | "TARGET_PROFILE_BLOCKER"
  | "ALIAS_CLEANUP_NEEDED"
  | "CANONICAL_ENTITY_NEEDED"
  | "TARGET_PROFILE_NEEDED"
  | "RETAINED_OUT_OF_SCOPE"
  | "OTHER_TRUE_BLOCKER";

export interface ScopedBlockerPackageInputRow {
  readonly sourceFile: string;
  readonly priority: string;
  readonly blockerId: string;
  readonly blockerType: string;
  readonly bcCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly bcFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly bcScopeReason: string;
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly sourceValue: string;
  readonly canonicalEntityCode: string;
  readonly currentEntityCodes: readonly string[];
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly decisionNeeded: string;
  readonly recommendedAction: string;
  readonly blocksP10BeforeScope: boolean;
  readonly blocksP10AfterScope: boolean;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
  readonly approvalStatus: string;
  readonly reviewer: string;
  readonly reviewerNotes: string;
}

export interface ScopedBlockerPackageCsvRow {
  readonly priority: string;
  readonly blocker_id: string;
  readonly blocker_type: string;
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: BusinessCentralFutureUseDomain;
  readonly bc_scope_reason: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly decision_needed: string;
  readonly recommended_action: string;
  readonly blocks_p10_before_scope: "true" | "false";
  readonly blocks_p10_after_scope: "true" | "false";
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly approval_status: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface ScopedBlockerPackageSummary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly trueP10BlockerGroups: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly unknownScopeBlockerRows: number;
  readonly okOutputEntityBlockerRows: number;
  readonly rejectScopeBlockerRows: number;
  readonly targetProfileBlockerRows: number;
  readonly aliasCleanupNeededRows: number;
  readonly canonicalEntityNeededRows: number;
  readonly targetProfileNeededRows: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly topTrueP10Blockers: readonly ScopedBlockerPackageCsvRow[];
  readonly topUnknownScopeBlockers: readonly ScopedBlockerPackageCsvRow[];
  readonly topOkOutputEntityBlockers: readonly ScopedBlockerPackageCsvRow[];
  readonly topRejectScopeBlockers: readonly ScopedBlockerPackageCsvRow[];
  readonly topTargetProfileBlockers: readonly ScopedBlockerPackageCsvRow[];
  readonly p10Gate: {
    readonly status: P10Gate["status"];
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

export interface ScopedBlockerPackageResult {
  readonly rows: readonly ScopedBlockerPackageCsvRow[];
  readonly summary: ScopedBlockerPackageSummary;
  readonly categories: {
    readonly trueP10Blockers: readonly ScopedBlockerPackageCsvRow[];
    readonly unknownScopeBlockers: readonly ScopedBlockerPackageCsvRow[];
    readonly okOutputEntityBlockers: readonly ScopedBlockerPackageCsvRow[];
    readonly rejectScopeBlockers: readonly ScopedBlockerPackageCsvRow[];
    readonly targetProfileBlockers: readonly ScopedBlockerPackageCsvRow[];
    readonly aliasCleanupNeeded: readonly ScopedBlockerPackageCsvRow[];
    readonly canonicalEntityNeeded: readonly ScopedBlockerPackageCsvRow[];
    readonly targetProfileNeeded: readonly ScopedBlockerPackageCsvRow[];
    readonly retainedOutOfScope: readonly ScopedBlockerPackageCsvRow[];
    readonly otherTrueBlockers: readonly ScopedBlockerPackageCsvRow[];
  };
}

export function buildBusinessCentralScopedBlockerPackage(input: {
  readonly rows: readonly ScopedBlockerPackageInputRow[];
  readonly totalRows: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly p10Gate: P10Gate;
  readonly generatedAt?: string;
}): ScopedBlockerPackageResult {
  const mergedRows = mergeRows(input.rows).sort(compareRows);
  const categorized = mergedRows.map((row) => ({
    ...row,
    category: classifyRow(row)
  }));

  const trueP10Blockers = categorized.filter((row) => row.blocksP10AfterScope);
  const unknownScopeBlockers = trueP10Blockers.filter((row) => row.category === "UNKNOWN_SCOPE_BLOCKER");
  const okOutputEntityBlockers = trueP10Blockers.filter((row) => row.category === "OUTPUT_OK_ENTITY_BLOCKER");
  const rejectScopeBlockers = trueP10Blockers.filter((row) => row.category === "OUTPUT_REJECT_SCOPE_BLOCKER");
  const targetProfileBlockers = trueP10Blockers.filter((row) => row.category === "TARGET_PROFILE_BLOCKER");
  const aliasCleanupNeeded = categorized.filter((row) => row.category === "ALIAS_CLEANUP_NEEDED");
  const canonicalEntityNeeded = categorized.filter((row) => row.category === "CANONICAL_ENTITY_NEEDED");
  const targetProfileNeeded = categorized.filter((row) => row.category === "TARGET_PROFILE_NEEDED");
  const retainedOutOfScope = categorized.filter((row) => row.category === "RETAINED_OUT_OF_SCOPE");
  const otherTrueBlockers = trueP10Blockers.filter((row) => row.category === "OTHER_TRUE_BLOCKER");
  const csvRows = categorized.map(stripCategory);

  return {
    rows: csvRows,
    categories: {
      trueP10Blockers: trueP10Blockers.map(stripCategory),
      unknownScopeBlockers: unknownScopeBlockers.map(stripCategory),
      okOutputEntityBlockers: okOutputEntityBlockers.map(stripCategory),
      rejectScopeBlockers: rejectScopeBlockers.map(stripCategory),
      targetProfileBlockers: targetProfileBlockers.map(stripCategory),
      aliasCleanupNeeded: aliasCleanupNeeded.map(stripCategory),
      canonicalEntityNeeded: canonicalEntityNeeded.map(stripCategory),
      targetProfileNeeded: targetProfileNeeded.map(stripCategory),
      retainedOutOfScope: retainedOutOfScope.map(stripCategory),
      otherTrueBlockers: otherTrueBlockers.map(stripCategory)
    },
    summary: {
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      totalRows: input.totalRows,
      trueP10BlockerGroups: trueP10Blockers.length,
      p10BlockingRowsAfterScope: sumRows(trueP10Blockers),
      unknownScopeBlockerRows: sumRows(unknownScopeBlockers),
      okOutputEntityBlockerRows: sumRows(okOutputEntityBlockers),
      rejectScopeBlockerRows: sumRows(rejectScopeBlockers),
      targetProfileBlockerRows: sumRows(targetProfileBlockers),
      aliasCleanupNeededRows: sumRows(aliasCleanupNeeded),
      canonicalEntityNeededRows: sumRows(canonicalEntityNeeded),
      targetProfileNeededRows: sumRows(targetProfileNeeded),
      excludedFromP10ButRetainedRows: input.excludedFromP10ButRetainedRows,
      topTrueP10Blockers: trueP10Blockers.slice(0, 10).map(stripCategory),
      topUnknownScopeBlockers: unknownScopeBlockers.slice(0, 10).map(stripCategory),
      topOkOutputEntityBlockers: okOutputEntityBlockers.slice(0, 10).map(stripCategory),
      topRejectScopeBlockers: rejectScopeBlockers.slice(0, 10).map(stripCategory),
      topTargetProfileBlockers: targetProfileBlockers.slice(0, 10).map(stripCategory),
      p10Gate: {
        status: input.p10Gate.status,
        reason: input.p10Gate.reason
      },
      safety: {
        databaseUpdated: false,
        productionOutputsUpdated: false,
        targetProfilesUpdated: false,
        dashboardChanged: false,
        aliasesChanged: false,
        conditionalRulesChanged: false
      }
    }
  };
}

function mergeRows(rows: readonly ScopedBlockerPackageInputRow[]): readonly (ScopedBlockerPackageInputRow & { readonly rowKey: string })[] {
  const groups = new Map<string, ScopedBlockerPackageInputRow & { readonly rowKey: string }>();

  for (const row of rows) {
    const rowKey = [
      normalizeKey(row.blockerType),
      normalizeKey(row.bcCurrentKpiScope),
      normalizeKey(row.bcFutureUseDomain),
      normalizeKey(row.sourceValue),
      normalizeKey(row.canonicalEntityCode),
      normalizeJoinedList(row.currentEntityCodes),
      normalizeKey(row.targetBucket),
      normalizeKey(row.machineCenterNo)
    ].join("||");
    const current = groups.get(rowKey);
    if (!current) {
      groups.set(rowKey, { ...row, rowKey });
      continue;
    }
    groups.set(rowKey, {
      ...current,
      priority: higherPriority(current.priority, row.priority),
      blockerId: current.blockerId || row.blockerId,
      rows: Math.max(current.rows, row.rows),
      riskLevel: higherRiskLevel(current.riskLevel, row.riskLevel),
      sourceFile: current.sourceFile || row.sourceFile,
      decisionNeeded: current.decisionNeeded || row.decisionNeeded,
      recommendedAction: current.recommendedAction || row.recommendedAction,
      approvalStatus: current.approvalStatus || row.approvalStatus,
      reviewer: current.reviewer || row.reviewer,
      reviewerNotes: current.reviewerNotes || row.reviewerNotes,
      blocksP10BeforeScope: current.blocksP10BeforeScope || row.blocksP10BeforeScope,
      blocksP10AfterScope: current.blocksP10AfterScope || row.blocksP10AfterScope,
      currentEntityCodes: mergeStrings(current.currentEntityCodes, row.currentEntityCodes),
      sampleDocuments: mergeStrings(current.sampleDocuments, row.sampleDocuments, 5),
      sampleItems: mergeStrings(current.sampleItems, row.sampleItems, 5)
    });
  }

  return [...groups.values()];
}

function classifyRow(row: ScopedBlockerPackageInputRow): ScopedBlockerPackageCategory {
  if (isAliasCleanupSource(row)) return "ALIAS_CLEANUP_NEEDED";
  if (isCanonicalEntitySource(row)) return "CANONICAL_ENTITY_NEEDED";
  if (isTargetProfileNeededSource(row)) return "TARGET_PROFILE_NEEDED";
  if (!row.blocksP10AfterScope) return "RETAINED_OUT_OF_SCOPE";
  if (isTargetProfileSource(row)) return "TARGET_PROFILE_BLOCKER";
  if (row.bcCurrentKpiScope === "UNKNOWN_SCOPE_REVIEW" || row.bcFutureUseDomain === "UNKNOWN_REVIEW") {
    return "UNKNOWN_SCOPE_BLOCKER";
  }
  if (row.bcCurrentKpiScope === "OUTPUT_KPI_REJECT_SCOPE" || row.bcFutureUseDomain === "REJECT_ATTACHMENT") {
    return "OUTPUT_REJECT_SCOPE_BLOCKER";
  }
  if (row.bcCurrentKpiScope === "OUTPUT_KPI_OK_SCOPE" || row.bcFutureUseDomain === "PRODUCTION_OUTPUT_DASHBOARD") {
    return "OUTPUT_OK_ENTITY_BLOCKER";
  }
  return "OTHER_TRUE_BLOCKER";
}

function isTargetProfileSource(row: ScopedBlockerPackageInputRow): boolean {
  return /TARGET[_ -]?PROFILE/i.test(row.blockerType) || /TARGET[_ -]?PROFILE/i.test(row.sourceFile);
}

function isAliasCleanupSource(row: ScopedBlockerPackageInputRow): boolean {
  return /alias-cleanup-review-plan\.csv$/i.test(row.sourceFile) || /ALIAS/i.test(row.decisionNeeded);
}

function isCanonicalEntitySource(row: ScopedBlockerPackageInputRow): boolean {
  return /canonical-entity-creation-plan\.csv$/i.test(row.sourceFile) || /CANONICAL/i.test(row.decisionNeeded);
}

function isTargetProfileNeededSource(row: ScopedBlockerPackageInputRow): boolean {
  return /target-profile-seed-draft-plan\.csv$/i.test(row.sourceFile) || /TARGET[_ -]?PROFILE/i.test(row.decisionNeeded);
}

function stripCategory(row: ScopedBlockerPackageInputRow & { readonly rowKey?: string } & { readonly category?: ScopedBlockerPackageCategory }): ScopedBlockerPackageCsvRow {
  return {
    priority: row.priority,
    blocker_id: row.blockerId,
    blocker_type: row.blockerType,
    bc_current_kpi_scope: row.bcCurrentKpiScope,
    bc_future_use_domain: row.bcFutureUseDomain,
    bc_scope_reason: row.bcScopeReason,
    bc_entity_source_status: row.bcEntitySourceStatus,
    source_value: row.sourceValue,
    canonical_entity_code: row.canonicalEntityCode,
    current_entity_codes: joinStrings(row.currentEntityCodes),
    target_bucket: row.targetBucket,
    machine_center_no: row.machineCenterNo,
    rows: row.rows,
    risk_level: row.riskLevel,
    decision_needed: row.decisionNeeded,
    recommended_action: row.recommendedAction,
    blocks_p10_before_scope: row.blocksP10BeforeScope ? "true" : "false",
    blocks_p10_after_scope: row.blocksP10AfterScope ? "true" : "false",
    sample_documents: joinStrings(row.sampleDocuments),
    sample_items: joinStrings(row.sampleItems),
    approval_status: row.approvalStatus,
    reviewer: row.reviewer,
    reviewer_notes: row.reviewerNotes
  };
}

function compareRows(left: ScopedBlockerPackageInputRow, right: ScopedBlockerPackageInputRow): number {
  return Number(right.blocksP10AfterScope) - Number(left.blocksP10AfterScope)
    || priorityRank(left.priority) - priorityRank(right.priority)
    || riskRank(right.riskLevel) - riskRank(left.riskLevel)
    || right.rows - left.rows
    || left.blockerType.localeCompare(right.blockerType)
    || left.sourceValue.localeCompare(right.sourceValue)
    || left.targetBucket.localeCompare(right.targetBucket);
}

function sumRows(rows: readonly ScopedBlockerPackageInputRow[]): number {
  return rows.reduce((sum, row) => sum + row.rows, 0);
}

function mergeStrings(left: readonly string[], right: readonly string[], limit = Number.POSITIVE_INFINITY): readonly string[] {
  const items = new Set<string>();
  for (const value of left) {
    const normalized = normalizeKey(value);
    if (normalized !== "(BLANK)") items.add(normalized);
  }
  for (const value of right) {
    const normalized = normalizeKey(value);
    if (normalized !== "(BLANK)") items.add(normalized);
    if (items.size >= limit) break;
  }
  return [...items].sort((a, b) => a.localeCompare(b)).slice(0, limit);
}

function joinStrings(values: readonly string[]): string {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("|");
}

function normalizeJoinedList(values: readonly string[]): string {
  return joinStrings(values)
    .split("|")
    .map((value) => normalizeKey(value))
    .filter((value) => value !== "(BLANK)")
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function normalizeKey(value: string): string {
  const text = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return text || "(BLANK)";
}

function higherPriority(left: string, right: string): string {
  return priorityRank(right) < priorityRank(left) ? right : left;
}

function priorityRank(value: string): number {
  switch (normalizeKey(value)) {
    case "P1": return 1;
    case "P2": return 2;
    case "P3": return 3;
    case "P4": return 4;
    default: return 99;
  }
}

function higherRiskLevel(left: BackfillRiskLevel, right: BackfillRiskLevel): BackfillRiskLevel {
  return riskRank(right) > riskRank(left) ? right : left;
}

function riskRank(value: BackfillRiskLevel): number {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}
