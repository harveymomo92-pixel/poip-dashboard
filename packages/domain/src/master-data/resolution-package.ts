import type { BackfillRiskLevel } from "./entity-target-backfill-plan.js";
import type { HighRiskReviewDecision, HighRiskReviewPlanGroup, P10Gate } from "./high-risk-review-plan.js";
import type {
  BusinessCentralCurrentKpiScope,
  BusinessCentralEntitySourceStatus,
  BusinessCentralFutureUseDomain
} from "./bc-data-scope.js";

export type ResolutionPackageApprovalStatus = "needs_review" | "draft" | "pending";
export type ManualApprovalPriority = "P1" | "P2" | "P3" | "P4";
export type AliasCleanupConflictType =
  | "multiple_current_entities"
  | "legacy_target_variant_alias"
  | "wrong_size_or_variant_mapping"
  | "blank_or_missing_source"
  | "machine_center_ambiguous"
  | "unknown";

export interface CanonicalEntityCreationPlanInput {
  readonly canonicalEntityCode: string;
  readonly canonicalEntityDisplayName: string;
  readonly sourceValues: readonly string[];
  readonly currentEntityCodes: readonly string[];
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
}

export interface CanonicalEntityCreationPlanItem extends CanonicalEntityCreationPlanInput {
  readonly areaCandidate: string;
  readonly approvalStatus: "needs_review";
}

export interface AliasCleanupReviewPlanInput {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly currentEntityCodes: readonly string[];
  readonly proposedCanonicalEntityCode: string;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
}

export interface AliasCleanupReviewPlanItem extends AliasCleanupReviewPlanInput {
  readonly conflictType: AliasCleanupConflictType;
  readonly approvalStatus: "needs_review";
}

export interface TargetProfileSeedDraftPlanInput {
  readonly canonicalEntityCode: string;
  readonly canonicalEntityDisplayName: string;
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly machineCenterNoNormalized: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly targetQty: number | null;
  readonly unit: "PCS";
  readonly sourceCurrentEntityCode: string;
  readonly sourceTargetValueOrigin: string;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
}

export interface TargetProfileSeedDraftPlanItem extends TargetProfileSeedDraftPlanInput {
  readonly approvalStatus: "draft" | "needs_review";
}

export interface ManualApprovalQueueItem {
  readonly priority: ManualApprovalPriority;
  readonly reviewGroupType: string;
  readonly sourceValue: string;
  readonly canonicalEntityCode: string;
  readonly currentEntityCodes: readonly string[];
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly decisionNeeded: HighRiskReviewDecision;
  readonly recommendedAction: string;
  readonly blocksP10: boolean;
  readonly blocksP10AfterScope: boolean;
  readonly bcCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly bcFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly bcScopeReason: string;
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
}

export interface BlockedGroupsChecklistItem {
  readonly blockerId: string;
  readonly blockerType: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly currentStatus: string;
  readonly requiredResolution: string;
  readonly owner: "";
  readonly approvalStatus: "pending";
  readonly resolved: false;
  readonly notes: "";
}

export interface ResolutionPackageSummary {
  readonly generatedAt: string;
  readonly sourceReports: {
    readonly entityBackfillDryRun: string;
    readonly targetProfileBackfillDryRun: string;
    readonly highRiskReviewPlan: string;
  };
  readonly counts: {
    readonly canonicalEntityCreationCandidates: number;
    readonly aliasCleanupCandidates: number;
    readonly targetProfileSeedDraftCandidates: number;
    readonly manualApprovalItems: number;
    readonly blockedGroups: number;
  };
  readonly scopeSummary: {
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
  };
  readonly p10Readiness: {
    readonly status: P10Gate["status"];
    readonly reason: string;
    readonly requiredBeforeP10: readonly string[];
  };
  readonly unknownScopeProfile: {
    readonly unknownScopeRows: number;
    readonly topUnknownScopeGroups: readonly ResolutionPackageUnknownScopeGroup[];
    readonly profileCsvPath: string | null;
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

export interface ResolutionPackageUnknownScopeGroup {
  readonly sourceValue: string;
  readonly rows: number;
  readonly blocksP10AfterScope: boolean;
  readonly currentKpiScope: BusinessCentralCurrentKpiScope;
  readonly futureUseDomain: BusinessCentralFutureUseDomain;
}

export function buildCanonicalEntityCreationPlanItem(
  input: CanonicalEntityCreationPlanInput
): CanonicalEntityCreationPlanItem {
  return {
    ...input,
    areaCandidate: inferAreaCandidate([input.canonicalEntityCode, input.canonicalEntityDisplayName, ...input.sourceValues].join(" ")),
    approvalStatus: "needs_review"
  };
}

export function buildAliasCleanupReviewPlanItem(
  input: AliasCleanupReviewPlanInput
): AliasCleanupReviewPlanItem {
  return {
    ...input,
    conflictType: inferAliasCleanupConflictType(input),
    approvalStatus: "needs_review"
  };
}

export function buildTargetProfileSeedDraftPlanItem(
  input: TargetProfileSeedDraftPlanInput
): TargetProfileSeedDraftPlanItem {
  return {
    ...input,
    approvalStatus: input.riskLevel === "LOW" && input.targetQty !== null ? "draft" : "needs_review"
  };
}

export function buildManualApprovalQueueItem(group: HighRiskReviewPlanGroup): ManualApprovalQueueItem {
  return {
    priority: manualApprovalPriority(group),
    reviewGroupType: group.reviewGroupType,
    sourceValue: group.sourceValue,
    canonicalEntityCode: group.canonicalEntityCode,
    currentEntityCodes: group.currentEntityCodes,
    targetBucket: group.targetBucket,
    machineCenterNo: group.machineCenterNo,
    rows: group.rows,
    riskLevel: group.riskLevel,
    decisionNeeded: group.reviewDecision,
    recommendedAction: group.recommendedAction,
    blocksP10: group.p10Blocker,
    blocksP10AfterScope: group.blocksP10AfterScope,
    bcCurrentKpiScope: group.bcCurrentKpiScope,
    bcFutureUseDomain: group.bcFutureUseDomain,
    bcScopeReason: group.bcScopeReason,
    bcEntitySourceStatus: group.bcEntitySourceStatus,
    sampleDocuments: group.sampleDocuments,
    sampleItems: group.sampleItems
  };
}

export function buildBlockedGroupsChecklistItem(
  group: HighRiskReviewPlanGroup,
  index: number
): BlockedGroupsChecklistItem {
  return {
    blockerId: `B${String(index + 1).padStart(4, "0")}`,
    blockerType: group.reviewGroupType,
    sourceValue: group.sourceValue,
    rows: group.rows,
    currentStatus: group.reviewDecision,
    requiredResolution: requiredResolutionFor(group),
    owner: "",
    approvalStatus: "pending",
    resolved: false,
    notes: ""
  };
}

export function buildResolutionPackageSummary(input: {
  readonly generatedAt?: string;
  readonly sourceReports: ResolutionPackageSummary["sourceReports"];
  readonly canonicalEntityCreationCandidates: number;
  readonly aliasCleanupCandidates: number;
  readonly targetProfileSeedDraftCandidates: number;
  readonly manualApprovalItems: number;
  readonly blockedGroups: number;
  readonly scopeSummary: ResolutionPackageSummary["scopeSummary"];
  readonly p10Gate: P10Gate;
  readonly topUnknownScopeGroups?: readonly ResolutionPackageUnknownScopeGroup[];
  readonly unknownScopeProfileCsvPath?: string | null;
}): ResolutionPackageSummary {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceReports: input.sourceReports,
    counts: {
      canonicalEntityCreationCandidates: input.canonicalEntityCreationCandidates,
      aliasCleanupCandidates: input.aliasCleanupCandidates,
      targetProfileSeedDraftCandidates: input.targetProfileSeedDraftCandidates,
      manualApprovalItems: input.manualApprovalItems,
      blockedGroups: input.blockedGroups
    },
    scopeSummary: input.scopeSummary,
    p10Readiness: {
      status: input.p10Gate.status,
      reason: input.p10Gate.reason,
      requiredBeforeP10: requiredBeforeP10(input.p10Gate)
    },
    unknownScopeProfile: {
      unknownScopeRows: input.scopeSummary.unknownScopeReviewRows,
      topUnknownScopeGroups: input.topUnknownScopeGroups ?? [],
      profileCsvPath: input.unknownScopeProfileCsvPath ?? null
    },
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

export function inferAreaCandidate(value: string): string {
  const text = normalize(value);
  if (/\b(OMSO|POLYPRINT|PRINTING)\b/.test(text)) return "PRINTING";
  if (/\b(THERMO|HENGFENG|ILLIG|CUP)\b/.test(text)) return "THERMOFORMING";
  if (/\b(VFINE|LONGSUN|CHUM|BOTOL|BTL)\b/.test(text)) return "BLOWING";
  if (/\b(BORCH|PREFORM|NEWDO|CAI)\b/.test(text)) return "INJECTION";
  if (/\bREPACKING\b/.test(text)) return "REPACKING";
  return "UNKNOWN";
}

export function inferAliasCleanupConflictType(
  input: Pick<AliasCleanupReviewPlanInput, "sourceField" | "sourceValue" | "currentEntityCodes" | "proposedCanonicalEntityCode">
): AliasCleanupConflictType {
  const source = normalize(input.sourceValue);
  const currentCodes = input.currentEntityCodes.map(normalize).filter(Boolean);
  if (!source || source === "(BLANK)" || input.sourceField === "UNMAPPED") return "blank_or_missing_source";
  if (input.sourceField === "machineCenterNo") return "machine_center_ambiguous";
  if (currentCodes.length > 1) return "multiple_current_entities";
  if (currentCodes.some((code) => legacyTargetVariantPattern.test(code))) return "legacy_target_variant_alias";
  if (looksLikeWrongSizeOrVariant(source, currentCodes.join(" "), normalize(input.proposedCanonicalEntityCode))) {
    return "wrong_size_or_variant_mapping";
  }
  return "unknown";
}

export function manualApprovalPriority(group: HighRiskReviewPlanGroup): ManualApprovalPriority {
  if (group.blocksP10AfterScope && group.rows >= 500) return "P1";
  if (group.blocksP10AfterScope) return "P2";
  if (group.reviewDecision !== "IGNORE_FOR_NOW") return "P3";
  return "P4";
}

function requiredBeforeP10(gate: P10Gate): readonly string[] {
  if (gate.status !== "BLOCKED") return [];
  return [
    ...gate.blockers,
    "Resolve every pending blocker in blocked-groups-checklist.csv.",
    "Review canonical entity creation plan before creating entities.",
    "Review alias cleanup plan without broad/global aliases.",
    "Prepare target profile drafts with reviewed target_qty before approval.",
    "Re-run P0.9/P0.9a and KPI compare after review package updates are applied."
  ];
}

function requiredResolutionFor(group: HighRiskReviewPlanGroup): string {
  if (group.reviewDecision === "NEEDS_SOURCE_DATA_FIX") return "Fix or enrich source data, then rerun P0.9/P0.9a.";
  if (group.reviewDecision === "NEEDS_ALIAS_CLEANUP") return "Review alias/catalog conflict manually; do not delete aliases automatically.";
  if (group.reviewDecision === "CAN_CREATE_TARGET_PROFILE_DRAFT_LATER") return "Prepare draft target profile and review target_qty before approval.";
  if (group.reviewDecision === "CAN_CREATE_CANONICAL_ENTITY_LATER") return "Review and create/expose canonical entity in a controlled later step.";
  if (group.reviewDecision === "CAN_AUTO_COLLAPSE_IN_FUTURE") return "Keep as future low-risk collapse candidate after approval.";
  return group.recommendedAction || "Resolve manually before P1.0.";
}

function looksLikeWrongSizeOrVariant(source: string, current: string, proposed: string): boolean {
  const sourceTokens = sizeTokens(source);
  if (sourceTokens.length === 0) return false;
  const currentTokens = sizeTokens(current);
  const proposedTokens = sizeTokens(proposed);
  return currentTokens.some((token) => !sourceTokens.includes(token))
    || (proposedTokens.length > 0 && proposedTokens.some((token) => !sourceTokens.includes(token)));
}

function sizeTokens(value: string): readonly string[] {
  return [...value.matchAll(/\b\d+(?:\.\d+)?\s*(?:ML|GR|OZ)\b/g)].map((match) => match[0].replace(/\s+/g, ""));
}

function normalize(value: string): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

const legacyTargetVariantPattern = /\b(PRINTING 22 OZ|PRINTING OZ < 20|PRINTING NON-OZ|THERMOFORMING)\b/;
