import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardKpiSummary } from "../packages/domain/src/kpi/dashboard.js";
import { classifyOutputRow } from "../packages/domain/src/kpi/output-classification.js";
import { createDatabase } from "../packages/db/src/client.js";
import {
  buildDailyItemResume,
  DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES,
  DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS,
  isAttachedDailyItemResumeRejectAttachmentStatus,
  summarizeDailyItemResumeRejectDocuments,
  summarizeDailyItemResumeRejectConversions,
  DAILY_ITEM_RESUME_TARGET_REASONS,
  summarizeDailyItemResumeTargetReasons,
  type DailyItemResumeRow,
  type DailyItemResumeFilters,
  type DailyItemResumeRejectAttachmentStatus,
  type DailyItemResumeSourceRow,
  type DailyItemResumeTarget
} from "../apps/api/src/modules/dashboard/daily-item-resume.js";
import {
  isMasterSourceField,
  normalizeAliasDisplay,
  normalizeAliasKey,
  type MasterSourceField
} from "../packages/domain/src/master-data/alias.js";
import {
  buildMappingPlanRows,
  containsMappingSecretLikeText,
  mappingPlanRowsToCsv,
  mappingPlanSourceFields,
  parseMappingPlanCsv,
  suggestMappingCandidates,
  type CandidateEntityInput,
  type MappingPlanRow,
  type MappingSuggestion
} from "../packages/domain/src/master-data/mapping-candidates.js";
import {
  planEntityV2Backfill,
  planTargetProfileBackfill,
  type BackfillRiskLevel,
  type EntityV2BackfillAction
} from "../packages/domain/src/master-data/entity-target-backfill-plan.js";
import {
  buildHighRiskReviewPlanSummary,
  buildKpiCompareV1V2Summary,
  type HighRiskReviewDecision,
  type HighRiskReviewPlanGroup,
  type HighRiskReviewPlanSummary,
  type KpiCompareV1V2Summary
} from "../packages/domain/src/master-data/high-risk-review-plan.js";
import {
  buildAliasCleanupReviewPlanItem,
  buildBlockedGroupsChecklistItem,
  buildCanonicalEntityCreationPlanItem,
  buildManualApprovalQueueItem,
  buildResolutionPackageSummary,
  buildTargetProfileSeedDraftPlanItem,
  type AliasCleanupConflictType,
  type ManualApprovalPriority,
  type ResolutionPackageSummary,
  type ResolutionPackageApprovalStatus
} from "../packages/domain/src/master-data/resolution-package.js";
import {
  buildBusinessCentralUnknownScopeProfile,
  type BusinessCentralUnknownScopeProfileGroup,
  type BusinessCentralUnknownScopeProfileInputRow,
  type BusinessCentralUnknownScopeProfileSummary,
  type UnknownScopeRuleConfidence
} from "../packages/domain/src/master-data/unknown-scope-profile.js";
import {
  buildScopedDecisionReview,
  type ScopedDecisionFamilyRollupRow,
  type ScopedDecisionNextActionRow,
  type ScopedDecisionReviewInputRow,
  type ScopedDecisionReviewRow,
  type ScopedDecisionReviewSummary
} from "../packages/domain/src/master-data/scoped-decision-review.js";
import {
  buildScopedDecisionValidation,
  type ScopedDecisionBlockedExecutionPlanRow,
  type ScopedDecisionValidationInputRow,
  type ScopedDecisionValidationIssueRow,
  type ScopedDecisionValidationSummary,
  type ScopedDecisionValidationSummaryRow
} from "../packages/domain/src/master-data/scoped-decision-validation.js";
import {
  buildScopedDecisionApprovalWorkspace,
  type ScopedDecisionApprovalInputRow,
  type ScopedDecisionApprovalWorkbookRow,
  type ScopedDecisionApprovalWorkspaceSummary,
  type ScopedDecisionReviewerChecklistRow
} from "../packages/domain/src/master-data/scoped-decision-approval-workspace.js";
import {
  applyAcceptedReviewerDecisionsToWorkspaceRows,
  buildScopedDecisionApplyDryRun,
  type ScopedDecisionApplyDryRunInputRow,
  type ScopedDecisionApplyDryRunSummary,
  type ScopedDecisionApplyDryRunSourceSummaryRow,
  type ScopedDecisionBlockedPlanRow,
  type ScopedDecisionCategoryDryRunRow,
  type ScopedDecisionExecutablePlanRow,
  type ScopedDecisionP10ImpactEstimateRow
} from "../packages/domain/src/master-data/scoped-decision-apply-dry-run.js";
import {
  buildScopedDecisionApprovalIntake,
  type ScopedDecisionApprovalIntakeSummary,
  type ScopedDecisionApprovalReadinessReport,
  type ScopedDecisionBlockedReviewerDecisionRow,
  type ScopedDecisionDuplicateReviewerDecisionRow,
  type ScopedDecisionInvalidReviewerDecisionRow,
  type ScopedDecisionMissingReviewerDecisionRow,
  type ScopedDecisionNormalizedReviewerDecisionRow,
  type ScopedDecisionReviewerInputRow,
  type ScopedDecisionReviewerInputTemplateRow
} from "../packages/domain/src/master-data/scoped-decision-approval-intake.js";
import {
  authoritativeMasterInputCsvHeaders,
  buildAuthoritativeMasterIntake,
  type AuthoritativeBcCoverageInputRow,
  type AuthoritativeCanonicalEntityInputRow,
  type AuthoritativeLegacyConflictEvidenceRow,
  type AuthoritativeMasterIntakeSummary,
  type AuthoritativeMasterValidationIssueRow,
  type AuthoritativeNormalizedCanonicalEntityRow,
  type AuthoritativeNormalizedSourceMapRow,
  type AuthoritativeNormalizedTargetProfileRow,
  type AuthoritativeSourceCoveragePreviewRow,
  type AuthoritativeSourceToEntityMapInputRow,
  type AuthoritativeTargetProfileCoveragePreviewRow,
  type AuthoritativeTargetProfileInputRow,
  type AuthoritativeUnmappedSourceValueRow
} from "../packages/domain/src/master-data/authoritative-master-intake.js";
import {
  buildAuthoritativeMasterSeedDraft,
  decideAuthoritativeSeedWriteTarget,
  type AuthoritativeExcludedSourceValueRow,
  type AuthoritativeLegacyEvidenceCrosswalkRow,
  type AuthoritativeMasterSeedDraftSummary,
  type AuthoritativeSeedEvidenceRow,
  type AuthoritativeSeedQualityWarningRow,
  type AuthoritativeSeedReviewQueueRow,
  type AuthoritativeTargetProfileSeedEvidenceRow
} from "../packages/domain/src/master-data/authoritative-master-seed-draft.js";
import {
  buildFutureUseRawRegistry,
  type FutureUseDomainCoverageRow,
  type FutureUseModuleReadinessRollupRow,
  type FutureUseP10SplitRow,
  type FutureUseRawEvidenceRow,
  type FutureUseRawRegistryRow,
  type FutureUseReviewQueueRow,
  type FutureUseRollupRow,
  type FutureUseSourceCoverageRow,
  type FutureUseTargetProfileRequirementRow
} from "../packages/domain/src/master-data/future-use-raw-registry.js";
import {
  buildAuthoritativeMasterReviewWorkspace,
  type AuthoritativeMasterConflictReviewRow,
  type AuthoritativeMasterEntityReviewRow,
  type AuthoritativeMasterFutureUseDomainReviewRow,
  type AuthoritativeMasterReviewerDecisionTemplateRow,
  type AuthoritativeMasterReviewChecklistRow,
  type AuthoritativeMasterReviewPriorityBoardRow,
  type AuthoritativeMasterSourceDataGapReviewRow,
  type AuthoritativeMasterSourceMappingReviewRow,
  type AuthoritativeMasterTargetProfileReviewRow
} from "../packages/domain/src/master-data/authoritative-master-review-workspace.js";
import {
  buildAuthoritativeMasterReviewDecisionIntake,
  type AuthoritativeReviewDecisionBacklogPreviewRow,
  type AuthoritativeReviewDecisionInputRow,
  type AuthoritativeReviewDecisionIssueRow,
  type AuthoritativeReviewDecisionNormalizedRow,
  type AuthoritativeReviewDecisionPreviewCanonicalRow,
  type AuthoritativeReviewDecisionPreviewSourceMapRow,
  type AuthoritativeReviewDecisionPreviewTargetProfileRow
} from "../packages/domain/src/master-data/authoritative-master-review-decision-intake.js";
import {
  buildAuthoritativeReviewDecisionSampleFixture,
  type AuthoritativeReviewDecisionSampleExpectationRow,
  type AuthoritativeReviewDecisionSampleRow
} from "../packages/domain/src/master-data/authoritative-review-decision-sample-fixture.js";
import {
  buildAuthoritativeReviewDecisionBulkPrefill,
  type AuthoritativeReviewDecisionBulkPrefillRuleReportRow,
  type AuthoritativeReviewDecisionBulkPrefillRiskReportRow,
  type AuthoritativeReviewDecisionBulkPrefillSummary
} from "../packages/domain/src/master-data/authoritative-review-decision-bulk-prefill.js";
import {
  buildAuthoritativeMasterAcceptedDecisionDryRun,
  type AuthoritativeAcceptedDecisionApplicationPlanRow,
  type AuthoritativeBlockedDecisionApplicationPlanRow,
  type AuthoritativeCoverageImpactPreviewRow,
  type AuthoritativeFutureUseCoverageImpactRow,
  type AuthoritativeP10ReadinessImpactRow,
  type AuthoritativeTargetProfileGapAfterDryRunRow,
  type AuthoritativeSourceDataGapAfterDryRunRow,
  type AuthoritativeConflictRiskAfterDryRunRow,
  type AuthoritativeAcceptedDecisionDryRunSummary
} from "../packages/domain/src/master-data/authoritative-master-accepted-decision-dry-run.js";
import {
  buildBusinessCentralCanonicalEntityCatalog,
  classifyBusinessCentralEntityV2MismatchReview,
  classifyBusinessCentralEntityV2Review,
  resolveBusinessCentralEntityV2,
  type BusinessCentralCanonicalEntityAliasInput,
  type BusinessCentralCanonicalEntityCatalog,
  type BusinessCentralCanonicalEntityInput,
  type BusinessCentralEntityV2Confidence,
  type BusinessCentralEntityV2ComparisonStatus,
  type BusinessCentralEntityV2MismatchReviewType,
  type BusinessCentralEntityV2MismatchRiskLevel,
  type BusinessCentralEntityV2ReviewClassification,
  type BusinessCentralEntityV2SourceField,
  type BusinessCentralTargetBucketCandidate
} from "../packages/domain/src/master-data/entity-resolver-v2.js";
import {
  businessCentralBlocksP10AfterScope,
  classifyBusinessCentralDataScope,
  type BusinessCentralCurrentKpiScope,
  type BusinessCentralEntitySourceStatus,
  type BusinessCentralFutureUseDomain
} from "../packages/domain/src/master-data/bc-data-scope.js";
import {
  normalizeMachineCenterNo,
  resolveBusinessCentralTargetProfile,
  type TargetProfile,
  type TargetProfileLookupStatus
} from "../packages/domain/src/master-data/target-profile.js";

const SOURCE_SYSTEM = "business-central";
const DEFAULT_MAPPING_PLAN_PATH = ".tmp/mapping-plan/business-central-mapping-plan.csv";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Command =
  | "profile"
  | "reconcile"
  | "target-coverage"
  | "daily-item-resume"
  | "mapping-candidates"
  | "mapping-apply"
  | "mapping-plan"
  | "mapping-plan-apply"
  | "entity-v2-dry-run"
  | "target-profile-dry-run"
  | "entity-v2-backfill-dry-run"
  | "target-profile-backfill-dry-run"
  | "high-risk-review-plan"
  | "kpi-compare-v1-v2"
  | "unknown-scope-profile"
  | "scoped-blocker-package"
  | "scoped-decision-review"
  | "scoped-decision-validate"
  | "scoped-decision-approval-workspace"
  | "scoped-decision-apply-dry-run"
  | "scoped-decision-approval-intake"
  | "authoritative-master-intake"
  | "authoritative-master-seed-draft"
  | "future-use-raw-registry"
  | "authoritative-master-review-workspace"
  | "authoritative-master-review-decision-intake"
  | "authoritative-review-decision-sample-fixture"
  | "authoritative-review-decision-bulk-prefill"
  | "authoritative-master-accepted-decision-dry-run"
  | "resolution-package";

type DatabasePool = ReturnType<typeof createDatabase>["pool"];

interface Filters {
  readonly from: string;
  readonly to: string;
  readonly entityId?: string;
  readonly itemNo?: string;
}

interface SqlParts {
  readonly where: string;
  readonly params: unknown[];
}

const sourceFieldColumns: Record<MasterSourceField, string> = {
  machine_description: "machine_description",
  machine_center_no: "machine_center_no",
  prod_line_description: "prod_line_description",
  prod_line_no: "prod_line_no",
  item_no: "item_no",
  uom: "uom"
};

interface MappingCoverageSummary {
  readonly totalRows: number;
  readonly mappedRows: number;
  readonly unmappedRows: number;
  readonly okRows: number;
  readonly mappedOkRows: number;
  readonly unmappedOkRows: number;
  readonly unmappedOkQty: number;
}

interface UnmappedSourceGroup {
  readonly sourceField: MasterSourceField;
  readonly sourceValue: string;
  readonly normalizedValue: string;
  readonly rows: number;
  readonly okQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly suggestions: readonly MappingSuggestion[];
}

interface EntityV2SourceRow {
  readonly entryNo: string | null;
  readonly postingDate: string;
  readonly documentNo: string | null;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly quantity: number;
  readonly uom: string | null;
  readonly grossWeight: number | null;
  readonly entryType: string | null;
  readonly locationCode: string | null;
  readonly gProdOrRotLineNo: string | null;
  readonly gProdOrRotLineDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly currentEntityId: string | null;
  readonly currentEntityCode: string | null;
  readonly currentEntityDisplayName: string | null;
}

interface BusinessCentralScopeReportFields {
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: BusinessCentralFutureUseDomain;
  readonly bc_scope_reason: string;
  readonly bc_scope_evidence_fields: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly blocks_p10_after_scope: "true" | "false";
}

interface EntityV2ReportRow extends BusinessCentralScopeReportFields {
  readonly posting_date: string;
  readonly document_no: string;
  readonly entry_no: string;
  readonly item_no: string;
  readonly item_description: string;
  readonly item_category_code: string;
  readonly quantity: number;
  readonly unit_of_measure_code: string;
  readonly gross_weight: number | "";
  readonly entry_type: string;
  readonly location_code: string;
  readonly g_prod_or_rot_line_no: string;
  readonly g_prod_or_rot_line_description: string;
  readonly machine_center_no: string;
  readonly current_entity_id: string;
  readonly current_entity_code: string;
  readonly current_entity_display_name: string;
  readonly v2_entity_code: string;
  readonly v2_entity_display_name: string;
  readonly v2_source_field_used: BusinessCentralEntityV2SourceField;
  readonly v2_source_value_used: string;
  readonly v2_confidence: BusinessCentralEntityV2Confidence;
  readonly v2_reason: string;
  readonly v2_target_bucket_candidate: BusinessCentralTargetBucketCandidate;
  readonly v2_target_routing_evidence: string;
  readonly comparison_status: BusinessCentralEntityV2ComparisonStatus;
  readonly v2_review_classification: BusinessCentralEntityV2ReviewClassification;
  readonly v2_review_reason: string;
  readonly v2_recommended_action: string;
  readonly v2_suggested_canonical_entity_code: string;
  readonly v2_suggested_canonical_entity_display_name: string;
  readonly v2_mismatch_review_type: BusinessCentralEntityV2MismatchReviewType | "";
  readonly v2_mismatch_review_reason: string;
  readonly v2_mismatch_recommended_action: string;
}

interface EntityV2Summary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly TopCount[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly resolvedRows: number;
  readonly unresolvedRows: number;
  readonly sameEntityRows: number;
  readonly differentEntityRows: number;
  readonly currentlyUnmappedButV2Resolved: number;
  readonly currentlyMappedButV2Unmapped: number;
  readonly topSourceFieldsUsed: readonly TopCount[];
  readonly topTargetBucketCandidates: readonly TopCount[];
  readonly topMismatchSourceValues: readonly EntityV2MismatchGroup[];
  readonly reviewSummary: EntityV2ReviewSummary;
  readonly canonicalCatalogGaps: readonly EntityV2CanonicalCatalogGap[];
  readonly legacyTargetVariantCollapseNeeded: readonly EntityV2LegacyTargetVariantCollapseGroup[];
  readonly topPossibleResolverMismatches: readonly EntityV2TopPossibleResolverMismatch[];
  readonly possibleResolverMismatchReview: EntityV2PossibleResolverMismatchReview;
  readonly examplesByFamily: Record<EntityV2ExampleFamily, readonly EntityV2Example[]>;
  readonly outputFiles: {
    readonly csv: string;
    readonly json: string;
  };
  readonly safety: {
    readonly dashboardChanged: false;
    readonly databaseUpdated: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

interface TopCount {
  readonly value: string;
  readonly rows: number;
}

interface EntityV2MismatchGroup {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly comparisonStatuses: readonly string[];
  readonly currentEntityCodes: readonly string[];
  readonly v2EntityCodes: readonly string[];
}

interface EntityV2ReviewSummary {
  readonly okSameEntityRows: number;
  readonly okBothUnmappedRows: number;
  readonly canonicalCatalogGapRows: number;
  readonly legacyTargetVariantCollapseNeededRows: number;
  readonly possibleResolverMismatchRows: number;
  readonly possibleDataSourceGapRows: number;
  readonly unknownReviewNeededRows: number;
}

interface EntityV2CanonicalCatalogGap {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly currentEntityCodes: readonly string[];
  readonly suggestedCanonicalEntityCode: string;
  readonly suggestedCanonicalEntityDisplayName: string;
  readonly reason: string;
  readonly recommendedAction: string;
}

interface EntityV2LegacyTargetVariantCollapseGroup {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly currentEntityCodes: readonly string[];
  readonly suggestedCanonicalEntityCode: string;
  readonly suggestedCanonicalEntityDisplayName: string;
  readonly recommendedFuturePhase: "P0.8/P0.9";
  readonly reason: string;
  readonly recommendedAction: string;
}

interface EntityV2TopPossibleResolverMismatch {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly mismatchReviewType: BusinessCentralEntityV2MismatchReviewType;
  readonly currentEntityCodes: readonly string[];
  readonly v2EntityCodes: readonly string[];
  readonly recommendedReviewAction: string;
}

interface EntityV2PossibleResolverMismatchReview {
  readonly totalRows: number;
  readonly truncated: boolean;
  readonly groups: readonly EntityV2PossibleResolverMismatchGroup[];
}

interface EntityV2PossibleResolverMismatchGroup {
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly currentEntityCodes: readonly string[];
  readonly v2EntityCodes: readonly string[];
  readonly targetBucketCandidates: readonly string[];
  readonly machineCenterNos: readonly string[];
  readonly itemCategoryCodes: readonly string[];
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
  readonly mismatchReviewType: BusinessCentralEntityV2MismatchReviewType;
  readonly reviewReason: string;
  readonly recommendedReviewAction: string;
  readonly riskLevel: BusinessCentralEntityV2MismatchRiskLevel;
}

type EntityV2ExampleFamily = "OMSO" | "VFINE" | "ILLIG" | "REPACKING" | "NEWDO" | "CAI";

interface EntityV2Example {
  readonly postingDate: string;
  readonly documentNo: string;
  readonly itemNo: string;
  readonly itemDescription: string;
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly currentEntityCode: string;
  readonly v2EntityCode: string;
  readonly comparisonStatus: BusinessCentralEntityV2ComparisonStatus;
  readonly targetBucketCandidate: BusinessCentralTargetBucketCandidate;
}

interface TargetProfileDryRunReportRow extends BusinessCentralScopeReportFields {
  readonly posting_date: string;
  readonly document_no: string;
  readonly entry_no: string;
  readonly item_no: string;
  readonly item_description: string;
  readonly item_category_code: string;
  readonly quantity: number;
  readonly gross_weight: number | "";
  readonly entry_type: string;
  readonly location_code: string;
  readonly g_prod_or_rot_line_no: string;
  readonly g_prod_or_rot_line_description: string;
  readonly machine_center_no: string;
  readonly resolver_v2_entity_code: string;
  readonly resolver_v2_entity_display_name: string;
  readonly resolver_v2_source_field_used: BusinessCentralEntityV2SourceField;
  readonly resolver_v2_source_value_used: string;
  readonly resolver_v2_target_bucket_candidate: BusinessCentralTargetBucketCandidate;
  readonly target_profile_lookup_status: TargetProfileLookupStatus;
  readonly target_profile_id: string;
  readonly target_profile_target_qty: number | "";
  readonly target_profile_unit: string;
  readonly target_profile_effective_from: string;
  readonly target_profile_effective_to: string;
  readonly target_profile_machine_center_no: string;
  readonly target_profile_reason: string;
  readonly recommended_action: string;
}

interface TargetProfileDryRunSummary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly TopCount[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly resolverV2ResolvedRows: number;
  readonly resolverV2UnresolvedRows: number;
  readonly targetProfileMatchedRows: number;
  readonly targetProfileNoActiveRows: number;
  readonly targetProfileMultipleMatchRows: number;
  readonly targetProfileInvalidBucketRows: number;
  readonly targetProfileInvalidEntityRows: number;
  readonly topNoActiveTargetProfileGroups: readonly TargetProfileDryRunIssueGroup[];
  readonly topMultipleTargetProfileGroups: readonly TargetProfileDryRunIssueGroup[];
  readonly topMatchedTargetProfiles: readonly TargetProfileDryRunMatchedGroup[];
  readonly outputFiles: {
    readonly csv: string;
    readonly json: string;
  };
  readonly targetProfilesTableAvailable: boolean;
  readonly targetProfilesLoaded: number;
  readonly safety: {
    readonly dashboardChanged: false;
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly oldTargetLogicChanged: false;
  };
}

interface TargetProfileDryRunIssueGroup {
  readonly entityCode: string;
  readonly entityDisplayName: string;
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly targetBucketCandidate: string;
  readonly machineCenterNo: string;
  readonly rows: number;
  readonly sampleDocuments: readonly string[];
  readonly sampleItems: readonly string[];
  readonly recommendedAction: string;
}

interface TargetProfileDryRunMatchedGroup {
  readonly targetProfileId: string;
  readonly entityCode: string;
  readonly entityDisplayName: string;
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly targetQty: number;
  readonly unit: string;
  readonly rows: number;
}

interface EntityV2BackfillDryRunReportRow extends BusinessCentralScopeReportFields {
  readonly posting_date: string;
  readonly document_no: string;
  readonly entry_no: string;
  readonly item_no: string;
  readonly item_description: string;
  readonly quantity: number;
  readonly entry_type: string;
  readonly location_code: string;
  readonly source_field: BusinessCentralEntityV2SourceField;
  readonly source_value: string;
  readonly machine_center_no: string;
  readonly current_entity_id: string;
  readonly current_entity_code: string;
  readonly current_entity_display_name: string;
  readonly proposed_canonical_entity_code: string;
  readonly proposed_canonical_entity_display_name: string;
  readonly backfill_action: EntityV2BackfillAction;
  readonly risk_level: BackfillRiskLevel;
  readonly risk_reason: string;
  readonly recommended_action: string;
}

interface EntityV2BackfillDryRunSummary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly TopCount[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly proposedEntityBackfillRows: number;
  readonly noChangeRows: number;
  readonly highRiskRows: number;
  readonly mediumRiskRows: number;
  readonly lowRiskRows: number;
  readonly topProposedCanonicalEntities: readonly EntityV2BackfillGroup[];
  readonly topHighRiskGroups: readonly EntityV2BackfillGroup[];
  readonly safeCollapseCandidates: readonly EntityV2BackfillGroup[];
  readonly canonicalEntityCreationCandidates: readonly EntityV2BackfillGroup[];
  readonly aliasConflictCandidates: readonly EntityV2BackfillGroup[];
  readonly families: readonly BackfillFamilySummary[];
  readonly outputFiles: {
    readonly csv: string;
    readonly json: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

interface EntityV2BackfillGroup {
  readonly proposedCanonicalEntityCode: string;
  readonly proposedCanonicalEntityDisplayName: string;
  readonly currentEntityCodes: readonly string[];
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly rows: number;
  readonly action: EntityV2BackfillAction;
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly recommendedAction: string;
}

interface BackfillFamilySummary {
  readonly family: string;
  readonly rows: number;
  readonly highRiskRows: number;
  readonly mediumRiskRows: number;
  readonly lowRiskRows: number;
}

interface ProductionTargetSource {
  readonly entityId: string;
  readonly entityCode: string;
  readonly entityDisplayName: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly dailyTargetQty: number;
  readonly status: string;
}

interface TargetProfileBackfillDryRunReportRow extends BusinessCentralScopeReportFields {
  readonly canonical_entity_code: string;
  readonly canonical_entity_display_name: string;
  readonly current_entity_code: string;
  readonly current_entity_display_name: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly machine_center_no_normalized: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly proposed_target_qty: number | "";
  readonly unit: "PCS";
  readonly source: "p0.9-dry-run";
  readonly approval_status: "draft";
  readonly risk_level: BackfillRiskLevel;
  readonly risk_reason: string;
  readonly recommended_action: string;
  readonly sample_rows: number;
  readonly sample_documents: readonly string[];
  readonly sample_items: readonly string[];
}

interface TargetProfileBackfillDryRunSummary {
  readonly generatedAt: string;
  readonly totalRows: number;
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly TopCount[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
  readonly proposedTargetProfileRows: number;
  readonly lowRiskRows: number;
  readonly mediumRiskRows: number;
  readonly highRiskRows: number;
  readonly topProposedTargetProfiles: readonly TargetProfileBackfillGroup[];
  readonly topMissingTargetQtyGroups: readonly TargetProfileBackfillGroup[];
  readonly topHighRiskGroups: readonly TargetProfileBackfillGroup[];
  readonly families: readonly BackfillFamilySummary[];
  readonly outputFiles: {
    readonly csv: string;
    readonly json: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly oldTargetLogicChanged: false;
  };
}

interface TargetProfileBackfillGroup {
  readonly canonicalEntityCode: string;
  readonly canonicalEntityDisplayName: string;
  readonly currentEntityCodes: readonly string[];
  readonly targetBucket: string;
  readonly machineCenterNo: string;
  readonly proposedTargetQty: number | null;
  readonly rows: number;
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly recommendedAction: string;
}

interface HighRiskReviewPlanCsvRow {
  readonly review_group_type: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly proposed_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly risk_reason: string;
  readonly review_decision: HighRiskReviewDecision;
  readonly recommended_action: string;
  readonly p10_blocker: "TRUE" | "FALSE";
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: BusinessCentralFutureUseDomain;
  readonly bc_scope_reason: string;
  readonly bc_scope_evidence_fields: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly blocks_p10_after_scope: "TRUE" | "FALSE";
  readonly sample_documents: string;
  readonly sample_items: string;
}

interface KpiCompareV1V2CsvRow {
  readonly status: KpiCompareV1V2Summary["status"];
  readonly blocker: string;
  readonly recommended_action: string;
}

interface CanonicalEntityCreationPlanCsvRow {
  readonly canonical_entity_code: string;
  readonly canonical_entity_display_name: string;
  readonly area_candidate: string;
  readonly source_values: string;
  readonly current_entity_codes: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly reason: string;
  readonly recommended_action: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly approval_status: ResolutionPackageApprovalStatus;
}

interface AliasCleanupReviewPlanCsvRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly current_entity_codes: string;
  readonly proposed_canonical_entity_code: string;
  readonly rows: number;
  readonly conflict_type: AliasCleanupConflictType;
  readonly risk_level: BackfillRiskLevel;
  readonly reason: string;
  readonly recommended_action: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly approval_status: ResolutionPackageApprovalStatus;
}

interface TargetProfileSeedDraftPlanCsvRow {
  readonly canonical_entity_code: string;
  readonly canonical_entity_display_name: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly machine_center_no_normalized: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly target_qty: number | "";
  readonly unit: "PCS";
  readonly source_current_entity_code: string;
  readonly source_target_value_origin: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly reason: string;
  readonly recommended_action: string;
  readonly approval_status: ResolutionPackageApprovalStatus;
  readonly sample_documents: string;
  readonly sample_items: string;
}

interface ManualApprovalQueueCsvRow {
  readonly priority: ManualApprovalPriority;
  readonly review_group_type: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly decision_needed: HighRiskReviewDecision;
  readonly recommended_action: string;
  readonly blocks_p10: "true" | "false";
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: BusinessCentralFutureUseDomain;
  readonly bc_scope_reason: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly blocks_p10_after_scope: "true" | "false";
  readonly sample_documents: string;
  readonly sample_items: string;
}

interface BlockedGroupsChecklistCsvRow {
  readonly blocker_id: string;
  readonly blocker_type: string;
  readonly source_value: string;
  readonly rows: number;
  readonly current_status: string;
  readonly required_resolution: string;
  readonly owner: "";
  readonly approval_status: "pending";
  readonly resolved: "false";
  readonly notes: "";
}

interface UnknownScopeProfileCsvRow {
  readonly group_id: string;
  readonly rows: number;
  readonly blocks_p10_after_scope: "true" | "false";
  readonly entry_type: string;
  readonly location_code: string;
  readonly item_category_code: string;
  readonly unit_of_measure_code: string;
  readonly document_prefix: string;
  readonly item_prefix: string;
  readonly source_value: string;
  readonly current_entity_codes: string;
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly reason_unknown: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly suggested_future_use_domain: BusinessCentralFutureUseDomain;
  readonly suggested_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly suggested_rule: string;
  readonly confidence: UnknownScopeRuleConfidence;
  readonly needs_manual_review: "true" | "false";
}

interface ScopedBlockerPackageCsvRow {
  readonly blocker_group_id: string;
  readonly blocker_category: string;
  readonly review_group_type: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly current_entity_codes: string;
  readonly proposed_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly risk_level: BackfillRiskLevel;
  readonly risk_reason: string;
  readonly review_decision: HighRiskReviewDecision;
  readonly recommended_action: string;
  readonly p10_blocker_before_scope: "true" | "false";
  readonly blocks_p10_after_scope: "true" | "false";
  readonly bc_current_kpi_scope: BusinessCentralCurrentKpiScope;
  readonly bc_future_use_domain: BusinessCentralFutureUseDomain;
  readonly bc_scope_reason: string;
  readonly bc_scope_evidence_fields: string;
  readonly bc_entity_source_status: BusinessCentralEntitySourceStatus;
  readonly sample_documents: string;
  readonly sample_items: string;
}

interface ScopedAliasCleanupDecisionTemplateCsvRow extends AliasCleanupReviewPlanCsvRow {
  readonly decision: "";
  readonly approved_by: "";
  readonly notes: "";
}

interface ScopedCanonicalEntityDecisionTemplateCsvRow extends CanonicalEntityCreationPlanCsvRow {
  readonly decision: "";
  readonly approved_by: "";
  readonly notes: "";
}

interface ScopedTargetProfileDecisionTemplateCsvRow extends TargetProfileSeedDraftPlanCsvRow {
  readonly decision: "";
  readonly approved_by: "";
  readonly notes: "";
}

const DEFAULT_ENTITY_V2_CSV_PATH = ".tmp/bc-entity-v2-dry-run.csv";
const DEFAULT_ENTITY_V2_JSON_PATH = ".tmp/bc-entity-v2-dry-run.json";
const DEFAULT_TARGET_PROFILE_DRY_RUN_CSV_PATH = ".tmp/bc-target-profile-dry-run.csv";
const DEFAULT_TARGET_PROFILE_DRY_RUN_JSON_PATH = ".tmp/bc-target-profile-dry-run.json";
const DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH = ".tmp/bc-entity-v2-backfill-dry-run.csv";
const DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_JSON_PATH = ".tmp/bc-entity-v2-backfill-dry-run.json";
const DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_CSV_PATH = ".tmp/bc-target-profile-backfill-dry-run.csv";
const DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_JSON_PATH = ".tmp/bc-target-profile-backfill-dry-run.json";
const DEFAULT_HIGH_RISK_REVIEW_PLAN_CSV_PATH = ".tmp/bc-high-risk-review-plan.csv";
const DEFAULT_HIGH_RISK_REVIEW_PLAN_JSON_PATH = ".tmp/bc-high-risk-review-plan.json";
const DEFAULT_KPI_COMPARE_V1_V2_CSV_PATH = ".tmp/bc-kpi-compare-v1-v2.csv";
const DEFAULT_KPI_COMPARE_V1_V2_JSON_PATH = ".tmp/bc-kpi-compare-v1-v2.json";
const DEFAULT_UNKNOWN_SCOPE_PROFILE_CSV_PATH = ".tmp/bc-unknown-scope-profile.csv";
const DEFAULT_UNKNOWN_SCOPE_PROFILE_JSON_PATH = ".tmp/bc-unknown-scope-profile.json";
const DEFAULT_RESOLUTION_PACKAGE_DIR = ".tmp/bc-resolution-package";
const DEFAULT_SCOPED_BLOCKER_PACKAGE_DIR = ".tmp/bc-scoped-blocker-package";
const DEFAULT_SCOPED_DECISION_REVIEW_DIR = ".tmp/bc-scoped-decision-review";
const DEFAULT_SCOPED_DECISION_VALIDATION_DIR = ".tmp/bc-scoped-decision-validation";
const DEFAULT_SCOPED_DECISION_APPROVAL_WORKSPACE_DIR = ".tmp/bc-scoped-decision-approval-workspace";
const DEFAULT_SCOPED_DECISION_APPLY_DRY_RUN_DIR = ".tmp/bc-scoped-decision-apply-dry-run";
const DEFAULT_SCOPED_DECISION_MANUAL_APPROVAL_INPUT_DIR = ".tmp/bc-scoped-decision-manual-approval-input";
const DEFAULT_SCOPED_DECISION_APPROVAL_INTAKE_DIR = ".tmp/bc-scoped-decision-approval-intake";
const DEFAULT_AUTHORITATIVE_MASTER_INPUT_DIR = ".tmp/bc-authoritative-master-input";
const DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR = ".tmp/bc-authoritative-master-intake";
const DEFAULT_AUTHORITATIVE_MASTER_SEED_DRAFT_DIR = ".tmp/bc-authoritative-master-seed-draft";
const DEFAULT_FUTURE_USE_RAW_REGISTRY_DIR = ".tmp/bc-future-use-raw-registry";
const DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR = ".tmp/bc-authoritative-master-review-workspace";
const DEFAULT_AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR = ".tmp/bc-authoritative-master-review-input";
const DEFAULT_AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR = ".tmp/bc-authoritative-master-review-decision-intake";
const DEFAULT_AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FIXTURE_DIR = ".tmp/bc-authoritative-review-decision-sample-fixture";
const DEFAULT_AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_DIR = ".tmp/bc-authoritative-review-decision-bulk-prefill";
const DEFAULT_AUTHORITATIVE_MASTER_ACCEPTED_DECISION_DRY_RUN_DIR = ".tmp/bc-authoritative-master-accepted-decision-dry-run";
const RESOLUTION_PACKAGE_SUMMARY_FILE = "summary.json";
const RESOLUTION_PACKAGE_CANONICAL_FILE = "canonical-entity-creation-plan.csv";
const RESOLUTION_PACKAGE_ALIAS_FILE = "alias-cleanup-review-plan.csv";
const RESOLUTION_PACKAGE_TARGET_PROFILE_FILE = "target-profile-seed-draft-plan.csv";
const RESOLUTION_PACKAGE_MANUAL_QUEUE_FILE = "manual-approval-queue.csv";
const RESOLUTION_PACKAGE_BLOCKED_CHECKLIST_FILE = "blocked-groups-checklist.csv";
const RESOLUTION_PACKAGE_README_FILE = "README.md";
const SCOPED_BLOCKER_PACKAGE_SUMMARY_FILE = "summary.json";
const SCOPED_BLOCKER_PACKAGE_README_FILE = "README.md";
const SCOPED_BLOCKER_TRUE_P10_FILE = "true-p10-blockers.csv";
const SCOPED_BLOCKER_UNKNOWN_SCOPE_FILE = "unknown-scope-blockers.csv";
const SCOPED_BLOCKER_OK_OUTPUT_ENTITY_FILE = "ok-output-entity-blockers.csv";
const SCOPED_BLOCKER_REJECT_SCOPE_FILE = "reject-scope-blockers.csv";
const SCOPED_BLOCKER_TARGET_PROFILE_FILE = "target-profile-blockers.csv";
const SCOPED_BLOCKER_ALIAS_TEMPLATE_FILE = "alias-cleanup-decision-template.csv";
const SCOPED_BLOCKER_CANONICAL_TEMPLATE_FILE = "canonical-entity-decision-template.csv";
const SCOPED_BLOCKER_TARGET_PROFILE_TEMPLATE_FILE = "target-profile-decision-template.csv";
const SCOPED_DECISION_REVIEW_SUMMARY_FILE = "summary.json";
const SCOPED_DECISION_REVIEW_README_FILE = "README.md";
const SCOPED_DECISION_REVIEW_BOARD_FILE = "decision-board.csv";
const SCOPED_DECISION_REVIEW_ALIAS_CANONICAL_FILE = "alias-canonical-review.csv";
const SCOPED_DECISION_REVIEW_UNKNOWN_SOURCE_FILE = "unknown-source-review.csv";
const SCOPED_DECISION_REVIEW_REJECT_ATTACHMENT_FILE = "reject-attachment-review.csv";
const SCOPED_DECISION_REVIEW_TARGET_PROFILE_FILE = "target-profile-dependency-review.csv";
const SCOPED_DECISION_REVIEW_FAMILY_ROLLUP_FILE = "entity-family-rollup.csv";
const SCOPED_DECISION_REVIEW_NEXT_ACTION_FILE = "next-action-checklist.csv";
const SCOPED_DECISION_VALIDATION_SUMMARY_FILE = "summary.json";
const SCOPED_DECISION_VALIDATION_README_FILE = "README.md";
const SCOPED_DECISION_VALIDATION_ERRORS_FILE = "validation-errors.csv";
const SCOPED_DECISION_VALIDATION_WARNINGS_FILE = "validation-warnings.csv";
const SCOPED_DECISION_VALIDATION_APPROVED_FILE = "approved-decision-summary.csv";
const SCOPED_DECISION_VALIDATION_PENDING_FILE = "pending-decision-summary.csv";
const SCOPED_DECISION_VALIDATION_BLOCKED_EXECUTION_FILE = "blocked-execution-plan.csv";
const SCOPED_DECISION_APPROVAL_SUMMARY_FILE = "summary.json";
const SCOPED_DECISION_APPROVAL_README_FILE = "README.md";
const SCOPED_DECISION_APPROVAL_WORKBOOK_FILE = "approval-workbook.csv";
const SCOPED_DECISION_APPROVAL_WORKBOOK_P1_FILE = "approval-workbook-p1.csv";
const SCOPED_DECISION_APPROVAL_WORKBOOK_P2_FILE = "approval-workbook-p2.csv";
const SCOPED_DECISION_APPROVAL_SOURCE_DATA_FILE = "source-data-approval-template.csv";
const SCOPED_DECISION_APPROVAL_ALIAS_CANONICAL_FILE = "alias-canonical-approval-template.csv";
const SCOPED_DECISION_APPROVAL_REJECT_ATTACHMENT_FILE = "reject-attachment-approval-template.csv";
const SCOPED_DECISION_APPROVAL_TARGET_PROFILE_FILE = "target-profile-approval-template.csv";
const SCOPED_DECISION_APPROVAL_REVIEWER_CHECKLIST_FILE = "reviewer-checklist.csv";
const SCOPED_DECISION_APPROVAL_IMPORT_MANIFEST_FILE = "import-manifest.json";
const SCOPED_DECISION_APPLY_SUMMARY_FILE = "summary.json";
const SCOPED_DECISION_APPLY_README_FILE = "README.md";
const SCOPED_DECISION_APPLY_EXECUTABLE_FILE = "executable-decision-plan.csv";
const SCOPED_DECISION_APPLY_BLOCKED_FILE = "blocked-decision-plan.csv";
const SCOPED_DECISION_APPLY_ALIAS_FILE = "alias-apply-dry-run.csv";
const SCOPED_DECISION_APPLY_CANONICAL_FILE = "canonical-entity-apply-dry-run.csv";
const SCOPED_DECISION_APPLY_REJECT_FILE = "reject-attachment-apply-dry-run.csv";
const SCOPED_DECISION_APPLY_TARGET_PROFILE_FILE = "target-profile-apply-dry-run.csv";
const SCOPED_DECISION_APPLY_P10_IMPACT_FILE = "p10-impact-estimate.csv";
const SCOPED_DECISION_APPLY_SAFETY_FILE = "safety-report.json";
const SCOPED_DECISION_APPLY_INTAKE_SOURCE_FILE = "intake-source-summary.csv";
const SCOPED_DECISION_REVIEWER_DECISIONS_FILE = "reviewer-decisions.csv";
const SCOPED_DECISION_REVIEWER_DECISIONS_TEMPLATE_FILE = "reviewer-decisions.template.csv";
const SCOPED_DECISION_INTAKE_SUMMARY_FILE = "summary.json";
const SCOPED_DECISION_INTAKE_README_FILE = "README.md";
const SCOPED_DECISION_INTAKE_NORMALIZED_FILE = "normalized-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_ACCEPTED_FILE = "accepted-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_BLOCKED_FILE = "blocked-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_MISSING_FILE = "missing-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_DUPLICATE_FILE = "duplicate-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_INVALID_FILE = "invalid-reviewer-decisions.csv";
const SCOPED_DECISION_INTAKE_READINESS_FILE = "approval-readiness-report.json";
const SCOPED_DECISION_INTAKE_P10_GATE_FILE = "p10-gate-preview.json";
const SCOPED_DECISION_INTAKE_SAFETY_FILE = "safety-report.json";
const AUTHORITATIVE_MASTER_CANONICAL_FILE = "canonical-entities.csv";
const AUTHORITATIVE_MASTER_SOURCE_MAP_FILE = "source-to-entity-map.csv";
const AUTHORITATIVE_MASTER_TARGET_PROFILES_FILE = "target-profiles.csv";
const AUTHORITATIVE_MASTER_CANONICAL_DRAFT_FILE = "canonical-entities.draft.csv";
const AUTHORITATIVE_MASTER_SOURCE_MAP_DRAFT_FILE = "source-to-entity-map.draft.csv";
const AUTHORITATIVE_MASTER_TARGET_PROFILES_DRAFT_FILE = "target-profiles.draft.csv";
const AUTHORITATIVE_MASTER_CANONICAL_TEMPLATE_FILE = "canonical-entities.template.csv";
const AUTHORITATIVE_MASTER_SOURCE_MAP_TEMPLATE_FILE = "source-to-entity-map.template.csv";
const AUTHORITATIVE_MASTER_TARGET_PROFILES_TEMPLATE_FILE = "target-profiles.template.csv";
const AUTHORITATIVE_MASTER_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_MASTER_README_FILE = "README.md";
const AUTHORITATIVE_MASTER_CANONICAL_NORMALIZED_FILE = "canonical-entities.normalized.csv";
const AUTHORITATIVE_MASTER_SOURCE_MAP_NORMALIZED_FILE = "source-to-entity-map.normalized.csv";
const AUTHORITATIVE_MASTER_TARGET_PROFILES_NORMALIZED_FILE = "target-profiles.normalized.csv";
const AUTHORITATIVE_MASTER_ERRORS_FILE = "master-validation-errors.csv";
const AUTHORITATIVE_MASTER_WARNINGS_FILE = "master-validation-warnings.csv";
const AUTHORITATIVE_MASTER_SOURCE_COVERAGE_FILE = "source-coverage-preview.csv";
const AUTHORITATIVE_MASTER_TARGET_COVERAGE_FILE = "target-profile-coverage-preview.csv";
const AUTHORITATIVE_MASTER_LEGACY_CONFLICT_FILE = "legacy-conflict-evidence.csv";
const AUTHORITATIVE_MASTER_UNMAPPED_SOURCE_FILE = "unmapped-source-values.csv";
const AUTHORITATIVE_MASTER_TEMPLATES_MANIFEST_FILE = "authoritative-master-templates-manifest.json";
const AUTHORITATIVE_MASTER_SEED_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_MASTER_SEED_README_FILE = "README.md";
const AUTHORITATIVE_MASTER_SEED_CANONICAL_FILE = "canonical-entities.seed-draft.csv";
const AUTHORITATIVE_MASTER_SEED_SOURCE_MAP_FILE = "source-to-entity-map.seed-draft.csv";
const AUTHORITATIVE_MASTER_SEED_TARGET_PROFILES_FILE = "target-profiles.seed-draft.csv";
const AUTHORITATIVE_MASTER_SEED_REVIEW_QUEUE_FILE = "seed-review-queue.csv";
const AUTHORITATIVE_MASTER_SEED_LEGACY_CROSSWALK_FILE = "legacy-evidence-crosswalk.csv";
const AUTHORITATIVE_MASTER_SEED_EXCLUDED_FILE = "excluded-source-values.csv";
const AUTHORITATIVE_MASTER_SEED_WARNINGS_FILE = "seed-quality-warnings.csv";
const FUTURE_USE_RAW_REGISTRY_SUMMARY_FILE = "summary.json";
const FUTURE_USE_RAW_REGISTRY_README_FILE = "README.md";
const FUTURE_USE_RAW_REGISTRY_FILE = "future-use-raw-registry.csv";
const FUTURE_USE_DOMAIN_ROLLUP_FILE = "domain-rollup.csv";
const FUTURE_USE_MODULE_READINESS_FILE = "module-readiness-rollup.csv";
const FUTURE_USE_P10_SPLIT_FILE = "p10-vs-future-split.csv";
const FUTURE_USE_SOURCE_COVERAGE_FILE = "future-use-source-coverage.csv";
const FUTURE_USE_REVIEW_QUEUE_FILE = "future-use-review-queue.csv";
const FUTURE_USE_SOURCE_DATA_GAP_FILE = "source-data-gap-backlog.csv";
const FUTURE_USE_UNKNOWN_REVIEW_FILE = "unknown-review-backlog.csv";
const FUTURE_USE_ENTITY_COVERAGE_FILE = "authoritative-entity-coverage-by-domain.csv";
const FUTURE_USE_TARGET_PROFILE_REQUIREMENT_FILE = "target-profile-requirement-by-domain.csv";
const FUTURE_USE_SAFETY_REPORT_FILE = "future-use-safety-report.json";
const AUTHORITATIVE_MASTER_REVIEW_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_MASTER_REVIEW_README_FILE = "README.md";
const AUTHORITATIVE_MASTER_REVIEW_ENTITY_FILE = "entity-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_SOURCE_MAPPING_FILE = "source-mapping-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_TARGET_PROFILE_FILE = "target-profile-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_CONFLICT_FILE = "conflict-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_SOURCE_GAP_FILE = "source-data-gap-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_FUTURE_USE_FILE = "future-use-domain-review-workbook.csv";
const AUTHORITATIVE_MASTER_REVIEW_DECISION_TEMPLATE_FILE = "reviewer-decision-template.csv";
const AUTHORITATIVE_MASTER_REVIEW_PRIORITY_BOARD_FILE = "review-priority-board.csv";
const AUTHORITATIVE_MASTER_REVIEW_CHECKLIST_FILE = "review-checklist.csv";
const AUTHORITATIVE_MASTER_REVIEW_IMPORT_MANIFEST_FILE = "import-manifest.json";
const AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE = "reviewer-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_DECISIONS_TEMPLATE_FILE = "reviewer-decisions.template.csv";
const AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_README_FILE = "README.md";
const AUTHORITATIVE_MASTER_REVIEW_ACCEPTED_FILE = "accepted-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_BLOCKED_FILE = "blocked-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_INVALID_FILE = "invalid-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_DUPLICATE_FILE = "duplicate-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_UNKNOWN_FILE = "unknown-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_PENDING_FILE = "pending-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_REJECTED_FILE = "rejected-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_DEFERRED_FILE = "deferred-review-decisions.csv";
const AUTHORITATIVE_MASTER_REVIEW_APPROVED_CANONICAL_FILE = "approved-canonical-entity-preview.csv";
const AUTHORITATIVE_MASTER_REVIEW_APPROVED_SOURCE_MAP_FILE = "approved-source-mapping-preview.csv";
const AUTHORITATIVE_MASTER_REVIEW_APPROVED_TARGET_PROFILE_FILE = "approved-target-profile-preview.csv";
const AUTHORITATIVE_MASTER_REVIEW_SOURCE_BACKLOG_FILE = "source-data-backlog-preview.csv";
const AUTHORITATIVE_MASTER_REVIEW_FUTURE_USE_ONLY_FILE = "future-use-only-preview.csv";
const AUTHORITATIVE_MASTER_REVIEW_INTAKE_ERRORS_FILE = "decision-intake-errors.csv";
const AUTHORITATIVE_MASTER_REVIEW_INTAKE_WARNINGS_FILE = "decision-intake-warnings.csv";
const AUTHORITATIVE_MASTER_REVIEW_DECISION_IMPORT_MANIFEST_FILE = "import-manifest.json";
const AUTHORITATIVE_REVIEW_DECISION_SAMPLE_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_REVIEW_DECISION_SAMPLE_README_FILE = "README.md";
const AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FILE = "reviewer-decisions.sample.csv";
const AUTHORITATIVE_REVIEW_DECISION_SAFE_DEFER_FILE = "reviewer-decisions.safe-defer-all.csv";
const AUTHORITATIVE_REVIEW_DECISION_MIXED_FILE = "reviewer-decisions.mixed-simulation.csv";
const AUTHORITATIVE_REVIEW_DECISION_EXPECTATIONS_FILE = "sample-validation-expectations.csv";
const AUTHORITATIVE_REVIEW_DECISION_USAGE_FILE = "sample-usage-instructions.md";
const AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_README_FILE = "README.md";
const AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_FILE = "reviewer-decisions.bulk-prefill.csv";
const AUTHORITATIVE_REVIEW_DECISION_BULK_SAFE_ACCEPTED_FILE = "reviewer-decisions.safe-auto-accepted.csv";
const AUTHORITATIVE_REVIEW_DECISION_BULK_HUMAN_REVIEW_FILE = "reviewer-decisions.requires-human-review.csv";
const AUTHORITATIVE_REVIEW_DECISION_BULK_RULE_REPORT_FILE = "bulk-prefill-rule-report.csv";
const AUTHORITATIVE_REVIEW_DECISION_BULK_RISK_REPORT_FILE = "bulk-prefill-risk-report.csv";
const AUTHORITATIVE_REVIEW_DECISION_BULK_USAGE_FILE = "bulk-prefill-usage-instructions.md";
const AUTHORITATIVE_REVIEW_DECISION_BULK_MANIFEST_FILE = "import-manifest.json";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SUMMARY_FILE = "summary.json";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_README_FILE = "README.md";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CANONICAL_FILE = "canonical-entities.merged-preview.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_MAP_FILE = "source-to-entity-map.merged-preview.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_PROFILES_FILE = "target-profiles.merged-preview.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_ACCEPTED_PLAN_FILE = "accepted-decision-application-plan.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_BLOCKED_PLAN_FILE = "blocked-decision-application-plan.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_COVERAGE_IMPACT_FILE = "coverage-impact-preview.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_P10_IMPACT_FILE = "p10-readiness-impact.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_FUTURE_USE_IMPACT_FILE = "future-use-coverage-impact.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_GAP_FILE = "target-profile-gap-after-dry-run.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_GAP_FILE = "source-data-gap-after-dry-run.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CONFLICT_RISK_FILE = "conflict-risk-after-dry-run.csv";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SAFETY_FILE = "dry-run-safety-report.json";
const AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_MANIFEST_FILE = "import-manifest.json";
const authoritativeMasterValidationIssueCsvHeaders = [
  "issue_id",
  "severity",
  "record_type",
  "row_number",
  "field",
  "issue_code",
  "issue_message",
  "required_action"
] as const satisfies readonly (keyof AuthoritativeMasterValidationIssueRow)[];
const authoritativeMasterSourceCoverageCsvHeaders = [
  "source_field",
  "source_value",
  "rows",
  "authoritative_status",
  "canonical_entity_code",
  "bc_scopes",
  "current_entity_codes_legacy_evidence",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeSourceCoveragePreviewRow)[];
const authoritativeMasterTargetCoverageCsvHeaders = [
  "canonical_entity_code",
  "target_bucket",
  "machine_center_no",
  "rows",
  "coverage_status",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeTargetProfileCoveragePreviewRow)[];
const authoritativeMasterLegacyConflictCsvHeaders = [
  "evidence_id",
  "source_field",
  "source_value",
  "rows",
  "current_entity_codes_legacy_evidence",
  "proposed_legacy_entity_codes",
  "conflict_reason",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeLegacyConflictEvidenceRow)[];
const authoritativeMasterUnmappedSourceCsvHeaders = [
  "source_field",
  "source_value",
  "rows",
  "bc_scopes",
  "current_entity_codes_legacy_evidence",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeUnmappedSourceValueRow)[];
const authoritativeSeedReviewQueueCsvHeaders = [
  "review_id",
  "review_category",
  "source_field",
  "source_value",
  "proposed_canonical_entity_code",
  "rows",
  "review_reason",
  "recommended_action",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeSeedReviewQueueRow)[];
const authoritativeSeedLegacyCrosswalkCsvHeaders = [
  "source_value",
  "proposed_canonical_entity_code",
  "legacy_current_entity_codes",
  "v2_entity_codes",
  "target_bucket_candidates",
  "machine_center_nos",
  "sample_documents",
  "sample_items",
  "evidence_reason",
  "review_required"
] as const satisfies readonly (keyof AuthoritativeLegacyEvidenceCrosswalkRow)[];
const authoritativeSeedExcludedCsvHeaders = [
  "source_field",
  "source_value",
  "rows",
  "exclusion_reason",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof AuthoritativeExcludedSourceValueRow)[];
const authoritativeSeedWarningsCsvHeaders = [
  "warning_id",
  "warning_category",
  "source_value",
  "canonical_entity_code",
  "warning_reason",
  "recommended_action"
] as const satisfies readonly (keyof AuthoritativeSeedQualityWarningRow)[];
const futureUseRawRegistryCsvHeaders = [
  "registry_key",
  "registry_granularity",
  "source_system",
  "source_file",
  "posting_date",
  "document_no",
  "item_no",
  "item_description",
  "entry_type",
  "item_category_code",
  "source_field",
  "source_value",
  "machine_center_no",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "registry_status",
  "p10_inclusion_status",
  "future_module_candidate",
  "authoritative_entity_status",
  "authoritative_entity_code",
  "target_profile_required",
  "target_profile_status",
  "review_required",
  "review_reason",
  "safety_reason"
] as const satisfies readonly (keyof FutureUseRawRegistryRow)[];
const futureUseRollupCsvHeaders = [
  "rollup_key",
  "rows",
  "registered_rows"
] as const satisfies readonly (keyof FutureUseRollupRow)[];
const futureUseModuleReadinessCsvHeaders = [
  "future_module_candidate",
  "rows",
  "authoritative_mapped_rows",
  "draft_entity_candidate_rows",
  "source_data_gap_rows",
  "conflict_review_rows",
  "target_profile_required_rows",
  "target_profile_missing_rows",
  "review_required_rows",
  "readiness_status"
] as const satisfies readonly (keyof FutureUseModuleReadinessRollupRow)[];
const futureUseP10SplitCsvHeaders = [
  "split",
  "rows"
] as const satisfies readonly (keyof FutureUseP10SplitRow)[];
const futureUseSourceCoverageCsvHeaders = [
  "source_field",
  "source_value",
  "bc_future_use_domain",
  "rows",
  "authoritative_entity_status",
  "authoritative_entity_code",
  "review_required",
  "review_reason"
] as const satisfies readonly (keyof FutureUseSourceCoverageRow)[];
const futureUseReviewQueueCsvHeaders = [
  "review_id",
  "review_type",
  "source_field",
  "source_value",
  "bc_future_use_domain",
  "rows",
  "review_reason",
  "recommended_action"
] as const satisfies readonly (keyof FutureUseReviewQueueRow)[];
const futureUseDomainCoverageCsvHeaders = [
  "bc_future_use_domain",
  "rows",
  "authoritative_mapped_rows",
  "draft_entity_candidate_rows",
  "source_data_gap_rows",
  "conflict_review_rows",
  "unknown_rows"
] as const satisfies readonly (keyof FutureUseDomainCoverageRow)[];
const futureUseTargetProfileRequirementCsvHeaders = [
  "bc_future_use_domain",
  "rows",
  "target_profile_required_rows",
  "target_profile_covered_rows",
  "target_profile_missing_rows",
  "target_profile_not_required_rows"
] as const satisfies readonly (keyof FutureUseTargetProfileRequirementRow)[];
const authoritativeReviewEntityCsvHeaders = [
  "review_id",
  "priority",
  "entity_family",
  "proposed_canonical_entity_code",
  "proposed_canonical_entity_display_name",
  "proposed_entity_type",
  "row_coverage_count",
  "p10_output_rows",
  "reject_rows",
  "future_use_rows",
  "conflict_rows",
  "source_data_gap_rows",
  "legacy_current_entity_codes",
  "sample_source_values",
  "sample_documents",
  "sample_items",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterEntityReviewRow)[];
const authoritativeReviewSourceMappingCsvHeaders = [
  "review_id",
  "priority",
  "source_system",
  "source_field",
  "source_value",
  "proposed_canonical_entity_code",
  "mapping_type",
  "confidence",
  "rows_covered",
  "bc_future_use_domains",
  "p10_inclusion_statuses",
  "legacy_current_entity_codes",
  "conflict_flag",
  "conflict_reason",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterSourceMappingReviewRow)[];
const authoritativeReviewTargetProfileCsvHeaders = [
  "review_id",
  "priority",
  "canonical_entity_code",
  "target_bucket",
  "machine_center_no",
  "affected_output_rows",
  "affected_reject_rows",
  "target_profile_required",
  "target_profile_status",
  "proposed_target_qty",
  "proposed_unit",
  "effective_from",
  "effective_to",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterTargetProfileReviewRow)[];
const authoritativeReviewConflictCsvHeaders = [
  "review_id",
  "priority",
  "conflict_type",
  "source_field",
  "source_value",
  "proposed_canonical_entity_code",
  "legacy_current_entity_codes",
  "v2_entity_codes",
  "rows",
  "bc_future_use_domains",
  "sample_documents",
  "sample_items",
  "risk_level",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterConflictReviewRow)[];
const authoritativeReviewSourceGapCsvHeaders = [
  "review_id",
  "priority",
  "source_gap_type",
  "rows",
  "bc_future_use_domains",
  "p10_inclusion_statuses",
  "sample_documents",
  "sample_items",
  "item_category_codes",
  "machine_center_nos",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterSourceDataGapReviewRow)[];
const authoritativeReviewFutureUseCsvHeaders = [
  "review_id",
  "future_use_domain",
  "future_module_candidate",
  "rows",
  "authoritative_entity_status_counts",
  "target_profile_required_rows",
  "target_profile_not_required_rows",
  "unknown_rows",
  "source_data_gap_rows",
  "recommended_action",
  "approval_status",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterFutureUseDomainReviewRow)[];
const authoritativeReviewDecisionTemplateCsvHeaders = [
  "review_id",
  "review_type",
  "approval_status",
  "approved_action",
  "approved_canonical_entity_code",
  "approved_source_field",
  "approved_source_value",
  "approved_mapping_type",
  "approved_target_bucket",
  "approved_machine_center_no",
  "approved_target_qty",
  "approved_unit",
  "effective_from",
  "effective_to",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeMasterReviewerDecisionTemplateRow)[];
const authoritativeReviewPriorityBoardCsvHeaders = [
  "review_id",
  "review_type",
  "priority",
  "rows",
  "review_reason",
  "recommended_action"
] as const satisfies readonly (keyof AuthoritativeMasterReviewPriorityBoardRow)[];
const authoritativeReviewChecklistCsvHeaders = [
  "checklist_id",
  "priority",
  "review_area",
  "required_check",
  "completion_status"
] as const satisfies readonly (keyof AuthoritativeMasterReviewChecklistRow)[];
const authoritativeReviewDecisionNormalizedCsvHeaders = [
  "review_id",
  "review_type",
  "approval_status",
  "approved_action",
  "approved_canonical_entity_code",
  "approved_source_field",
  "approved_source_value",
  "approved_mapping_type",
  "approved_target_bucket",
  "approved_machine_center_no",
  "approved_target_qty",
  "approved_unit",
  "effective_from",
  "effective_to",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionNormalizedRow)[];
const authoritativeReviewDecisionIssueCsvHeaders = [
  "issue_id",
  "severity",
  "issue_code",
  "issue_message",
  ...authoritativeReviewDecisionNormalizedCsvHeaders
] as const satisfies readonly (keyof AuthoritativeReviewDecisionIssueRow)[];
const authoritativeReviewDecisionPreviewCanonicalCsvHeaders = [
  "canonical_entity_code",
  "canonical_entity_display_name",
  "entity_family",
  "entity_type",
  "production_area",
  "is_active",
  "source_of_truth_status",
  "reviewer",
  "reviewer_notes",
  "effective_from",
  "effective_to",
  "source_review_id"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionPreviewCanonicalRow)[];
const authoritativeReviewDecisionPreviewSourceMapCsvHeaders = [
  "source_system",
  "source_field",
  "source_value",
  "canonical_entity_code",
  "mapping_type",
  "confidence",
  "is_active",
  "reviewer",
  "reviewer_notes",
  "effective_from",
  "effective_to",
  "source_review_id"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionPreviewSourceMapRow)[];
const authoritativeReviewDecisionPreviewTargetProfileCsvHeaders = [
  "canonical_entity_code",
  "target_bucket",
  "machine_center_no",
  "target_qty",
  "unit",
  "effective_from",
  "effective_to",
  "is_active",
  "approval_status",
  "reviewer",
  "reviewer_notes",
  "source_review_id"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionPreviewTargetProfileRow)[];
const authoritativeReviewDecisionBacklogPreviewCsvHeaders = [
  "review_id",
  "review_type",
  "approved_action",
  "reviewer",
  "reviewer_notes"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionBacklogPreviewRow)[];
const authoritativeReviewDecisionSampleCsvHeaders = authoritativeReviewDecisionNormalizedCsvHeaders satisfies readonly (keyof AuthoritativeReviewDecisionSampleRow)[];
const authoritativeReviewDecisionSampleExpectationCsvHeaders = [
  "fixture_file",
  "expected_total_rows",
  "expected_accepted_min",
  "expected_deferred_min",
  "expected_rejected_min",
  "expected_invalid_min",
  "expected_duplicate_min",
  "expected_unknown_min",
  "expected_p10_status",
  "expected_safety"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionSampleExpectationRow)[];
const authoritativeReviewDecisionBulkPrefillRuleCsvHeaders = [
  "review_id",
  "review_type",
  "rule_id",
  "rule_result",
  "approved_action",
  "rule_reason"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionBulkPrefillRuleReportRow)[];
const authoritativeReviewDecisionBulkPrefillRiskCsvHeaders = [
  "review_id",
  "review_type",
  "risk_level",
  "risk_reason",
  "requires_human_review"
] as const satisfies readonly (keyof AuthoritativeReviewDecisionBulkPrefillRiskReportRow)[];
const authoritativeAcceptedDecisionApplicationPlanCsvHeaders = [
  "review_id",
  "review_type",
  "approved_action",
  "application_status",
  "preview_artifact",
  "canonical_entity_code",
  "source_field",
  "source_value",
  "target_bucket",
  "machine_center_no",
  "warning_code",
  "warning_message"
] as const satisfies readonly (keyof AuthoritativeAcceptedDecisionApplicationPlanRow)[];
const authoritativeBlockedDecisionApplicationPlanCsvHeaders = [
  "review_id",
  "review_type",
  "approval_status",
  "approved_action",
  "blocker_code",
  "blocker_message"
] as const satisfies readonly (keyof AuthoritativeBlockedDecisionApplicationPlanRow)[];
const authoritativeCoverageImpactPreviewCsvHeaders = [
  "metric",
  "before",
  "after",
  "delta"
] as const satisfies readonly (keyof AuthoritativeCoverageImpactPreviewRow)[];
const authoritativeP10ReadinessImpactCsvHeaders = [
  "metric",
  "rows"
] as const satisfies readonly (keyof AuthoritativeP10ReadinessImpactRow)[];
const authoritativeFutureUseCoverageImpactCsvHeaders = [
  "bc_future_use_domain",
  "rows",
  "authoritative_mapped_rows_before",
  "authoritative_mapped_rows_after",
  "target_profile_missing_rows_before",
  "target_profile_missing_rows_after",
  "future_use_only_rows"
] as const satisfies readonly (keyof AuthoritativeFutureUseCoverageImpactRow)[];
const authoritativeTargetProfileGapAfterDryRunCsvHeaders = [
  "bc_future_use_domain",
  "canonical_entity_code",
  "target_bucket",
  "machine_center_no",
  "rows",
  "p10_blocker"
] as const satisfies readonly (keyof AuthoritativeTargetProfileGapAfterDryRunRow)[];
const authoritativeSourceDataGapAfterDryRunCsvHeaders = [
  "source_field",
  "source_value",
  "bc_future_use_domain",
  "rows",
  "p10_blocker"
] as const satisfies readonly (keyof AuthoritativeSourceDataGapAfterDryRunRow)[];
const authoritativeConflictRiskAfterDryRunCsvHeaders = [
  "source_field",
  "source_value",
  "bc_future_use_domain",
  "rows",
  "p10_blocker"
] as const satisfies readonly (keyof AuthoritativeConflictRiskAfterDryRunRow)[];
const entityV2CsvHeaders = [
  "posting_date",
  "document_no",
  "entry_no",
  "item_no",
  "item_description",
  "item_category_code",
  "quantity",
  "unit_of_measure_code",
  "gross_weight",
  "entry_type",
  "location_code",
  "g_prod_or_rot_line_no",
  "g_prod_or_rot_line_description",
  "machine_center_no",
  "current_entity_code",
  "current_entity_display_name",
  "v2_entity_code",
  "v2_entity_display_name",
  "v2_source_field_used",
  "v2_source_value_used",
  "v2_confidence",
  "v2_reason",
  "v2_target_bucket_candidate",
  "v2_target_routing_evidence",
  "comparison_status",
  "v2_review_classification",
  "v2_review_reason",
  "v2_recommended_action",
  "v2_suggested_canonical_entity_code",
  "v2_suggested_canonical_entity_display_name",
  "v2_mismatch_review_type",
  "v2_mismatch_review_reason",
  "v2_mismatch_recommended_action",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "blocks_p10_after_scope"
] as const satisfies readonly (keyof EntityV2ReportRow)[];

const targetProfileDryRunCsvHeaders = [
  "posting_date",
  "document_no",
  "entry_no",
  "item_no",
  "item_description",
  "item_category_code",
  "quantity",
  "gross_weight",
  "entry_type",
  "location_code",
  "g_prod_or_rot_line_no",
  "g_prod_or_rot_line_description",
  "machine_center_no",
  "resolver_v2_entity_code",
  "resolver_v2_entity_display_name",
  "resolver_v2_source_field_used",
  "resolver_v2_source_value_used",
  "resolver_v2_target_bucket_candidate",
  "target_profile_lookup_status",
  "target_profile_id",
  "target_profile_target_qty",
  "target_profile_unit",
  "target_profile_effective_from",
  "target_profile_effective_to",
  "target_profile_machine_center_no",
  "target_profile_reason",
  "recommended_action",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "blocks_p10_after_scope"
] as const satisfies readonly (keyof TargetProfileDryRunReportRow)[];

const entityV2BackfillDryRunCsvHeaders = [
  "posting_date",
  "document_no",
  "entry_no",
  "item_no",
  "item_description",
  "quantity",
  "entry_type",
  "location_code",
  "source_field",
  "source_value",
  "machine_center_no",
  "current_entity_id",
  "current_entity_code",
  "current_entity_display_name",
  "proposed_canonical_entity_code",
  "proposed_canonical_entity_display_name",
  "backfill_action",
  "risk_level",
  "risk_reason",
  "recommended_action",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "blocks_p10_after_scope"
] as const satisfies readonly (keyof EntityV2BackfillDryRunReportRow)[];

const targetProfileBackfillDryRunCsvHeaders = [
  "canonical_entity_code",
  "canonical_entity_display_name",
  "current_entity_code",
  "current_entity_display_name",
  "target_bucket",
  "machine_center_no",
  "machine_center_no_normalized",
  "effective_from",
  "effective_to",
  "proposed_target_qty",
  "unit",
  "source",
  "approval_status",
  "risk_level",
  "risk_reason",
  "recommended_action",
  "sample_rows",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "blocks_p10_after_scope"
] as const satisfies readonly (keyof TargetProfileBackfillDryRunReportRow)[];

const highRiskReviewPlanCsvHeaders = [
  "review_group_type",
  "source_field",
  "source_value",
  "canonical_entity_code",
  "current_entity_codes",
  "proposed_entity_code",
  "target_bucket",
  "machine_center_no",
  "rows",
  "risk_level",
  "risk_reason",
  "review_decision",
  "recommended_action",
  "p10_blocker",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "blocks_p10_after_scope",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof HighRiskReviewPlanCsvRow)[];

const kpiCompareV1V2CsvHeaders = [
  "status",
  "blocker",
  "recommended_action"
] as const satisfies readonly (keyof KpiCompareV1V2CsvRow)[];

const unknownScopeProfileCsvHeaders = [
  "group_id",
  "rows",
  "blocks_p10_after_scope",
  "entry_type",
  "location_code",
  "item_category_code",
  "unit_of_measure_code",
  "document_prefix",
  "item_prefix",
  "source_value",
  "current_entity_codes",
  "canonical_entity_code",
  "target_bucket",
  "machine_center_no",
  "bc_entity_source_status",
  "reason_unknown",
  "sample_documents",
  "sample_items",
  "suggested_future_use_domain",
  "suggested_current_kpi_scope",
  "suggested_rule",
  "confidence",
  "needs_manual_review"
] as const satisfies readonly (keyof UnknownScopeProfileCsvRow)[];

const scopedBlockerPackageCsvHeaders = [
  "blocker_group_id",
  "blocker_category",
  "review_group_type",
  "source_field",
  "source_value",
  "canonical_entity_code",
  "current_entity_codes",
  "proposed_entity_code",
  "target_bucket",
  "machine_center_no",
  "rows",
  "risk_level",
  "risk_reason",
  "review_decision",
  "recommended_action",
  "p10_blocker_before_scope",
  "blocks_p10_after_scope",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_scope_evidence_fields",
  "bc_entity_source_status",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof ScopedBlockerPackageCsvRow)[];

const canonicalEntityCreationPlanCsvHeaders = [
  "canonical_entity_code",
  "canonical_entity_display_name",
  "area_candidate",
  "source_values",
  "current_entity_codes",
  "rows",
  "risk_level",
  "reason",
  "recommended_action",
  "sample_documents",
  "sample_items",
  "approval_status"
] as const satisfies readonly (keyof CanonicalEntityCreationPlanCsvRow)[];

const aliasCleanupReviewPlanCsvHeaders = [
  "source_field",
  "source_value",
  "current_entity_codes",
  "proposed_canonical_entity_code",
  "rows",
  "conflict_type",
  "risk_level",
  "reason",
  "recommended_action",
  "sample_documents",
  "sample_items",
  "approval_status"
] as const satisfies readonly (keyof AliasCleanupReviewPlanCsvRow)[];

const targetProfileSeedDraftPlanCsvHeaders = [
  "canonical_entity_code",
  "canonical_entity_display_name",
  "target_bucket",
  "machine_center_no",
  "machine_center_no_normalized",
  "effective_from",
  "effective_to",
  "target_qty",
  "unit",
  "source_current_entity_code",
  "source_target_value_origin",
  "rows",
  "risk_level",
  "reason",
  "recommended_action",
  "approval_status",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof TargetProfileSeedDraftPlanCsvRow)[];

const scopedAliasCleanupDecisionTemplateCsvHeaders = [
  ...aliasCleanupReviewPlanCsvHeaders,
  "decision",
  "approved_by",
  "notes"
] as const satisfies readonly (keyof ScopedAliasCleanupDecisionTemplateCsvRow)[];

const scopedCanonicalEntityDecisionTemplateCsvHeaders = [
  ...canonicalEntityCreationPlanCsvHeaders,
  "decision",
  "approved_by",
  "notes"
] as const satisfies readonly (keyof ScopedCanonicalEntityDecisionTemplateCsvRow)[];

const scopedTargetProfileDecisionTemplateCsvHeaders = [
  ...targetProfileSeedDraftPlanCsvHeaders,
  "decision",
  "approved_by",
  "notes"
] as const satisfies readonly (keyof ScopedTargetProfileDecisionTemplateCsvRow)[];

const scopedDecisionReviewCsvHeaders = [
  "decision_id",
  "decision_family",
  "decision_category",
  "source_values",
  "blocker_group_ids",
  "blocker_categories",
  "review_group_types",
  "rows",
  "risk_levels",
  "reason",
  "recommended_action",
  "required_decision",
  "safe_to_auto_apply",
  "decision_status",
  "p10_gate_effect",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof ScopedDecisionReviewRow)[];

const scopedDecisionFamilyRollupCsvHeaders = [
  "decision_family",
  "decision_rows",
  "blocker_groups",
  "grouped_rows",
  "categories",
  "top_source_values",
  "safe_to_auto_apply",
  "p10_gate_effect"
] as const satisfies readonly (keyof ScopedDecisionFamilyRollupRow)[];

const scopedDecisionNextActionCsvHeaders = [
  "action_id",
  "decision_family",
  "decision_category",
  "priority",
  "action",
  "owner",
  "status",
  "safe_to_auto_apply"
] as const satisfies readonly (keyof ScopedDecisionNextActionRow)[];

const scopedDecisionValidationIssueCsvHeaders = [
  "validation_id",
  "severity",
  "decision_id",
  "decision_family",
  "decision_category",
  "source_values",
  "field",
  "code",
  "message",
  "approval_status",
  "safe_to_auto_apply",
  "safe_to_seed_target_profile",
  "p10_gate_effect",
  "rows"
] as const satisfies readonly (keyof ScopedDecisionValidationIssueRow)[];

const scopedDecisionValidationSummaryCsvHeaders = [
  "decision_id",
  "decision_family",
  "decision_category",
  "source_values",
  "approval_status",
  "reviewer",
  "reviewer_notes",
  "rows",
  "p10_gate_effect",
  "safe_to_auto_apply",
  "safe_to_seed_target_profile"
] as const satisfies readonly (keyof ScopedDecisionValidationSummaryRow)[];

const scopedDecisionBlockedExecutionCsvHeaders = [
  "block_id",
  "decision_id",
  "decision_family",
  "decision_category",
  "source_values",
  "approval_status",
  "blocker_reason",
  "required_before_execution",
  "p10_gate_effect",
  "rows"
] as const satisfies readonly (keyof ScopedDecisionBlockedExecutionPlanRow)[];

const scopedDecisionApprovalWorkbookCsvHeaders = [
  "decision_id",
  "priority",
  "decision_family",
  "decision_category",
  "source_value",
  "proposed_canonical_entity_code",
  "current_entity_codes",
  "target_bucket",
  "machine_center_no",
  "grouped_rows",
  "affected_scopes",
  "affected_future_use_domains",
  "recommended_decision",
  "rationale",
  "risk_level",
  "blocks_p10_after_scope",
  "validation_status",
  "validation_warnings",
  "approval_status",
  "approved_action",
  "safe_to_auto_apply",
  "safe_to_seed_target_profile",
  "reviewer",
  "reviewer_notes",
  "business_approval_reference",
  "decision_date",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof ScopedDecisionApprovalWorkbookRow)[];

const scopedDecisionReviewerChecklistCsvHeaders = [
  "checklist_id",
  "approval_template",
  "priority",
  "checklist_item",
  "required_before_approval",
  "status"
] as const satisfies readonly (keyof ScopedDecisionReviewerChecklistRow)[];

const scopedDecisionExecutablePlanCsvHeaders = [
  "plan_id",
  "decision_id",
  "priority",
  "decision_family",
  "decision_category",
  "approved_action",
  "plan_type",
  "source_value",
  "grouped_rows",
  "reviewer",
  "reviewer_notes",
  "business_approval_reference",
  "sample_documents",
  "sample_items",
  "p10_gate_effect",
  "execution_mode"
] as const satisfies readonly (keyof ScopedDecisionExecutablePlanRow)[];

const scopedDecisionBlockedPlanCsvHeaders = [
  "block_id",
  "decision_id",
  "priority",
  "decision_family",
  "decision_category",
  "approval_status",
  "approved_action",
  "blocker_code",
  "blocker_reason",
  "required_before_execution",
  "grouped_rows",
  "source_value",
  "p10_gate_effect"
] as const satisfies readonly (keyof ScopedDecisionBlockedPlanRow)[];

const scopedDecisionCategoryDryRunCsvHeaders = [
  "plan_id",
  "decision_id",
  "decision_family",
  "decision_category",
  "approved_action",
  "source_value",
  "grouped_rows",
  "reviewer",
  "reviewer_notes",
  "dry_run_notes"
] as const satisfies readonly (keyof ScopedDecisionCategoryDryRunRow)[];

const scopedDecisionP10ImpactCsvHeaders = [
  "metric",
  "value",
  "note"
] as const satisfies readonly (keyof ScopedDecisionP10ImpactEstimateRow)[];

const scopedDecisionApplyIntakeSourceCsvHeaders = [
  "metric",
  "value",
  "note"
] as const satisfies readonly (keyof ScopedDecisionApplyDryRunSourceSummaryRow)[];

const scopedDecisionReviewerInputTemplateCsvHeaders = [
  "decision_id",
  "stable_decision_key",
  "priority",
  "decision_family",
  "decision_category",
  "source_value",
  "grouped_rows",
  "recommended_decision",
  "rationale",
  "approval_status",
  "approved_action",
  "reviewer",
  "reviewer_notes",
  "business_approval_reference",
  "decision_date",
  "safe_to_auto_apply",
  "safe_to_seed_target_profile",
  "entity_dependency_status",
  "target_bucket",
  "target_qty",
  "unit"
] as const satisfies readonly (keyof ScopedDecisionReviewerInputTemplateRow)[];

const scopedDecisionNormalizedReviewerDecisionCsvHeaders = [
  "intake_id",
  "decision_id",
  "stable_decision_key",
  "priority",
  "decision_family",
  "decision_category",
  "source_value",
  "grouped_rows",
  "approval_status",
  "approved_action",
  "reviewer",
  "reviewer_notes",
  "business_approval_reference",
  "decision_date",
  "safe_to_auto_apply",
  "safe_to_seed_target_profile",
  "entity_dependency_status",
  "target_bucket",
  "target_qty",
  "unit",
  "intake_status",
  "intake_reason"
] as const satisfies readonly (keyof ScopedDecisionNormalizedReviewerDecisionRow)[];

const scopedDecisionBlockedReviewerDecisionCsvHeaders = [
  "block_id",
  "decision_id",
  "stable_decision_key",
  "decision_family",
  "decision_category",
  "source_value",
  "approval_status",
  "approved_action",
  "blocker_code",
  "blocker_reason",
  "required_before_acceptance"
] as const satisfies readonly (keyof ScopedDecisionBlockedReviewerDecisionRow)[];

const scopedDecisionMissingReviewerDecisionCsvHeaders = [
  "decision_id",
  "stable_decision_key",
  "priority",
  "decision_family",
  "decision_category",
  "source_value",
  "grouped_rows",
  "approval_status",
  "required_reviewer_fields"
] as const satisfies readonly (keyof ScopedDecisionMissingReviewerDecisionRow)[];

const scopedDecisionDuplicateReviewerDecisionCsvHeaders = [
  "duplicate_id",
  "decision_id",
  "stable_decision_key",
  "duplicate_count",
  "blocker_code",
  "blocker_reason"
] as const satisfies readonly (keyof ScopedDecisionDuplicateReviewerDecisionRow)[];

const scopedDecisionInvalidReviewerDecisionCsvHeaders = [
  "invalid_id",
  "decision_id",
  "stable_decision_key",
  "approval_status",
  "approved_action",
  "invalid_code",
  "invalid_reason"
] as const satisfies readonly (keyof ScopedDecisionInvalidReviewerDecisionRow)[];

const manualApprovalQueueCsvHeaders = [
  "priority",
  "review_group_type",
  "source_value",
  "canonical_entity_code",
  "current_entity_codes",
  "target_bucket",
  "machine_center_no",
  "rows",
  "risk_level",
  "decision_needed",
  "recommended_action",
  "blocks_p10",
  "bc_current_kpi_scope",
  "bc_future_use_domain",
  "bc_scope_reason",
  "bc_entity_source_status",
  "blocks_p10_after_scope",
  "sample_documents",
  "sample_items"
] as const satisfies readonly (keyof ManualApprovalQueueCsvRow)[];

const blockedGroupsChecklistCsvHeaders = [
  "blocker_id",
  "blocker_type",
  "source_value",
  "rows",
  "current_status",
  "required_resolution",
  "owner",
  "approval_status",
  "resolved",
  "notes"
] as const satisfies readonly (keyof BlockedGroupsChecklistCsvRow)[];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function resolveRepoPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(REPO_ROOT, value);
}

function displayRepoPath(value: string): string {
  const absolute = resolveRepoPath(value);
  const relative = path.relative(REPO_ROOT, absolute);
  return relative.startsWith("..") ? absolute : relative;
}

async function fileExists(value: string): Promise<boolean> {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

function validateDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  return value;
}

function jakartaDate(daysFromToday = 0): string {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${formatNumber(value, 2)}%`;
}

function formatTableField(value: unknown): string {
  return String(value ?? "N/A").replace(/\s*\|\s*/g, " / ");
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function sourceFieldColumn(sourceField: MasterSourceField): string {
  return sourceFieldColumns[sourceField];
}

function requireSourceField(): MasterSourceField {
  const value = process.env.SOURCE_FIELD?.trim();
  if (!value || !isMasterSourceField(value)) {
    throw new Error("SOURCE_FIELD must be one of machine_description, machine_center_no, prod_line_description, prod_line_no, item_no, uom");
  }
  return value;
}

function sqlNormalizeExpression(column: string): string {
  return `upper(regexp_replace(trim(coalesce(${column}, '')), '[^A-Za-z0-9]+', '', 'g'))`;
}

function preferredEntitySourceFieldSql(alias = "po"): string {
  return `
    case
      when nullif(btrim(${alias}.machine_description), '') is not null then 'machine_description'
      when nullif(btrim(${alias}.machine_center_no), '') is not null then 'machine_center_no'
      when nullif(btrim(${alias}.prod_line_description), '') is not null then 'prod_line_description'
      when nullif(btrim(${alias}.prod_line_no), '') is not null then 'prod_line_no'
      else 'blank'
    end
  `;
}

function preferredEntitySourceValueSql(alias = "po"): string {
  return `
    coalesce(
      nullif(btrim(${alias}.machine_description), ''),
      nullif(btrim(${alias}.machine_center_no), ''),
      nullif(btrim(${alias}.prod_line_description), ''),
      nullif(btrim(${alias}.prod_line_no), '')
    )
  `;
}

function outputEntryTypePredicate(alias?: string): string {
  const column = alias ? `${alias}.entry_type` : "entry_type";
  return `upper(coalesce(${column}, '')) = 'OUTPUT'`;
}

function okOutputPredicate(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `upper(coalesce(${prefix}item_no, '')) not like 'RJ%' and upper(coalesce(${prefix}uom, '')) = 'PCS'`;
}

function rejectOutputPredicate(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `upper(coalesce(${prefix}item_no, '')) like 'RJ%' and upper(coalesce(${prefix}uom, '')) = 'KG'`;
}

function rejectKgExpression(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `case when ${rejectOutputPredicate(alias)} then abs(${prefix}quantity) else 0 end`;
}

function rejectPcsEqExpression(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `case when ${rejectOutputPredicate(alias)} and ${prefix}gross_weight_per_pcs > 0 then abs(${prefix}quantity) / ${prefix}gross_weight_per_pcs else null end`;
}

function outputClassCase(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `
    case
      when ${okOutputPredicate(alias)} then 'OK'
      when ${rejectOutputPredicate(alias)} then 'REJECT'
      when upper(coalesce(${prefix}item_no, '')) like 'RJ%' then 'REJECT_UOM_MISMATCH'
      when nullif(btrim(coalesce(${prefix}item_no, '')), '') is not null then 'OK_UOM_MISMATCH'
      else 'UNKNOWN_OUTPUT_CLASS'
    end
  `;
}

function buildFilters(): Filters {
  const fallback = { from: jakartaDate(-6), to: jakartaDate() };
  const from = validateDate(process.env.RECONCILE_FROM?.trim() || fallback.from, "RECONCILE_FROM");
  const to = validateDate(process.env.RECONCILE_TO?.trim() || fallback.to, "RECONCILE_TO");
  if (to < from) throw new Error("RECONCILE_TO must be on or after RECONCILE_FROM");
  return {
    from,
    to,
    ...(process.env.RECONCILE_ENTITY_ID?.trim()
      ? { entityId: process.env.RECONCILE_ENTITY_ID.trim() }
      : {}),
    ...(process.env.RECONCILE_ITEM_NO?.trim()
      ? { itemNo: process.env.RECONCILE_ITEM_NO.trim().toUpperCase() }
      : {})
  };
}

function outputWhere(filters: Filters, alias?: string): SqlParts {
  const prefix = alias ? `${alias}.` : "";
  const clauses = [`${prefix}source_system = $1`, outputEntryTypePredicate(alias), `${prefix}posting_date >= $2`, `${prefix}posting_date <= $3`];
  const params: unknown[] = [SOURCE_SYSTEM, filters.from, filters.to];
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`${prefix}entity_id = $${params.length}`);
  }
  if (filters.itemNo) {
    params.push(filters.itemNo);
    clauses.push(`${prefix}item_no = $${params.length}`);
  }
  return { where: clauses.join(" and "), params };
}

async function queryDailyItemResumeSourceRows(pool: DatabasePool, filters: Filters): Promise<DailyItemResumeSourceRow[]> {
  const where = outputWhere(filters, "po");
  const result = await pool.query<{
    id: string;
    posting_date: string;
    document_no: string | null;
    external_document_no: string | null;
    normalized_output_type: string;
    item_no: string;
    item_description: string | null;
    item_category_code: string | null;
    machine_description: string | null;
    machine_center_no: string | null;
    prod_line_no: string | null;
    prod_line_description: string | null;
    entity_id: string | null;
    entity_code: string | null;
    entity_display_name: string | null;
    planned_runtime_hours: string | number | null;
    shift_code: string | null;
    operator_name: string | null;
    quantity: string | number;
    uom: string | null;
    gross_weight_per_pcs: string | number | null;
    mapped_gross_weight_per_pcs: string | number | null;
    mapped_gross_weight_source: string | null;
    reject_kg: string | number;
    reject_pcs_eq: string | number | null;
  }>(
    `
      select
        po.id,
        po.posting_date::text,
        po.document_no,
        po.external_document_no,
        po.normalized_output_type,
        po.item_no,
        po.item_description,
        po.item_category_code,
        po.machine_description,
        po.machine_center_no,
        po.prod_line_no,
        po.prod_line_description,
        po.entity_id,
        me.entity_code,
        me.display_name as entity_display_name,
        me.planned_runtime_hours,
        po.shift_code,
        po.operator_name,
        po.quantity,
        po.uom,
        po.gross_weight_per_pcs,
        icm.gross_weight_per_pcs as mapped_gross_weight_per_pcs,
        case when icm.gross_weight_per_pcs is not null then 'ITEM_CONVERSION_MAPPING' else null end as mapped_gross_weight_source,
        po.reject_kg,
        po.reject_pcs_eq
      from production_outputs po
      left join master_entities me on me.id = po.entity_id
      left join lateral (
        select gross_weight_per_pcs
        from item_conversion_mappings
        where item_no = po.item_no
          and uom = coalesce(po.uom, '')
          and is_active = true
        order by updated_at desc, created_at desc
        limit 1
      ) icm on true
      where ${where.where}
      order by po.posting_date desc, po.id asc
    `,
    where.params
  );

  return result.rows.map((row) => ({
    id: row.id,
    postingDate: dateText(row.posting_date),
    documentNo: row.document_no,
    externalDocumentNo: row.external_document_no,
    normalizedOutputType: row.normalized_output_type,
    itemNo: row.item_no,
    itemDescription: row.item_description,
    itemCategoryCode: row.item_category_code,
    machineDescription: row.machine_description,
    machineCenterNo: row.machine_center_no,
    prodLineNo: row.prod_line_no,
    prodLineDescription: row.prod_line_description,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityDisplayName: row.entity_display_name,
    plannedRuntimeHours: row.planned_runtime_hours === null ? null : numberValue(row.planned_runtime_hours),
    shiftCode: row.shift_code,
    operatorName: row.operator_name,
    quantity: numberValue(row.quantity),
    uom: row.uom,
    grossWeightPerPcs: row.gross_weight_per_pcs === null ? null : numberValue(row.gross_weight_per_pcs),
    mappedGrossWeightPerPcs: row.mapped_gross_weight_per_pcs === null ? null : numberValue(row.mapped_gross_weight_per_pcs),
    mappedGrossWeightSource: row.mapped_gross_weight_source === null ? null : "ITEM_CONVERSION_MAPPING",
    rejectKg: numberValue(row.reject_kg),
    rejectPcsEq: row.reject_pcs_eq === null ? null : numberValue(row.reject_pcs_eq)
  }));
}

async function queryDailyItemResumeTargets(pool: DatabasePool, filters: Filters): Promise<DailyItemResumeTarget[]> {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`entity_id = $${params.length}`);
  }
  const result = await pool.query<{
    entity_id: string;
    effective_from: string;
    effective_to: string | null;
    daily_target_qty: string | number;
    status: string | null;
  }>(
    `
      select entity_id, effective_from::text, effective_to::text, daily_target_qty, status
      from production_targets
      ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
      order by entity_id, effective_from desc
    `,
    params
  );
  return result.rows.map((row) => ({
    entityId: row.entity_id,
    effectiveFrom: dateText(row.effective_from),
    effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
    dailyTargetQty: numberValue(row.daily_target_qty),
    status: row.status
  }));
}

async function mappingCoverageSummary(pool: DatabasePool): Promise<MappingCoverageSummary> {
  const result = await pool.query<{
    total_rows: string | number;
    mapped_rows: string | number;
    unmapped_rows: string | number;
    ok_rows: string | number;
    mapped_ok_rows: string | number;
    unmapped_ok_rows: string | number;
    unmapped_ok_qty: string | number | null;
  }>(
    `
      select
        count(*) as total_rows,
        count(*) filter (where entity_id is not null) as mapped_rows,
        count(*) filter (where entity_id is null) as unmapped_rows,
        count(*) filter (where ${okOutputPredicate()}) as ok_rows,
        count(*) filter (where entity_id is not null and ${okOutputPredicate()}) as mapped_ok_rows,
        count(*) filter (where entity_id is null and ${okOutputPredicate()}) as unmapped_ok_rows,
        coalesce(sum(quantity) filter (where entity_id is null and ${okOutputPredicate()}), 0) as unmapped_ok_qty
      from production_outputs
      where source_system = $1
        and ${outputEntryTypePredicate()}
    `,
    [SOURCE_SYSTEM]
  );
  const row = result.rows[0];
  return {
    totalRows: numberValue(row?.total_rows),
    mappedRows: numberValue(row?.mapped_rows),
    unmappedRows: numberValue(row?.unmapped_rows),
    okRows: numberValue(row?.ok_rows),
    mappedOkRows: numberValue(row?.mapped_ok_rows),
    unmappedOkRows: numberValue(row?.unmapped_ok_rows),
    unmappedOkQty: numberValue(row?.unmapped_ok_qty)
  };
}

function mappingCoveragePct(summary: MappingCoverageSummary): number | null {
  return summary.totalRows > 0 ? (summary.mappedRows / summary.totalRows) * 100 : null;
}

async function activeEntityCandidates(pool: DatabasePool): Promise<readonly CandidateEntityInput[]> {
  const result = await pool.query<{
    entity_id: string;
    entity_code: string;
    display_name: string;
    line_code: string | null;
    product_family: string | null;
    report_group: string | null;
    alias_values: string[] | null;
    target_exists: boolean;
  }>(
    `
      select me.id as entity_id,
             me.entity_code,
             me.display_name,
             me.line_code,
             me.product_family,
             me.report_group,
             array_remove(array_agg(distinct mea.alias), null) as alias_values,
             exists (
               select 1
               from production_targets pt
               where pt.entity_id = me.id
                 and pt.status in ('APPROVED', 'ACTIVE')
                 and pt.daily_target_qty > 0
             ) as target_exists
      from master_entities me
      left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active
      where me.is_active
      group by me.id
      order by me.entity_code
      limit 1000
    `
  );
  return result.rows.map((row) => ({
    entityId: row.entity_id,
    entityCode: row.entity_code,
    displayName: row.display_name,
    aliasValues: row.alias_values ?? [],
    targetExists: row.target_exists,
    lineCode: row.line_code,
    productFamily: row.product_family,
    reportGroup: row.report_group
  }));
}

async function queryBusinessCentralCanonicalEntityCatalog(
  pool: DatabasePool
): Promise<BusinessCentralCanonicalEntityCatalog> {
  const result = await pool.query<{
    entity_id: string;
    entity_code: string;
    display_name: string;
    line_code: string | null;
    product_family: string | null;
    report_group: string | null;
    aliases: unknown;
  }>(
    `
      select me.id as entity_id,
             me.entity_code,
             me.display_name,
             me.line_code,
             me.product_family,
             me.report_group,
             coalesce(
               jsonb_agg(
                 distinct jsonb_build_object(
                   'alias', mea.alias,
                   'aliasNormalized', mea.alias_normalized,
                   'sourceSystem', mea.source_system,
                   'sourceField', mea.source_field,
                   'isActive', mea.is_active
                 )
               ) filter (where mea.id is not null),
               '[]'::jsonb
             ) as aliases
      from master_entities me
      left join master_entity_aliases mea
        on mea.entity_id = me.id
       and mea.is_active
       and mea.source_system = $1
      where me.is_active
      group by me.id
      order by me.entity_code
    `,
    [SOURCE_SYSTEM]
  );

  return buildBusinessCentralCanonicalEntityCatalog(result.rows.map((row): BusinessCentralCanonicalEntityInput => ({
    entityId: row.entity_id,
    entityCode: row.entity_code,
    displayName: row.display_name,
    lineCode: row.line_code,
    productFamily: row.product_family,
    reportGroup: row.report_group,
    aliases: parseEntityV2Aliases(row.aliases)
  })));
}

async function queryEntityV2SourceRows(pool: DatabasePool): Promise<readonly EntityV2SourceRow[]> {
  const limit = Number(process.env.ENTITY_V2_DRY_RUN_LIMIT ?? 0);
  const params: unknown[] = [SOURCE_SYSTEM];
  const limitClause = Number.isFinite(limit) && limit > 0 ? "limit $2" : "";
  if (limitClause) params.push(limit);

  const result = await pool.query<{
    entry_no: string | null;
    posting_date: string;
    document_no: string | null;
    item_no: string;
    item_description: string | null;
    item_category_code: string | null;
    quantity: string | number;
    uom: string | null;
    gross_weight: string | number | null;
    entry_type: string | null;
    location_code: string | null;
    g_prod_or_rot_line_no: string | null;
    g_prod_or_rot_line_description: string | null;
    machine_center_no: string | null;
    current_entity_id: string | null;
    current_entity_code: string | null;
    current_entity_display_name: string | null;
  }>(
    `
      select po.entry_no::text,
             po.posting_date::text,
             po.document_no,
             po.item_no,
             po.item_description,
             po.item_category_code,
             po.quantity,
             po.uom,
             po.gross_weight_per_pcs as gross_weight,
             po.entry_type,
             coalesce(
               po.raw_payload ->> 'Location_Code',
               po.raw_payload ->> 'LocationCode',
               po.raw_payload ->> 'location_code'
             ) as location_code,
             po.prod_line_no as g_prod_or_rot_line_no,
             po.prod_line_description as g_prod_or_rot_line_description,
             po.machine_center_no,
             po.entity_id::text as current_entity_id,
             me.entity_code as current_entity_code,
             me.display_name as current_entity_display_name
      from production_outputs po
      left join master_entities me on me.id = po.entity_id
      where po.source_system = $1
      order by po.posting_date asc, po.entry_no asc nulls last, po.id asc
      ${limitClause}
    `,
    params
  );

  return result.rows.map((row) => ({
    entryNo: row.entry_no,
    postingDate: dateText(row.posting_date),
    documentNo: row.document_no,
    itemNo: row.item_no,
    itemDescription: row.item_description,
    itemCategoryCode: row.item_category_code,
    quantity: numberValue(row.quantity),
    uom: row.uom,
    grossWeight: row.gross_weight === null ? null : numberValue(row.gross_weight),
    entryType: row.entry_type,
    locationCode: row.location_code,
    gProdOrRotLineNo: row.g_prod_or_rot_line_no,
    gProdOrRotLineDescription: row.g_prod_or_rot_line_description,
    machineCenterNo: row.machine_center_no,
    currentEntityId: row.current_entity_id,
    currentEntityCode: row.current_entity_code,
    currentEntityDisplayName: row.current_entity_display_name
  }));
}

function buildEntityV2ReportRows(
  sourceRows: readonly EntityV2SourceRow[],
  catalog: BusinessCentralCanonicalEntityCatalog
): readonly EntityV2ReportRow[] {
  const rows = sourceRows.map((row) => {
    const resolution = resolveBusinessCentralEntityV2({
      entryType: row.entryType,
      postingDate: row.postingDate,
      documentNo: row.documentNo,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      locationCode: row.locationCode,
      quantity: row.quantity,
      grossWeight: row.grossWeight,
      gProdOrRotLineNo: row.gProdOrRotLineNo,
      gProdOrRotLineDescription: row.gProdOrRotLineDescription,
      machineCenterNo: row.machineCenterNo
    }, catalog);
    const comparisonStatus = entityV2ComparisonStatus(row.currentEntityCode, resolution.resolvedEntityCode);
    const review = classifyBusinessCentralEntityV2Review({
      comparisonStatus,
      sourceFieldUsed: resolution.sourceFieldUsed,
      sourceValueUsed: resolution.sourceValueUsed,
      currentEntityCode: row.currentEntityCode,
      currentEntityDisplayName: row.currentEntityDisplayName,
      v2EntityCode: resolution.resolvedEntityCode,
      v2EntityDisplayName: resolution.resolvedEntityDisplayName
    });
    const scope = businessCentralScopeFields({
      entryType: row.entryType,
      locationCode: row.locationCode,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      documentNo: row.documentNo,
      quantity: row.quantity,
      unitOfMeasureCode: row.uom,
      grossWeight: row.grossWeight,
      gProdOrRotLineDescription: row.gProdOrRotLineDescription,
      gProdOrRotLineNo: row.gProdOrRotLineNo,
      machineCenterNo: row.machineCenterNo,
      blocksP10BeforeScope: false
    });
    return {
      posting_date: row.postingDate,
      document_no: row.documentNo ?? "",
      entry_no: row.entryNo ?? "",
      item_no: row.itemNo,
      item_description: row.itemDescription ?? "",
      item_category_code: row.itemCategoryCode ?? "",
      quantity: row.quantity,
      unit_of_measure_code: row.uom ?? "",
      gross_weight: row.grossWeight ?? "",
      entry_type: row.entryType ?? "",
      location_code: row.locationCode ?? "",
      g_prod_or_rot_line_no: row.gProdOrRotLineNo ?? "",
      g_prod_or_rot_line_description: row.gProdOrRotLineDescription ?? "",
      machine_center_no: row.machineCenterNo ?? "",
      current_entity_id: row.currentEntityId ?? "",
      current_entity_code: row.currentEntityCode ?? "",
      current_entity_display_name: row.currentEntityDisplayName ?? "",
      v2_entity_code: resolution.resolvedEntityCode ?? "",
      v2_entity_display_name: resolution.resolvedEntityDisplayName ?? "",
      v2_source_field_used: resolution.sourceFieldUsed,
      v2_source_value_used: resolution.sourceValueUsed ?? "",
      v2_confidence: resolution.confidence,
      v2_reason: resolution.reason,
      v2_target_bucket_candidate: resolution.targetBucketCandidate,
      v2_target_routing_evidence: resolution.targetRoutingEvidence,
      comparison_status: comparisonStatus,
      v2_review_classification: review.classification,
      v2_review_reason: review.reason,
      v2_recommended_action: review.recommendedAction,
      v2_suggested_canonical_entity_code: review.suggestedCanonicalEntityCode ?? "",
      v2_suggested_canonical_entity_display_name: review.suggestedCanonicalEntityDisplayName ?? "",
      v2_mismatch_review_type: "",
      v2_mismatch_review_reason: "",
      v2_mismatch_recommended_action: "",
      ...scope
    };
  });
  return addEntityV2MismatchReviews(rows);
}

function summarizeEntityV2ReportRows(
  rows: readonly EntityV2ReportRow[],
  outputFiles: EntityV2Summary["outputFiles"]
): EntityV2Summary {
  const scopeSummary = summarizeBusinessCentralScopeRows({ rows });
  return {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    ...scopeSummary,
    resolvedRows: rows.filter((row) => row.v2_entity_code).length,
    unresolvedRows: rows.filter((row) => !row.v2_entity_code).length,
    sameEntityRows: rows.filter((row) => row.comparison_status === "SAME_ENTITY").length,
    differentEntityRows: rows.filter((row) => row.comparison_status === "DIFFERENT_ENTITY").length,
    currentlyUnmappedButV2Resolved: rows.filter((row) => row.comparison_status === "CURRENT_UNMAPPED_V2_RESOLVED").length,
    currentlyMappedButV2Unmapped: rows.filter((row) => row.comparison_status === "CURRENT_MAPPED_V2_UNMAPPED").length,
    topSourceFieldsUsed: topCounts(rows.map((row) => row.v2_source_field_used)),
    topTargetBucketCandidates: topCounts(rows.map((row) => row.v2_target_bucket_candidate)),
    topMismatchSourceValues: topMismatchSourceValues(rows),
    reviewSummary: entityV2ReviewSummary(rows),
    canonicalCatalogGaps: canonicalCatalogGaps(rows),
    legacyTargetVariantCollapseNeeded: legacyTargetVariantCollapseNeeded(rows),
    topPossibleResolverMismatches: topPossibleResolverMismatches(rows),
    possibleResolverMismatchReview: possibleResolverMismatchReview(rows),
    examplesByFamily: examplesByFamily(rows),
    outputFiles,
    safety: {
      dashboardChanged: false,
      databaseUpdated: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };
}

function addEntityV2MismatchReviews(rows: readonly EntityV2ReportRow[]): readonly EntityV2ReportRow[] {
  const sourceContexts = entityV2SourceValueContexts(rows);
  const machineCenterContexts = entityV2MachineCenterContexts(rows);
  return rows.map((row) => {
    if (row.v2_review_classification !== "POSSIBLE_RESOLVER_MISMATCH") return row;
    const sourceContext = sourceContexts.get(entityV2SourceContextKey(row.v2_source_field_used, row.v2_source_value_used));
    const mismatch = classifyBusinessCentralEntityV2MismatchReview({
      comparisonStatus: row.comparison_status,
      reviewClassification: row.v2_review_classification,
      sourceFieldUsed: row.v2_source_field_used,
      sourceValueUsed: row.v2_source_value_used,
      currentEntityCode: row.current_entity_code,
      currentEntityDisplayName: row.current_entity_display_name,
      v2EntityCode: row.v2_entity_code,
      v2EntityDisplayName: row.v2_entity_display_name,
      currentEntityCodesForSourceValue: sourceContext ? sortedStrings(sourceContext.currentEntityCodes) : [],
      v2EntityCodesForSourceValue: sourceContext ? sortedStrings(sourceContext.v2EntityCodes) : [],
      machineCenterNo: row.machine_center_no,
      machineCenterSourceValues: sortedStrings(machineCenterContexts.get(normalizeAliasKey(row.machine_center_no)) ?? new Set<string>())
    });
    return {
      ...row,
      v2_mismatch_review_type: mismatch.type,
      v2_mismatch_review_reason: mismatch.reason,
      v2_mismatch_recommended_action: mismatch.recommendedAction
    };
  });
}

function entityV2SourceValueContexts(rows: readonly EntityV2ReportRow[]) {
  const contexts = new Map<string, { currentEntityCodes: Set<string>; v2EntityCodes: Set<string> }>();
  for (const row of rows) {
    if (!row.v2_source_value_used) continue;
    const key = entityV2SourceContextKey(row.v2_source_field_used, row.v2_source_value_used);
    const current = contexts.get(key) ?? { currentEntityCodes: new Set<string>(), v2EntityCodes: new Set<string>() };
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.v2_entity_code) current.v2EntityCodes.add(row.v2_entity_code);
    contexts.set(key, current);
  }
  return contexts;
}

function entityV2MachineCenterContexts(rows: readonly EntityV2ReportRow[]) {
  const contexts = new Map<string, Set<string>>();
  for (const row of rows) {
    const machineCenterKey = normalizeAliasKey(row.machine_center_no);
    if (!machineCenterKey || !row.g_prod_or_rot_line_description) continue;
    const current = contexts.get(machineCenterKey) ?? new Set<string>();
    current.add(row.g_prod_or_rot_line_description);
    contexts.set(machineCenterKey, current);
  }
  return contexts;
}

function entityV2SourceContextKey(sourceField: string, sourceValue: string): string {
  return `${sourceField}:${normalizeAliasKey(sourceValue)}`;
}

function parseEntityV2Aliases(value: unknown): readonly BusinessCentralCanonicalEntityAliasInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BusinessCentralCanonicalEntityAliasInput[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const alias = typeof record.alias === "string" ? record.alias : "";
    if (!alias) return [];
    return [{
      alias,
      aliasNormalized: typeof record.aliasNormalized === "string" ? record.aliasNormalized : null,
      sourceSystem: typeof record.sourceSystem === "string" ? record.sourceSystem : null,
      sourceField: typeof record.sourceField === "string" ? record.sourceField : null,
      isActive: typeof record.isActive === "boolean" ? record.isActive : null
    }];
  });
}

function entityV2ComparisonStatus(
  currentEntityCode: string | null,
  v2EntityCode: string | null
): BusinessCentralEntityV2ComparisonStatus {
  if (currentEntityCode && v2EntityCode) {
    return currentEntityCode === v2EntityCode ? "SAME_ENTITY" : "DIFFERENT_ENTITY";
  }
  if (!currentEntityCode && v2EntityCode) return "CURRENT_UNMAPPED_V2_RESOLVED";
  if (currentEntityCode && !v2EntityCode) return "CURRENT_MAPPED_V2_UNMAPPED";
  return "BOTH_UNMAPPED";
}

function entityV2RowsToCsv(rows: readonly EntityV2ReportRow[]): string {
  const lines = [
    entityV2CsvHeaders.join(","),
    ...rows.map((row) => entityV2CsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function csvField(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function businessCentralScopeFields(input: {
  readonly entryType?: string | null;
  readonly locationCode?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly documentNo?: string | null;
  readonly quantity?: number | null;
  readonly unitOfMeasureCode?: string | null;
  readonly grossWeight?: number | null;
  readonly gProdOrRotLineDescription?: string | null;
  readonly gProdOrRotLineNo?: string | null;
  readonly machineCenterNo?: string | null;
  readonly blocksP10BeforeScope?: boolean | null;
}): BusinessCentralScopeReportFields {
  const scope = classifyBusinessCentralDataScope(input);
  return {
    bc_current_kpi_scope: scope.bcCurrentKpiScope,
    bc_future_use_domain: scope.bcFutureUseDomain,
    bc_scope_reason: scope.bcScopeReason,
    bc_scope_evidence_fields: scope.bcScopeEvidenceFields.join("|"),
    bc_entity_source_status: scope.bcEntitySourceStatus,
    blocks_p10_after_scope: scope.blocksP10AfterScope ? "true" : "false"
  };
}

function summarizeBusinessCentralScopeRows<T extends BusinessCentralScopeReportFields>(input: {
  readonly rows: readonly T[];
  readonly isP10BlockingBeforeScope?: (row: T) => boolean;
}): {
  readonly outputKpiOkScopeRows: number;
  readonly outputKpiRejectScopeRows: number;
  readonly outOfCurrentKpiScopeRows: number;
  readonly unknownScopeReviewRows: number;
  readonly futureUseDomainCounts: readonly TopCount[];
  readonly entitySourceBlankButClassifiedRows: number;
  readonly entitySourceBlankUnknownRows: number;
  readonly p10BlockingRowsBeforeScope: number;
  readonly p10BlockingRowsAfterScope: number;
  readonly excludedFromP10ButRetainedRows: number;
} {
  const rows = input.rows;
  const isP10BlockingBeforeScope = input.isP10BlockingBeforeScope ?? (() => false);
  return {
    outputKpiOkScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_OK_SCOPE").length,
    outputKpiRejectScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE").length,
    outOfCurrentKpiScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUT_OF_CURRENT_KPI_SCOPE").length,
    unknownScopeReviewRows: rows.filter((row) => row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW").length,
    futureUseDomainCounts: topCounts(rows.map((row) => row.bc_future_use_domain), 20),
    entitySourceBlankButClassifiedRows: rows.filter((row) => row.bc_entity_source_status === "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED").length,
    entitySourceBlankUnknownRows: rows.filter((row) => row.bc_entity_source_status === "ENTITY_SOURCE_BLANK_UNKNOWN").length,
    p10BlockingRowsBeforeScope: rows.filter(isP10BlockingBeforeScope).length,
    p10BlockingRowsAfterScope: rows.filter((row) => isP10BlockingBeforeScope(row) && row.blocks_p10_after_scope === "true").length,
    excludedFromP10ButRetainedRows: rows.filter((row) => isP10BlockingBeforeScope(row) && row.blocks_p10_after_scope === "false").length
  };
}

function topCounts(values: readonly string[], limit = 10): readonly TopCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || "(blank)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, rows]) => ({ value, rows }))
    .sort((left, right) => right.rows - left.rows || left.value.localeCompare(right.value))
    .slice(0, limit);
}

function topMismatchSourceValues(rows: readonly EntityV2ReportRow[], limit = 10): readonly EntityV2MismatchGroup[] {
  const grouped = new Map<string, {
    sourceField: string;
    sourceValue: string;
    rows: number;
    comparisonStatuses: Set<string>;
    currentEntityCodes: Set<string>;
    v2EntityCodes: Set<string>;
  }>();
  for (const row of rows) {
    if (row.comparison_status === "SAME_ENTITY" || row.comparison_status === "BOTH_UNMAPPED") continue;
    const sourceField = row.v2_source_field_used;
    const sourceValue = row.v2_source_value_used || "(blank)";
    const key = `${sourceField}:${sourceValue}`;
    const current = grouped.get(key) ?? {
      sourceField,
      sourceValue,
      rows: 0,
      comparisonStatuses: new Set<string>(),
      currentEntityCodes: new Set<string>(),
      v2EntityCodes: new Set<string>()
    };
    current.rows += 1;
    current.comparisonStatuses.add(row.comparison_status);
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.v2_entity_code) current.v2EntityCodes.add(row.v2_entity_code);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((group) => ({
      sourceField: group.sourceField,
      sourceValue: group.sourceValue,
      rows: group.rows,
      comparisonStatuses: sortedStrings(group.comparisonStatuses),
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      v2EntityCodes: sortedStrings(group.v2EntityCodes)
    }))
    .sort((left, right) => right.rows - left.rows || left.sourceField.localeCompare(right.sourceField) || left.sourceValue.localeCompare(right.sourceValue))
    .slice(0, limit);
}

function entityV2ReviewSummary(rows: readonly EntityV2ReportRow[]): EntityV2ReviewSummary {
  return {
    okSameEntityRows: countReview(rows, "OK_SAME_ENTITY"),
    okBothUnmappedRows: countReview(rows, "OK_BOTH_UNMAPPED"),
    canonicalCatalogGapRows: countReview(rows, "CANONICAL_CATALOG_GAP"),
    legacyTargetVariantCollapseNeededRows: countReview(rows, "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED"),
    possibleResolverMismatchRows: countReview(rows, "POSSIBLE_RESOLVER_MISMATCH"),
    possibleDataSourceGapRows: countReview(rows, "POSSIBLE_DATA_SOURCE_GAP"),
    unknownReviewNeededRows: countReview(rows, "UNKNOWN_REVIEW_NEEDED")
  };
}

function countReview(
  rows: readonly EntityV2ReportRow[],
  classification: BusinessCentralEntityV2ReviewClassification
): number {
  return rows.filter((row) => row.v2_review_classification === classification).length;
}

function canonicalCatalogGaps(rows: readonly EntityV2ReportRow[]): readonly EntityV2CanonicalCatalogGap[] {
  return groupedReviewRows(rows, "CANONICAL_CATALOG_GAP").map((group) => ({
    sourceField: group.sourceField,
    sourceValue: group.sourceValue,
    rows: group.rows,
    currentEntityCodes: group.currentEntityCodes,
    suggestedCanonicalEntityCode: group.suggestedCanonicalEntityCode,
    suggestedCanonicalEntityDisplayName: group.suggestedCanonicalEntityDisplayName,
    reason: group.reason,
    recommendedAction: group.recommendedAction
  }));
}

function legacyTargetVariantCollapseNeeded(
  rows: readonly EntityV2ReportRow[]
): readonly EntityV2LegacyTargetVariantCollapseGroup[] {
  return groupedReviewRows(rows, "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED").map((group) => ({
    sourceField: group.sourceField,
    sourceValue: group.sourceValue,
    rows: group.rows,
    currentEntityCodes: group.currentEntityCodes,
    suggestedCanonicalEntityCode: group.suggestedCanonicalEntityCode,
    suggestedCanonicalEntityDisplayName: group.suggestedCanonicalEntityDisplayName,
    recommendedFuturePhase: "P0.8/P0.9",
    reason: group.reason,
    recommendedAction: group.recommendedAction
  }));
}

function groupedReviewRows(
  rows: readonly EntityV2ReportRow[],
  classification: BusinessCentralEntityV2ReviewClassification
) {
  const grouped = new Map<string, {
    sourceField: string;
    sourceValue: string;
    rows: number;
    currentEntityCodes: Set<string>;
    suggestedCanonicalEntityCode: string;
    suggestedCanonicalEntityDisplayName: string;
    reason: string;
    recommendedAction: string;
  }>();
  for (const row of rows) {
    if (row.v2_review_classification !== classification) continue;
    const sourceField = row.v2_source_field_used;
    const sourceValue = row.v2_source_value_used || "(blank)";
    const key = `${sourceField}:${sourceValue}`;
    const current = grouped.get(key) ?? {
      sourceField,
      sourceValue,
      rows: 0,
      currentEntityCodes: new Set<string>(),
      suggestedCanonicalEntityCode: row.v2_suggested_canonical_entity_code,
      suggestedCanonicalEntityDisplayName: row.v2_suggested_canonical_entity_display_name,
      reason: row.v2_review_reason,
      recommendedAction: row.v2_recommended_action
    };
    current.rows += 1;
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((group) => ({
      sourceField: group.sourceField,
      sourceValue: group.sourceValue,
      rows: group.rows,
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      suggestedCanonicalEntityCode: group.suggestedCanonicalEntityCode,
      suggestedCanonicalEntityDisplayName: group.suggestedCanonicalEntityDisplayName,
      reason: group.reason,
      recommendedAction: group.recommendedAction
    }))
    .sort((left, right) => right.rows - left.rows || left.sourceField.localeCompare(right.sourceField) || left.sourceValue.localeCompare(right.sourceValue));
}

function topPossibleResolverMismatches(rows: readonly EntityV2ReportRow[]): readonly EntityV2TopPossibleResolverMismatch[] {
  return groupPossibleResolverMismatchRows(rows).slice(0, 10).map((group) => ({
    sourceField: group.sourceField,
    sourceValue: group.sourceValue,
    rows: group.rows,
    mismatchReviewType: group.mismatchReviewType,
    currentEntityCodes: group.currentEntityCodes,
    v2EntityCodes: group.v2EntityCodes,
    recommendedReviewAction: group.recommendedReviewAction
  }));
}

function possibleResolverMismatchReview(rows: readonly EntityV2ReportRow[]): EntityV2PossibleResolverMismatchReview {
  const groups = groupPossibleResolverMismatchRows(rows);
  return {
    totalRows: rows.filter((row) => row.v2_review_classification === "POSSIBLE_RESOLVER_MISMATCH").length,
    truncated: groups.length > 50,
    groups: groups.slice(0, 50)
  };
}

function groupPossibleResolverMismatchRows(rows: readonly EntityV2ReportRow[]): readonly EntityV2PossibleResolverMismatchGroup[] {
  const grouped = new Map<string, {
    sourceField: string;
    sourceValue: string;
    rows: number;
    currentEntityCodes: Set<string>;
    v2EntityCodes: Set<string>;
    targetBucketCandidates: Set<string>;
    machineCenterNos: Set<string>;
    itemCategoryCodes: Set<string>;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
    mismatchReviewTypes: Map<BusinessCentralEntityV2MismatchReviewType, number>;
    reviewReasons: Map<BusinessCentralEntityV2MismatchReviewType, string>;
    recommendedActions: Map<BusinessCentralEntityV2MismatchReviewType, string>;
  }>();

  for (const row of rows) {
    if (row.v2_review_classification !== "POSSIBLE_RESOLVER_MISMATCH") continue;
    const sourceField = row.v2_source_field_used;
    const sourceValue = row.v2_source_value_used || "(blank)";
    const key = `${sourceField}:${normalizeAliasKey(sourceValue)}`;
    const current = grouped.get(key) ?? {
      sourceField,
      sourceValue,
      rows: 0,
      currentEntityCodes: new Set<string>(),
      v2EntityCodes: new Set<string>(),
      targetBucketCandidates: new Set<string>(),
      machineCenterNos: new Set<string>(),
      itemCategoryCodes: new Set<string>(),
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>(),
      mismatchReviewTypes: new Map<BusinessCentralEntityV2MismatchReviewType, number>(),
      reviewReasons: new Map<BusinessCentralEntityV2MismatchReviewType, string>(),
      recommendedActions: new Map<BusinessCentralEntityV2MismatchReviewType, string>()
    };
    current.rows += 1;
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.v2_entity_code) current.v2EntityCodes.add(row.v2_entity_code);
    if (row.v2_target_bucket_candidate) current.targetBucketCandidates.add(row.v2_target_bucket_candidate);
    if (row.machine_center_no) current.machineCenterNos.add(row.machine_center_no);
    if (row.item_category_code) current.itemCategoryCodes.add(row.item_category_code);
    if (row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.document_no);
    if (row.item_no && current.sampleItems.size < 5) current.sampleItems.add(row.item_no);
    const reviewType = row.v2_mismatch_review_type || "UNKNOWN_MISMATCH_REVIEW";
    current.mismatchReviewTypes.set(reviewType, (current.mismatchReviewTypes.get(reviewType) ?? 0) + 1);
    if (!current.reviewReasons.has(reviewType)) current.reviewReasons.set(reviewType, row.v2_mismatch_review_reason);
    if (!current.recommendedActions.has(reviewType)) current.recommendedActions.set(reviewType, row.v2_mismatch_recommended_action);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => {
      const mismatchReviewType = dominantMismatchReviewType(group.mismatchReviewTypes);
      return {
        sourceField: group.sourceField,
        sourceValue: group.sourceValue,
        rows: group.rows,
        currentEntityCodes: sortedStrings(group.currentEntityCodes),
        v2EntityCodes: sortedStrings(group.v2EntityCodes),
        targetBucketCandidates: sortedStrings(group.targetBucketCandidates),
        machineCenterNos: sortedStrings(group.machineCenterNos),
        itemCategoryCodes: sortedStrings(group.itemCategoryCodes),
        sampleDocuments: [...group.sampleDocuments],
        sampleItems: [...group.sampleItems],
        mismatchReviewType,
        reviewReason: group.reviewReasons.get(mismatchReviewType) ?? "",
        recommendedReviewAction: group.recommendedActions.get(mismatchReviewType) ?? "",
        riskLevel: mismatchReviewRiskLevel(mismatchReviewType)
      };
    })
    .sort((left, right) => right.rows - left.rows || left.sourceField.localeCompare(right.sourceField) || left.sourceValue.localeCompare(right.sourceValue));
}

function dominantMismatchReviewType(
  values: ReadonlyMap<BusinessCentralEntityV2MismatchReviewType, number>
): BusinessCentralEntityV2MismatchReviewType {
  return [...values.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "UNKNOWN_MISMATCH_REVIEW";
}

function mismatchReviewRiskLevel(
  type: BusinessCentralEntityV2MismatchReviewType
): BusinessCentralEntityV2MismatchRiskLevel {
  if (type === "POSSIBLE_TRUE_RESOLVER_BUG") return "HIGH";
  if (type === "LEGACY_NAME_VARIANT" || type === "TARGET_VARIANT_NAME_COLLISION") return "LOW";
  return "MEDIUM";
}

function examplesByFamily(rows: readonly EntityV2ReportRow[]): Record<EntityV2ExampleFamily, readonly EntityV2Example[]> {
  const families = ["OMSO", "VFINE", "ILLIG", "REPACKING", "NEWDO", "CAI"] as const;
  const examples = Object.fromEntries(families.map((family) => [family, []])) as Record<EntityV2ExampleFamily, EntityV2Example[]>;
  for (const row of rows) {
    const text = normalizeAliasDisplay([
      row.g_prod_or_rot_line_description,
      row.g_prod_or_rot_line_no,
      row.machine_center_no,
      row.current_entity_code,
      row.current_entity_display_name,
      row.v2_entity_code,
      row.v2_entity_display_name,
      row.item_description
    ].filter(Boolean).join(" "));
    for (const family of families) {
      if (examples[family].length >= 5 || !text.includes(family)) continue;
      examples[family].push({
        postingDate: row.posting_date,
        documentNo: row.document_no,
        itemNo: row.item_no,
        itemDescription: row.item_description,
        sourceField: row.v2_source_field_used,
        sourceValue: row.v2_source_value_used,
        currentEntityCode: row.current_entity_code,
        v2EntityCode: row.v2_entity_code,
        comparisonStatus: row.comparison_status,
        targetBucketCandidate: row.v2_target_bucket_candidate
      });
    }
  }
  return examples;
}

function sortedStrings(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function fetchUnmappedSourceGroups(
  pool: DatabasePool,
  limit: number,
  entities: readonly CandidateEntityInput[]
): Promise<readonly UnmappedSourceGroup[]> {
  const result = await pool.query<{
    source_field: MasterSourceField;
    source_value: string | null;
    normalized_value: string;
    rows: string | number;
    ok_qty: string | number;
    first_posting_date: string | null;
    last_posting_date: string | null;
  }>(
    `
      with source_rows as (
        select ${preferredEntitySourceFieldSql("po")}::text as source_field,
               ${preferredEntitySourceValueSql("po")} as source_value,
               po.posting_date,
               po.quantity
        from production_outputs po
        where po.source_system = $1 and ${outputEntryTypePredicate("po")} and po.entity_id is null and ${okOutputPredicate("po")}
      )
      select source_field,
             coalesce(source_value, '') as source_value,
             upper(regexp_replace(trim(coalesce(source_value, '')), '[^A-Za-z0-9]+', '', 'g')) as normalized_value,
             count(*) as rows,
             coalesce(sum(quantity), 0) as ok_qty,
             min(posting_date)::text as first_posting_date,
             max(posting_date)::text as last_posting_date
      from source_rows
      where source_field <> 'blank'
      group by source_field, coalesce(source_value, '')
      order by ok_qty desc, rows desc
      limit $2
    `,
    [SOURCE_SYSTEM, limit]
  );
  return result.rows.map((row) => ({
    sourceField: row.source_field,
    sourceValue: row.source_value ?? "",
    normalizedValue: row.normalized_value,
    rows: numberValue(row.rows),
    okQty: numberValue(row.ok_qty),
    firstPostingDate: row.first_posting_date,
    lastPostingDate: row.last_posting_date,
    suggestions: suggestMappingCandidates(row.source_value ?? "", entities)
  }));
}

async function previewMappingPlanRow(pool: DatabasePool, row: Pick<MappingPlanRow, "source_field" | "source_value" | "suggested_entity_id">) {
  const sourceColumn = sourceFieldColumn(row.source_field);
  const normalized = normalizeAliasKey(row.source_value);
  return pool.query<{
    affected_rows: string | number;
    already_mapped_rows: string | number;
    ok_qty: string | number | null;
    target_covered_rows: string | number;
  }>(
    `
      select
        count(*) filter (where po.entity_id is null) as affected_rows,
        count(*) filter (where po.entity_id is not null) as already_mapped_rows,
        coalesce(sum(po.quantity) filter (where po.entity_id is null and ${okOutputPredicate("po")}), 0) as ok_qty,
        count(*) filter (
          where po.entity_id is null
            and ${okOutputPredicate("po")}
            and exists (
              select 1
              from production_targets pt
              where pt.entity_id = $3::uuid
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.daily_target_qty > 0
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            )
        ) as target_covered_rows
      from production_outputs po
      where po.source_system = $1
        and ${sqlNormalizeExpression(`po.${sourceColumn}`)} = $2
    `,
    [SOURCE_SYSTEM, normalized, row.suggested_entity_id]
  ).then((result) => ({
    affectedRows: numberValue(result.rows[0]?.affected_rows),
    alreadyMappedRows: numberValue(result.rows[0]?.already_mapped_rows),
    okQty: numberValue(result.rows[0]?.ok_qty),
    targetCoveredRows: numberValue(result.rows[0]?.target_covered_rows)
  }));
}

function printCoverageSummary(summary: MappingCoverageSummary) {
  console.log(
    `Rows: total=${formatNumber(summary.totalRows, 0)}; mapped=${formatNumber(summary.mappedRows, 0)}; unmapped=${formatNumber(summary.unmappedRows, 0)}; coverage=${formatPct(mappingCoveragePct(summary))}`
  );
  console.log(
    `OK rows: total=${formatNumber(summary.okRows, 0)}; mapped=${formatNumber(summary.mappedOkRows, 0)}; unmapped=${formatNumber(summary.unmappedOkRows, 0)}; unmapped_ok_qty=${formatNumber(summary.unmappedOkQty, 2)}`
  );
}

async function printEntitySourceUsage(pool: DatabasePool, title = "Entity source usage") {
  await printRows(
    title,
    pool.query(
      `
        select ${preferredEntitySourceFieldSql("po")} as source_field,
               count(*) as rows,
               count(*) filter (where po.entity_id is null) as unmapped_rows,
               coalesce(sum(po.quantity) filter (where ${okOutputPredicate("po")}), 0) as ok_qty
        from production_outputs po
        where po.source_system = $1
          and ${outputEntryTypePredicate("po")}
        group by 1
        order by rows desc, source_field asc
      `,
      [SOURCE_SYSTEM]
    )
  );
}

async function runProfile(pool: ReturnType<typeof createDatabase>["pool"]) {
  console.log("Business Central profile");
  console.log(`Source system: ${SOURCE_SYSTEM}`);

  const totals = await pool.query<{
    total_rows: string | number;
    min_posting_date: string | null;
    max_posting_date: string | null;
    ok_rows: string | number;
    reject_rows: string | number;
    unmapped_rows: string | number;
    conversion_gaps: string | number;
  }>(`
    select
      count(*) as total_rows,
      min(posting_date)::text as min_posting_date,
      max(posting_date)::text as max_posting_date,
      count(*) filter (where ${okOutputPredicate()}) as ok_rows,
      count(*) filter (where ${rejectOutputPredicate()}) as reject_rows,
      count(*) filter (where entity_id is null) as unmapped_rows,
      count(*) filter (where ${rejectOutputPredicate()} and (gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)) as conversion_gaps
    from production_outputs
    where source_system = $1
  `, [SOURCE_SYSTEM]);
  const total = totals.rows[0];
  console.log(
    `Rows: ${total?.total_rows ?? 0}; posting date range: ${total?.min_posting_date ?? "N/A"} to ${total?.max_posting_date ?? "N/A"}`
  );
  console.log(
    `OK rows: ${total?.ok_rows ?? 0}; reject rows: ${total?.reject_rows ?? 0}; unmapped rows: ${total?.unmapped_rows ?? 0}; conversion gaps: ${total?.conversion_gaps ?? 0}`
  );

  await printRows(
    "Rows by source system",
    pool.query("select source_system, count(*) as rows from production_outputs group by source_system order by rows desc")
  );
  await printRows(
    "Rows by month",
    pool.query(
      `select date_trunc('month', posting_date)::date::text as month, count(*) as rows
       from production_outputs
       where source_system = $1
       group by 1
       order by 1`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Rows by Entry_Type",
    pool.query(
      `select coalesce(entry_type, '(blank)') as entry_type, count(*) as rows
       from production_outputs
       where source_system = $1
       group by 1
       order by rows desc, entry_type asc
       limit 20`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Rows by item/UOM output classification",
    pool.query(
      `select ${outputClassCase()} as output_class, count(*) as rows, coalesce(sum(quantity), 0) as quantity
       from production_outputs
       where source_system = $1
       group by 1
       order by rows desc, output_class asc`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Top unmapped preferred source output",
    pool.query(
      `select ${preferredEntitySourceFieldSql("po")} as source_field,
              coalesce(${preferredEntitySourceValueSql("po")}, '(blank)') as source_value,
              count(*) as rows,
              coalesce(sum(case when ${okOutputPredicate("po")} then po.quantity else 0 end), 0) as ok_qty
       from production_outputs po
       where po.source_system = $1 and po.entity_id is null
       group by 1, 2
       order by ok_qty desc, rows desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Top mapped entities by OK quantity",
    pool.query(
      `select me.entity_code,
              me.display_name,
              count(*) as rows,
              coalesce(sum(po.quantity), 0) as ok_qty
       from production_outputs po
       inner join master_entities me on me.id = po.entity_id
       where po.source_system = $1 and ${okOutputPredicate("po")}
       group by me.entity_code, me.display_name
       order by ok_qty desc, rows desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows(
    "Alias coverage by source field",
    pool.query(
      `select source_field,
              count(*) filter (where is_active) as active_aliases,
              count(*) as total_aliases
       from master_entity_aliases
       where source_system = $1
       group by source_field
       order by source_field`,
      [SOURCE_SYSTEM]
    )
  );
  await printEntitySourceUsage(pool);
  await printRows(
    "Top items by OK quantity",
    pool.query(
      `select item_no,
              left(coalesce(max(item_description), ''), 60) as item_description,
              count(*) as rows,
              coalesce(sum(quantity), 0) as ok_qty
       from production_outputs
       where source_system = $1 and ${okOutputPredicate()}
       group by item_no
       order by ok_qty desc
       limit 15`,
      [SOURCE_SYSTEM]
    )
  );
  await printRows("Target coverage summary", targetCoverageSummary(pool));
  await printRows("Conversion gaps by item/UOM", conversionGapSummary(pool));
}

async function runReconcile(pool: ReturnType<typeof createDatabase>["pool"]) {
  const filters = buildFilters();
  const where = outputWhere(filters);
  console.log("Business Central dashboard reconciliation");
  console.log(`Window: ${filters.from} to ${filters.to}`);
  if (filters.entityId) console.log(`Entity filter: ${filters.entityId}`);
  if (filters.itemNo) console.log(`Item filter: ${filters.itemNo}`);

  const [aggregate, activeDays, targets, latestSync, sourceRows] = await Promise.all([
    pool.query<{
      output_ok_qty: string | number | null;
      raw_ok_qty: string | number | null;
      reject_kg: string | number | null;
      reject_pcs_equivalent: string | number | null;
      incomplete_reject_conversion_count: string | number | null;
      active_days: string | number | null;
      ok_rows: string | number;
      reject_rows: string | number;
      reject_conversion_complete_count: string | number;
      raw_rows: string | number;
      excluded_rows: string | number;
    }>(
      `
        select
          coalesce(sum(case when ${okOutputPredicate()} then quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as raw_ok_qty,
          coalesce(sum(${rejectKgExpression()}), 0) as reject_kg,
          coalesce(sum(${rejectPcsEqExpression()}), 0) as reject_pcs_equivalent,
          count(*) filter (where ${rejectOutputPredicate()} and (gross_weight_per_pcs is null or gross_weight_per_pcs <= 0)) as incomplete_reject_conversion_count,
          count(distinct posting_date) filter (where ${okOutputPredicate()}) as active_days,
          count(*) filter (where ${okOutputPredicate()}) as ok_rows,
          count(*) filter (where ${rejectOutputPredicate()}) as reject_rows,
          count(*) filter (where ${rejectOutputPredicate()} and gross_weight_per_pcs > 0) as reject_conversion_complete_count,
          count(*) as raw_rows,
          count(*) filter (where not (${okOutputPredicate()})) as excluded_rows
        from production_outputs
        where ${where.where}
      `,
      where.params
    ),
    pool.query<{ entity_id: string; posting_date: string }>(
      `
        select entity_id, posting_date::text
        from production_outputs
        where ${where.where}
          and entity_id is not null
          and ${okOutputPredicate()}
        group by entity_id, posting_date
      `,
      where.params
    ),
    pool.query<{
      entity_id: string;
      effective_from: string;
      effective_to: string | null;
      daily_target_qty: string | number;
      min_achievement_pct: string | number;
      max_achievement_pct: string | number;
    }>(
      `
        select entity_id,
               effective_from::text,
               effective_to::text,
               daily_target_qty,
               min_achievement_pct,
               max_achievement_pct
        from production_targets
        where effective_from <= $1
          and (effective_to is null or effective_to >= $2)
          and status in ('APPROVED', 'ACTIVE')
          ${filters.entityId ? "and entity_id = $3" : ""}
      `,
      filters.entityId ? [filters.to, filters.from, filters.entityId] : [filters.to, filters.from]
    ),
    pool.query<{ finished_at: Date | null }>(
      `
        select finished_at
        from sync_runs
        where source_system = $1
          and status = 'SUCCESS'
          and ($2::boolean = false or (source_url is not null and source_url not like 'mock://%'))
        order by finished_at desc
        limit 1
      `,
      [SOURCE_SYSTEM, process.env.ODATA_SYNC_MODE === "live"]
    ),
    queryDailyItemResumeSourceRows(pool, filters)
  ]);

  const row = aggregate.rows[0];
  const conversionRows = buildDailyItemResume(sourceRows, [], {
    from: filters.from,
    to: filters.to,
    sourceSystem: SOURCE_SYSTEM,
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.itemNo ? { itemNo: filters.itemNo } : {}),
    page: 1,
    pageSize: Math.max(sourceRows.length, 1),
    sort: "postingDate.desc"
  }).rows;
  const conversionTotals = summarizeDailyItemResumeRejectConversions(conversionRows);
  const coverage = computeCoverage(activeDays.rows, targets.rows);
  const kpis = buildDashboardKpiSummary({
    outputOkQty: numberValue(row?.output_ok_qty),
    rejectKg: numberValue(row?.reject_kg),
    rejectPcsEquivalent: conversionTotals.rejectPcsEquivalent,
    prorataTarget: coverage.prorataTarget,
    hasTarget: coverage.hasTarget,
    activeDays: numberValue(row?.active_days),
    incompleteRejectConversionCount: conversionTotals.incompleteCount,
    latestSuccessfulSyncFinishedAt: latestSync.rows[0]?.finished_at ?? null,
    now: new Date(),
    ...(coverage.minAchievementPct ? { minAchievementPct: coverage.minAchievementPct } : {}),
    ...(coverage.maxAchievementPct ? { maxAchievementPct: coverage.maxAchievementPct } : {})
  });
  const rawOk = numberValue(row?.raw_ok_qty);
  const warnings: string[] = [];
  if (Math.abs(kpis.outputOkQty - rawOk) > 0.0001) warnings.push("Dashboard OK output differs from raw OK aggregate.");
  if (kpis.targetStatusReason === "TARGET_MISSING" && coverage.activeEntityDays > 0) {
    warnings.push("Achievement is N/A because one or more active entity-days have no approved/active target.");
  } else if (kpis.targetStatusReason === "TARGET_MISSING") {
    warnings.push("Achievement is N/A because OK output has no mapped active entity-days for target matching.");
  }
  if (kpis.rejectConversionStatus === "INCOMPLETE") warnings.push("Reject PCS equivalent is incomplete because one or more reject rows lack a safe OK-item gross weight conversion.");
  if (coverage.activeEntityDays === 0 && kpis.outputOkQty > 0) warnings.push("OK output exists but no rows are mapped to a master entity, so target coverage cannot be calculated.");

  console.log(`Dashboard OK output: ${formatNumber(kpis.outputOkQty, 4)}`);
  console.log(`Raw OK output: ${formatNumber(rawOk, 4)}`);
  console.log(`Target: ${coverage.hasTarget ? formatNumber(kpis.prorataTarget, 4) : "N/A"}`);
  console.log(`Target reason: ${kpis.targetStatusReason ?? "OK"}`);
  console.log(`Achievement: ${formatPct(kpis.achievementPct)}`);
  console.log(`Reject KG: ${formatNumber(kpis.rejectKg, 4)}`);
  console.log(`Reject PCS equivalent: ${formatNumber(kpis.rejectPcsEquivalent, 4)}`);
  console.log(`Reject conversion status: ${kpis.rejectConversionStatus}; gaps: ${kpis.incompleteRejectConversionCount}`);
  console.log(`Reject rate: ${formatPct(kpis.rejectRatePct)}`);
  console.log(`OK rows count: ${row?.ok_rows ?? 0}; reject rows count: ${row?.reject_rows ?? 0}`);
  console.log(`Reject PCS Eq complete/incomplete count: ${conversionTotals.completeCount}/${conversionTotals.incompleteCount}`);
  console.log(`Raw rows in window: ${row?.raw_rows ?? 0}; excluded from OK KPI: ${row?.excluded_rows ?? 0}`);
  console.log(`Active entity-days: ${coverage.activeEntityDays}; missing target entity-days: ${coverage.missingTargetEntityDays}`);
  console.log(
    `Freshness: ${kpis.dataFreshnessStatus}; latest successful sync: ${latestSync.rows[0]?.finished_at?.toISOString() ?? "N/A"}`
  );
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  } else {
    console.log("Warnings: none");
  }
}

function topResumeValues(
  rows: readonly DailyItemResumeRow[],
  pickLabel: (row: DailyItemResumeRow) => string,
  limit = 3
): string {
  const grouped = new Map<string, { rows: number; netOutput: number }>();
  for (const row of rows) {
    const label = pickLabel(row) || "N/A";
    const current = grouped.get(label) ?? { rows: 0, netOutput: 0 };
    current.rows += 1;
    current.netOutput += row.netOutputQty;
    grouped.set(label, current);
  }
  const values = [...grouped.entries()]
    .sort((left, right) => right[1].rows - left[1].rows || Math.abs(right[1].netOutput) - Math.abs(left[1].netOutput) || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, value]) => `${label} (${value.rows} rows, net=${formatNumber(value.netOutput, 2)})`);
  return values.length ? values.join(" | ") : "none";
}

function sampleResumeRows(rows: readonly DailyItemResumeRow[], limit = 3): string {
  const samples = rows.slice(0, limit).map((row) => (
    `${row.postingDate}; machine_display=${row.machineDisplay}; machine_label=${row.machineLabel}; ${row.itemNo}; net=${formatNumber(row.netOutputQty, 2)}; bucket=${row.targetBucketLabel ?? row.targetBucket ?? "N/A"}; target=${row.dailyTarget ?? "N/A"}`
  ));
  return samples.length ? samples.join(" | ") : "none";
}

function rejectAttachmentStatus(detail: Record<string, unknown>): DailyItemResumeRejectAttachmentStatus | null {
  const status = typeof detail.attachmentStatus === "string" ? detail.attachmentStatus : "";
  if (status === "NONE" || DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES.includes(status as Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">)) {
    return status as DailyItemResumeRejectAttachmentStatus;
  }
  return null;
}

function rejectAttachmentCandidates(detail: Record<string, unknown>): readonly Record<string, unknown>[] {
  return Array.isArray(detail.attachmentCandidates)
    ? detail.attachmentCandidates.filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === "object")
    : [];
}

function rejectConversionGapReason(detail: Record<string, unknown>): typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number] | null {
  const reason = typeof detail.conversionGapReason === "string" ? detail.conversionGapReason : "";
  return DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS.includes(reason as typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number])
    ? reason as typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number]
    : null;
}

function buildRejectAttachmentStatusBreakdown(rows: readonly DailyItemResumeRow[]) {
  const breakdown = new Map<Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">, { rejectRows: number; groups: number; rejectKg: number }>();
  for (const status of DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES) {
    breakdown.set(status, { rejectRows: 0, groups: 0, rejectKg: 0 });
  }
  for (const row of rows) {
    const groupStatuses = new Set<Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">>();
    for (const detail of row.rejectDetails) {
      const status = rejectAttachmentStatus(detail);
      if (!status || status === "NONE") continue;
      const current = breakdown.get(status);
      if (!current) continue;
      current.rejectRows += 1;
      current.rejectKg += numberValue(detail.rejectKg as string | number | null | undefined);
      groupStatuses.add(status);
    }
    for (const status of groupStatuses) {
      const current = breakdown.get(status);
      if (current) current.groups += 1;
    }
  }
  return breakdown;
}

function buildRejectConversionGapBreakdown(rows: readonly DailyItemResumeRow[]) {
  const breakdown = new Map<typeof DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS[number], { rows: number; rejectKg: number }>();
  for (const reason of DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS) {
    breakdown.set(reason, { rows: 0, rejectKg: 0 });
  }
  for (const row of rows) {
    for (const detail of row.rejectDetails) {
      if (detail.conversionStatus !== "INCOMPLETE") continue;
      const reason = rejectConversionGapReason(detail) ?? "MISSING_OK_GROSS_WEIGHT";
      const current = breakdown.get(reason);
      if (!current) continue;
      current.rows += 1;
      current.rejectKg += numberValue(detail.rejectKg as string | number | null | undefined);
    }
  }
  return breakdown;
}

function printDailyItemResumeTargetBreakdown(rows: readonly DailyItemResumeRow[]) {
  console.log("");
  console.log("Target reason breakdown:");
  const summaries = summarizeDailyItemResumeTargetReasons(rows);
  for (const reason of DAILY_ITEM_RESUME_TARGET_REASONS) {
    const summary = summaries.find((item) => item.reason === reason);
    const reasonRows = rows.filter((row) => row.targetReason === reason);
    console.log(`- ${reason}: rows=${summary?.rowCount ?? 0}; net_output=${formatNumber(summary?.netOutputQty ?? 0, 4)}`);
    console.log(`  top_machines=${topResumeValues(reasonRows, (row) => row.machineLabel)}`);
    console.log(`  top_items=${topResumeValues(reasonRows, (row) => row.itemNo)}`);
    console.log(`  samples=${sampleResumeRows(reasonRows)}`);
  }
}

async function runDailyItemResume(pool: DatabasePool) {
  const baseFilters = buildFilters();
  const filters: DailyItemResumeFilters = {
    ...baseFilters,
    sourceSystem: SOURCE_SYSTEM,
    page: 1,
    pageSize: 20,
    sort: "postingDate.desc"
  };
  const [sourceRows, targets] = await Promise.all([
    queryDailyItemResumeSourceRows(pool, baseFilters),
    queryDailyItemResumeTargets(pool, baseFilters)
  ]);
  const resume = buildDailyItemResume(sourceRows, targets, filters);
  const allRows = buildDailyItemResume(sourceRows, targets, { ...filters, pageSize: Math.max(1, sourceRows.length) }).rows;
  const classificationCounts = sourceRows.reduce(
    (acc, row) => {
      const classification = classifyOutputRow({ entryType: "Output", itemNo: row.itemNo, uom: row.uom });
      if (classification === "OK") acc.okRows += 1;
      else if (classification === "REJECT") acc.rejectRows += 1;
      else acc.unknownRows += 1;
      return acc;
    },
    { okRows: 0, rejectRows: 0, unknownRows: 0 }
  );
  const totals = allRows.reduce(
    (acc, row) => ({
      netOutput: acc.netOutput + row.netOutputQty,
      positiveOutput: acc.positiveOutput + row.positiveOutputQty,
      correctionOutput: acc.correctionOutput + row.correctionOutputQty,
      rejectAttachedCount: acc.rejectAttachedCount + row.rejectDetails.filter((detail) => {
        const status = rejectAttachmentStatus(detail);
        return status ? isAttachedDailyItemResumeRejectAttachmentStatus(status) : false;
      }).length,
      rejectOnlyGroupCount: acc.rejectOnlyGroupCount + (row.rejectAttachmentStatus === "REJECT_ONLY" ? 1 : 0),
      ambiguousRejectAttachmentCount: acc.ambiguousRejectAttachmentCount + (row.rejectAttachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT" ? 1 : 0),
      totalRejectKg: acc.totalRejectKg + row.rejectKg,
      conversionCompleteCount: acc.conversionCompleteCount + row.rejectDetails.filter((detail) => detail.conversionStatus === "COMPLETE").length,
      conversionGaps: acc.conversionGaps + row.rejectDetails.filter((detail) => detail.conversionStatus === "INCOMPLETE").length,
      targetMissingCount: acc.targetMissingCount + (row.dailyTarget === null ? 1 : 0),
      targetNonMatchedCount: acc.targetNonMatchedCount + (row.targetReason === "TARGET_MATCHED" ? 0 : 1)
    }),
    { netOutput: 0, positiveOutput: 0, correctionOutput: 0, rejectAttachedCount: 0, rejectOnlyGroupCount: 0, ambiguousRejectAttachmentCount: 0, totalRejectKg: 0, conversionCompleteCount: 0, conversionGaps: 0, targetMissingCount: 0, targetNonMatchedCount: 0 }
  );
  const rejectAttachmentBreakdown = buildRejectAttachmentStatusBreakdown(allRows);
  const rejectConversionGapBreakdown = buildRejectConversionGapBreakdown(allRows);

  console.log("Business Central daily item resume");
  console.log(`Window: ${baseFilters.from} to ${baseFilters.to}`);
  console.log(`Raw Output row count: ${sourceRows.length}`);
  console.log(`OK rows count: ${classificationCounts.okRows}`);
  console.log(`Reject rows count: ${classificationCounts.rejectRows}`);
  console.log(`Unknown/mismatch output rows count: ${classificationCounts.unknownRows}`);
  console.log(`Grouped resume row count: ${resume.pagination.totalRows}`);
  console.log(`Net output: ${formatNumber(totals.netOutput, 4)}`);
  console.log(`Positive output: ${formatNumber(totals.positiveOutput, 4)}`);
  console.log(`Correction output: ${formatNumber(totals.correctionOutput, 4)}`);
  console.log(`Reject attached count: ${totals.rejectAttachedCount}`);
  console.log(`Reject-only group count: ${totals.rejectOnlyGroupCount}`);
  console.log(`Ambiguous reject attachment count: ${totals.ambiguousRejectAttachmentCount}`);
  console.log(`Total reject kg: ${formatNumber(totals.totalRejectKg, 4)}`);
  console.log(`Reject PCS Eq complete/incomplete count: ${totals.conversionCompleteCount}/${totals.conversionGaps}`);
  console.log("Reject conversion gap breakdown:");
  for (const reason of DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS) {
    const value = rejectConversionGapBreakdown.get(reason) ?? { rows: 0, rejectKg: 0 };
    console.log(`- ${reason}: rows=${value.rows}; reject_kg=${formatNumber(value.rejectKg, 4)}`);
  }
  console.log("Reject attachment status breakdown:");
  for (const status of DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES) {
    const value = rejectAttachmentBreakdown.get(status) ?? { rejectRows: 0, groups: 0, rejectKg: 0 };
    console.log(`- ${status}: reject_rows=${value.rejectRows}; groups=${value.groups}; reject_kg=${formatNumber(value.rejectKg, 4)}`);
  }
  console.log(`Target missing count: ${totals.targetMissingCount}`);
  console.log(`Target non-matched count: ${totals.targetNonMatchedCount}`);
  await printEntitySourceUsage(pool);
  printDailyItemResumeTargetBreakdown(allRows);
  console.log("Top reject documents:");
  const topRejectDocuments = [...summarizeDailyItemResumeRejectDocuments(allRows)]
    .sort((left, right) => right.rejectKg - left.rejectKg || right.rows - left.rows)
    .slice(0, 5);
  if (topRejectDocuments.length === 0) console.log("- none");
  for (const value of topRejectDocuments) {
    console.log(`- ${value.documentNo}: reject_kg=${formatNumber(value.rejectKg, 4)}; rows=${value.rows}; ok_items=${value.okItems.join(", ") || "none"}; reject_items=${value.rejectItems.join(", ") || "none"}`);
  }
  const attachedSample = allRows.flatMap((row) =>
    row.rejectDetails
      .filter((detail) => {
        const status = rejectAttachmentStatus(detail);
        return status ? isAttachedDailyItemResumeRejectAttachmentStatus(status) : false;
      })
      .map((detail) => ({ row, detail }))
  )[0];
  console.log("Sample attached reject:");
  if (attachedSample) {
    const status = rejectAttachmentStatus(attachedSample.detail) ?? "N/A";
    console.log(
      `- ${String(attachedSample.detail.documentNo ?? "N/A")}: OK item ${attachedSample.row.itemNo}; Reject item ${String(attachedSample.detail.itemNo ?? "N/A")}; reject_kg=${formatNumber(numberValue(attachedSample.detail.rejectKg as string | number | null | undefined), 4)}; status=${status}`
    );
  } else {
    console.log("- none");
  }
  console.log("Reject conversion gap examples:");
  const allGapExamples = allRows.flatMap((row) =>
    row.rejectDetails
      .filter((detail) => detail.conversionStatus === "INCOMPLETE")
      .map((detail) => ({ row, detail }))
  );
  const gapExamples = DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS.flatMap((reason) =>
    allGapExamples.filter((example) => rejectConversionGapReason(example.detail) === reason).slice(0, 2)
  ).slice(0, 8);
  if (gapExamples.length === 0) {
    console.log("- none");
  }
  for (const example of gapExamples) {
    const status = rejectAttachmentStatus(example.detail) ?? "N/A";
    const hasMatchedOk = status !== "N/A" && isAttachedDailyItemResumeRejectAttachmentStatus(status as DailyItemResumeRejectAttachmentStatus);
    console.log(`- document_no=${String(example.detail.documentNo ?? "N/A")}`);
    console.log(`  reject_item=${String(example.detail.itemNo ?? "N/A")}`);
    console.log(`  reject_kg=${formatNumber(numberValue(example.detail.rejectKg as string | number | null | undefined), 4)}`);
    console.log(`  attachment_status=${status}`);
    console.log(`  ok_item=${hasMatchedOk ? example.row.itemNo : "N/A"}`);
    console.log(`  ok_item_description=${hasMatchedOk ? example.row.itemDescription ?? "N/A" : "N/A"}`);
    console.log(`  ok_gross_weight=${example.detail.grossWeight === null || typeof example.detail.grossWeight === "undefined" ? "N/A" : formatNumber(numberValue(example.detail.grossWeight as string | number | null | undefined), 6)}`);
    console.log(`  gross_weight_source=${String(example.detail.grossWeightSource ?? "N/A")}`);
    console.log(`  reason=${rejectConversionGapReason(example.detail) ?? "MISSING_OK_GROSS_WEIGHT"}`);
  }
  console.log("Ambiguous reject examples:");
  const ambiguousExamples = allRows.flatMap((row) =>
    row.rejectAttachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT"
      ? row.rejectDetails.map((detail) => ({ row, detail }))
      : []
  ).slice(0, 3);
  if (ambiguousExamples.length === 0) {
    console.log("- none");
  }
  for (const example of ambiguousExamples) {
    const candidates = rejectAttachmentCandidates(example.detail);
    console.log(`- document_no=${String(example.detail.documentNo ?? "N/A")}`);
    console.log(`  reject_item=${String(example.detail.itemNo ?? "N/A")}`);
    console.log(`  reject_kg=${formatNumber(numberValue(example.detail.rejectKg as string | number | null | undefined), 4)}`);
    console.log(`  candidate_count=${candidates.length}`);
    console.log("  candidates=");
    if (candidates.length === 0) {
      console.log("    none");
      continue;
    }
    console.log("    posting_date | machine | item_no | item_description | net_output | operator | shift | work_hours");
    for (const candidate of candidates.slice(0, 5)) {
      console.log(
        `    ${formatTableField(candidate.postingDate)} | ${formatTableField(candidate.machine)} | ${formatTableField(candidate.itemNo)} | ${formatTableField(candidate.itemDescription)} | ${formatNumber(numberValue(candidate.netOutput as string | number | null | undefined), 4)} | ${formatTableField(candidate.operator)} | ${formatTableField(candidate.shift)} | ${formatTableField(candidate.workHours)}`
      );
    }
  }
  console.log("Sample grouped rows:");
  for (const row of resume.rows.slice(0, 5)) {
    console.log(`- ${row.postingDate}; machine_display=${row.machineDisplay}; machine_label=${row.machineLabel}; ${row.itemNo}; net=${formatNumber(row.netOutputQty, 4)}; correction=${formatNumber(row.correctionOutputQty, 4)}; rejectKg=${formatNumber(row.rejectKg, 4)}; target=${row.dailyTarget ?? "N/A"}; reason=${row.targetReason}; achievement=${formatPct(row.achievementPct)}; status=${row.achievementStatus}`);
  }
}

async function runTargetCoverage(pool: ReturnType<typeof createDatabase>["pool"]) {
  console.log("Business Central target coverage");
  await printEntitySourceUsage(pool);
  await printRows("Coverage by entity/machine/month", targetCoverageSummary(pool));
}

async function runMappingCandidates(pool: ReturnType<typeof createDatabase>["pool"]) {
  const limit = Math.min(Number(process.env.MAPPING_CANDIDATE_LIMIT ?? 25) || 25, 100);
  console.log("Business Central mapping candidates");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Limit: ${limit}`);

  const [coverage, entities] = await Promise.all([
    mappingCoverageSummary(pool),
    activeEntityCandidates(pool)
  ]);
  printCoverageSummary(coverage);
  await printEntitySourceUsage(pool);

  const groups = await fetchUnmappedSourceGroups(pool, limit, entities);
  if (groups.length === 0) {
    console.log("- no unmapped source groups found");
    return;
  }

  console.log("");
  console.log("Top unmapped source groups with suggestions");
  for (const group of groups) {
    const top = group.suggestions[0];
    const candidates = group.suggestions
      .slice(0, 3)
      .map((candidate) => `${candidate.entityCode} ${candidate.confidence}/${candidate.score}${candidate.targetExists ? "/target" : "/no-target"} (${candidate.reason})`);
    console.log(
      `- source_field=${group.sourceField}; source_value=${group.sourceValue || "(blank)"}; normalized=${group.normalizedValue || "(blank)"}; rows=${group.rows}; ok_qty=${formatNumber(group.okQty, 2)}; range=${group.firstPostingDate ?? "N/A"}..${group.lastPostingDate ?? "N/A"}; confidence=${top?.confidence ?? "LOW"}; estimated_mapped_rows_if_committed=${group.sourceValue ? group.rows : 0}; candidates=${candidates.join(" | ") || "none"}`
    );
  }

  await printRows(
    "Top unmapped by machine_description",
    pool.query(
      `
        select coalesce(machine_description, '(blank)') as machine_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by machine_center_no fallback",
    pool.query(
      `
        select coalesce(machine_center_no, '(blank)') as machine_center_no,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by prod_line_no",
    pool.query(
      `
        select coalesce(prod_line_no, '(blank)') as prod_line_no,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by prod_line_description",
    pool.query(
      `
        select coalesce(prod_line_description, '(blank)') as prod_line_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by preferred source/machine/prod-line",
    pool.query(
      `
        select ${preferredEntitySourceFieldSql("po")} as source_field,
               coalesce(${preferredEntitySourceValueSql("po")}, '(blank)') as source_value,
               coalesce(machine_description, '(blank)') as machine_description,
               coalesce(machine_center_no, '(blank)') as machine_center_no,
               coalesce(prod_line_no, '(blank)') as prod_line_no,
               coalesce(prod_line_description, '(blank)') as prod_line_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate("po")}), 0) as ok_qty
        from production_outputs po
        where po.source_system = $1 and ${outputEntryTypePredicate("po")} and po.entity_id is null
        group by 1, 2, 3, 4, 5, 6
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by item/product family",
    pool.query(
      `
        select coalesce(item_category_code, '(blank)') as item_category_code,
               coalesce(item_no, '(blank)') as item_no,
               left(coalesce(max(item_description), ''), 80) as item_description,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1, 2
        order by ok_qty desc, rows desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
  await printRows(
    "Top unmapped by month",
    pool.query(
      `
        select date_trunc('month', posting_date)::date::text as month,
               count(*) as rows,
               coalesce(sum(quantity) filter (where ${okOutputPredicate()}), 0) as ok_qty
        from production_outputs
        where source_system = $1 and ${outputEntryTypePredicate()} and entity_id is null
        group by 1
        order by month desc
        limit $2
      `,
      [SOURCE_SYSTEM, limit]
    )
  );
}

async function runEntityV2DryRun(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.ENTITY_V2_DRY_RUN_CSV?.trim() || DEFAULT_ENTITY_V2_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.ENTITY_V2_DRY_RUN_JSON?.trim() || DEFAULT_ENTITY_V2_JSON_PATH);

  console.log("Business Central entity resolver v2 dry run");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; production_outputs.entity_id, aliases, conditional rules, targets, and KPI logic are not changed.");

  const [catalog, sourceRows] = await Promise.all([
    queryBusinessCentralCanonicalEntityCatalog(pool),
    queryEntityV2SourceRows(pool)
  ]);
  const reportRows = buildEntityV2ReportRows(sourceRows, catalog);
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const summary = summarizeEntityV2ReportRows(reportRows, outputFiles);

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, entityV2RowsToCsv(reportRows), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_rows=${summary.totalRows}`);
  console.log(`- resolved_rows=${summary.resolvedRows}; unresolved_rows=${summary.unresolvedRows}`);
  console.log(`- same_entity_rows=${summary.sameEntityRows}; different_entity_rows=${summary.differentEntityRows}`);
  console.log(`- currently_unmapped_but_v2_resolved=${summary.currentlyUnmappedButV2Resolved}`);
  console.log(`- currently_mapped_but_v2_unmapped=${summary.currentlyMappedButV2Unmapped}`);
  console.log(`- catalog_entities=${catalog.entries.length}`);

  console.log("");
  console.log("Review summary");
  console.log(`- ok_same_entity_rows=${summary.reviewSummary.okSameEntityRows}`);
  console.log(`- ok_both_unmapped_rows=${summary.reviewSummary.okBothUnmappedRows}`);
  console.log(`- canonical_catalog_gap_rows=${summary.reviewSummary.canonicalCatalogGapRows}`);
  console.log(`- legacy_target_variant_collapse_needed_rows=${summary.reviewSummary.legacyTargetVariantCollapseNeededRows}`);
  console.log(`- possible_resolver_mismatch_rows=${summary.reviewSummary.possibleResolverMismatchRows}`);
  console.log(`- possible_data_source_gap_rows=${summary.reviewSummary.possibleDataSourceGapRows}`);
  console.log(`- unknown_review_needed_rows=${summary.reviewSummary.unknownReviewNeededRows}`);

  console.log("");
  console.log("Top source fields used");
  for (const item of summary.topSourceFieldsUsed.slice(0, 5)) {
    console.log(`- ${item.value}: rows=${item.rows}`);
  }

  console.log("");
  console.log("Top target bucket candidates");
  for (const item of summary.topTargetBucketCandidates.slice(0, 8)) {
    console.log(`- ${item.value}: rows=${item.rows}`);
  }

  console.log("");
  console.log("Top mismatch source values");
  if (summary.topMismatchSourceValues.length === 0) {
    console.log("- none");
  }
  for (const item of summary.topMismatchSourceValues.slice(0, 8)) {
    console.log(
      `- ${item.sourceField}=${item.sourceValue}; rows=${item.rows}; statuses=${item.comparisonStatuses.join("|")}; current=${item.currentEntityCodes.join("|") || "none"}; v2=${item.v2EntityCodes.join("|") || "none"}`
    );
  }

  console.log("");
  console.log("Top possible resolver mismatch review groups");
  if (summary.topPossibleResolverMismatches.length === 0) {
    console.log("- none");
  }
  for (const item of summary.topPossibleResolverMismatches.slice(0, 8)) {
    console.log(
      `- ${item.sourceField}=${item.sourceValue}; rows=${item.rows}; type=${item.mismatchReviewType}; current=${item.currentEntityCodes.join("|") || "none"}; v2=${item.v2EntityCodes.join("|") || "none"}`
    );
  }

  console.log("");
  console.log("Top canonical catalog gaps");
  if (summary.canonicalCatalogGaps.length === 0) {
    console.log("- none");
  }
  for (const item of summary.canonicalCatalogGaps.slice(0, 8)) {
    console.log(
      `- ${item.sourceField}=${item.sourceValue}; rows=${item.rows}; current=${item.currentEntityCodes.join("|") || "none"}; suggested=${item.suggestedCanonicalEntityCode}`
    );
  }

  console.log("");
  console.log("Top legacy target variant collapse groups");
  if (summary.legacyTargetVariantCollapseNeeded.length === 0) {
    console.log("- none");
  }
  for (const item of summary.legacyTargetVariantCollapseNeeded.slice(0, 8)) {
    console.log(
      `- ${item.sourceField}=${item.sourceValue}; rows=${item.rows}; current=${item.currentEntityCodes.join("|") || "none"}; suggested=${item.suggestedCanonicalEntityCode}; phase=${item.recommendedFuturePhase}`
    );
  }

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

async function queryBusinessCentralTargetProfiles(pool: DatabasePool): Promise<{
  readonly tableAvailable: boolean;
  readonly profiles: readonly TargetProfile[];
}> {
  const tableCheck = await pool.query<{ table_name: string | null }>(
    "select to_regclass('public.target_profiles')::text as table_name"
  );
  if (!tableCheck.rows[0]?.table_name) {
    return { tableAvailable: false, profiles: [] };
  }

  const result = await pool.query<{
    id: string;
    entity_id: string;
    machine_center_no: string | null;
    machine_center_no_normalized: string | null;
    target_bucket: string;
    target_bucket_normalized: string;
    effective_from: string;
    effective_to: string | null;
    target_qty: string | number;
    unit: string;
    is_active: boolean;
    approval_status: string;
    source: string | null;
    notes: string | null;
  }>(
    `
      select id,
             entity_id,
             machine_center_no,
             machine_center_no_normalized,
             target_bucket,
             target_bucket_normalized,
             effective_from::text,
             effective_to::text,
             target_qty,
             unit,
             is_active,
             approval_status,
             source,
             notes
      from target_profiles
      order by entity_id, target_bucket_normalized, machine_center_no_normalized nulls first, effective_from desc
    `
  );

  return {
    tableAvailable: true,
    profiles: result.rows.map((row): TargetProfile => ({
      id: row.id,
      entityId: row.entity_id,
      machineCenterNo: row.machine_center_no,
      machineCenterNoNormalized: row.machine_center_no_normalized,
      targetBucket: row.target_bucket,
      targetBucketNormalized: row.target_bucket_normalized,
      effectiveFrom: dateText(row.effective_from),
      effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
      targetQty: numberValue(row.target_qty),
      unit: row.unit,
      isActive: row.is_active,
      approvalStatus: row.approval_status,
      source: row.source,
      notes: row.notes
    }))
  };
}

function buildTargetProfileDryRunReportRows(input: {
  readonly sourceRows: readonly EntityV2SourceRow[];
  readonly catalog: BusinessCentralCanonicalEntityCatalog;
  readonly targetProfiles: readonly TargetProfile[];
  readonly targetProfilesTableAvailable: boolean;
}): readonly TargetProfileDryRunReportRow[] {
  const entityByCode = new Map(input.catalog.entries.map((entry) => [entry.entityCode, entry]));

  return input.sourceRows.map((row) => {
    const resolution = resolveBusinessCentralEntityV2({
      entryType: row.entryType,
      postingDate: row.postingDate,
      documentNo: row.documentNo,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      locationCode: row.locationCode,
      quantity: row.quantity,
      grossWeight: row.grossWeight,
      gProdOrRotLineNo: row.gProdOrRotLineNo,
      gProdOrRotLineDescription: row.gProdOrRotLineDescription,
      machineCenterNo: row.machineCenterNo
    }, input.catalog);
    const resolvedEntity = resolution.resolvedEntityCode
      ? entityByCode.get(resolution.resolvedEntityCode)
      : undefined;
    const lookup = resolveBusinessCentralTargetProfile({
      entityId: resolvedEntity?.entityId ?? null,
      targetBucket: resolution.targetBucketCandidate,
      machineCenterNo: row.machineCenterNo,
      postingDate: row.postingDate,
      profiles: input.targetProfiles
    });
    const targetProfile = lookup.targetProfile;
    const scope = businessCentralScopeFields({
      entryType: row.entryType,
      locationCode: row.locationCode,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      documentNo: row.documentNo,
      quantity: row.quantity,
      unitOfMeasureCode: row.uom,
      grossWeight: row.grossWeight,
      gProdOrRotLineDescription: row.gProdOrRotLineDescription,
      gProdOrRotLineNo: row.gProdOrRotLineNo,
      machineCenterNo: row.machineCenterNo,
      blocksP10BeforeScope: false
    });

    return {
      posting_date: row.postingDate,
      document_no: row.documentNo ?? "",
      entry_no: row.entryNo ?? "",
      item_no: row.itemNo,
      item_description: row.itemDescription ?? "",
      item_category_code: row.itemCategoryCode ?? "",
      quantity: row.quantity,
      gross_weight: row.grossWeight ?? "",
      entry_type: row.entryType ?? "",
      location_code: row.locationCode ?? "",
      g_prod_or_rot_line_no: row.gProdOrRotLineNo ?? "",
      g_prod_or_rot_line_description: row.gProdOrRotLineDescription ?? "",
      machine_center_no: row.machineCenterNo ?? "",
      resolver_v2_entity_code: resolution.resolvedEntityCode ?? "",
      resolver_v2_entity_display_name: resolution.resolvedEntityDisplayName ?? "",
      resolver_v2_source_field_used: resolution.sourceFieldUsed,
      resolver_v2_source_value_used: resolution.sourceValueUsed ?? "",
      resolver_v2_target_bucket_candidate: resolution.targetBucketCandidate,
      target_profile_lookup_status: lookup.status,
      target_profile_id: targetProfile?.id ?? "",
      target_profile_target_qty: targetProfile?.targetQty ?? "",
      target_profile_unit: targetProfile?.unit ?? "",
      target_profile_effective_from: targetProfile ? dateText(targetProfile.effectiveFrom) : "",
      target_profile_effective_to: targetProfile?.effectiveTo ? dateText(targetProfile.effectiveTo) : "",
      target_profile_machine_center_no: targetProfile?.machineCenterNo ?? "",
      target_profile_reason: lookup.reason,
      recommended_action: targetProfileRecommendedAction(lookup.status, input.targetProfilesTableAvailable),
      ...scope
    };
  });
}

function targetProfileRecommendedAction(
  status: TargetProfileLookupStatus,
  targetProfilesTableAvailable: boolean
): string {
  if (status === "TARGET_PROFILE_MATCHED_EXACT" || status === "TARGET_PROFILE_MATCHED_ENTITY_BUCKET") {
    return "Review dry-run match only; dashboard target lookup is not switched in P0.8.";
  }
  if (status === "MULTIPLE_TARGET_PROFILE_MATCH") {
    return "Review overlapping active approved target profiles; do not let P0.8 guess.";
  }
  if (status === "INVALID_TARGET_BUCKET") {
    return "Review P0.7 bucket inference/source data; do not guess target bucket.";
  }
  if (status === "INVALID_ENTITY") {
    return "Resolve canonical entity catalog gaps before target profile backfill planning.";
  }
  if (!targetProfilesTableAvailable) {
    return "Run the P0.8 migration, then plan P0.9 seed/backfill dry-run; no dashboard switch in P0.8.";
  }
  return "Create or approve a target profile in P0.9 planning; do not migrate old targets in P0.8.";
}

function targetProfileDryRunRowsToCsv(rows: readonly TargetProfileDryRunReportRow[]): string {
  const lines = [
    targetProfileDryRunCsvHeaders.join(","),
    ...rows.map((row) => targetProfileDryRunCsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function summarizeTargetProfileDryRunRows(input: {
  readonly rows: readonly TargetProfileDryRunReportRow[];
  readonly outputFiles: TargetProfileDryRunSummary["outputFiles"];
  readonly targetProfilesTableAvailable: boolean;
  readonly targetProfilesLoaded: number;
}): TargetProfileDryRunSummary {
  const rows = input.rows;
  const scopeSummary = summarizeBusinessCentralScopeRows({ rows });
  return {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    ...scopeSummary,
    resolverV2ResolvedRows: rows.filter((row) => row.resolver_v2_entity_code).length,
    resolverV2UnresolvedRows: rows.filter((row) => !row.resolver_v2_entity_code).length,
    targetProfileMatchedRows: rows.filter((row) => (
      row.target_profile_lookup_status === "TARGET_PROFILE_MATCHED_EXACT"
      || row.target_profile_lookup_status === "TARGET_PROFILE_MATCHED_ENTITY_BUCKET"
    )).length,
    targetProfileNoActiveRows: rows.filter((row) => row.target_profile_lookup_status === "NO_ACTIVE_TARGET_PROFILE").length,
    targetProfileMultipleMatchRows: rows.filter((row) => row.target_profile_lookup_status === "MULTIPLE_TARGET_PROFILE_MATCH").length,
    targetProfileInvalidBucketRows: rows.filter((row) => row.target_profile_lookup_status === "INVALID_TARGET_BUCKET").length,
    targetProfileInvalidEntityRows: rows.filter((row) => row.target_profile_lookup_status === "INVALID_ENTITY").length,
    topNoActiveTargetProfileGroups: targetProfileIssueGroups(rows, "NO_ACTIVE_TARGET_PROFILE"),
    topMultipleTargetProfileGroups: targetProfileIssueGroups(rows, "MULTIPLE_TARGET_PROFILE_MATCH"),
    topMatchedTargetProfiles: targetProfileMatchedGroups(rows),
    outputFiles: input.outputFiles,
    targetProfilesTableAvailable: input.targetProfilesTableAvailable,
    targetProfilesLoaded: input.targetProfilesLoaded,
    safety: {
      dashboardChanged: false,
      databaseUpdated: false,
      productionOutputsUpdated: false,
      oldTargetLogicChanged: false
    }
  };
}

function targetProfileIssueGroups(
  rows: readonly TargetProfileDryRunReportRow[],
  status: TargetProfileLookupStatus,
  limit = 20
): readonly TargetProfileDryRunIssueGroup[] {
  const groups = new Map<string, {
    entityCode: string;
    entityDisplayName: string;
    sourceField: string;
    sourceValue: string;
    targetBucketCandidate: string;
    machineCenterNo: string;
    rows: number;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
    recommendedAction: string;
  }>();

  for (const row of rows) {
    if (row.target_profile_lookup_status !== status) continue;
    const key = [
      row.resolver_v2_entity_code,
      row.resolver_v2_target_bucket_candidate,
      normalizeAliasKey(row.machine_center_no),
      row.resolver_v2_source_field_used,
      normalizeAliasKey(row.resolver_v2_source_value_used)
    ].join(":");
    const current = groups.get(key) ?? {
      entityCode: row.resolver_v2_entity_code || "(unresolved)",
      entityDisplayName: row.resolver_v2_entity_display_name || "(unresolved)",
      sourceField: row.resolver_v2_source_field_used,
      sourceValue: row.resolver_v2_source_value_used || "(blank)",
      targetBucketCandidate: row.resolver_v2_target_bucket_candidate,
      machineCenterNo: row.machine_center_no || "(blank)",
      rows: 0,
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>(),
      recommendedAction: row.recommended_action
    };
    current.rows += 1;
    if (row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.document_no);
    if (row.item_no && current.sampleItems.size < 5) current.sampleItems.add(row.item_no);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      entityCode: group.entityCode,
      entityDisplayName: group.entityDisplayName,
      sourceField: group.sourceField,
      sourceValue: group.sourceValue,
      targetBucketCandidate: group.targetBucketCandidate,
      machineCenterNo: group.machineCenterNo,
      rows: group.rows,
      sampleDocuments: [...group.sampleDocuments],
      sampleItems: [...group.sampleItems],
      recommendedAction: group.recommendedAction
    }))
    .sort((left, right) => right.rows - left.rows || left.entityCode.localeCompare(right.entityCode))
    .slice(0, limit);
}

function targetProfileMatchedGroups(
  rows: readonly TargetProfileDryRunReportRow[],
  limit = 20
): readonly TargetProfileDryRunMatchedGroup[] {
  const groups = new Map<string, TargetProfileDryRunMatchedGroup>();
  for (const row of rows) {
    if (!row.target_profile_id) continue;
    const current = groups.get(row.target_profile_id) ?? {
      targetProfileId: row.target_profile_id,
      entityCode: row.resolver_v2_entity_code,
      entityDisplayName: row.resolver_v2_entity_display_name,
      targetBucket: row.resolver_v2_target_bucket_candidate,
      machineCenterNo: row.target_profile_machine_center_no || "(generic)",
      targetQty: typeof row.target_profile_target_qty === "number" ? row.target_profile_target_qty : 0,
      unit: row.target_profile_unit,
      rows: 0
    };
    groups.set(row.target_profile_id, {
      ...current,
      rows: current.rows + 1
    });
  }
  return [...groups.values()]
    .sort((left, right) => right.rows - left.rows || left.targetProfileId.localeCompare(right.targetProfileId))
    .slice(0, limit);
}

async function runTargetProfileDryRun(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.TARGET_PROFILE_DRY_RUN_CSV?.trim() || DEFAULT_TARGET_PROFILE_DRY_RUN_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.TARGET_PROFILE_DRY_RUN_JSON?.trim() || DEFAULT_TARGET_PROFILE_DRY_RUN_JSON_PATH);

  console.log("Business Central target profile dry run");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; dashboard target lookup, production_outputs.entity_id, old targets, aliases, and conditional rules are not changed.");

  const [catalog, sourceRows, targetProfileState] = await Promise.all([
    queryBusinessCentralCanonicalEntityCatalog(pool),
    queryEntityV2SourceRows(pool),
    queryBusinessCentralTargetProfiles(pool)
  ]);
  const reportRows = buildTargetProfileDryRunReportRows({
    sourceRows,
    catalog,
    targetProfiles: targetProfileState.profiles,
    targetProfilesTableAvailable: targetProfileState.tableAvailable
  });
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const summary = summarizeTargetProfileDryRunRows({
    rows: reportRows,
    outputFiles,
    targetProfilesTableAvailable: targetProfileState.tableAvailable,
    targetProfilesLoaded: targetProfileState.profiles.length
  });

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, targetProfileDryRunRowsToCsv(reportRows), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_rows=${summary.totalRows}`);
  console.log(`- resolver_v2_resolved_rows=${summary.resolverV2ResolvedRows}; resolver_v2_unresolved_rows=${summary.resolverV2UnresolvedRows}`);
  console.log(`- target_profile_matched_rows=${summary.targetProfileMatchedRows}`);
  console.log(`- target_profile_no_active_rows=${summary.targetProfileNoActiveRows}`);
  console.log(`- target_profile_multiple_match_rows=${summary.targetProfileMultipleMatchRows}`);
  console.log(`- target_profile_invalid_bucket_rows=${summary.targetProfileInvalidBucketRows}`);
  console.log(`- target_profile_invalid_entity_rows=${summary.targetProfileInvalidEntityRows}`);
  console.log(`- target_profiles_table_available=${summary.targetProfilesTableAvailable}`);
  console.log(`- target_profiles_loaded=${summary.targetProfilesLoaded}`);

  if (!summary.targetProfilesTableAvailable) {
    console.log("");
    console.log("Target profiles table is not available in this database yet. This dry run treated profiles as empty; run migrations before P0.9 seed/backfill planning.");
  } else if (summary.targetProfilesLoaded === 0) {
    console.log("");
    console.log("Target profiles table is empty. NO_ACTIVE_TARGET_PROFILE is expected until P0.9/backfill/seed planning.");
  }

  console.log("");
  console.log("Top no-active target profile groups");
  if (summary.topNoActiveTargetProfileGroups.length === 0) {
    console.log("- none");
  }
  for (const item of summary.topNoActiveTargetProfileGroups.slice(0, 10)) {
    console.log(
      `- entity=${item.entityCode}; bucket=${item.targetBucketCandidate}; machine_center=${item.machineCenterNo}; rows=${item.rows}; source=${item.sourceField}:${item.sourceValue}`
    );
  }

  console.log("");
  console.log("Top multiple target profile groups");
  if (summary.topMultipleTargetProfileGroups.length === 0) {
    console.log("- none");
  }
  for (const item of summary.topMultipleTargetProfileGroups.slice(0, 10)) {
    console.log(
      `- entity=${item.entityCode}; bucket=${item.targetBucketCandidate}; machine_center=${item.machineCenterNo}; rows=${item.rows}; source=${item.sourceField}:${item.sourceValue}`
    );
  }

  console.log("");
  console.log("Top matched target profiles");
  if (summary.topMatchedTargetProfiles.length === 0) {
    console.log("- none");
  }
  for (const item of summary.topMatchedTargetProfiles.slice(0, 10)) {
    console.log(
      `- profile=${item.targetProfileId}; entity=${item.entityCode}; bucket=${item.targetBucket}; machine_center=${item.machineCenterNo}; target=${item.targetQty} ${item.unit}; rows=${item.rows}`
    );
  }

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

function buildEntityV2BackfillDryRunReportRows(
  rows: readonly EntityV2ReportRow[]
): readonly EntityV2BackfillDryRunReportRow[] {
  const sourceContexts = entityV2SourceValueContexts(rows);

  return rows.map((row) => {
    const sourceContext = sourceContexts.get(entityV2SourceContextKey(row.v2_source_field_used, row.v2_source_value_used));
    const plan = planEntityV2Backfill({
      sourceField: row.v2_source_field_used,
      sourceValue: row.v2_source_value_used,
      currentEntityCode: row.current_entity_code,
      currentEntityDisplayName: row.current_entity_display_name,
      currentEntityCodesForSourceValue: sourceContext ? sortedStrings(sourceContext.currentEntityCodes) : [],
      proposedEntityCode: row.v2_entity_code,
      proposedEntityDisplayName: row.v2_entity_display_name,
      suggestedCanonicalEntityCode: row.v2_suggested_canonical_entity_code,
      suggestedCanonicalEntityDisplayName: row.v2_suggested_canonical_entity_display_name,
      comparisonStatus: row.comparison_status,
      reviewClassification: row.v2_review_classification,
      mismatchReviewType: row.v2_mismatch_review_type
    });
    const scope = businessCentralScopeFields({
      entryType: row.entry_type,
      locationCode: row.location_code,
      itemNo: row.item_no,
      itemDescription: row.item_description,
      itemCategoryCode: row.item_category_code,
      documentNo: row.document_no,
      quantity: row.quantity,
      gProdOrRotLineDescription: row.g_prod_or_rot_line_description,
      gProdOrRotLineNo: row.g_prod_or_rot_line_no,
      machineCenterNo: row.machine_center_no,
      blocksP10BeforeScope: plan.riskLevel === "HIGH"
    });

    return {
      posting_date: row.posting_date,
      document_no: row.document_no,
      entry_no: row.entry_no,
      item_no: row.item_no,
      item_description: row.item_description,
      quantity: row.quantity,
      entry_type: row.entry_type,
      location_code: row.location_code,
      source_field: row.v2_source_field_used,
      source_value: row.v2_source_value_used,
      machine_center_no: row.machine_center_no,
      current_entity_id: row.current_entity_id,
      current_entity_code: row.current_entity_code,
      current_entity_display_name: row.current_entity_display_name,
      proposed_canonical_entity_code: plan.proposedCanonicalEntityCode ?? "",
      proposed_canonical_entity_display_name: plan.proposedCanonicalEntityDisplayName ?? "",
      backfill_action: plan.backfillAction,
      risk_level: plan.riskLevel,
      risk_reason: plan.riskReason,
      recommended_action: plan.recommendedAction,
      ...scope
    };
  });
}

function entityV2BackfillRowsToCsv(rows: readonly EntityV2BackfillDryRunReportRow[]): string {
  const lines = [
    entityV2BackfillDryRunCsvHeaders.join(","),
    ...rows.map((row) => entityV2BackfillDryRunCsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function summarizeEntityV2BackfillDryRunRows(input: {
  readonly rows: readonly EntityV2BackfillDryRunReportRow[];
  readonly outputFiles: EntityV2BackfillDryRunSummary["outputFiles"];
}): EntityV2BackfillDryRunSummary {
  const rows = input.rows;
  const scopeSummary = summarizeBusinessCentralScopeRows({
    rows,
    isP10BlockingBeforeScope: (row) => row.risk_level === "HIGH"
  });
  return {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    ...scopeSummary,
    proposedEntityBackfillRows: rows.filter((row) => row.backfill_action === "PROPOSE_CANONICAL_ENTITY_COLLAPSE" || row.backfill_action === "PROPOSE_CANONICAL_ENTITY_CREATION").length,
    noChangeRows: rows.filter((row) => row.backfill_action === "NO_CHANGE").length,
    highRiskRows: rows.filter((row) => row.risk_level === "HIGH").length,
    mediumRiskRows: rows.filter((row) => row.risk_level === "MEDIUM").length,
    lowRiskRows: rows.filter((row) => row.risk_level === "LOW").length,
    topProposedCanonicalEntities: entityBackfillGroups(rows.filter((row) => row.backfill_action === "PROPOSE_CANONICAL_ENTITY_COLLAPSE" || row.backfill_action === "PROPOSE_CANONICAL_ENTITY_CREATION")),
    topHighRiskGroups: entityBackfillGroups(rows.filter((row) => row.risk_level === "HIGH")),
    safeCollapseCandidates: entityBackfillGroups(rows.filter((row) => row.backfill_action === "PROPOSE_CANONICAL_ENTITY_COLLAPSE" && row.risk_level === "LOW")),
    canonicalEntityCreationCandidates: entityBackfillGroups(rows.filter((row) => row.backfill_action === "PROPOSE_CANONICAL_ENTITY_CREATION")),
    aliasConflictCandidates: entityBackfillGroups(rows.filter((row) => row.backfill_action === "REVIEW_ALIAS_CONFLICT")),
    families: backfillFamilySummary(rows),
    outputFiles: input.outputFiles,
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };
}

function entityBackfillGroups(
  rows: readonly EntityV2BackfillDryRunReportRow[],
  limit = 20
): readonly EntityV2BackfillGroup[] {
  const groups = new Map<string, {
    proposedCanonicalEntityCode: string;
    proposedCanonicalEntityDisplayName: string;
    currentEntityCodes: Set<string>;
    sourceField: string;
    sourceValue: string;
    rows: number;
    action: EntityV2BackfillAction;
    riskLevel: BackfillRiskLevel;
    riskReason: string;
    recommendedAction: string;
  }>();

  for (const row of rows) {
    const key = [
      row.proposed_canonical_entity_code || "(blank)",
      row.source_field,
      normalizeAliasKey(row.source_value),
      row.backfill_action,
      row.risk_level
    ].join(":");
    const current = groups.get(key) ?? {
      proposedCanonicalEntityCode: row.proposed_canonical_entity_code || "(blank)",
      proposedCanonicalEntityDisplayName: row.proposed_canonical_entity_display_name || "(blank)",
      currentEntityCodes: new Set<string>(),
      sourceField: row.source_field,
      sourceValue: row.source_value || "(blank)",
      rows: 0,
      action: row.backfill_action,
      riskLevel: row.risk_level,
      riskReason: row.risk_reason,
      recommendedAction: row.recommended_action
    };
    current.rows += 1;
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      proposedCanonicalEntityCode: group.proposedCanonicalEntityCode,
      proposedCanonicalEntityDisplayName: group.proposedCanonicalEntityDisplayName,
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      sourceField: group.sourceField,
      sourceValue: group.sourceValue,
      rows: group.rows,
      action: group.action,
      riskLevel: group.riskLevel,
      riskReason: group.riskReason,
      recommendedAction: group.recommendedAction
    }))
    .sort((left, right) => right.rows - left.rows || left.riskLevel.localeCompare(right.riskLevel) || left.proposedCanonicalEntityCode.localeCompare(right.proposedCanonicalEntityCode))
    .slice(0, limit);
}

function backfillFamilySummary(
  rows: readonly (EntityV2BackfillDryRunReportRow | TargetProfileBackfillDryRunReportRow)[]
): readonly BackfillFamilySummary[] {
  const families = ["OMSO", "POLYPRINT", "VFINE", "LONGSUN", "BORCH", "THERMO", "NEWDO", "CAI", "REPACKING"] as const;
  return families.map((family) => {
    const familyRows = rows.filter((row) => normalizeAliasDisplay(Object.values(row).join(" ")).includes(family));
    return {
      family,
      rows: familyRows.length,
      highRiskRows: familyRows.filter((row) => row.risk_level === "HIGH").length,
      mediumRiskRows: familyRows.filter((row) => row.risk_level === "MEDIUM").length,
      lowRiskRows: familyRows.filter((row) => row.risk_level === "LOW").length
    };
  }).filter((row) => row.rows > 0);
}

async function queryProductionTargetSources(pool: DatabasePool): Promise<readonly ProductionTargetSource[]> {
  const result = await pool.query<{
    entity_id: string;
    entity_code: string;
    entity_display_name: string;
    effective_from: string;
    effective_to: string | null;
    daily_target_qty: string | number;
    status: string;
  }>(
    `
      select pt.entity_id::text,
             me.entity_code,
             me.display_name as entity_display_name,
             pt.effective_from::text,
             pt.effective_to::text,
             pt.daily_target_qty,
             pt.status
      from production_targets pt
      inner join master_entities me on me.id = pt.entity_id
      where pt.status in ('APPROVED', 'ACTIVE')
      order by me.entity_code, pt.effective_from
    `
  );
  return result.rows.map((row) => ({
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityDisplayName: row.entity_display_name,
    effectiveFrom: dateText(row.effective_from),
    effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
    dailyTargetQty: numberValue(row.daily_target_qty),
    status: row.status
  }));
}

function buildTargetProfileBackfillDryRunReportRows(input: {
  readonly entityRows: readonly EntityV2BackfillDryRunReportRow[];
  readonly v2Rows: readonly EntityV2ReportRow[];
  readonly productionTargets: readonly ProductionTargetSource[];
}): readonly TargetProfileBackfillDryRunReportRow[] {
  const targetsByEntityId = new Map<string, ProductionTargetSource[]>();
  for (const target of input.productionTargets) {
    const current = targetsByEntityId.get(target.entityId) ?? [];
    current.push(target);
    targetsByEntityId.set(target.entityId, current);
  }

  const grouped = new Map<string, {
    entityRow: EntityV2BackfillDryRunReportRow;
    v2Row: EntityV2ReportRow;
    sampleRows: number;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();

  input.entityRows.forEach((entityRow, index) => {
    const v2Row = input.v2Rows[index];
    if (!v2Row) return;
    if (entityRow.backfill_action === "NO_CHANGE" || entityRow.backfill_action === "REVIEW_DATA_SOURCE_GAP") return;
    if (!entityRow.proposed_canonical_entity_code || !entityRow.current_entity_code) return;
    const key = [
      entityRow.proposed_canonical_entity_code,
      entityRow.current_entity_code,
      v2Row.v2_target_bucket_candidate,
      normalizeMachineCenterNo(v2Row.machine_center_no) ?? "(blank)"
    ].join(":");
    const current = grouped.get(key) ?? {
      entityRow,
      v2Row,
      sampleRows: 0,
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    if (v2Row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(v2Row.document_no);
    if (v2Row.item_no && current.sampleItems.size < 5) current.sampleItems.add(v2Row.item_no);
    grouped.set(key, { ...current, sampleRows: current.sampleRows + 1 });
  });

  const candidates: TargetProfileBackfillDryRunReportRow[] = [];
  for (const group of grouped.values()) {
    const targets = targetsByEntityId.get(group.entityRow.current_entity_id) ?? [];
    if (targets.length === 0) {
      candidates.push(targetProfileBackfillRow(group, null, false));
      continue;
    }

    const targetsByPeriod = new Map<string, ProductionTargetSource[]>();
    for (const target of targets) {
      const key = `${target.effectiveFrom}:${target.effectiveTo ?? ""}`;
      const current = targetsByPeriod.get(key) ?? [];
      current.push(target);
      targetsByPeriod.set(key, current);
    }

    for (const periodTargets of targetsByPeriod.values()) {
      const distinctQty = new Set(periodTargets.map((target) => target.dailyTargetQty));
      const target = periodTargets[0] ?? null;
      candidates.push(targetProfileBackfillRow(group, distinctQty.size > 1 ? null : target, distinctQty.size > 1));
    }
  }

  return candidates.sort((left, right) => (
    riskSort(right.risk_level) - riskSort(left.risk_level)
    || right.sample_rows - left.sample_rows
    || left.canonical_entity_code.localeCompare(right.canonical_entity_code)
  ));
}

function targetProfileBackfillRow(
  group: {
    readonly entityRow: EntityV2BackfillDryRunReportRow;
    readonly v2Row: EntityV2ReportRow;
    readonly sampleRows: number;
    readonly sampleDocuments: ReadonlySet<string>;
    readonly sampleItems: ReadonlySet<string>;
  },
  target: ProductionTargetSource | null,
  hasMultipleTargetQtySources: boolean
): TargetProfileBackfillDryRunReportRow {
  const plan = planTargetProfileBackfill({
    canonicalEntityCode: group.entityRow.proposed_canonical_entity_code,
    canonicalEntityDisplayName: group.entityRow.proposed_canonical_entity_display_name,
    currentEntityCode: group.entityRow.current_entity_code,
    currentEntityDisplayName: group.entityRow.current_entity_display_name,
    targetBucket: group.v2Row.v2_target_bucket_candidate,
    machineCenterNo: group.v2Row.machine_center_no,
    proposedTargetQty: target?.dailyTargetQty ?? null,
    entityBackfillRiskLevel: group.entityRow.risk_level,
    entityBackfillAction: group.entityRow.backfill_action,
    hasMultipleTargetQtySources
  });
  const scope = businessCentralScopeFields({
    entryType: group.v2Row.entry_type,
    locationCode: group.v2Row.location_code,
    itemNo: group.v2Row.item_no,
    itemDescription: group.v2Row.item_description,
    itemCategoryCode: group.v2Row.item_category_code,
    documentNo: group.v2Row.document_no,
    quantity: group.v2Row.quantity,
    gProdOrRotLineDescription: group.v2Row.g_prod_or_rot_line_description,
    gProdOrRotLineNo: group.v2Row.g_prod_or_rot_line_no,
    machineCenterNo: group.v2Row.machine_center_no,
    blocksP10BeforeScope: plan.riskLevel === "HIGH"
  });

  return {
    canonical_entity_code: group.entityRow.proposed_canonical_entity_code,
    canonical_entity_display_name: group.entityRow.proposed_canonical_entity_display_name,
    current_entity_code: group.entityRow.current_entity_code,
    current_entity_display_name: group.entityRow.current_entity_display_name,
    target_bucket: plan.targetBucket,
    machine_center_no: plan.machineCenterNo ?? "",
    machine_center_no_normalized: plan.machineCenterNoNormalized ?? "",
    effective_from: target?.effectiveFrom ?? "",
    effective_to: target?.effectiveTo ?? "",
    proposed_target_qty: plan.proposedTargetQty ?? "",
    unit: plan.unit,
    source: plan.source,
    approval_status: plan.approvalStatus,
    risk_level: plan.riskLevel,
    risk_reason: plan.riskReason,
    recommended_action: plan.recommendedAction,
    sample_rows: group.sampleRows,
    sample_documents: [...group.sampleDocuments],
    sample_items: [...group.sampleItems],
    ...scope
  };
}

function targetProfileBackfillRowsToCsv(rows: readonly TargetProfileBackfillDryRunReportRow[]): string {
  const lines = [
    targetProfileBackfillDryRunCsvHeaders.join(","),
    ...rows.map((row) => targetProfileBackfillDryRunCsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function summarizeTargetProfileBackfillDryRunRows(input: {
  readonly rows: readonly TargetProfileBackfillDryRunReportRow[];
  readonly outputFiles: TargetProfileBackfillDryRunSummary["outputFiles"];
}): TargetProfileBackfillDryRunSummary {
  const rows = input.rows;
  const scopeSummary = summarizeBusinessCentralScopeRows({
    rows,
    isP10BlockingBeforeScope: (row) => row.risk_level === "HIGH"
  });
  return {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    ...scopeSummary,
    proposedTargetProfileRows: rows.length,
    lowRiskRows: rows.filter((row) => row.risk_level === "LOW").length,
    mediumRiskRows: rows.filter((row) => row.risk_level === "MEDIUM").length,
    highRiskRows: rows.filter((row) => row.risk_level === "HIGH").length,
    topProposedTargetProfiles: targetProfileBackfillGroups(rows),
    topMissingTargetQtyGroups: targetProfileBackfillGroups(rows.filter((row) => row.proposed_target_qty === "")),
    topHighRiskGroups: targetProfileBackfillGroups(rows.filter((row) => row.risk_level === "HIGH")),
    families: backfillFamilySummary(rows),
    outputFiles: input.outputFiles,
    safety: {
      databaseUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      oldTargetLogicChanged: false
    }
  };
}

async function buildTargetProfileDryRunSummaryForGate(pool: DatabasePool): Promise<TargetProfileDryRunSummary> {
  const [catalog, sourceRows, targetProfileState] = await Promise.all([
    queryBusinessCentralCanonicalEntityCatalog(pool),
    queryEntityV2SourceRows(pool),
    queryBusinessCentralTargetProfiles(pool)
  ]);
  const reportRows = buildTargetProfileDryRunReportRows({
    sourceRows,
    catalog,
    targetProfiles: targetProfileState.profiles,
    targetProfilesTableAvailable: targetProfileState.tableAvailable
  });
  return summarizeTargetProfileDryRunRows({
    rows: reportRows,
    outputFiles: {
      csv: displayRepoPath(DEFAULT_TARGET_PROFILE_DRY_RUN_CSV_PATH),
      json: displayRepoPath(DEFAULT_TARGET_PROFILE_DRY_RUN_JSON_PATH)
    },
    targetProfilesTableAvailable: targetProfileState.tableAvailable,
    targetProfilesLoaded: targetProfileState.profiles.length
  });
}

async function buildHighRiskReviewPlan(pool: DatabasePool): Promise<{
  readonly summary: HighRiskReviewPlanSummary;
  readonly groups: readonly HighRiskReviewPlanGroup[];
  readonly targetProfileDryRunSummary: TargetProfileDryRunSummary;
  readonly entityRows: readonly EntityV2BackfillDryRunReportRow[];
  readonly targetProfileRows: readonly TargetProfileBackfillDryRunReportRow[];
}> {
  const [{ entityRows, v2Rows }, productionTargets, targetProfileState, targetProfileDryRunSummary] = await Promise.all([
    buildEntityV2BackfillDryRun(pool),
    queryProductionTargetSources(pool),
    queryBusinessCentralTargetProfiles(pool),
    buildTargetProfileDryRunSummaryForGate(pool)
  ]);
  const targetProfileRows = buildTargetProfileBackfillDryRunReportRows({ entityRows, v2Rows, productionTargets });
  const groups = [
    ...buildEntityHighRiskReviewGroups(entityRows),
    ...buildTargetProfileHighRiskReviewGroups(targetProfileRows)
  ];
  const entityHighRiskRows = entityRows.filter((row) => row.risk_level === "HIGH").length;
  const targetProfileHighRiskRows = targetProfileRows.filter((row) => row.risk_level === "HIGH").length;
  const approvedTargetProfileCount = targetProfileState.profiles.filter((profile) => (
    profile.isActive && String(profile.approvalStatus).trim().toUpperCase() === "APPROVED"
  )).length;
  const summary = buildHighRiskReviewPlanSummary({
    entityHighRiskRows,
    targetProfileHighRiskRows,
    unresolvedHighRiskGroups: groups.filter((group) => group.p10Blocker).length,
    targetProfilesTableAvailable: targetProfileState.tableAvailable,
    approvedTargetProfileCount,
    resolverV2ResolvedRows: targetProfileDryRunSummary.resolverV2ResolvedRows,
    targetProfileNoActiveRows: targetProfileDryRunSummary.targetProfileNoActiveRows,
    kpiComparisonReady: false,
    kpiComparisonReviewed: false,
    groups
  });

  return { summary, groups, targetProfileDryRunSummary, entityRows, targetProfileRows };
}

function buildEntityHighRiskReviewGroups(
  rows: readonly EntityV2BackfillDryRunReportRow[]
): readonly HighRiskReviewPlanGroup[] {
  const relevantRows = rows.filter((row) => (
    row.risk_level === "HIGH"
    || row.risk_level === "MEDIUM"
    || (
      row.risk_level === "LOW"
      && row.backfill_action !== "NO_CHANGE"
    )
  ));
  const groups = new Map<string, {
    row: EntityV2BackfillDryRunReportRow;
    currentEntityCodes: Set<string>;
    rows: number;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();

  for (const row of relevantRows) {
    const key = [
      "ENTITY",
      row.source_field,
      normalizeAliasKey(row.source_value),
      row.proposed_canonical_entity_code,
      row.backfill_action,
      row.risk_level,
      row.bc_current_kpi_scope,
      row.bc_future_use_domain,
      row.blocks_p10_after_scope
    ].join(":");
    const current = groups.get(key) ?? {
      row,
      currentEntityCodes: new Set<string>(),
      rows: 0,
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    current.rows += 1;
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.document_no);
    if (row.item_no && current.sampleItems.size < 5) current.sampleItems.add(row.item_no);
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    const decision = entityReviewDecision(group.row);
    const p10Blocker = group.row.risk_level === "HIGH";
    return {
      reviewGroupType: p10Blocker ? "ENTITY_HIGH_RISK" : "ENTITY_MANUAL_REVIEW",
      sourceField: group.row.source_field,
      sourceValue: group.row.source_value || "(blank)",
      canonicalEntityCode: group.row.proposed_canonical_entity_code || "(blank)",
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      proposedEntityCode: group.row.proposed_canonical_entity_code || "(blank)",
      targetBucket: "",
      machineCenterNo: group.row.machine_center_no || "(blank)",
      rows: group.rows,
      riskLevel: group.row.risk_level,
      riskReason: group.row.risk_reason,
      reviewDecision: decision,
      recommendedAction: group.row.recommended_action,
      p10Blocker,
      blocksP10AfterScope: group.row.blocks_p10_after_scope === "true",
      bcCurrentKpiScope: group.row.bc_current_kpi_scope,
      bcFutureUseDomain: group.row.bc_future_use_domain,
      bcScopeReason: group.row.bc_scope_reason,
      bcScopeEvidenceFields: group.row.bc_scope_evidence_fields.split("|").filter(Boolean),
      bcEntitySourceStatus: group.row.bc_entity_source_status,
      sampleDocuments: [...group.sampleDocuments],
      sampleItems: [...group.sampleItems]
    };
  }).sort(reviewGroupSort);
}

function buildTargetProfileHighRiskReviewGroups(
  rows: readonly TargetProfileBackfillDryRunReportRow[]
): readonly HighRiskReviewPlanGroup[] {
  const relevantRows = rows.filter((row) => row.risk_level === "HIGH" || row.risk_level === "MEDIUM" || row.risk_level === "LOW");
  return relevantRows.map((row): HighRiskReviewPlanGroup => {
    const p10Blocker = row.risk_level === "HIGH";
    return {
      reviewGroupType: p10Blocker ? "TARGET_PROFILE_HIGH_RISK" : "TARGET_PROFILE_MANUAL_REVIEW",
      sourceField: "target_profile_backfill",
      sourceValue: row.current_entity_code || row.canonical_entity_code || "(blank)",
      canonicalEntityCode: row.canonical_entity_code || "(blank)",
      currentEntityCodes: row.current_entity_code ? [row.current_entity_code] : [],
      proposedEntityCode: row.canonical_entity_code || "(blank)",
      targetBucket: row.target_bucket,
      machineCenterNo: row.machine_center_no || "(generic)",
      rows: row.sample_rows,
      riskLevel: row.risk_level,
      riskReason: row.risk_reason,
      reviewDecision: targetProfileReviewDecision(row),
      recommendedAction: row.recommended_action,
      p10Blocker,
      blocksP10AfterScope: row.blocks_p10_after_scope === "true",
      bcCurrentKpiScope: row.bc_current_kpi_scope,
      bcFutureUseDomain: row.bc_future_use_domain,
      bcScopeReason: row.bc_scope_reason,
      bcScopeEvidenceFields: row.bc_scope_evidence_fields.split("|").filter(Boolean),
      bcEntitySourceStatus: row.bc_entity_source_status,
      sampleDocuments: row.sample_documents,
      sampleItems: row.sample_items
    };
  }).sort(reviewGroupSort);
}

function entityReviewDecision(row: EntityV2BackfillDryRunReportRow): HighRiskReviewDecision {
  if (row.risk_level === "HIGH") {
    if (row.backfill_action === "REVIEW_DATA_SOURCE_GAP") return "NEEDS_SOURCE_DATA_FIX";
    if (row.backfill_action === "REVIEW_ALIAS_CONFLICT") return "NEEDS_ALIAS_CLEANUP";
    return "BLOCK_P1_SWITCH";
  }
  if (row.backfill_action === "PROPOSE_CANONICAL_ENTITY_COLLAPSE") return "CAN_AUTO_COLLAPSE_IN_FUTURE";
  if (row.backfill_action === "PROPOSE_CANONICAL_ENTITY_CREATION") return "CAN_CREATE_CANONICAL_ENTITY_LATER";
  if (row.backfill_action === "REVIEW_ALIAS_CONFLICT") return "MANUAL_APPROVAL_REQUIRED";
  return "MANUAL_APPROVAL_REQUIRED";
}

function targetProfileReviewDecision(row: TargetProfileBackfillDryRunReportRow): HighRiskReviewDecision {
  if (row.risk_level === "HIGH") return "BLOCK_P1_SWITCH";
  return "CAN_CREATE_TARGET_PROFILE_DRAFT_LATER";
}

function reviewGroupSort(left: HighRiskReviewPlanGroup, right: HighRiskReviewPlanGroup): number {
  return Number(right.p10Blocker) - Number(left.p10Blocker)
    || riskSort(right.riskLevel) - riskSort(left.riskLevel)
    || right.rows - left.rows
    || left.reviewGroupType.localeCompare(right.reviewGroupType)
    || left.sourceValue.localeCompare(right.sourceValue);
}

function targetProfileBackfillGroups(
  rows: readonly TargetProfileBackfillDryRunReportRow[],
  limit = 20
): readonly TargetProfileBackfillGroup[] {
  const groups = new Map<string, {
    canonicalEntityCode: string;
    canonicalEntityDisplayName: string;
    currentEntityCodes: Set<string>;
    targetBucket: string;
    machineCenterNo: string;
    proposedTargetQty: number | null;
    rows: number;
    riskLevel: BackfillRiskLevel;
    riskReason: string;
    recommendedAction: string;
  }>();

  for (const row of rows) {
    const key = [
      row.canonical_entity_code,
      row.target_bucket,
      row.machine_center_no_normalized || "(blank)",
      row.proposed_target_qty || "(blank)",
      row.risk_level
    ].join(":");
    const current = groups.get(key) ?? {
      canonicalEntityCode: row.canonical_entity_code,
      canonicalEntityDisplayName: row.canonical_entity_display_name,
      currentEntityCodes: new Set<string>(),
      targetBucket: row.target_bucket,
      machineCenterNo: row.machine_center_no || "(generic)",
      proposedTargetQty: typeof row.proposed_target_qty === "number" ? row.proposed_target_qty : null,
      rows: 0,
      riskLevel: row.risk_level,
      riskReason: row.risk_reason,
      recommendedAction: row.recommended_action
    };
    current.rows += row.sample_rows;
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      canonicalEntityCode: group.canonicalEntityCode,
      canonicalEntityDisplayName: group.canonicalEntityDisplayName,
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      targetBucket: group.targetBucket,
      machineCenterNo: group.machineCenterNo,
      proposedTargetQty: group.proposedTargetQty,
      rows: group.rows,
      riskLevel: group.riskLevel,
      riskReason: group.riskReason,
      recommendedAction: group.recommendedAction
    }))
    .sort((left, right) => riskSort(right.riskLevel) - riskSort(left.riskLevel) || right.rows - left.rows || left.canonicalEntityCode.localeCompare(right.canonicalEntityCode))
    .slice(0, limit);
}

function riskSort(value: BackfillRiskLevel): number {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}

async function buildEntityV2BackfillDryRun(pool: DatabasePool): Promise<{
  readonly entityRows: readonly EntityV2BackfillDryRunReportRow[];
  readonly v2Rows: readonly EntityV2ReportRow[];
}> {
  const [catalog, sourceRows] = await Promise.all([
    queryBusinessCentralCanonicalEntityCatalog(pool),
    queryEntityV2SourceRows(pool)
  ]);
  const v2Rows = buildEntityV2ReportRows(sourceRows, catalog);
  return {
    entityRows: buildEntityV2BackfillDryRunReportRows(v2Rows),
    v2Rows
  };
}

async function runEntityV2BackfillDryRun(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.ENTITY_V2_BACKFILL_DRY_RUN_CSV?.trim() || DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.ENTITY_V2_BACKFILL_DRY_RUN_JSON?.trim() || DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_JSON_PATH);

  console.log("Business Central entity v2 backfill dry run");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; production_outputs.entity_id, aliases, conditional rules, dashboard, and target profiles are not changed.");

  const { entityRows } = await buildEntityV2BackfillDryRun(pool);
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const summary = summarizeEntityV2BackfillDryRunRows({ rows: entityRows, outputFiles });

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, entityV2BackfillRowsToCsv(entityRows), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_rows=${summary.totalRows}`);
  console.log(`- proposed_entity_backfill_rows=${summary.proposedEntityBackfillRows}`);
  console.log(`- no_change_rows=${summary.noChangeRows}`);
  console.log(`- high_risk_rows=${summary.highRiskRows}; medium_risk_rows=${summary.mediumRiskRows}; low_risk_rows=${summary.lowRiskRows}`);

  console.log("");
  console.log("Top proposed canonical entities");
  printEntityBackfillGroups(summary.topProposedCanonicalEntities.slice(0, 10));

  console.log("");
  console.log("Top high-risk groups");
  printEntityBackfillGroups(summary.topHighRiskGroups.slice(0, 10));

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

async function runTargetProfileBackfillDryRun(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.TARGET_PROFILE_BACKFILL_DRY_RUN_CSV?.trim() || DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.TARGET_PROFILE_BACKFILL_DRY_RUN_JSON?.trim() || DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_JSON_PATH);

  console.log("Business Central target profile backfill dry run");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; target_profiles, production_outputs.entity_id, old targets, and dashboard lookup are not changed.");

  const [{ entityRows, v2Rows }, productionTargets] = await Promise.all([
    buildEntityV2BackfillDryRun(pool),
    queryProductionTargetSources(pool)
  ]);
  const reportRows = buildTargetProfileBackfillDryRunReportRows({ entityRows, v2Rows, productionTargets });
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const summary = summarizeTargetProfileBackfillDryRunRows({ rows: reportRows, outputFiles });

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, targetProfileBackfillRowsToCsv(reportRows), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- proposed_target_profile_rows=${summary.proposedTargetProfileRows}`);
  console.log(`- high_risk_rows=${summary.highRiskRows}; medium_risk_rows=${summary.mediumRiskRows}; low_risk_rows=${summary.lowRiskRows}`);

  console.log("");
  console.log("Top proposed target profiles");
  printTargetProfileBackfillGroups(summary.topProposedTargetProfiles.slice(0, 10));

  console.log("");
  console.log("Top missing target quantity groups");
  printTargetProfileBackfillGroups(summary.topMissingTargetQtyGroups.slice(0, 10));

  console.log("");
  console.log("Top high-risk groups");
  printTargetProfileBackfillGroups(summary.topHighRiskGroups.slice(0, 10));

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

function printEntityBackfillGroups(groups: readonly EntityV2BackfillGroup[]) {
  if (groups.length === 0) {
    console.log("- none");
    return;
  }
  for (const item of groups) {
    console.log(
      `- proposed=${item.proposedCanonicalEntityCode}; rows=${item.rows}; risk=${item.riskLevel}; action=${item.action}; current=${item.currentEntityCodes.join("|") || "none"}; source=${item.sourceField}:${item.sourceValue}`
    );
  }
}

function printTargetProfileBackfillGroups(groups: readonly TargetProfileBackfillGroup[]) {
  if (groups.length === 0) {
    console.log("- none");
    return;
  }
  for (const item of groups) {
    console.log(
      `- canonical=${item.canonicalEntityCode}; bucket=${item.targetBucket}; machine_center=${item.machineCenterNo}; target=${item.proposedTargetQty ?? "blank"}; rows=${item.rows}; risk=${item.riskLevel}; current=${item.currentEntityCodes.join("|") || "none"}`
    );
  }
}

function highRiskReviewPlanRowsToCsv(groups: readonly HighRiskReviewPlanGroup[]): string {
  const rows: HighRiskReviewPlanCsvRow[] = groups.map((group) => ({
    review_group_type: group.reviewGroupType,
    source_field: group.sourceField,
    source_value: group.sourceValue,
    canonical_entity_code: group.canonicalEntityCode,
    current_entity_codes: group.currentEntityCodes.join("|"),
    proposed_entity_code: group.proposedEntityCode,
    target_bucket: group.targetBucket,
    machine_center_no: group.machineCenterNo,
    rows: group.rows,
    risk_level: group.riskLevel,
    risk_reason: group.riskReason,
    review_decision: group.reviewDecision,
    recommended_action: group.recommendedAction,
    p10_blocker: group.p10Blocker ? "TRUE" : "FALSE",
    bc_current_kpi_scope: group.bcCurrentKpiScope,
    bc_future_use_domain: group.bcFutureUseDomain,
    bc_scope_reason: group.bcScopeReason,
    bc_scope_evidence_fields: group.bcScopeEvidenceFields.join("|"),
    bc_entity_source_status: group.bcEntitySourceStatus,
    blocks_p10_after_scope: group.blocksP10AfterScope ? "TRUE" : "FALSE",
    sample_documents: group.sampleDocuments.join("|"),
    sample_items: group.sampleItems.join("|")
  }));
  const lines = [
    highRiskReviewPlanCsvHeaders.join(","),
    ...rows.map((row) => highRiskReviewPlanCsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function kpiCompareV1V2RowsToCsv(summary: KpiCompareV1V2Summary): string {
  const blockers = summary.blockers.length > 0 ? summary.blockers : [""];
  const rows: KpiCompareV1V2CsvRow[] = blockers.map((blocker) => ({
    status: summary.status,
    blocker,
    recommended_action: summary.status === "P1.0_BLOCKED_BY_HIGH_RISK_REVIEW"
      ? "Resolve P0.9a blockers before running KPI comparison for dashboard switch approval."
      : "Run read-only v1/v2 KPI comparison and review differences before any feature flag change."
  }));
  const lines = [
    kpiCompareV1V2CsvHeaders.join(","),
    ...rows.map((row) => kpiCompareV1V2CsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function buildUnknownScopeProfileInputRows(input: {
  readonly entityRows: readonly EntityV2BackfillDryRunReportRow[];
  readonly v2Rows: readonly EntityV2ReportRow[];
}): readonly BusinessCentralUnknownScopeProfileInputRow[] {
  return input.v2Rows.map((row, index) => {
    const entityRow = input.entityRows[index];
    const bcCurrentKpiScope = row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW" || entityRow?.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW"
      ? "UNKNOWN_SCOPE_REVIEW"
      : row.bc_current_kpi_scope;
    return {
      entryType: row.entry_type,
      locationCode: row.location_code,
      itemCategoryCode: row.item_category_code,
      unitOfMeasureCode: row.unit_of_measure_code,
      documentNo: row.document_no,
      itemNo: row.item_no,
      sourceValue: entityRow?.source_value || row.v2_source_value_used,
      currentEntityCode: row.current_entity_code,
      canonicalEntityCode: entityRow?.proposed_canonical_entity_code || row.v2_entity_code,
      targetBucket: row.v2_target_bucket_candidate,
      machineCenterNo: row.machine_center_no,
      bcCurrentKpiScope,
      bcEntitySourceStatus: row.bc_entity_source_status,
      blocksP10AfterScope: entityRow?.blocks_p10_after_scope === "true"
    };
  });
}

function unknownScopeProfileRowsToCsv(groups: readonly BusinessCentralUnknownScopeProfileGroup[]): string {
  const rows: UnknownScopeProfileCsvRow[] = groups.map((group) => ({
    group_id: group.groupId,
    rows: group.rows,
    blocks_p10_after_scope: group.blocksP10AfterScope ? "true" : "false",
    entry_type: group.entryType,
    location_code: group.locationCode,
    item_category_code: group.itemCategoryCode,
    unit_of_measure_code: group.unitOfMeasureCode,
    document_prefix: group.documentPrefix,
    item_prefix: group.itemPrefix,
    source_value: group.sourceValue,
    current_entity_codes: group.currentEntityCodes.join("|"),
    canonical_entity_code: group.canonicalEntityCode,
    target_bucket: group.targetBucket,
    machine_center_no: group.machineCenterNo,
    bc_entity_source_status: group.bcEntitySourceStatus,
    reason_unknown: group.reasonUnknown,
    sample_documents: group.sampleDocuments.join("|"),
    sample_items: group.sampleItems.join("|"),
    suggested_future_use_domain: group.suggestedFutureUseDomain,
    suggested_current_kpi_scope: group.suggestedCurrentKpiScope,
    suggested_rule: group.suggestedRule,
    confidence: group.confidence,
    needs_manual_review: group.needsManualReview ? "true" : "false"
  }));
  const lines = [
    unknownScopeProfileCsvHeaders.join(","),
    ...rows.map((row) => unknownScopeProfileCsvHeaders.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

async function runUnknownScopeProfile(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.UNKNOWN_SCOPE_PROFILE_CSV?.trim() || DEFAULT_UNKNOWN_SCOPE_PROFILE_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.UNKNOWN_SCOPE_PROFILE_JSON?.trim() || DEFAULT_UNKNOWN_SCOPE_PROFILE_JSON_PATH);

  console.log("Business Central P0.9d unknown scope evidence profile");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only profiler; database rows, target_profiles, aliases, conditional rules, classifier rules, and dashboard behavior are not changed.");

  const { entityRows, v2Rows } = await buildEntityV2BackfillDryRun(pool);
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const { groups, summary } = buildBusinessCentralUnknownScopeProfile({
    rows: buildUnknownScopeProfileInputRows({ entityRows, v2Rows }),
    outputFiles
  });

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, unknownScopeProfileRowsToCsv(groups), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_rows=${summary.totalRows}`);
  console.log(`- unknown_scope_rows=${summary.unknownScopeRows}`);
  console.log(`- unknown_scope_blocking_rows=${summary.unknownScopeBlockingRows}`);
  console.log(`- unknown_scope_non_blocking_rows=${summary.unknownScopeNonBlockingRows}`);
  console.log(`- p10_blocking_before_profiler=${summary.p10ImpactEstimate.blockingRowsBeforeProfiler}`);
  console.log(`- p10_blocking_after_profiler=${summary.p10ImpactEstimate.blockingRowsAfterProfiler}`);

  console.log("");
  console.log("Top unknown groups");
  for (const group of groups.slice(0, 10)) {
    console.log(`- ${group.groupId}; rows=${group.rows}; block=${group.blocksP10AfterScope ? "yes" : "no"}; entry=${group.entryType}; loc=${group.locationCode}; doc=${group.documentPrefix}; item=${group.itemPrefix}; source=${group.sourceValue}; suggested=${group.suggestedFutureUseDomain}; confidence=${group.confidence}`);
  }

  console.log("");
  console.log("Suggested classifier rule candidates");
  for (const candidate of summary.suggestedClassifierRuleCandidates.slice(0, 10)) {
    console.log(`- rows=${candidate.rows}; confidence=${candidate.confidence}; scope=${candidate.suggestedCurrentKpiScope}; domain=${candidate.suggestedFutureUseDomain}; rule=${candidate.suggestedRule}`);
  }

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

async function runHighRiskReviewPlan(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.HIGH_RISK_REVIEW_PLAN_CSV?.trim() || DEFAULT_HIGH_RISK_REVIEW_PLAN_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.HIGH_RISK_REVIEW_PLAN_JSON?.trim() || DEFAULT_HIGH_RISK_REVIEW_PLAN_JSON_PATH);

  console.log("Business Central P0.9a high-risk review plan");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; production_outputs.entity_id, target_profiles, dashboard, aliases, and conditional rules are not changed.");

  const { summary, groups, targetProfileDryRunSummary } = await buildHighRiskReviewPlan(pool);
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const jsonSummary = {
    ...summary,
    outputFiles,
    targetProfileReadiness: {
      targetProfilesTableAvailable: targetProfileDryRunSummary.targetProfilesTableAvailable,
      targetProfilesLoaded: targetProfileDryRunSummary.targetProfilesLoaded,
      resolverV2ResolvedRows: targetProfileDryRunSummary.resolverV2ResolvedRows,
      targetProfileNoActiveRows: targetProfileDryRunSummary.targetProfileNoActiveRows,
      targetProfileMatchedRows: targetProfileDryRunSummary.targetProfileMatchedRows
    }
  };

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, highRiskReviewPlanRowsToCsv(groups), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(jsonSummary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- entity_high_risk_rows=${summary.entityHighRiskRows}`);
  console.log(`- target_profile_high_risk_rows=${summary.targetProfileHighRiskRows}`);
  console.log(`- blocked_groups=${summary.blockedGroups}`);
  console.log(`- manual_approval_groups=${summary.manualApprovalGroups}`);
  console.log(`- safe_auto_migration_groups=${summary.safeAutoMigrationGroups}`);
  console.log(`- p10_gate_status=${summary.p10Gate.status}`);
  console.log(`- p10_gate_reason=${summary.p10Gate.reason}`);

  console.log("");
  console.log("Top blocked groups");
  printHighRiskReviewGroups(summary.topBlockedGroups.slice(0, 10));

  console.log("");
  console.log("Top manual approval groups");
  printHighRiskReviewGroups(summary.topManualApprovalGroups.slice(0, 10));

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

async function runKpiCompareV1V2(pool: DatabasePool) {
  const csvPath = resolveRepoPath(process.env.KPI_COMPARE_V1_V2_CSV?.trim() || DEFAULT_KPI_COMPARE_V1_V2_CSV_PATH);
  const jsonPath = resolveRepoPath(process.env.KPI_COMPARE_V1_V2_JSON?.trim() || DEFAULT_KPI_COMPARE_V1_V2_JSON_PATH);

  console.log("Business Central KPI compare v1/v2 scaffold");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`CSV output: ${displayRepoPath(csvPath)}`);
  console.log(`JSON output: ${displayRepoPath(jsonPath)}`);
  console.log("Safety: read-only; dashboard calculation and database rows are not changed.");

  const { summary: reviewSummary } = await buildHighRiskReviewPlan(pool);
  const kpiSummary = buildKpiCompareV1V2Summary({ p10Gate: reviewSummary.p10Gate });
  const outputFiles = {
    csv: displayRepoPath(csvPath),
    json: displayRepoPath(jsonPath)
  };
  const jsonSummary = {
    ...kpiSummary,
    outputFiles,
    p10Gate: reviewSummary.p10Gate
  };

  await mkdir(path.dirname(csvPath), { recursive: true });
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(csvPath, kpiCompareV1V2RowsToCsv(kpiSummary), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(jsonSummary, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- status=${kpiSummary.status}`);
  if (kpiSummary.blockers.length === 0) {
    console.log("- blockers=none");
  } else {
    for (const blocker of kpiSummary.blockers) console.log(`- blocker=${blocker}`);
  }

  console.log("");
  console.log("Reports written");
  console.log(`- ${outputFiles.csv}`);
  console.log(`- ${outputFiles.json}`);
}

function printHighRiskReviewGroups(groups: readonly HighRiskReviewPlanGroup[]) {
  if (groups.length === 0) {
    console.log("- none");
    return;
  }
  for (const item of groups) {
    console.log(
      `- type=${item.reviewGroupType}; source=${item.sourceField}:${item.sourceValue}; canonical=${item.canonicalEntityCode}; bucket=${item.targetBucket || "N/A"}; rows=${item.rows}; risk=${item.riskLevel}; decision=${item.reviewDecision}; blocker=${item.p10Blocker ? "yes" : "no"}`
    );
  }
}

function buildCanonicalEntityCreationPlanRows(
  rows: readonly EntityV2BackfillDryRunReportRow[]
): readonly CanonicalEntityCreationPlanCsvRow[] {
  const groups = new Map<string, {
    canonicalEntityCode: string;
    canonicalEntityDisplayName: string;
    sourceValues: Set<string>;
    currentEntityCodes: Set<string>;
    rows: number;
    riskLevel: BackfillRiskLevel;
    reason: string;
    recommendedAction: string;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();

  for (const row of rows) {
    if (row.backfill_action !== "PROPOSE_CANONICAL_ENTITY_CREATION") continue;
    const key = row.proposed_canonical_entity_code || "(blank)";
    const current = groups.get(key) ?? {
      canonicalEntityCode: key,
      canonicalEntityDisplayName: row.proposed_canonical_entity_display_name || key,
      sourceValues: new Set<string>(),
      currentEntityCodes: new Set<string>(),
      rows: 0,
      riskLevel: row.risk_level,
      reason: row.risk_reason,
      recommendedAction: row.recommended_action,
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    current.rows += 1;
    current.riskLevel = higherRiskLevel(current.riskLevel, row.risk_level);
    if (row.source_value) current.sourceValues.add(row.source_value);
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.document_no);
    if (row.item_no && current.sampleItems.size < 5) current.sampleItems.add(row.item_no);
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    const item = buildCanonicalEntityCreationPlanItem({
      canonicalEntityCode: group.canonicalEntityCode,
      canonicalEntityDisplayName: group.canonicalEntityDisplayName,
      sourceValues: sortedStrings(group.sourceValues),
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      rows: group.rows,
      riskLevel: group.riskLevel,
      reason: group.reason,
      recommendedAction: group.recommendedAction,
      sampleDocuments: [...group.sampleDocuments],
      sampleItems: [...group.sampleItems]
    });
    return {
      canonical_entity_code: item.canonicalEntityCode,
      canonical_entity_display_name: item.canonicalEntityDisplayName,
      area_candidate: item.areaCandidate,
      source_values: item.sourceValues.join("|"),
      current_entity_codes: item.currentEntityCodes.join("|"),
      rows: item.rows,
      risk_level: item.riskLevel,
      reason: item.reason,
      recommended_action: item.recommendedAction,
      sample_documents: item.sampleDocuments.join("|"),
      sample_items: item.sampleItems.join("|"),
      approval_status: item.approvalStatus
    };
  }).sort((left, right) => right.rows - left.rows || left.canonical_entity_code.localeCompare(right.canonical_entity_code));
}

function buildAliasCleanupReviewPlanRows(
  rows: readonly EntityV2BackfillDryRunReportRow[]
): readonly AliasCleanupReviewPlanCsvRow[] {
  const groups = new Map<string, {
    sourceField: string;
    sourceValue: string;
    currentEntityCodes: Set<string>;
    proposedCanonicalEntityCode: string;
    rows: number;
    riskLevel: BackfillRiskLevel;
    reason: string;
    recommendedAction: string;
    sampleDocuments: Set<string>;
    sampleItems: Set<string>;
  }>();
  const actions = new Set<EntityV2BackfillAction>(["REVIEW_ALIAS_CONFLICT", "REVIEW_DATA_SOURCE_GAP", "SKIP_HIGH_RISK"]);

  for (const row of rows) {
    if (!actions.has(row.backfill_action)) continue;
    const key = [
      row.source_field,
      normalizeAliasKey(row.source_value),
      row.proposed_canonical_entity_code || "(blank)",
      row.backfill_action,
      row.risk_level
    ].join(":");
    const current = groups.get(key) ?? {
      sourceField: row.source_field,
      sourceValue: row.source_value || "(blank)",
      currentEntityCodes: new Set<string>(),
      proposedCanonicalEntityCode: row.proposed_canonical_entity_code || "(blank)",
      rows: 0,
      riskLevel: row.risk_level,
      reason: row.risk_reason,
      recommendedAction: row.recommended_action,
      sampleDocuments: new Set<string>(),
      sampleItems: new Set<string>()
    };
    current.rows += 1;
    current.riskLevel = higherRiskLevel(current.riskLevel, row.risk_level);
    if (row.current_entity_code) current.currentEntityCodes.add(row.current_entity_code);
    if (row.document_no && current.sampleDocuments.size < 5) current.sampleDocuments.add(row.document_no);
    if (row.item_no && current.sampleItems.size < 5) current.sampleItems.add(row.item_no);
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    const item = buildAliasCleanupReviewPlanItem({
      sourceField: group.sourceField,
      sourceValue: group.sourceValue,
      currentEntityCodes: sortedStrings(group.currentEntityCodes),
      proposedCanonicalEntityCode: group.proposedCanonicalEntityCode,
      rows: group.rows,
      riskLevel: group.riskLevel,
      reason: group.reason,
      recommendedAction: group.recommendedAction,
      sampleDocuments: [...group.sampleDocuments],
      sampleItems: [...group.sampleItems]
    });
    return {
      source_field: item.sourceField,
      source_value: item.sourceValue,
      current_entity_codes: item.currentEntityCodes.join("|"),
      proposed_canonical_entity_code: item.proposedCanonicalEntityCode,
      rows: item.rows,
      conflict_type: item.conflictType,
      risk_level: item.riskLevel,
      reason: item.reason,
      recommended_action: item.recommendedAction,
      sample_documents: item.sampleDocuments.join("|"),
      sample_items: item.sampleItems.join("|"),
      approval_status: item.approvalStatus
    };
  }).sort((left, right) => riskSort(right.risk_level) - riskSort(left.risk_level) || right.rows - left.rows || left.source_value.localeCompare(right.source_value));
}

function buildTargetProfileSeedDraftPlanRows(
  rows: readonly TargetProfileBackfillDryRunReportRow[]
): readonly TargetProfileSeedDraftPlanCsvRow[] {
  return rows.map((row) => {
    const targetQty = typeof row.proposed_target_qty === "number" ? row.proposed_target_qty : null;
    const item = buildTargetProfileSeedDraftPlanItem({
      canonicalEntityCode: row.canonical_entity_code,
      canonicalEntityDisplayName: row.canonical_entity_display_name,
      targetBucket: row.target_bucket,
      machineCenterNo: row.machine_center_no,
      machineCenterNoNormalized: row.machine_center_no_normalized,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      targetQty,
      unit: row.unit,
      sourceCurrentEntityCode: row.current_entity_code,
      sourceTargetValueOrigin: targetProfileValueOrigin(row),
      rows: row.sample_rows,
      riskLevel: row.risk_level,
      reason: row.risk_reason,
      recommendedAction: targetQty === null ? "Fill target_qty manually before migration." : row.recommended_action,
      sampleDocuments: row.sample_documents,
      sampleItems: row.sample_items
    });
    return {
      canonical_entity_code: item.canonicalEntityCode,
      canonical_entity_display_name: item.canonicalEntityDisplayName,
      target_bucket: item.targetBucket,
      machine_center_no: item.machineCenterNo,
      machine_center_no_normalized: item.machineCenterNoNormalized,
      effective_from: item.effectiveFrom,
      effective_to: item.effectiveTo,
      target_qty: item.targetQty ?? "",
      unit: item.unit,
      source_current_entity_code: item.sourceCurrentEntityCode,
      source_target_value_origin: item.sourceTargetValueOrigin,
      rows: item.rows,
      risk_level: item.riskLevel,
      reason: item.reason,
      recommended_action: item.recommendedAction,
      approval_status: item.approvalStatus,
      sample_documents: item.sampleDocuments.join("|"),
      sample_items: item.sampleItems.join("|")
    };
  }).sort((left, right) => riskSort(right.risk_level) - riskSort(left.risk_level) || right.rows - left.rows || left.canonical_entity_code.localeCompare(right.canonical_entity_code));
}

function buildManualApprovalQueueRows(
  groups: readonly HighRiskReviewPlanGroup[]
): readonly ManualApprovalQueueCsvRow[] {
  return groups.map((group) => {
    const item = buildManualApprovalQueueItem(group);
    return {
      priority: item.priority,
      review_group_type: item.reviewGroupType,
      source_value: item.sourceValue,
      canonical_entity_code: item.canonicalEntityCode,
      current_entity_codes: item.currentEntityCodes.join("|"),
      target_bucket: item.targetBucket,
      machine_center_no: item.machineCenterNo,
      rows: item.rows,
      risk_level: item.riskLevel,
      decision_needed: item.decisionNeeded,
      recommended_action: item.recommendedAction,
      blocks_p10: item.blocksP10 ? "true" : "false",
      bc_current_kpi_scope: item.bcCurrentKpiScope,
      bc_future_use_domain: item.bcFutureUseDomain,
      bc_scope_reason: item.bcScopeReason,
      bc_entity_source_status: item.bcEntitySourceStatus,
      blocks_p10_after_scope: item.blocksP10AfterScope ? "true" : "false",
      sample_documents: item.sampleDocuments.join("|"),
      sample_items: item.sampleItems.join("|")
    };
  }).sort((left, right) => prioritySort(left.priority) - prioritySort(right.priority) || right.rows - left.rows || left.source_value.localeCompare(right.source_value));
}

function buildBlockedGroupsChecklistRows(
  groups: readonly HighRiskReviewPlanGroup[]
): readonly BlockedGroupsChecklistCsvRow[] {
  return groups
    .filter((group) => group.blocksP10AfterScope)
    .sort(reviewGroupSort)
    .map((group, index) => {
      const item = buildBlockedGroupsChecklistItem(group, index);
      return {
        blocker_id: item.blockerId,
        blocker_type: item.blockerType,
        source_value: item.sourceValue,
        rows: item.rows,
        current_status: item.currentStatus,
        required_resolution: item.requiredResolution,
        owner: item.owner,
        approval_status: item.approvalStatus,
        resolved: "false",
        notes: item.notes
      };
    });
}

function targetProfileValueOrigin(row: TargetProfileBackfillDryRunReportRow): string {
  if (row.proposed_target_qty === "") {
    return row.risk_reason.includes("Multiple old target quantities")
      ? "ambiguous_production_targets"
      : "missing_target_qty";
  }
  return `production_targets:${row.current_entity_code}`;
}

function resolutionPackageCsv<T extends Record<string, unknown>>(
  headers: readonly (keyof T)[],
  rows: readonly T[]
): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvField(row[header])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

function buildResolutionPackageReadme(summary: ResolutionPackageSummary): string {
  return `# Business Central P0.9b Resolution Package

Generated at: ${summary.generatedAt}

P1.0 status: ${summary.p10Readiness.status}

Reason:

${summary.p10Readiness.reason}

## Files

- \`${RESOLUTION_PACKAGE_SUMMARY_FILE}\`: package counts, source reports, P1.0 readiness, and safety flags.
- \`${RESOLUTION_PACKAGE_CANONICAL_FILE}\`: canonical entities that likely need to exist before migration.
- \`${RESOLUTION_PACKAGE_ALIAS_FILE}\`: source values and current mappings that need alias/catalog cleanup review.
- \`${RESOLUTION_PACKAGE_TARGET_PROFILE_FILE}\`: target profile seed drafts for later human review.
- \`${RESOLUTION_PACKAGE_MANUAL_QUEUE_FILE}\`: prioritized business/data owner review queue.
- \`${RESOLUTION_PACKAGE_BLOCKED_CHECKLIST_FILE}\`: checklist for blockers that must be resolved before P1.0.

## Required Review Order

1. Review canonical entity creation plan.
2. Review alias cleanup plan.
3. Review target profile seed drafts.
4. Approve or manually fill target_qty where needed.
5. Re-run P0.9 and P0.9a dry-run commands.
6. Only then consider P1.0.

## What Not To Do

- Do not update \`production_outputs.entity_id\` from this package.
- Do not insert/update/delete \`target_profiles\` from this package.
- Do not create canonical entities automatically.
- Do not delete/deactivate aliases or conditional rules automatically.
- Do not create broad/global aliases to force ambiguous mappings.
- Do not switch dashboard behavior while \`p10Readiness.status\` is not \`PASS\`.

## Current Counts

- Canonical entity creation candidates: ${summary.counts.canonicalEntityCreationCandidates}
- Alias cleanup candidates: ${summary.counts.aliasCleanupCandidates}
- Target profile seed draft candidates: ${summary.counts.targetProfileSeedDraftCandidates}
- Manual approval items: ${summary.counts.manualApprovalItems}
- Blocked groups: ${summary.counts.blockedGroups}
- Unknown scope rows: ${summary.unknownScopeProfile.unknownScopeRows}
- Unknown scope profile CSV: ${summary.unknownScopeProfile.profileCsvPath ?? "not generated yet"}

## Required Before P1.0

${summary.p10Readiness.requiredBeforeP10.map((item) => `- ${item}`).join("\n")}
`;
}

function dedupeHighRiskReviewGroups(
  groups: readonly HighRiskReviewPlanGroup[]
): readonly HighRiskReviewPlanGroup[] {
  const deduped = new Map<string, HighRiskReviewPlanGroup>();
  for (const group of groups) {
    const key = scopedGroupKey(group);
    if (!deduped.has(key)) deduped.set(key, group);
  }
  return [...deduped.values()].sort(reviewGroupSort);
}

function scopedBlockerCategory(group: HighRiskReviewPlanGroup): string {
  if (group.bcCurrentKpiScope === "UNKNOWN_SCOPE_REVIEW") return "UNKNOWN_SCOPE_BLOCKER";
  if (group.reviewGroupType.startsWith("TARGET_PROFILE")) return "TARGET_PROFILE_BLOCKER";
  if (group.bcCurrentKpiScope === "OUTPUT_KPI_REJECT_SCOPE") return "REJECT_SCOPE_BLOCKER";
  if (group.reviewGroupType.startsWith("ENTITY") && group.bcCurrentKpiScope === "OUTPUT_KPI_OK_SCOPE") return "OK_OUTPUT_ENTITY_BLOCKER";
  return "TRUE_P10_BLOCKER";
}

function scopedBlockerRows(groups: readonly HighRiskReviewPlanGroup[]): readonly ScopedBlockerPackageCsvRow[] {
  return groups.map((group, index) => ({
    blocker_group_id: `SB${String(index + 1).padStart(5, "0")}`,
    blocker_category: scopedBlockerCategory(group),
    review_group_type: group.reviewGroupType,
    source_field: group.sourceField,
    source_value: group.sourceValue,
    canonical_entity_code: group.canonicalEntityCode,
    current_entity_codes: group.currentEntityCodes.join("|"),
    proposed_entity_code: group.proposedEntityCode,
    target_bucket: group.targetBucket,
    machine_center_no: group.machineCenterNo,
    rows: group.rows,
    risk_level: group.riskLevel,
    risk_reason: group.riskReason,
    review_decision: group.reviewDecision,
    recommended_action: group.recommendedAction,
    p10_blocker_before_scope: group.p10Blocker ? "true" : "false",
    blocks_p10_after_scope: group.blocksP10AfterScope ? "true" : "false",
    bc_current_kpi_scope: group.bcCurrentKpiScope,
    bc_future_use_domain: group.bcFutureUseDomain,
    bc_scope_reason: group.bcScopeReason,
    bc_scope_evidence_fields: group.bcScopeEvidenceFields.join("|"),
    bc_entity_source_status: group.bcEntitySourceStatus,
    sample_documents: group.sampleDocuments.join("|"),
    sample_items: group.sampleItems.join("|")
  }));
}

function scopedBlockerCsv(rows: readonly ScopedBlockerPackageCsvRow[]): string {
  return resolutionPackageCsv(scopedBlockerPackageCsvHeaders, rows);
}

function scopedDecisionTemplateRows<T extends Record<string, unknown>>(rows: readonly T[]): readonly (T & {
  readonly decision: "";
  readonly approved_by: "";
  readonly notes: "";
})[] {
  return rows.map((row) => ({
    ...row,
    decision: "",
    approved_by: "",
    notes: ""
  }));
}

function summarizeEntityRowsForScopedPackage(rows: readonly EntityV2BackfillDryRunReportRow[]) {
  return {
    totalRows: rows.length,
    outputKpiOkScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_OK_SCOPE").length,
    outputKpiRejectScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE").length,
    outOfCurrentKpiScopeRows: rows.filter((row) => row.bc_current_kpi_scope === "OUT_OF_CURRENT_KPI_SCOPE").length,
    unknownScopeReviewRows: rows.filter((row) => row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW").length,
    futureUseDomainCounts: topCounts(rows.map((row) => row.bc_future_use_domain), 20),
    p10BlockingRowsBeforeScope: rows.filter((row) => row.risk_level === "HIGH").length,
    p10BlockingRowsAfterScope: rows.filter((row) => row.risk_level === "HIGH" && row.blocks_p10_after_scope === "true").length,
    excludedFromP10ButRetainedRows: rows.filter((row) => row.risk_level === "HIGH" && row.blocks_p10_after_scope === "false").length
  };
}

function groupedRows(groups: readonly HighRiskReviewPlanGroup[]): number {
  return groups.reduce((sum, group) => sum + group.rows, 0);
}

function parseCsvLine(line: string): readonly string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function readCsvRows(
  filePath: string,
  onRow: (row: Record<string, string>) => void
): Promise<void> {
  const input = createReadStream(filePath);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: readonly string[] | null = null;
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    if (!line) continue;
    const fields = parseCsvLine(line);
    onRow(Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""])));
  }
}

function appendDecisionTemplateColumns(csv: string): string {
  const lines = csv.trimEnd().split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return "decision,approved_by,notes\n";
  const [header, ...rows] = lines;
  return [
    `${header},decision,approved_by,notes`,
    ...rows.map((row) => `${row},,,`)
  ].join("\n").concat("\n");
}

function scopedGroupKey(group: HighRiskReviewPlanGroup): string {
  return [
    group.reviewGroupType,
    group.sourceField,
    normalizeAliasKey(group.sourceValue),
    group.canonicalEntityCode,
    group.proposedEntityCode,
    group.targetBucket,
    normalizeAliasKey(group.machineCenterNo),
    group.riskLevel,
    group.reviewDecision,
    group.bcCurrentKpiScope,
    group.bcFutureUseDomain,
    group.blocksP10AfterScope ? "block" : "nonblock"
  ].join(":");
}

function buildScopedBlockerPackageReadme(summary: {
  readonly generatedAt: string;
  readonly p10Readiness: { readonly status: string; readonly reason: string };
  readonly counts: {
    readonly trueP10BlockerGroups: number;
    readonly unknownScopeBlockerGroups: number;
    readonly okOutputEntityBlockerGroups: number;
    readonly rejectScopeBlockerGroups: number;
    readonly targetProfileBlockerGroups: number;
  };
}): string {
  return `# Business Central P0.9f Scoped Blocker Package

Generated at: ${summary.generatedAt}

P1.0 status: ${summary.p10Readiness.status}

Reason:

${summary.p10Readiness.reason}

## Files

- \`${SCOPED_BLOCKER_PACKAGE_SUMMARY_FILE}\`: row-level source scope counts, deduped blocker group counts, P1.0 readiness, and safety flags.
- \`${SCOPED_BLOCKER_TRUE_P10_FILE}\`: deduped blocker groups that still block P1.0 after scope filtering.
- \`${SCOPED_BLOCKER_UNKNOWN_SCOPE_FILE}\`: remaining unknown-scope blocker groups.
- \`${SCOPED_BLOCKER_OK_OUTPUT_ENTITY_FILE}\`: current OK output entity blocker groups.
- \`${SCOPED_BLOCKER_REJECT_SCOPE_FILE}\`: reject-scope blocker groups retained for reject review.
- \`${SCOPED_BLOCKER_TARGET_PROFILE_FILE}\`: target profile blocker groups.
- \`${SCOPED_BLOCKER_ALIAS_TEMPLATE_FILE}\`: alias cleanup decision template.
- \`${SCOPED_BLOCKER_CANONICAL_TEMPLATE_FILE}\`: canonical entity decision template.
- \`${SCOPED_BLOCKER_TARGET_PROFILE_TEMPLATE_FILE}\`: target profile decision template.

## Counting Rules

- Source row counts are computed once from the entity backfill dry-run rows.
- Blocker CSV files are grouped review queues and can overlap by source evidence.
- Summary group counts are deduped by review group identity.
- \`excludedFromP10ButRetainedRows\` is a source row count, not a sum of CSV files.

## Current Blocker Groups

- True P1.0 blocker groups: ${summary.counts.trueP10BlockerGroups}
- Unknown scope blocker groups: ${summary.counts.unknownScopeBlockerGroups}
- OK output entity blocker groups: ${summary.counts.okOutputEntityBlockerGroups}
- Reject scope blocker groups: ${summary.counts.rejectScopeBlockerGroups}
- Target profile blocker groups: ${summary.counts.targetProfileBlockerGroups}

## Safety

- Reporting/classification only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
`;
}

async function runScopedBlockerPackage(pool: DatabasePool) {
  const outputDir = resolveRepoPath(process.env.SCOPED_BLOCKER_PACKAGE_DIR?.trim() || DEFAULT_SCOPED_BLOCKER_PACKAGE_DIR);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_BLOCKER_PACKAGE_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_BLOCKER_PACKAGE_README_FILE),
    trueP10: path.join(outputDir, SCOPED_BLOCKER_TRUE_P10_FILE),
    unknownScope: path.join(outputDir, SCOPED_BLOCKER_UNKNOWN_SCOPE_FILE),
    okOutputEntity: path.join(outputDir, SCOPED_BLOCKER_OK_OUTPUT_ENTITY_FILE),
    rejectScope: path.join(outputDir, SCOPED_BLOCKER_REJECT_SCOPE_FILE),
    targetProfile: path.join(outputDir, SCOPED_BLOCKER_TARGET_PROFILE_FILE),
    aliasTemplate: path.join(outputDir, SCOPED_BLOCKER_ALIAS_TEMPLATE_FILE),
    canonicalTemplate: path.join(outputDir, SCOPED_BLOCKER_CANONICAL_TEMPLATE_FILE),
    targetProfileTemplate: path.join(outputDir, SCOPED_BLOCKER_TARGET_PROFILE_TEMPLATE_FILE)
  };

  console.log("Business Central P0.9f scoped blocker package");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: export-only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const { summary: highRiskSummary, groups, entityRows, targetProfileRows } = await buildHighRiskReviewPlan(pool);
  const dedupedGroups = dedupeHighRiskReviewGroups(groups);
  const trueP10Groups = dedupedGroups.filter((group) => group.blocksP10AfterScope);
  const trueP10Rows = scopedBlockerRows(trueP10Groups);
  const unknownScopeRows = trueP10Rows.filter((row) => row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW");
  const okOutputEntityRows = trueP10Rows.filter((row) => row.blocker_category === "OK_OUTPUT_ENTITY_BLOCKER");
  const rejectScopeRows = trueP10Rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE");
  const targetProfileRowsForCsv = trueP10Rows.filter((row) => row.review_group_type.startsWith("TARGET_PROFILE"));
  const canonicalRows = buildCanonicalEntityCreationPlanRows(entityRows);
  const aliasRows = buildAliasCleanupReviewPlanRows(entityRows);
  const targetProfileSeedRows = buildTargetProfileSeedDraftPlanRows(targetProfileRows);
  const rowScopeSummary = summarizeEntityRowsForScopedPackage(entityRows);
  const summary = {
    generatedAt: new Date().toISOString(),
    sourceReports: {
      entityBackfillDryRun: DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_JSON_PATH,
      targetProfileBackfillDryRun: DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_JSON_PATH,
      highRiskReviewPlan: DEFAULT_HIGH_RISK_REVIEW_PLAN_JSON_PATH
    },
    outputFiles: Object.fromEntries(Object.entries(outputFiles).map(([key, value]) => [key, displayRepoPath(value)])),
    rowCounts: rowScopeSummary,
    groupCounts: {
      dedupedReviewGroups: dedupedGroups.length,
      p10BlockerGroupsBeforeScope: dedupedGroups.filter((group) => group.p10Blocker).length,
      trueP10BlockerGroups: trueP10Groups.length,
      trueP10BlockerGroupedRows: groupedRows(trueP10Groups),
      unknownScopeBlockerGroups: unknownScopeRows.length,
      unknownScopeBlockerGroupedRows: unknownScopeRows.reduce((sum, row) => sum + row.rows, 0),
      okOutputEntityBlockerGroups: okOutputEntityRows.length,
      okOutputEntityBlockerGroupedRows: okOutputEntityRows.reduce((sum, row) => sum + row.rows, 0),
      rejectScopeBlockerGroups: rejectScopeRows.length,
      rejectScopeBlockerGroupedRows: rejectScopeRows.reduce((sum, row) => sum + row.rows, 0),
      targetProfileBlockerGroups: targetProfileRowsForCsv.length,
      targetProfileBlockerGroupedRows: targetProfileRowsForCsv.reduce((sum, row) => sum + row.rows, 0),
      excludedFromP10ButRetainedGroups: dedupedGroups.filter((group) => group.p10Blocker && !group.blocksP10AfterScope).length,
      excludedFromP10ButRetainedGroupedRows: groupedRows(dedupedGroups.filter((group) => group.p10Blocker && !group.blocksP10AfterScope))
    },
    decisionTemplateCounts: {
      aliasCleanupRows: aliasRows.length,
      canonicalEntityRows: canonicalRows.length,
      targetProfileRows: targetProfileSeedRows.length
    },
    p10Readiness: {
      status: highRiskSummary.p10Gate.status,
      reason: highRiskSummary.p10Gate.reason,
      blockers: highRiskSummary.p10Gate.blockers
    },
    topRemainingTrueBlockers: trueP10Rows.slice(0, 10).map((row) => ({
      blockerGroupId: row.blocker_group_id,
      category: row.blocker_category,
      reviewGroupType: row.review_group_type,
      sourceValue: row.source_value,
      rows: row.rows,
      riskLevel: row.risk_level,
      currentKpiScope: row.bc_current_kpi_scope,
      futureUseDomain: row.bc_future_use_domain,
      recommendedAction: row.recommended_action
    })),
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedBlockerPackageReadme({
    generatedAt: summary.generatedAt,
    p10Readiness: summary.p10Readiness,
    counts: summary.groupCounts
  }), "utf8");
  await writeFile(outputFiles.trueP10, scopedBlockerCsv(trueP10Rows), "utf8");
  await writeFile(outputFiles.unknownScope, scopedBlockerCsv(unknownScopeRows), "utf8");
  await writeFile(outputFiles.okOutputEntity, scopedBlockerCsv(okOutputEntityRows), "utf8");
  await writeFile(outputFiles.rejectScope, scopedBlockerCsv(rejectScopeRows), "utf8");
  await writeFile(outputFiles.targetProfile, scopedBlockerCsv(targetProfileRowsForCsv), "utf8");
  await writeFile(outputFiles.aliasTemplate, resolutionPackageCsv(scopedAliasCleanupDecisionTemplateCsvHeaders, scopedDecisionTemplateRows(aliasRows)), "utf8");
  await writeFile(outputFiles.canonicalTemplate, resolutionPackageCsv(scopedCanonicalEntityDecisionTemplateCsvHeaders, scopedDecisionTemplateRows(canonicalRows)), "utf8");
  await writeFile(outputFiles.targetProfileTemplate, resolutionPackageCsv(scopedTargetProfileDecisionTemplateCsvHeaders, scopedDecisionTemplateRows(targetProfileSeedRows)), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_source_rows=${summary.rowCounts.totalRows}`);
  console.log(`- unknown_scope_review_rows=${summary.rowCounts.unknownScopeReviewRows}`);
  console.log(`- p10_blocking_rows_before_scope=${summary.rowCounts.p10BlockingRowsBeforeScope}`);
  console.log(`- p10_blocking_rows_after_scope=${summary.rowCounts.p10BlockingRowsAfterScope}`);
  console.log(`- excluded_from_p10_but_retained_rows=${summary.rowCounts.excludedFromP10ButRetainedRows}`);
  console.log(`- true_p10_blocker_groups=${summary.groupCounts.trueP10BlockerGroups}`);
  console.log(`- p10_status=${summary.p10Readiness.status}`);

  console.log("");
  console.log("Top remaining true blockers");
  for (const blocker of summary.topRemainingTrueBlockers) {
    console.log(`- ${blocker.blockerGroupId}; ${blocker.category}; source=${blocker.sourceValue}; rows=${blocker.rows}; scope=${blocker.currentKpiScope}; action=${blocker.recommendedAction}`);
  }

  console.log("");
  console.log("Package files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runScopedBlockerPackageFromFiles(cause: unknown) {
  const outputDir = resolveRepoPath(process.env.SCOPED_BLOCKER_PACKAGE_DIR?.trim() || DEFAULT_SCOPED_BLOCKER_PACKAGE_DIR);
  const entityCsvPath = resolveRepoPath(process.env.ENTITY_V2_BACKFILL_DRY_RUN_CSV?.trim() || DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH);
  const targetProfileCsvPath = resolveRepoPath(process.env.TARGET_PROFILE_BACKFILL_DRY_RUN_CSV?.trim() || DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_CSV_PATH);
  const resolutionPackageDir = resolveRepoPath(process.env.RESOLUTION_PACKAGE_DIR?.trim() || DEFAULT_RESOLUTION_PACKAGE_DIR);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_BLOCKER_PACKAGE_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_BLOCKER_PACKAGE_README_FILE),
    trueP10: path.join(outputDir, SCOPED_BLOCKER_TRUE_P10_FILE),
    unknownScope: path.join(outputDir, SCOPED_BLOCKER_UNKNOWN_SCOPE_FILE),
    okOutputEntity: path.join(outputDir, SCOPED_BLOCKER_OK_OUTPUT_ENTITY_FILE),
    rejectScope: path.join(outputDir, SCOPED_BLOCKER_REJECT_SCOPE_FILE),
    targetProfile: path.join(outputDir, SCOPED_BLOCKER_TARGET_PROFILE_FILE),
    aliasTemplate: path.join(outputDir, SCOPED_BLOCKER_ALIAS_TEMPLATE_FILE),
    canonicalTemplate: path.join(outputDir, SCOPED_BLOCKER_CANONICAL_TEMPLATE_FILE),
    targetProfileTemplate: path.join(outputDir, SCOPED_BLOCKER_TARGET_PROFILE_TEMPLATE_FILE)
  };
  const generatedAt = new Date().toISOString();
  const rowScopeCounts = new Map<BusinessCentralCurrentKpiScope, number>();
  const futureUseDomainCounts = new Map<string, number>();
  const groups = new Map<string, HighRiskReviewPlanGroup>();
  let totalRows = 0;
  let p10BlockingRowsBeforeScope = 0;
  let p10BlockingRowsAfterScope = 0;
  let excludedFromP10ButRetainedRows = 0;

  await readCsvRows(entityCsvPath, (row) => {
    const highRisk = row.risk_level === "HIGH";
    const scope = classifyBusinessCentralDataScope({
      entryType: row.entry_type,
      locationCode: row.location_code,
      itemNo: row.item_no,
      itemDescription: row.item_description,
      documentNo: row.document_no,
      quantity: numberValue(row.quantity),
      machineCenterNo: row.machine_center_no,
      blocksP10BeforeScope: highRisk
    });
    totalRows += 1;
    rowScopeCounts.set(scope.bcCurrentKpiScope, (rowScopeCounts.get(scope.bcCurrentKpiScope) ?? 0) + 1);
    futureUseDomainCounts.set(scope.bcFutureUseDomain, (futureUseDomainCounts.get(scope.bcFutureUseDomain) ?? 0) + 1);
    if (highRisk) p10BlockingRowsBeforeScope += 1;
    if (scope.blocksP10AfterScope) p10BlockingRowsAfterScope += 1;
    if (highRisk && !scope.blocksP10AfterScope) excludedFromP10ButRetainedRows += 1;
    if (!highRisk || !scope.blocksP10AfterScope) return;
    const group = scopedCsvEntityGroup(row, scope);
    const key = scopedGroupKey(group);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, group);
      return;
    }
    groups.set(key, {
      ...current,
      rows: current.rows + 1,
      sampleDocuments: sampleValues([...current.sampleDocuments, row.document_no]),
      sampleItems: sampleValues([...current.sampleItems, row.item_no])
    });
  });

  await readCsvRows(targetProfileCsvPath, (row) => {
    if (row.risk_level !== "HIGH" || row.blocks_p10_after_scope !== "true") return;
    const group = scopedCsvTargetProfileGroup(row);
    const key = scopedGroupKey(group);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, group);
      return;
    }
    groups.set(key, {
      ...current,
      rows: current.rows + numberValue(row.sample_rows),
      sampleDocuments: sampleValues([...current.sampleDocuments, ...(row.sample_documents ?? "").split("|")]),
      sampleItems: sampleValues([...current.sampleItems, ...(row.sample_items ?? "").split("|")])
    });
  });

  const dedupedGroups = [...groups.values()].sort(reviewGroupSort);
  const trueP10Rows = scopedBlockerRows(dedupedGroups);
  const unknownScopeRows = trueP10Rows.filter((row) => row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW");
  const okOutputEntityRows = trueP10Rows.filter((row) => row.blocker_category === "OK_OUTPUT_ENTITY_BLOCKER");
  const rejectScopeRows = trueP10Rows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE");
  const targetProfileRowsForCsv = trueP10Rows.filter((row) => row.review_group_type.startsWith("TARGET_PROFILE"));
  const p10Blockers = trueP10Rows.length > 0
    ? [`Unresolved scoped P1.0 blockers remain: groups=${trueP10Rows.length}, groupedRows=${trueP10Rows.reduce((sum, row) => sum + row.rows, 0)}.`]
    : [];
  const summary = {
    generatedAt,
    mode: "FILE_FALLBACK_AFTER_DB_CONNECTION_FAILURE",
    fallbackReason: cause instanceof Error ? cause.message : "DB connection failed",
    sourceReports: {
      entityBackfillDryRunCsv: displayRepoPath(entityCsvPath),
      targetProfileBackfillDryRunCsv: displayRepoPath(targetProfileCsvPath),
      resolutionPackageDir: displayRepoPath(resolutionPackageDir)
    },
    outputFiles: Object.fromEntries(Object.entries(outputFiles).map(([key, value]) => [key, displayRepoPath(value)])),
    rowCounts: {
      totalRows,
      outputKpiOkScopeRows: rowScopeCounts.get("OUTPUT_KPI_OK_SCOPE") ?? 0,
      outputKpiRejectScopeRows: rowScopeCounts.get("OUTPUT_KPI_REJECT_SCOPE") ?? 0,
      outOfCurrentKpiScopeRows: rowScopeCounts.get("OUT_OF_CURRENT_KPI_SCOPE") ?? 0,
      unknownScopeReviewRows: rowScopeCounts.get("UNKNOWN_SCOPE_REVIEW") ?? 0,
      futureUseDomainCounts: [...futureUseDomainCounts.entries()].map(([value, rows]) => ({ value, rows })).sort((left, right) => right.rows - left.rows || left.value.localeCompare(right.value)),
      p10BlockingRowsBeforeScope,
      p10BlockingRowsAfterScope,
      excludedFromP10ButRetainedRows
    },
    groupCounts: {
      dedupedReviewGroups: dedupedGroups.length,
      p10BlockerGroupsBeforeScope: dedupedGroups.length,
      trueP10BlockerGroups: trueP10Rows.length,
      trueP10BlockerGroupedRows: trueP10Rows.reduce((sum, row) => sum + row.rows, 0),
      unknownScopeBlockerGroups: unknownScopeRows.length,
      unknownScopeBlockerGroupedRows: unknownScopeRows.reduce((sum, row) => sum + row.rows, 0),
      okOutputEntityBlockerGroups: okOutputEntityRows.length,
      okOutputEntityBlockerGroupedRows: okOutputEntityRows.reduce((sum, row) => sum + row.rows, 0),
      rejectScopeBlockerGroups: rejectScopeRows.length,
      rejectScopeBlockerGroupedRows: rejectScopeRows.reduce((sum, row) => sum + row.rows, 0),
      targetProfileBlockerGroups: targetProfileRowsForCsv.length,
      targetProfileBlockerGroupedRows: targetProfileRowsForCsv.reduce((sum, row) => sum + row.rows, 0),
      excludedFromP10ButRetainedGroups: 0,
      excludedFromP10ButRetainedGroupedRows: 0
    },
    p10Readiness: {
      status: p10Blockers.length > 0 ? "BLOCKED" : "PASS",
      reason: p10Blockers.join(" ") || "No scoped blocker groups remain in file fallback package.",
      blockers: p10Blockers
    },
    topRemainingTrueBlockers: trueP10Rows.slice(0, 10).map((row) => ({
      blockerGroupId: row.blocker_group_id,
      category: row.blocker_category,
      reviewGroupType: row.review_group_type,
      sourceValue: row.source_value,
      rows: row.rows,
      riskLevel: row.risk_level,
      currentKpiScope: row.bc_current_kpi_scope,
      futureUseDomain: row.bc_future_use_domain,
      recommendedAction: row.recommended_action
    })),
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedBlockerPackageReadme({
    generatedAt,
    p10Readiness: summary.p10Readiness,
    counts: summary.groupCounts
  }), "utf8");
  await writeFile(outputFiles.trueP10, scopedBlockerCsv(trueP10Rows), "utf8");
  await writeFile(outputFiles.unknownScope, scopedBlockerCsv(unknownScopeRows), "utf8");
  await writeFile(outputFiles.okOutputEntity, scopedBlockerCsv(okOutputEntityRows), "utf8");
  await writeFile(outputFiles.rejectScope, scopedBlockerCsv(rejectScopeRows), "utf8");
  await writeFile(outputFiles.targetProfile, scopedBlockerCsv(targetProfileRowsForCsv), "utf8");
  await writeFile(outputFiles.aliasTemplate, appendDecisionTemplateColumns(await readFile(path.join(resolutionPackageDir, RESOLUTION_PACKAGE_ALIAS_FILE), "utf8")), "utf8");
  await writeFile(outputFiles.canonicalTemplate, appendDecisionTemplateColumns(await readFile(path.join(resolutionPackageDir, RESOLUTION_PACKAGE_CANONICAL_FILE), "utf8")), "utf8");
  await writeFile(outputFiles.targetProfileTemplate, appendDecisionTemplateColumns(await readFile(path.join(resolutionPackageDir, RESOLUTION_PACKAGE_TARGET_PROFILE_FILE), "utf8")), "utf8");

  console.log("Business Central P0.9f scoped blocker package");
  console.log("Mode: FILE_FALLBACK_AFTER_DB_CONNECTION_FAILURE");
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log(`Fallback reason: ${summary.fallbackReason}`);
  console.log("Safety: export-only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");
  console.log("");
  console.log("Summary");
  console.log(`- total_source_rows=${summary.rowCounts.totalRows}`);
  console.log(`- unknown_scope_review_rows=${summary.rowCounts.unknownScopeReviewRows}`);
  console.log(`- p10_blocking_rows_before_scope=${summary.rowCounts.p10BlockingRowsBeforeScope}`);
  console.log(`- p10_blocking_rows_after_scope=${summary.rowCounts.p10BlockingRowsAfterScope}`);
  console.log(`- excluded_from_p10_but_retained_rows=${summary.rowCounts.excludedFromP10ButRetainedRows}`);
  console.log(`- true_p10_blocker_groups=${summary.groupCounts.trueP10BlockerGroups}`);
  console.log(`- p10_status=${summary.p10Readiness.status}`);
}

function scopedCsvEntityGroup(
  row: Record<string, string>,
  scope: ReturnType<typeof classifyBusinessCentralDataScope>
): HighRiskReviewPlanGroup {
  return {
    reviewGroupType: "ENTITY_HIGH_RISK",
    sourceField: row.source_field,
    sourceValue: row.source_value || "(blank)",
    canonicalEntityCode: row.proposed_canonical_entity_code || "(blank)",
    currentEntityCodes: row.current_entity_code ? [row.current_entity_code] : [],
    proposedEntityCode: row.proposed_canonical_entity_code || "(blank)",
    targetBucket: "",
    machineCenterNo: row.machine_center_no || "(blank)",
    rows: 1,
    riskLevel: "HIGH",
    riskReason: row.risk_reason,
    reviewDecision: row.backfill_action === "REVIEW_DATA_SOURCE_GAP" ? "NEEDS_SOURCE_DATA_FIX" : row.backfill_action === "REVIEW_ALIAS_CONFLICT" ? "NEEDS_ALIAS_CLEANUP" : "BLOCK_P1_SWITCH",
    recommendedAction: row.recommended_action,
    p10Blocker: true,
    blocksP10AfterScope: true,
    bcCurrentKpiScope: scope.bcCurrentKpiScope,
    bcFutureUseDomain: scope.bcFutureUseDomain,
    bcScopeReason: scope.bcScopeReason,
    bcScopeEvidenceFields: scope.bcScopeEvidenceFields,
    bcEntitySourceStatus: scope.bcEntitySourceStatus,
    sampleDocuments: sampleValues([row.document_no]),
    sampleItems: sampleValues([row.item_no])
  };
}

function scopedCsvTargetProfileGroup(row: Record<string, string>): HighRiskReviewPlanGroup {
  return {
    reviewGroupType: "TARGET_PROFILE_HIGH_RISK",
    sourceField: "target_profile_backfill",
    sourceValue: row.current_entity_code || row.canonical_entity_code || "(blank)",
    canonicalEntityCode: row.canonical_entity_code || "(blank)",
    currentEntityCodes: row.current_entity_code ? [row.current_entity_code] : [],
    proposedEntityCode: row.canonical_entity_code || "(blank)",
    targetBucket: row.target_bucket,
    machineCenterNo: row.machine_center_no || "(generic)",
    rows: numberValue(row.sample_rows),
    riskLevel: "HIGH",
    riskReason: row.risk_reason,
    reviewDecision: "BLOCK_P1_SWITCH",
    recommendedAction: row.recommended_action,
    p10Blocker: true,
    blocksP10AfterScope: true,
    bcCurrentKpiScope: row.bc_current_kpi_scope as BusinessCentralCurrentKpiScope,
    bcFutureUseDomain: row.bc_future_use_domain as BusinessCentralFutureUseDomain,
    bcScopeReason: row.bc_scope_reason,
    bcScopeEvidenceFields: row.bc_scope_evidence_fields.split("|").filter(Boolean),
    bcEntitySourceStatus: row.bc_entity_source_status as BusinessCentralEntitySourceStatus,
    sampleDocuments: sampleValues((row.sample_documents ?? "").split("|")),
    sampleItems: sampleValues((row.sample_items ?? "").split("|"))
  };
}

function sampleValues(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 5);
}

async function readScopedBlockerRows(filePath: string): Promise<readonly ScopedDecisionReviewInputRow[]> {
  const rows: ScopedDecisionReviewInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      blocker_group_id: row.blocker_group_id ?? "",
      blocker_category: row.blocker_category ?? "",
      review_group_type: row.review_group_type ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      canonical_entity_code: row.canonical_entity_code ?? "",
      current_entity_codes: row.current_entity_codes ?? "",
      proposed_entity_code: row.proposed_entity_code ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      rows: row.rows ?? "0",
      risk_level: row.risk_level ?? "",
      risk_reason: row.risk_reason ?? "",
      review_decision: row.review_decision ?? "",
      recommended_action: row.recommended_action ?? "",
      p10_blocker_before_scope: row.p10_blocker_before_scope ?? "",
      blocks_p10_after_scope: row.blocks_p10_after_scope ?? "",
      bc_current_kpi_scope: row.bc_current_kpi_scope ?? "",
      bc_future_use_domain: row.bc_future_use_domain ?? "",
      bc_scope_reason: row.bc_scope_reason ?? "",
      bc_scope_evidence_fields: row.bc_scope_evidence_fields ?? "",
      bc_entity_source_status: row.bc_entity_source_status ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionValidationRows(filePath: string): Promise<readonly ScopedDecisionValidationInputRow[]> {
  const rows: ScopedDecisionValidationInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      decision_id: row.decision_id ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_values: row.source_values ?? "",
      blocker_group_ids: row.blocker_group_ids ?? "",
      blocker_categories: row.blocker_categories ?? "",
      review_group_types: row.review_group_types ?? "",
      rows: row.rows ?? "0",
      risk_levels: row.risk_levels ?? "",
      reason: row.reason ?? "",
      recommended_action: row.recommended_action ?? "",
      required_decision: row.required_decision ?? "",
      safe_to_auto_apply: row.safe_to_auto_apply ?? "false",
      decision_status: row.decision_status ?? "",
      p10_gate_effect: row.p10_gate_effect ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      approval_status: row.approval_status ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile ?? "false",
      entity_decision_status: row.entity_decision_status ?? "",
      target_bucket: row.target_bucket ?? "",
      target_qty: row.target_qty ?? "",
      unit: row.unit ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionApprovalRows(filePath: string): Promise<readonly ScopedDecisionApprovalInputRow[]> {
  const rows: ScopedDecisionApprovalInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      decision_id: row.decision_id ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_values: row.source_values ?? "",
      blocker_group_ids: row.blocker_group_ids ?? "",
      blocker_categories: row.blocker_categories ?? "",
      review_group_types: row.review_group_types ?? "",
      rows: row.rows ?? "0",
      risk_levels: row.risk_levels ?? "",
      reason: row.reason ?? "",
      recommended_action: row.recommended_action ?? "",
      required_decision: row.required_decision ?? "",
      safe_to_auto_apply: row.safe_to_auto_apply ?? "false",
      decision_status: row.decision_status ?? "",
      p10_gate_effect: row.p10_gate_effect ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionApplyDryRunRows(filePath: string): Promise<readonly ScopedDecisionApplyDryRunInputRow[]> {
  const rows: ScopedDecisionApplyDryRunInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      decision_id: row.decision_id ?? "",
      priority: row.priority ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      current_entity_codes: row.current_entity_codes ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      grouped_rows: row.grouped_rows ?? "0",
      affected_scopes: row.affected_scopes ?? "",
      affected_future_use_domains: row.affected_future_use_domains ?? "",
      recommended_decision: row.recommended_decision ?? "",
      rationale: row.rationale ?? "",
      risk_level: row.risk_level ?? "",
      blocks_p10_after_scope: row.blocks_p10_after_scope ?? "",
      validation_status: row.validation_status ?? "",
      validation_warnings: row.validation_warnings ?? "",
      approval_status: row.approval_status ?? "",
      approved_action: row.approved_action ?? "",
      safe_to_auto_apply: row.safe_to_auto_apply ?? "false",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile ?? "false",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      business_approval_reference: row.business_approval_reference ?? "",
      decision_date: row.decision_date ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      entity_dependency_status: row.entity_dependency_status ?? "",
      target_qty: row.target_qty ?? "",
      unit: row.unit ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionApprovalWorkbookRows(filePath: string): Promise<readonly ScopedDecisionApprovalWorkbookRow[]> {
  const rows: ScopedDecisionApprovalWorkbookRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      decision_id: row.decision_id ?? "",
      priority: row.priority === "P2" || row.priority === "P3" ? row.priority : "P1",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      current_entity_codes: row.current_entity_codes ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      grouped_rows: Number(row.grouped_rows ?? 0) || 0,
      affected_scopes: row.affected_scopes ?? "",
      affected_future_use_domains: row.affected_future_use_domains ?? "",
      recommended_decision: row.recommended_decision ?? "",
      rationale: row.rationale ?? "",
      risk_level: row.risk_level ?? "",
      blocks_p10_after_scope: row.blocks_p10_after_scope === "false" ? "false" : "true",
      validation_status: row.validation_status === "ERROR" || row.validation_status === "WARNING" ? row.validation_status : "PENDING",
      validation_warnings: row.validation_warnings ?? "",
      approval_status: "pending",
      approved_action: "",
      safe_to_auto_apply: "false",
      safe_to_seed_target_profile: "false",
      reviewer: "",
      reviewer_notes: row.reviewer_notes ?? "",
      business_approval_reference: "",
      decision_date: "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionReviewerInputRows(filePath: string): Promise<readonly ScopedDecisionReviewerInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: ScopedDecisionReviewerInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      decision_id: row.decision_id ?? "",
      stable_decision_key: row.stable_decision_key ?? "",
      approval_status: row.approval_status ?? "",
      approved_action: row.approved_action ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      business_approval_reference: row.business_approval_reference ?? "",
      decision_date: row.decision_date ?? "",
      safe_to_auto_apply: row.safe_to_auto_apply ?? "false",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile ?? "false",
      entity_dependency_status: row.entity_dependency_status ?? "",
      target_bucket: row.target_bucket ?? "",
      target_qty: row.target_qty ?? "",
      unit: row.unit ?? "",
      source_value: row.source_value ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? ""
    });
  });
  return rows;
}

async function readScopedDecisionAcceptedReviewerRows(filePath: string): Promise<readonly ScopedDecisionNormalizedReviewerDecisionRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: ScopedDecisionNormalizedReviewerDecisionRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      intake_id: row.intake_id ?? "",
      decision_id: row.decision_id ?? "",
      stable_decision_key: row.stable_decision_key ?? "",
      priority: row.priority ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_value: row.source_value ?? "",
      grouped_rows: Number(row.grouped_rows ?? 0) || 0,
      approval_status: row.approval_status === "rejected" || row.approval_status === "deferred" || row.approval_status === "pending" ? row.approval_status : "approved",
      approved_action: row.approved_action ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      business_approval_reference: row.business_approval_reference ?? "",
      decision_date: row.decision_date ?? "",
      safe_to_auto_apply: row.safe_to_auto_apply === "true" ? "true" : "false",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile === "true" ? "true" : "false",
      entity_dependency_status: row.entity_dependency_status ?? "",
      target_bucket: row.target_bucket ?? "",
      target_qty: row.target_qty ?? "",
      unit: row.unit ?? "",
      intake_status: row.intake_status === "BLOCKED" ? "BLOCKED" : "ACCEPTED",
      intake_reason: row.intake_reason ?? ""
    });
  });
  return rows.filter((row) => row.intake_status === "ACCEPTED");
}

async function readScopedDecisionApprovalIntakeSummary(filePath: string): Promise<ScopedDecisionApprovalIntakeSummary | null> {
  if (!(await fileExists(filePath))) return null;
  return JSON.parse(await readFile(filePath, "utf8")) as ScopedDecisionApprovalIntakeSummary;
}

async function readAuthoritativeCanonicalEntityRows(filePath: string): Promise<readonly AuthoritativeCanonicalEntityInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeCanonicalEntityInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      canonical_entity_code: row.canonical_entity_code ?? "",
      canonical_entity_display_name: row.canonical_entity_display_name ?? "",
      entity_family: row.entity_family ?? "",
      entity_type: row.entity_type ?? "",
      production_area: row.production_area ?? "",
      is_active: row.is_active ?? "",
      source_of_truth_status: row.source_of_truth_status ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeSourceMapRows(filePath: string): Promise<readonly AuthoritativeSourceToEntityMapInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeSourceToEntityMapInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      source_system: row.source_system ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      canonical_entity_code: row.canonical_entity_code ?? "",
      mapping_type: row.mapping_type ?? "",
      confidence: row.confidence ?? "",
      is_active: row.is_active ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeTargetProfileRows(filePath: string): Promise<readonly AuthoritativeTargetProfileInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeTargetProfileInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      canonical_entity_code: row.canonical_entity_code ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      target_qty: row.target_qty ?? "",
      unit: row.unit ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      is_active: row.is_active ?? "",
      approval_status: row.approval_status ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeEntityCoverageRows(filePath: string): Promise<readonly AuthoritativeBcCoverageInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeBcCoverageInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      source_field: row.source_field ?? row.v2_source_field_used ?? "",
      source_value: row.source_value ?? row.v2_source_value_used ?? "",
      g_prod_or_rot_line_description: row.g_prod_or_rot_line_description ?? "",
      g_prod_or_rot_line_no: row.g_prod_or_rot_line_no ?? "",
      machine_center_no: row.machine_center_no ?? "",
      current_entity_code: row.current_entity_code ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      v2_entity_code: row.v2_entity_code ?? "",
      bc_current_kpi_scope: row.bc_current_kpi_scope ?? "",
      document_no: row.document_no ?? "",
      item_no: row.item_no ?? "",
      target_bucket: row.target_bucket ?? "",
      v2_target_bucket_candidate: row.v2_target_bucket_candidate ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeTargetCoverageRows(filePath: string): Promise<readonly AuthoritativeBcCoverageInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeBcCoverageInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      source_field: row.resolver_v2_source_field_used ?? "",
      source_value: row.resolver_v2_source_value_used ?? "",
      g_prod_or_rot_line_description: row.g_prod_or_rot_line_description ?? "",
      g_prod_or_rot_line_no: row.g_prod_or_rot_line_no ?? "",
      machine_center_no: row.machine_center_no ?? "",
      current_entity_code: row.resolver_v2_entity_code ?? "",
      resolver_v2_entity_code: row.resolver_v2_entity_code ?? "",
      bc_current_kpi_scope: row.bc_current_kpi_scope ?? "",
      document_no: row.document_no ?? "",
      item_no: row.item_no ?? "",
      resolver_v2_target_bucket_candidate: row.resolver_v2_target_bucket_candidate ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeSeedEntityEvidenceRows(filePath: string): Promise<readonly AuthoritativeSeedEvidenceRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeSeedEvidenceRow[] = [];
  await readCsvRows(filePath, (row) => {
    const gProdDescription = row.g_prod_or_rot_line_description ?? "";
    rows.push({
      source_field: gProdDescription ? "gProdOrRotLineDescription" : row.v2_source_field_used || row.source_field || "",
      source_value: gProdDescription || row.v2_source_value_used || row.source_value || "",
      current_entity_code: row.current_entity_code ?? "",
      v2_entity_code: row.v2_entity_code ?? row.proposed_canonical_entity_code ?? "",
      suggested_canonical_entity_code: row.v2_suggested_canonical_entity_code ?? row.proposed_canonical_entity_code ?? "",
      suggested_canonical_entity_display_name: row.v2_suggested_canonical_entity_display_name ?? row.proposed_canonical_entity_display_name ?? "",
      target_bucket_candidate: row.v2_target_bucket_candidate ?? row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      document_no: row.document_no ?? "",
      item_no: row.item_no ?? "",
      bc_current_kpi_scope: row.bc_current_kpi_scope ?? "",
      review_classification: row.v2_review_classification ?? row.backfill_action ?? "",
      risk_level: row.risk_level ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeTargetProfileSeedEvidenceRows(filePath: string): Promise<readonly AuthoritativeTargetProfileSeedEvidenceRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeTargetProfileSeedEvidenceRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      canonical_entity_code: row.canonical_entity_code ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      target_qty: row.proposed_target_qty ?? "",
      unit: row.unit ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      rows: row.sample_rows ?? "0",
      risk_level: row.risk_level ?? ""
    });
  });
  return rows;
}

async function readFutureUseRawEvidenceRows(filePath: string): Promise<readonly FutureUseRawEvidenceRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: FutureUseRawEvidenceRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      posting_date: row.posting_date ?? "",
      document_no: row.document_no ?? "",
      entry_no: row.entry_no ?? "",
      item_no: row.item_no ?? "",
      item_description: row.item_description ?? "",
      item_category_code: row.item_category_code ?? "",
      entry_type: row.entry_type ?? "",
      location_code: row.location_code ?? "",
      g_prod_or_rot_line_description: row.g_prod_or_rot_line_description ?? "",
      g_prod_or_rot_line_no: row.g_prod_or_rot_line_no ?? "",
      machine_center_no: row.machine_center_no ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      v2_source_field_used: row.v2_source_field_used ?? "",
      v2_source_value_used: row.v2_source_value_used ?? "",
      current_entity_code: row.current_entity_code ?? "",
      v2_entity_code: row.v2_entity_code ?? "",
      v2_suggested_canonical_entity_code: row.v2_suggested_canonical_entity_code ?? "",
      v2_target_bucket_candidate: row.v2_target_bucket_candidate ?? row.target_bucket ?? "",
      target_bucket: row.target_bucket ?? "",
      bc_current_kpi_scope: row.bc_current_kpi_scope ?? "",
      bc_future_use_domain: row.bc_future_use_domain ?? "",
      blocks_p10_after_scope: row.blocks_p10_after_scope ?? ""
    });
  });
  return rows;
}

async function readFutureUseConflictRows(filePath: string): Promise<readonly { readonly source_field: string; readonly source_value: string; readonly proposed_canonical_entity_code: string; readonly review_reason: string }[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: { readonly source_field: string; readonly source_value: string; readonly proposed_canonical_entity_code: string; readonly review_reason: string }[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? row.canonical_entity_code ?? "",
      review_reason: row.review_reason ?? row.conflict_reason ?? ""
    });
  });
  return rows;
}

async function readFutureUseRegistryRows(filePath: string): Promise<readonly FutureUseRawRegistryRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: FutureUseRawRegistryRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      registry_key: row.registry_key ?? "",
      registry_granularity: row.registry_granularity === "GROUP" || row.registry_granularity === "MIXED" ? row.registry_granularity : "ROW",
      source_system: "business-central",
      source_file: row.source_file ?? "",
      posting_date: row.posting_date ?? "",
      document_no: row.document_no ?? "",
      item_no: row.item_no ?? "",
      item_description: row.item_description ?? "",
      entry_type: row.entry_type ?? "",
      item_category_code: row.item_category_code ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      machine_center_no: row.machine_center_no ?? "",
      bc_current_kpi_scope: isBusinessCentralCurrentKpiScope(row.bc_current_kpi_scope) ? row.bc_current_kpi_scope : "UNKNOWN_SCOPE_REVIEW",
      bc_future_use_domain: isFutureUseDomain(row.bc_future_use_domain) ? row.bc_future_use_domain : "UNKNOWN_REVIEW",
      registry_status: isRawRegistryStatus(row.registry_status) ? row.registry_status : "REGISTERED_FOR_UNKNOWN_REVIEW",
      p10_inclusion_status: isP10InclusionStatus(row.p10_inclusion_status) ? row.p10_inclusion_status : "P10_BLOCKED_UNKNOWN_REVIEW",
      future_module_candidate: isFutureModuleCandidate(row.future_module_candidate) ? row.future_module_candidate : "unknown-review",
      authoritative_entity_status: isAuthoritativeEntityStatus(row.authoritative_entity_status) ? row.authoritative_entity_status : "UNKNOWN",
      authoritative_entity_code: row.authoritative_entity_code ?? "",
      target_profile_required: row.target_profile_required === "true" ? "true" : "false",
      target_profile_status: row.target_profile_status === "COVERED" || row.target_profile_status === "MISSING_TARGET_PROFILE" ? row.target_profile_status : "NOT_REQUIRED",
      review_required: row.review_required === "true" ? "true" : "false",
      review_reason: row.review_reason ?? "",
      safety_reason: row.safety_reason ?? ""
    });
  });
  return rows;
}

async function readFutureUseReviewQueueRows(filePath: string): Promise<readonly FutureUseReviewQueueRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: FutureUseReviewQueueRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      review_type: isFutureUseReviewType(row.review_type) ? row.review_type : "UNKNOWN_REVIEW",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      bc_future_use_domain: isFutureUseDomain(row.bc_future_use_domain) ? row.bc_future_use_domain : "UNKNOWN_REVIEW",
      rows: Number(row.rows ?? 0),
      review_reason: row.review_reason ?? "",
      recommended_action: row.recommended_action ?? ""
    });
  });
  return rows;
}

async function readFutureUseTargetProfileRequirementRows(filePath: string): Promise<readonly FutureUseTargetProfileRequirementRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: FutureUseTargetProfileRequirementRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      bc_future_use_domain: isFutureUseDomain(row.bc_future_use_domain) ? row.bc_future_use_domain : "UNKNOWN_REVIEW",
      rows: Number(row.rows ?? 0),
      target_profile_required_rows: Number(row.target_profile_required_rows ?? 0),
      target_profile_covered_rows: Number(row.target_profile_covered_rows ?? 0),
      target_profile_missing_rows: Number(row.target_profile_missing_rows ?? 0),
      target_profile_not_required_rows: Number(row.target_profile_not_required_rows ?? 0)
    });
  });
  return rows;
}

async function readAuthoritativeSeedReviewQueueRows(filePath: string): Promise<readonly AuthoritativeSeedReviewQueueRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeSeedReviewQueueRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      review_category: row.review_category ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      rows: Number(row.rows ?? 0),
      review_reason: row.review_reason ?? "",
      recommended_action: row.recommended_action ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeSeedLegacyCrosswalkRows(filePath: string): Promise<readonly AuthoritativeLegacyEvidenceCrosswalkRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeLegacyEvidenceCrosswalkRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      legacy_current_entity_codes: row.legacy_current_entity_codes ?? "",
      v2_entity_codes: row.v2_entity_codes ?? "",
      target_bucket_candidates: row.target_bucket_candidates ?? "",
      machine_center_nos: row.machine_center_nos ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      evidence_reason: row.evidence_reason ?? "",
      review_required: row.review_required === "true" ? "true" : "false"
    });
  });
  return rows;
}

async function readAuthoritativeMasterReviewerDecisionTemplateRows(filePath: string): Promise<readonly AuthoritativeMasterReviewerDecisionTemplateRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterReviewerDecisionTemplateRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      review_type: row.review_type ?? "",
      approval_status: "pending",
      approved_action: "",
      approved_canonical_entity_code: row.approved_canonical_entity_code ?? "",
      approved_source_field: row.approved_source_field ?? "",
      approved_source_value: row.approved_source_value ?? "",
      approved_mapping_type: row.approved_mapping_type ?? "",
      approved_target_bucket: row.approved_target_bucket ?? "",
      approved_machine_center_no: row.approved_machine_center_no ?? "",
      approved_target_qty: row.approved_target_qty ?? "",
      approved_unit: row.approved_unit ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeMasterReviewerDecisionRows(filePath: string): Promise<readonly AuthoritativeReviewDecisionInputRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeReviewDecisionInputRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      review_type: row.review_type ?? "",
      approval_status: row.approval_status ?? "",
      approved_action: row.approved_action ?? "",
      approved_canonical_entity_code: row.approved_canonical_entity_code ?? "",
      approved_source_field: row.approved_source_field ?? "",
      approved_source_value: row.approved_source_value ?? "",
      approved_mapping_type: row.approved_mapping_type ?? "",
      approved_target_bucket: row.approved_target_bucket ?? "",
      approved_machine_center_no: row.approved_machine_center_no ?? "",
      approved_target_qty: row.approved_target_qty ?? "",
      approved_unit: row.approved_unit ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      reviewer: row.reviewer ?? "",
      reviewer_notes: row.reviewer_notes ?? ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewEntityRows(filePath: string): Promise<readonly AuthoritativeMasterEntityReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterEntityReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      priority: row.priority === "P1" || row.priority === "P2" || row.priority === "P3" ? row.priority : "P3",
      entity_family: row.entity_family ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      proposed_canonical_entity_display_name: row.proposed_canonical_entity_display_name ?? "",
      proposed_entity_type: row.proposed_entity_type ?? "",
      row_coverage_count: Number(row.row_coverage_count ?? 0),
      p10_output_rows: Number(row.p10_output_rows ?? 0),
      reject_rows: Number(row.reject_rows ?? 0),
      future_use_rows: Number(row.future_use_rows ?? 0),
      conflict_rows: Number(row.conflict_rows ?? 0),
      source_data_gap_rows: Number(row.source_data_gap_rows ?? 0),
      legacy_current_entity_codes: row.legacy_current_entity_codes ?? "",
      sample_source_values: row.sample_source_values ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewSourceMappingRows(filePath: string): Promise<readonly AuthoritativeMasterSourceMappingReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterSourceMappingReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      priority: row.priority === "P1" || row.priority === "P2" || row.priority === "P3" ? row.priority : "P3",
      source_system: row.source_system ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      mapping_type: row.mapping_type ?? "",
      confidence: row.confidence ?? "",
      rows_covered: Number(row.rows_covered ?? 0),
      bc_future_use_domains: row.bc_future_use_domains ?? "",
      p10_inclusion_statuses: row.p10_inclusion_statuses ?? "",
      legacy_current_entity_codes: row.legacy_current_entity_codes ?? "",
      conflict_flag: row.conflict_flag === "true" ? "true" : "false",
      conflict_reason: row.conflict_reason ?? "",
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewTargetProfileRows(filePath: string): Promise<readonly AuthoritativeMasterTargetProfileReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterTargetProfileReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      priority: row.priority === "P1" || row.priority === "P2" || row.priority === "P3" ? row.priority : "P3",
      canonical_entity_code: row.canonical_entity_code ?? "",
      target_bucket: row.target_bucket ?? "",
      machine_center_no: row.machine_center_no ?? "",
      affected_output_rows: Number(row.affected_output_rows ?? 0),
      affected_reject_rows: Number(row.affected_reject_rows ?? 0),
      target_profile_required: row.target_profile_required === "true" || row.target_profile_required === "conditional" ? row.target_profile_required : "false",
      target_profile_status: row.target_profile_status ?? "",
      proposed_target_qty: row.proposed_target_qty ?? "",
      proposed_unit: row.proposed_unit ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewConflictRows(filePath: string): Promise<readonly AuthoritativeMasterConflictReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterConflictReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      priority: row.priority === "P1" || row.priority === "P2" || row.priority === "P3" ? row.priority : "P3",
      conflict_type: row.conflict_type ?? "",
      source_field: row.source_field ?? "",
      source_value: row.source_value ?? "",
      proposed_canonical_entity_code: row.proposed_canonical_entity_code ?? "",
      legacy_current_entity_codes: row.legacy_current_entity_codes ?? "",
      v2_entity_codes: row.v2_entity_codes ?? "",
      rows: Number(row.rows ?? 0),
      bc_future_use_domains: row.bc_future_use_domains ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      risk_level: row.risk_level ?? "",
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewSourceDataGapRows(filePath: string): Promise<readonly AuthoritativeMasterSourceDataGapReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterSourceDataGapReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      priority: row.priority === "P1" || row.priority === "P2" || row.priority === "P3" ? row.priority : "P3",
      source_gap_type: row.source_gap_type ?? "",
      rows: Number(row.rows ?? 0),
      bc_future_use_domains: row.bc_future_use_domains ?? "",
      p10_inclusion_statuses: row.p10_inclusion_statuses ?? "",
      sample_documents: row.sample_documents ?? "",
      sample_items: row.sample_items ?? "",
      item_category_codes: row.item_category_codes ?? "",
      machine_center_nos: row.machine_center_nos ?? "",
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

async function readAuthoritativeReviewFutureUseDomainRows(filePath: string): Promise<readonly AuthoritativeMasterFutureUseDomainReviewRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: AuthoritativeMasterFutureUseDomainReviewRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      review_id: row.review_id ?? "",
      future_use_domain: row.future_use_domain ?? "",
      future_module_candidate: row.future_module_candidate ?? "",
      rows: Number(row.rows ?? 0),
      authoritative_entity_status_counts: row.authoritative_entity_status_counts ?? "",
      target_profile_required_rows: Number(row.target_profile_required_rows ?? 0),
      target_profile_not_required_rows: Number(row.target_profile_not_required_rows ?? 0),
      unknown_rows: Number(row.unknown_rows ?? 0),
      source_data_gap_rows: Number(row.source_data_gap_rows ?? 0),
      recommended_action: row.recommended_action ?? "",
      approval_status: "pending",
      reviewer: "",
      reviewer_notes: ""
    });
  });
  return rows;
}

function isBusinessCentralCurrentKpiScope(value: unknown): value is BusinessCentralCurrentKpiScope {
  return value === "OUTPUT_KPI_OK_SCOPE" || value === "OUTPUT_KPI_REJECT_SCOPE" || value === "OUT_OF_CURRENT_KPI_SCOPE" || value === "UNKNOWN_SCOPE_REVIEW";
}

function isFutureUseDomain(value: unknown): value is FutureUseRawRegistryRow["bc_future_use_domain"] {
  return value === "PRODUCTION_OUTPUT_DASHBOARD" || value === "REJECT_ATTACHMENT" || value === "SALES_REPORT" || value === "PURCHASE_OR_RECEIVING" || value === "TRANSFER_OR_INVENTORY_MOVEMENT" || value === "CONSUMPTION_OR_MATERIAL_USAGE" || value === "DOWNTIME_SPAREPART_OR_MATERIAL" || value === "SCRAP_WASTE_OR_AVALAN" || value === "MASTER_DATA_QUALITY_REVIEW" || value === "UNKNOWN_REVIEW";
}

function isRawRegistryStatus(value: unknown): value is FutureUseRawRegistryRow["registry_status"] {
  return value === "REGISTERED_FOR_P10_OUTPUT_KPI" || value === "REGISTERED_FOR_REJECT_ATTACHMENT" || value === "REGISTERED_FOR_FUTURE_SALES" || value === "REGISTERED_FOR_FUTURE_PURCHASE_RECEIVING" || value === "REGISTERED_FOR_FUTURE_TRANSFER_INVENTORY" || value === "REGISTERED_FOR_FUTURE_CONSUMPTION_MATERIAL_USAGE" || value === "REGISTERED_FOR_FUTURE_SPAREPART_MATERIAL" || value === "REGISTERED_FOR_FUTURE_SCRAP_WASTE" || value === "REGISTERED_FOR_MASTER_DATA_QUALITY_REVIEW" || value === "REGISTERED_FOR_UNKNOWN_REVIEW";
}

function isP10InclusionStatus(value: unknown): value is FutureUseRawRegistryRow["p10_inclusion_status"] {
  return value === "P10_INCLUDED_CANDIDATE" || value === "P10_REJECT_ATTACHMENT_CANDIDATE" || value === "P10_EXCLUDED_FUTURE_USE" || value === "P10_BLOCKED_UNKNOWN_REVIEW" || value === "P10_BLOCKED_SOURCE_DATA_GAP" || value === "P10_BLOCKED_HIGH_RISK_REVIEW";
}

function isFutureModuleCandidate(value: unknown): value is FutureUseRawRegistryRow["future_module_candidate"] {
  return value === "production-output-dashboard" || value === "reject-attachment" || value === "sales-report" || value === "purchase-receiving" || value === "transfer-inventory-movement" || value === "consumption-material-usage" || value === "downtime-sparepart-material" || value === "scrap-waste-avalan" || value === "master-data-quality" || value === "unknown-review";
}

function isAuthoritativeEntityStatus(value: unknown): value is FutureUseRawRegistryRow["authoritative_entity_status"] {
  return value === "AUTHORITATIVE_MAPPED" || value === "DRAFT_ENTITY_CANDIDATE" || value === "DRAFT_ALIAS_CANDIDATE" || value === "SOURCE_DATA_GAP" || value === "LEGACY_EVIDENCE_ONLY" || value === "NOT_REQUIRED_FOR_DOMAIN" || value === "CONFLICT_REVIEW" || value === "UNKNOWN";
}

function isFutureUseReviewType(value: unknown): value is FutureUseReviewQueueRow["review_type"] {
  return value === "SOURCE_DATA_GAP" || value === "UNKNOWN_REVIEW" || value === "CONFLICT_REVIEW" || value === "TARGET_PROFILE_REVIEW" || value === "MASTER_DATA_QUALITY_REVIEW";
}

async function csvFileHasDataRows(filePath: string): Promise<boolean> {
  if (!(await fileExists(filePath))) return false;
  let hasData = false;
  await readCsvRows(filePath, (row) => {
    if (Object.values(row).some((value) => value.trim())) hasData = true;
  });
  return hasData;
}

async function readScopedDecisionValidationIssues(filePath: string): Promise<readonly ScopedDecisionValidationIssueRow[]> {
  if (!(await fileExists(filePath))) return [];
  const rows: ScopedDecisionValidationIssueRow[] = [];
  await readCsvRows(filePath, (row) => {
    rows.push({
      validation_id: row.validation_id ?? "",
      severity: row.severity === "ERROR" ? "ERROR" : "WARNING",
      decision_id: row.decision_id ?? "",
      decision_family: row.decision_family ?? "",
      decision_category: row.decision_category ?? "",
      source_values: row.source_values ?? "",
      field: row.field ?? "",
      code: row.code ?? "",
      message: row.message ?? "",
      approval_status: row.approval_status === "approved" || row.approval_status === "rejected" || row.approval_status === "deferred" ? row.approval_status : "pending",
      safe_to_auto_apply: row.safe_to_auto_apply ?? "false",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile ?? "false",
      p10_gate_effect: row.p10_gate_effect ?? "",
      rows: Number(row.rows ?? 0)
    });
  });
  return rows;
}

function buildScopedDecisionReviewReadme(summary: ScopedDecisionReviewSummary): string {
  return `# Business Central P0.9g Scoped Decision Review

Generated at: ${summary.generatedAt}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Files

- \`${SCOPED_DECISION_REVIEW_SUMMARY_FILE}\`: decision review counts, family rollup, next actions, P1.0 gate, and safety flags.
- \`${SCOPED_DECISION_REVIEW_BOARD_FILE}\`: complete pending decision board grouped by family/category/source.
- \`${SCOPED_DECISION_REVIEW_ALIAS_CANONICAL_FILE}\`: alias, canonical, and manual entity review decisions.
- \`${SCOPED_DECISION_REVIEW_UNKNOWN_SOURCE_FILE}\`: blank/unmapped source-data review decisions.
- \`${SCOPED_DECISION_REVIEW_REJECT_ATTACHMENT_FILE}\`: reject attachment review decisions.
- \`${SCOPED_DECISION_REVIEW_TARGET_PROFILE_FILE}\`: target profile decisions blocked by entity/canonical review.
- \`${SCOPED_DECISION_REVIEW_FAMILY_ROLLUP_FILE}\`: family-level blocker rollup.
- \`${SCOPED_DECISION_REVIEW_NEXT_ACTION_FILE}\`: prioritized review checklist.

## Review Rules

- \`safe_to_auto_apply\` defaults to \`false\` for every row.
- OMSO conflicts require manual review.
- VFINE and LONGSUN size/variant conflicts require manual review.
- POLYPRINT naming/canonical normalization requires manual review.
- THERMO HENGFENG legacy target-variant collapse requires reviewed canonical decision.
- Blank/unmapped source rows go to source-data review, not canonical entity creation.
- Reject rows with RJ evidence go to reject attachment review.
- Target profile rows stay blocked until entity/canonical decisions are approved.
- Never create broad/global aliases.

## Recommended Next Actions

${summary.recommendedNextActions.map((action) => `- ${action}`).join("\n")}

## Safety

- Reporting/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
- P1.0 remains blocked while decision rows are pending.
`;
}

function buildScopedDecisionValidationReadme(summary: ScopedDecisionValidationSummary): string {
  return `# Business Central P0.9h Scoped Decision Validator

Generated at: ${summary.generatedAt}

Validation status: ${summary.validationStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Files

- \`${SCOPED_DECISION_VALIDATION_SUMMARY_FILE}\`: validation counts, gate status, and safety flags.
- \`${SCOPED_DECISION_VALIDATION_ERRORS_FILE}\`: invalid decision rows that must be fixed before execution.
- \`${SCOPED_DECISION_VALIDATION_WARNINGS_FILE}\`: non-blocking review quality warnings.
- \`${SCOPED_DECISION_VALIDATION_APPROVED_FILE}\`: approved decision rows, if any.
- \`${SCOPED_DECISION_VALIDATION_PENDING_FILE}\`: pending decision rows.
- \`${SCOPED_DECISION_VALIDATION_BLOCKED_EXECUTION_FILE}\`: execution blockers that keep P1.0 blocked.

## Validation Rules

- Empty \`approval_status\` is treated as \`pending\`.
- \`approval_status\` must be one of \`pending\`, \`approved\`, \`rejected\`, or \`deferred\`.
- Approved rows require a reviewer and should include reviewer notes.
- \`safe_to_auto_apply=true\` requires strict approval evidence and is invalid for manual-review families.
- OMSO, VFINE, LONGSUN, POLYPRINT, and THERMO HENGFENG decisions remain manual review unless later explicitly validated by narrower rules.
- Blank/unmapped source rows cannot become canonical entities automatically.
- Reject attachment rows cannot be converted into OK output scope.
- Target profile seed rows require approved entity dependency, target bucket, target quantity, unit, reviewer, and notes.

## Current Counts

- Total decision rows: ${summary.totalDecisionRows}
- Approved rows: ${summary.approvedRows}
- Pending rows: ${summary.pendingRows}
- Invalid rows: ${summary.invalidRows}
- Warning rows: ${summary.warningRows}
- Unsafe auto-apply rows: ${summary.unsafeAutoApplyRows}
- Target profile blocked rows: ${summary.targetProfileBlockedRows}
- Unknown source blocked rows: ${summary.unknownSourceBlockedRows}
- Alias/canonical blocked rows: ${summary.aliasCanonicalBlockedRows}
- Reject attachment blocked rows: ${summary.rejectAttachmentBlockedRows}

## Safety

- Reporting/validation only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
- P1.0 is not enabled by this command.
`;
}

function buildScopedDecisionApprovalWorkspaceReadme(summary: ScopedDecisionApprovalWorkspaceSummary): string {
  return `# Business Central P0.9i Scoped Decision Approval Workspace

Generated at: ${summary.generatedAt}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Files

- \`${SCOPED_DECISION_APPROVAL_SUMMARY_FILE}\`: approval workspace counts, gate status, and safety flags.
- \`${SCOPED_DECISION_APPROVAL_WORKBOOK_FILE}\`: full editable approval workbook.
- \`${SCOPED_DECISION_APPROVAL_WORKBOOK_P1_FILE}\`: P1 approval rows.
- \`${SCOPED_DECISION_APPROVAL_WORKBOOK_P2_FILE}\`: P2 approval rows.
- \`${SCOPED_DECISION_APPROVAL_SOURCE_DATA_FILE}\`: blank/unmapped source-data approval template.
- \`${SCOPED_DECISION_APPROVAL_ALIAS_CANONICAL_FILE}\`: alias/canonical/manual conflict approval template.
- \`${SCOPED_DECISION_APPROVAL_REJECT_ATTACHMENT_FILE}\`: reject attachment review approval template.
- \`${SCOPED_DECISION_APPROVAL_TARGET_PROFILE_FILE}\`: target profile dependency approval template.
- \`${SCOPED_DECISION_APPROVAL_REVIEWER_CHECKLIST_FILE}\`: reviewer checklist.
- \`${SCOPED_DECISION_APPROVAL_IMPORT_MANIFEST_FILE}\`: allowed review-only actions, editable columns, source folders, and safety flags.

## Editable Review Fields

- \`approval_status\`
- \`approved_action\`
- \`reviewer\`
- \`reviewer_notes\`
- \`business_approval_reference\`
- \`decision_date\`

Allowed \`approved_action\` values are review-only:

- \`DEFER\`
- \`REJECT_DECISION\`
- \`SOURCE_DATA_BACKLOG\`
- \`APPROVE_ALIAS_CANONICAL_REVIEW_ONLY\`
- \`APPROVE_REJECT_ATTACHMENT_REVIEW_ONLY\`
- \`APPROVE_TARGET_PROFILE_REVIEW_ONLY\`
- \`APPROVE_FOR_FUTURE_DRY_RUN\`

## Defaults

- \`approval_status=pending\`
- \`approved_action\` is blank until a reviewer fills it.
- \`safe_to_auto_apply=false\`
- \`safe_to_seed_target_profile=false\`
- Target profile rows remain dependency-blocked until entity/canonical approval exists.

## Current Counts

- Total approval rows: ${summary.totalApprovalRows}
- P1 rows: ${summary.p1Rows}
- P2 rows: ${summary.p2Rows}
- Source-data template rows: ${summary.sourceDataRows}
- Alias/canonical template rows: ${summary.aliasCanonicalRows}
- Reject attachment template rows: ${summary.rejectAttachmentRows}
- Target profile template rows: ${summary.targetProfileRows}
- Pending rows: ${summary.pendingRows}
- Safe-to-auto-apply rows: ${summary.safeToAutoApplyRows}
- Safe-to-seed-target-profile rows: ${summary.safeToSeedTargetProfileRows}

## Safety

- Export/template only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
- No decision is marked approved automatically.
- P1.0 remains blocked.
`;
}

function buildScopedDecisionApplyDryRunReadme(summary: ScopedDecisionApplyDryRunSummary): string {
  return `# Business Central P0.9j Scoped Decision Apply Dry-Run

Generated at: ${summary.generatedAt}

Dry-run status: ${summary.dryRunStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Files

- \`${SCOPED_DECISION_APPLY_SUMMARY_FILE}\`: dry-run counts, P1.0 gate, impact estimate, and safety flags.
- \`${SCOPED_DECISION_APPLY_EXECUTABLE_FILE}\`: approved rows that pass dry-run validation, if any.
- \`${SCOPED_DECISION_APPLY_BLOCKED_FILE}\`: rows that are not executable and the reason.
- \`${SCOPED_DECISION_APPLY_ALIAS_FILE}\`: alias/canonical review dry-run rows only.
- \`${SCOPED_DECISION_APPLY_CANONICAL_FILE}\`: canonical entity dry-run rows only.
- \`${SCOPED_DECISION_APPLY_REJECT_FILE}\`: reject attachment dry-run rows only.
- \`${SCOPED_DECISION_APPLY_TARGET_PROFILE_FILE}\`: target profile dry-run rows only.
- \`${SCOPED_DECISION_APPLY_P10_IMPACT_FILE}\`: P1.0 impact estimate.
- \`${SCOPED_DECISION_APPLY_SAFETY_FILE}\`: explicit no-mutation safety report.
- \`${SCOPED_DECISION_APPLY_INTAKE_SOURCE_FILE}\`: approval intake counts used by this dry-run.

## Current Counts

- Total workspace rows: ${summary.totalWorkspaceRows}
- Total reviewer input rows: ${summary.totalReviewerInputRows}
- Accepted reviewer rows: ${summary.acceptedReviewerRows}
- Blocked reviewer rows: ${summary.blockedReviewerRows}
- Invalid reviewer rows: ${summary.invalidReviewerRows}
- Missing reviewer rows: ${summary.missingReviewerRows}
- Total input rows: ${summary.totalInputRows}
- Approved input rows: ${summary.approvedInputRows}
- Pending input rows: ${summary.pendingInputRows}
- Rejected input rows: ${summary.rejectedInputRows}
- Deferred input rows: ${summary.deferredInputRows}
- Executable dry-run rows: ${summary.executableRows}
- Blocked rows: ${summary.blockedRows}
- Alias dry-run rows: ${summary.aliasDryRunRows}
- Canonical entity dry-run rows: ${summary.canonicalEntityDryRunRows}
- Reject attachment dry-run rows: ${summary.rejectAttachmentDryRunRows}
- Target profile dry-run rows: ${summary.targetProfileDryRunRows}
- Source data backlog rows: ${summary.sourceDataBacklogRows}
- Invalid action rows: ${summary.invalidActionRows}
- Missing reviewer field rows: ${summary.missingReviewerFieldRows}
- Missing reviewer notes rows: ${summary.missingReviewerNotesRows}

## Rules

- Accepted reviewer decisions from approval intake are merged into the dry-run input when present.
- Only \`approval_status=approved\` can become executable in dry-run.
- Pending, empty, rejected, and deferred rows are blocked.
- Approved rows require \`reviewer\`, \`reviewer_notes\`, and an allowed review-only \`approved_action\`.
- Direct mutation actions are invalid.
- \`safe_to_auto_apply=true\` never applies data and is still blocked for OMSO, VFINE, LONGSUN, POLYPRINT, THERMO HENGFENG, and blank/unmapped safeguards.
- Target profile rows never insert target profiles from this command.
- P1.0 cannot be unblocked by this command.

## Safety

- Dry-run/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
- P1.0 remains blocked.
`;
}

function buildScopedDecisionApprovalIntakeReadme(summary: ScopedDecisionApprovalIntakeSummary): string {
  return `# Business Central P0.9k Scoped Decision Approval Intake

Generated at: ${summary.generatedAt}

Readiness status: ${summary.readinessStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Files

- \`${SCOPED_DECISION_INTAKE_SUMMARY_FILE}\`: approval intake counts, gate status, and safety flags.
- \`${SCOPED_DECISION_INTAKE_NORMALIZED_FILE}\`: normalized reviewer decisions from the optional input file.
- \`${SCOPED_DECISION_INTAKE_ACCEPTED_FILE}\`: approved reviewer decisions that passed intake validation for future dry-run review.
- \`${SCOPED_DECISION_INTAKE_BLOCKED_FILE}\`: reviewer decisions blocked by pending/rejected/deferred status or safety rules.
- \`${SCOPED_DECISION_INTAKE_MISSING_FILE}\`: approval workspace rows without reviewer input.
- \`${SCOPED_DECISION_INTAKE_DUPLICATE_FILE}\`: duplicate reviewer decisions for the same row.
- \`${SCOPED_DECISION_INTAKE_INVALID_FILE}\`: invalid reviewer decisions.
- \`${SCOPED_DECISION_INTAKE_READINESS_FILE}\`: machine-readable readiness report.
- \`${SCOPED_DECISION_INTAKE_P10_GATE_FILE}\`: P1.0 gate preview.
- \`${SCOPED_DECISION_INTAKE_SAFETY_FILE}\`: explicit no-mutation safety report.
- \`${DEFAULT_SCOPED_DECISION_MANUAL_APPROVAL_INPUT_DIR}/${SCOPED_DECISION_REVIEWER_DECISIONS_TEMPLATE_FILE}\`: editable reviewer input template.

## Current Counts

- Total workspace rows: ${summary.totalWorkspaceRows}
- Total reviewer input rows: ${summary.totalReviewerInputRows}
- Matched reviewer rows: ${summary.matchedReviewerRows}
- Missing reviewer rows: ${summary.missingReviewerRows}
- Duplicate reviewer rows: ${summary.duplicateReviewerRows}
- Unknown reviewer rows: ${summary.unknownReviewerRows}
- Accepted reviewer rows: ${summary.acceptedReviewerRows}
- Blocked reviewer rows: ${summary.blockedReviewerRows}
- Invalid reviewer rows: ${summary.invalidReviewerRows}
- Approved reviewer rows: ${summary.approvedReviewerRows}
- Rejected reviewer rows: ${summary.rejectedReviewerRows}
- Deferred reviewer rows: ${summary.deferredReviewerRows}
- Pending reviewer rows: ${summary.pendingReviewerRows}

## Rules

- If \`${SCOPED_DECISION_REVIEWER_DECISIONS_FILE}\` is missing, all workspace rows are reported as missing reviewer decisions.
- Empty \`approval_status\` is treated as pending.
- Only \`approval_status=approved\` can be accepted, and approved rows still require reviewer, reviewer_notes, and a review-only approved_action.
- Duplicate and unknown reviewer decisions are blocked.
- Direct mutation actions are invalid.
- Accepted rows are exported only for future dry-run review; they are not written back into the approval workspace.
- P1.0 cannot be unblocked by this command.

## Safety

- Intake/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` mutation.
- No alias change.
- No conditional rule change.
- No dashboard switch.
- Approval workspace and apply dry-run outputs are not mutated.
- P1.0 remains blocked.
`;
}

async function runScopedDecisionReview() {
  const sourcePackage = resolveRepoPath(process.env.SCOPED_BLOCKER_PACKAGE_DIR?.trim() || DEFAULT_SCOPED_BLOCKER_PACKAGE_DIR);
  const outputDir = resolveRepoPath(process.env.SCOPED_DECISION_REVIEW_DIR?.trim() || DEFAULT_SCOPED_DECISION_REVIEW_DIR);
  const sourceFile = path.join(sourcePackage, SCOPED_BLOCKER_TRUE_P10_FILE);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_DECISION_REVIEW_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_DECISION_REVIEW_README_FILE),
    decisionBoard: path.join(outputDir, SCOPED_DECISION_REVIEW_BOARD_FILE),
    aliasCanonical: path.join(outputDir, SCOPED_DECISION_REVIEW_ALIAS_CANONICAL_FILE),
    unknownSource: path.join(outputDir, SCOPED_DECISION_REVIEW_UNKNOWN_SOURCE_FILE),
    rejectAttachment: path.join(outputDir, SCOPED_DECISION_REVIEW_REJECT_ATTACHMENT_FILE),
    targetProfile: path.join(outputDir, SCOPED_DECISION_REVIEW_TARGET_PROFILE_FILE),
    familyRollup: path.join(outputDir, SCOPED_DECISION_REVIEW_FAMILY_ROLLUP_FILE),
    nextAction: path.join(outputDir, SCOPED_DECISION_REVIEW_NEXT_ACTION_FILE)
  };

  console.log("Business Central P0.9g scoped decision review");
  console.log("Mode: EXPORT_ONLY");
  console.log(`Source package: ${displayRepoPath(sourcePackage)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: reporting/export only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const inputRows = await readScopedBlockerRows(sourceFile);
  const review = buildScopedDecisionReview({
    rows: inputRows,
    sourcePackage: displayRepoPath(sourcePackage),
    outputFolder: displayRepoPath(outputDir)
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(review.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedDecisionReviewReadme(review.summary), "utf8");
  await writeFile(outputFiles.decisionBoard, resolutionPackageCsv(scopedDecisionReviewCsvHeaders, review.decisionRows), "utf8");
  await writeFile(outputFiles.aliasCanonical, resolutionPackageCsv(scopedDecisionReviewCsvHeaders, review.aliasCanonicalRows), "utf8");
  await writeFile(outputFiles.unknownSource, resolutionPackageCsv(scopedDecisionReviewCsvHeaders, review.unknownSourceRows), "utf8");
  await writeFile(outputFiles.rejectAttachment, resolutionPackageCsv(scopedDecisionReviewCsvHeaders, review.rejectAttachmentRows), "utf8");
  await writeFile(outputFiles.targetProfile, resolutionPackageCsv(scopedDecisionReviewCsvHeaders, review.targetProfileDependencyRows), "utf8");
  await writeFile(outputFiles.familyRollup, resolutionPackageCsv(scopedDecisionFamilyRollupCsvHeaders, review.familyRollupRows), "utf8");
  await writeFile(outputFiles.nextAction, resolutionPackageCsv(scopedDecisionNextActionCsvHeaders, review.nextActionRows), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_decision_families=${review.summary.totalDecisionFamilies}`);
  console.log(`- true_p10_blocker_groups=${review.summary.trueP10BlockerGroups}`);
  console.log(`- true_p10_blocker_grouped_rows=${review.summary.trueP10BlockerGroupedRows}`);
  console.log(`- unknown_source_review_rows=${review.summary.unknownSourceReviewRows}`);
  console.log(`- alias_canonical_review_rows=${review.summary.aliasCanonicalReviewRows}`);
  console.log(`- reject_attachment_review_rows=${review.summary.rejectAttachmentReviewRows}`);
  console.log(`- target_profile_dependency_rows=${review.summary.targetProfileDependencyRows}`);
  console.log(`- p10_status=${review.summary.p10Gate.status}`);

  console.log("");
  console.log("Top decision families");
  for (const family of review.summary.topDecisionFamilies.slice(0, 10)) {
    console.log(`- ${family.decision_family}; rows=${family.grouped_rows}; groups=${family.blocker_groups}; categories=${family.categories}`);
  }

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runScopedDecisionValidate() {
  const sourceFolder = resolveRepoPath(process.env.SCOPED_DECISION_REVIEW_DIR?.trim() || DEFAULT_SCOPED_DECISION_REVIEW_DIR);
  const outputDir = resolveRepoPath(process.env.SCOPED_DECISION_VALIDATION_DIR?.trim() || DEFAULT_SCOPED_DECISION_VALIDATION_DIR);
  const sourceFile = path.join(sourceFolder, SCOPED_DECISION_REVIEW_BOARD_FILE);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_DECISION_VALIDATION_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_DECISION_VALIDATION_README_FILE),
    errors: path.join(outputDir, SCOPED_DECISION_VALIDATION_ERRORS_FILE),
    warnings: path.join(outputDir, SCOPED_DECISION_VALIDATION_WARNINGS_FILE),
    approved: path.join(outputDir, SCOPED_DECISION_VALIDATION_APPROVED_FILE),
    pending: path.join(outputDir, SCOPED_DECISION_VALIDATION_PENDING_FILE),
    blockedExecution: path.join(outputDir, SCOPED_DECISION_VALIDATION_BLOCKED_EXECUTION_FILE)
  };

  console.log("Business Central P0.9h scoped decision validator");
  console.log("Mode: VALIDATION_ONLY");
  console.log(`Source folder: ${displayRepoPath(sourceFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: reporting/validation only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const inputRows = await readScopedDecisionValidationRows(sourceFile);
  const validation = buildScopedDecisionValidation({
    rows: inputRows,
    sourceFolder: displayRepoPath(sourceFolder),
    outputFolder: displayRepoPath(outputDir)
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(validation.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedDecisionValidationReadme(validation.summary), "utf8");
  await writeFile(outputFiles.errors, resolutionPackageCsv(scopedDecisionValidationIssueCsvHeaders, validation.validationErrors), "utf8");
  await writeFile(outputFiles.warnings, resolutionPackageCsv(scopedDecisionValidationIssueCsvHeaders, validation.validationWarnings), "utf8");
  await writeFile(outputFiles.approved, resolutionPackageCsv(scopedDecisionValidationSummaryCsvHeaders, validation.approvedDecisionSummary), "utf8");
  await writeFile(outputFiles.pending, resolutionPackageCsv(scopedDecisionValidationSummaryCsvHeaders, validation.pendingDecisionSummary), "utf8");
  await writeFile(outputFiles.blockedExecution, resolutionPackageCsv(scopedDecisionBlockedExecutionCsvHeaders, validation.blockedExecutionPlan), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- validation_status=${validation.summary.validationStatus}`);
  console.log(`- total_decision_rows=${validation.summary.totalDecisionRows}`);
  console.log(`- approved_rows=${validation.summary.approvedRows}`);
  console.log(`- pending_rows=${validation.summary.pendingRows}`);
  console.log(`- rejected_rows=${validation.summary.rejectedRows}`);
  console.log(`- deferred_rows=${validation.summary.deferredRows}`);
  console.log(`- invalid_rows=${validation.summary.invalidRows}`);
  console.log(`- warning_rows=${validation.summary.warningRows}`);
  console.log(`- p1_blocking_pending_rows=${validation.summary.p1BlockingPendingRows}`);
  console.log(`- p2_blocking_pending_rows=${validation.summary.p2BlockingPendingRows}`);
  console.log(`- unsafe_auto_apply_rows=${validation.summary.unsafeAutoApplyRows}`);
  console.log(`- target_profile_blocked_rows=${validation.summary.targetProfileBlockedRows}`);
  console.log(`- unknown_source_blocked_rows=${validation.summary.unknownSourceBlockedRows}`);
  console.log(`- alias_canonical_blocked_rows=${validation.summary.aliasCanonicalBlockedRows}`);
  console.log(`- reject_attachment_blocked_rows=${validation.summary.rejectAttachmentBlockedRows}`);
  console.log(`- p10_status=${validation.summary.p10Gate.status}`);

  console.log("");
  console.log("Top validation errors");
  for (const row of validation.validationErrors.slice(0, 10)) console.log(`- ${row.validation_id}; ${row.decision_id}; ${row.code}; ${row.message}`);
  if (validation.validationErrors.length === 0) console.log("- none");

  console.log("");
  console.log("Top warnings");
  for (const row of validation.validationWarnings.slice(0, 10)) console.log(`- ${row.validation_id}; ${row.decision_id}; ${row.code}; ${row.message}`);
  if (validation.validationWarnings.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runScopedDecisionApprovalWorkspace() {
  const sourceReviewFolder = resolveRepoPath(process.env.SCOPED_DECISION_REVIEW_DIR?.trim() || DEFAULT_SCOPED_DECISION_REVIEW_DIR);
  const sourceValidationFolder = resolveRepoPath(process.env.SCOPED_DECISION_VALIDATION_DIR?.trim() || DEFAULT_SCOPED_DECISION_VALIDATION_DIR);
  const outputDir = resolveRepoPath(process.env.SCOPED_DECISION_APPROVAL_WORKSPACE_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPROVAL_WORKSPACE_DIR);
  const decisionBoardFile = path.join(sourceReviewFolder, SCOPED_DECISION_REVIEW_BOARD_FILE);
  const validationErrorsFile = path.join(sourceValidationFolder, SCOPED_DECISION_VALIDATION_ERRORS_FILE);
  const validationWarningsFile = path.join(sourceValidationFolder, SCOPED_DECISION_VALIDATION_WARNINGS_FILE);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_DECISION_APPROVAL_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_DECISION_APPROVAL_README_FILE),
    workbook: path.join(outputDir, SCOPED_DECISION_APPROVAL_WORKBOOK_FILE),
    workbookP1: path.join(outputDir, SCOPED_DECISION_APPROVAL_WORKBOOK_P1_FILE),
    workbookP2: path.join(outputDir, SCOPED_DECISION_APPROVAL_WORKBOOK_P2_FILE),
    sourceData: path.join(outputDir, SCOPED_DECISION_APPROVAL_SOURCE_DATA_FILE),
    aliasCanonical: path.join(outputDir, SCOPED_DECISION_APPROVAL_ALIAS_CANONICAL_FILE),
    rejectAttachment: path.join(outputDir, SCOPED_DECISION_APPROVAL_REJECT_ATTACHMENT_FILE),
    targetProfile: path.join(outputDir, SCOPED_DECISION_APPROVAL_TARGET_PROFILE_FILE),
    reviewerChecklist: path.join(outputDir, SCOPED_DECISION_APPROVAL_REVIEWER_CHECKLIST_FILE),
    importManifest: path.join(outputDir, SCOPED_DECISION_APPROVAL_IMPORT_MANIFEST_FILE)
  };

  console.log("Business Central P0.9i scoped decision approval workspace");
  console.log("Mode: EXPORT_TEMPLATE_ONLY");
  console.log(`Source review folder: ${displayRepoPath(sourceReviewFolder)}`);
  console.log(`Source validation folder: ${displayRepoPath(sourceValidationFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: export/template only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const decisions = await readScopedDecisionApprovalRows(decisionBoardFile);
  const validationErrors = await readScopedDecisionValidationIssues(validationErrorsFile);
  const validationWarnings = await readScopedDecisionValidationIssues(validationWarningsFile);
  const workspace = buildScopedDecisionApprovalWorkspace({
    decisions,
    validationErrors,
    validationWarnings,
    sourceReviewFolder: displayRepoPath(sourceReviewFolder),
    sourceValidationFolder: displayRepoPath(sourceValidationFolder),
    outputFolder: displayRepoPath(outputDir)
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(workspace.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedDecisionApprovalWorkspaceReadme(workspace.summary), "utf8");
  await writeFile(outputFiles.workbook, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.approvalWorkbookRows), "utf8");
  await writeFile(outputFiles.workbookP1, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.approvalWorkbookP1Rows), "utf8");
  await writeFile(outputFiles.workbookP2, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.approvalWorkbookP2Rows), "utf8");
  await writeFile(outputFiles.sourceData, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.sourceDataTemplateRows), "utf8");
  await writeFile(outputFiles.aliasCanonical, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.aliasCanonicalTemplateRows), "utf8");
  await writeFile(outputFiles.rejectAttachment, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.rejectAttachmentTemplateRows), "utf8");
  await writeFile(outputFiles.targetProfile, resolutionPackageCsv(scopedDecisionApprovalWorkbookCsvHeaders, workspace.targetProfileTemplateRows), "utf8");
  await writeFile(outputFiles.reviewerChecklist, resolutionPackageCsv(scopedDecisionReviewerChecklistCsvHeaders, workspace.reviewerChecklistRows), "utf8");
  await writeFile(outputFiles.importManifest, `${JSON.stringify(workspace.importManifest, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- total_approval_rows=${workspace.summary.totalApprovalRows}`);
  console.log(`- p1_rows=${workspace.summary.p1Rows}`);
  console.log(`- p2_rows=${workspace.summary.p2Rows}`);
  console.log(`- source_data_rows=${workspace.summary.sourceDataRows}`);
  console.log(`- alias_canonical_rows=${workspace.summary.aliasCanonicalRows}`);
  console.log(`- reject_attachment_rows=${workspace.summary.rejectAttachmentRows}`);
  console.log(`- target_profile_rows=${workspace.summary.targetProfileRows}`);
  console.log(`- pending_rows=${workspace.summary.pendingRows}`);
  console.log(`- safe_to_auto_apply_rows=${workspace.summary.safeToAutoApplyRows}`);
  console.log(`- safe_to_seed_target_profile_rows=${workspace.summary.safeToSeedTargetProfileRows}`);
  console.log(`- p10_status=${workspace.summary.p10Gate.status}`);

  console.log("");
  console.log("Top P1 approval rows");
  for (const row of workspace.approvalWorkbookP1Rows.slice(0, 10)) {
    console.log(`- ${row.decision_id}; ${row.decision_family}; ${row.decision_category}; rows=${row.grouped_rows}; source=${row.source_value}`);
  }
  if (workspace.approvalWorkbookP1Rows.length === 0) console.log("- none");

  console.log("");
  console.log("Top P2 approval rows");
  for (const row of workspace.approvalWorkbookP2Rows.slice(0, 10)) {
    console.log(`- ${row.decision_id}; ${row.decision_family}; ${row.decision_category}; rows=${row.grouped_rows}; source=${row.source_value}`);
  }
  if (workspace.approvalWorkbookP2Rows.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runScopedDecisionApplyDryRun() {
  const sourceApprovalWorkspace = resolveRepoPath(process.env.SCOPED_DECISION_APPROVAL_WORKSPACE_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPROVAL_WORKSPACE_DIR);
  const sourceApprovalIntake = resolveRepoPath(process.env.SCOPED_DECISION_APPROVAL_INTAKE_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPROVAL_INTAKE_DIR);
  const sourceValidationFolder = resolveRepoPath(process.env.SCOPED_DECISION_VALIDATION_DIR?.trim() || DEFAULT_SCOPED_DECISION_VALIDATION_DIR);
  const outputDir = resolveRepoPath(process.env.SCOPED_DECISION_APPLY_DRY_RUN_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPLY_DRY_RUN_DIR);
  const approvalWorkbookFile = path.join(sourceApprovalWorkspace, SCOPED_DECISION_APPROVAL_WORKBOOK_FILE);
  const approvalIntakeSummaryFile = path.join(sourceApprovalIntake, SCOPED_DECISION_INTAKE_SUMMARY_FILE);
  const acceptedReviewerFile = path.join(sourceApprovalIntake, SCOPED_DECISION_INTAKE_ACCEPTED_FILE);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_DECISION_APPLY_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_DECISION_APPLY_README_FILE),
    executable: path.join(outputDir, SCOPED_DECISION_APPLY_EXECUTABLE_FILE),
    blocked: path.join(outputDir, SCOPED_DECISION_APPLY_BLOCKED_FILE),
    alias: path.join(outputDir, SCOPED_DECISION_APPLY_ALIAS_FILE),
    canonical: path.join(outputDir, SCOPED_DECISION_APPLY_CANONICAL_FILE),
    reject: path.join(outputDir, SCOPED_DECISION_APPLY_REJECT_FILE),
    targetProfile: path.join(outputDir, SCOPED_DECISION_APPLY_TARGET_PROFILE_FILE),
    p10Impact: path.join(outputDir, SCOPED_DECISION_APPLY_P10_IMPACT_FILE),
    safety: path.join(outputDir, SCOPED_DECISION_APPLY_SAFETY_FILE),
    intakeSource: path.join(outputDir, SCOPED_DECISION_APPLY_INTAKE_SOURCE_FILE)
  };

  console.log("Business Central P0.9j scoped decision apply dry-run");
  console.log("Mode: DRY_RUN_ONLY");
  console.log(`Source approval workspace: ${displayRepoPath(sourceApprovalWorkspace)}`);
  console.log(`Source approval intake: ${displayRepoPath(sourceApprovalIntake)}`);
  console.log(`Source validation folder: ${displayRepoPath(sourceValidationFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: dry-run/export only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const workspaceRows = await readScopedDecisionApplyDryRunRows(approvalWorkbookFile);
  const intakeSummary = await readScopedDecisionApprovalIntakeSummary(approvalIntakeSummaryFile);
  const acceptedReviewerRows = await readScopedDecisionAcceptedReviewerRows(acceptedReviewerFile);
  const rows = applyAcceptedReviewerDecisionsToWorkspaceRows({
    workspaceRows,
    acceptedReviewerRows
  });
  const dryRun = buildScopedDecisionApplyDryRun({
    rows,
    sourceApprovalWorkspace: displayRepoPath(sourceApprovalWorkspace),
    sourceApprovalIntake: displayRepoPath(sourceApprovalIntake),
    sourceValidationFolder: displayRepoPath(sourceValidationFolder),
    outputFolder: displayRepoPath(outputDir),
    intakeSummary: intakeSummary ? {
      totalWorkspaceRows: intakeSummary.totalWorkspaceRows,
      totalReviewerInputRows: intakeSummary.totalReviewerInputRows,
      acceptedReviewerRows: intakeSummary.acceptedReviewerRows,
      blockedReviewerRows: intakeSummary.blockedReviewerRows,
      invalidReviewerRows: intakeSummary.invalidReviewerRows,
      missingReviewerRows: intakeSummary.missingReviewerRows
    } : undefined
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(dryRun.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedDecisionApplyDryRunReadme(dryRun.summary), "utf8");
  await writeFile(outputFiles.executable, resolutionPackageCsv(scopedDecisionExecutablePlanCsvHeaders, dryRun.executableDecisionPlanRows), "utf8");
  await writeFile(outputFiles.blocked, resolutionPackageCsv(scopedDecisionBlockedPlanCsvHeaders, dryRun.blockedDecisionPlanRows), "utf8");
  await writeFile(outputFiles.alias, resolutionPackageCsv(scopedDecisionCategoryDryRunCsvHeaders, dryRun.aliasApplyDryRunRows), "utf8");
  await writeFile(outputFiles.canonical, resolutionPackageCsv(scopedDecisionCategoryDryRunCsvHeaders, dryRun.canonicalEntityApplyDryRunRows), "utf8");
  await writeFile(outputFiles.reject, resolutionPackageCsv(scopedDecisionCategoryDryRunCsvHeaders, dryRun.rejectAttachmentApplyDryRunRows), "utf8");
  await writeFile(outputFiles.targetProfile, resolutionPackageCsv(scopedDecisionCategoryDryRunCsvHeaders, dryRun.targetProfileApplyDryRunRows), "utf8");
  await writeFile(outputFiles.p10Impact, resolutionPackageCsv(scopedDecisionP10ImpactCsvHeaders, dryRun.p10ImpactEstimateRows), "utf8");
  await writeFile(outputFiles.safety, `${JSON.stringify(dryRun.safetyReport, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.intakeSource, resolutionPackageCsv(scopedDecisionApplyIntakeSourceCsvHeaders, dryRun.intakeSourceSummaryRows), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- dry_run_status=${dryRun.summary.dryRunStatus}`);
  console.log(`- total_workspace_rows=${dryRun.summary.totalWorkspaceRows}`);
  console.log(`- total_reviewer_input_rows=${dryRun.summary.totalReviewerInputRows}`);
  console.log(`- accepted_reviewer_rows=${dryRun.summary.acceptedReviewerRows}`);
  console.log(`- blocked_reviewer_rows=${dryRun.summary.blockedReviewerRows}`);
  console.log(`- invalid_reviewer_rows=${dryRun.summary.invalidReviewerRows}`);
  console.log(`- missing_reviewer_rows=${dryRun.summary.missingReviewerRows}`);
  console.log(`- total_input_rows=${dryRun.summary.totalInputRows}`);
  console.log(`- approved_input_rows=${dryRun.summary.approvedInputRows}`);
  console.log(`- pending_input_rows=${dryRun.summary.pendingInputRows}`);
  console.log(`- executable_rows=${dryRun.summary.executableRows}`);
  console.log(`- blocked_rows=${dryRun.summary.blockedRows}`);
  console.log(`- alias_dry_run_rows=${dryRun.summary.aliasDryRunRows}`);
  console.log(`- canonical_entity_dry_run_rows=${dryRun.summary.canonicalEntityDryRunRows}`);
  console.log(`- reject_attachment_dry_run_rows=${dryRun.summary.rejectAttachmentDryRunRows}`);
  console.log(`- target_profile_dry_run_rows=${dryRun.summary.targetProfileDryRunRows}`);
  console.log(`- p10_status=${dryRun.summary.p10Gate.status}`);

  console.log("");
  console.log("Top blocked reasons");
  const blockedReasonCounts = topCounts(dryRun.blockedDecisionPlanRows.map((row) => row.blocker_code), 10);
  for (const row of blockedReasonCounts) console.log(`- ${row.value}; rows=${row.rows}`);
  if (blockedReasonCounts.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

function buildAuthoritativeMasterIntakeReadme(summary: AuthoritativeMasterIntakeSummary): string {
  return `# Business Central P0.9m Authoritative Master Intake

Generated at: ${summary.generatedAt}

Intake status: ${summary.intakeStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Source Of Truth Pivot

From P0.9m onward:

- Current entity values are legacy evidence only.
- Old target-like entity names are legacy evidence only.
- Old aliases are conflict evidence only.
- Old target naming is reference only.
- Authoritative canonical entity master is the source of truth.
- Authoritative source-to-entity map is the source of truth.
- Authoritative target profile master is the source of truth.

## Input Files

Fill these files in \`${DEFAULT_AUTHORITATIVE_MASTER_INPUT_DIR}/\`:

- \`${AUTHORITATIVE_MASTER_CANONICAL_FILE}\`
- \`${AUTHORITATIVE_MASTER_SOURCE_MAP_FILE}\`
- \`${AUTHORITATIVE_MASTER_TARGET_PROFILES_FILE}\`

Templates are written beside them:

- \`${AUTHORITATIVE_MASTER_CANONICAL_TEMPLATE_FILE}\`
- \`${AUTHORITATIVE_MASTER_SOURCE_MAP_TEMPLATE_FILE}\`
- \`${AUTHORITATIVE_MASTER_TARGET_PROFILES_TEMPLATE_FILE}\`

## Output Files

- \`${AUTHORITATIVE_MASTER_SUMMARY_FILE}\`: intake status, counts, coverage preview summary, P1.0 gate, and safety flags.
- \`${AUTHORITATIVE_MASTER_CANONICAL_NORMALIZED_FILE}\`: normalized canonical entity input.
- \`${AUTHORITATIVE_MASTER_SOURCE_MAP_NORMALIZED_FILE}\`: normalized authoritative source mapping input.
- \`${AUTHORITATIVE_MASTER_TARGET_PROFILES_NORMALIZED_FILE}\`: normalized target profile input.
- \`${AUTHORITATIVE_MASTER_ERRORS_FILE}\`: validation errors.
- \`${AUTHORITATIVE_MASTER_WARNINGS_FILE}\`: validation warnings.
- \`${AUTHORITATIVE_MASTER_SOURCE_COVERAGE_FILE}\`: coverage preview using authoritative source map only.
- \`${AUTHORITATIVE_MASTER_TARGET_COVERAGE_FILE}\`: target profile coverage preview using authoritative target profile input only.
- \`${AUTHORITATIVE_MASTER_LEGACY_CONFLICT_FILE}\`: legacy current-entity conflict evidence.
- \`${AUTHORITATIVE_MASTER_UNMAPPED_SOURCE_FILE}\`: top source values not covered by authoritative source map.
- \`${AUTHORITATIVE_MASTER_TEMPLATES_MANIFEST_FILE}\`: template and working-file manifest.

## Safety

- Intake/validation/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No conditional rule changes.
- No dashboard switch.
- No P1.0 enablement.
- No master data is applied by this command.
`;
}

async function runAuthoritativeMasterIntake() {
  const inputFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INPUT_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR);
  const canonicalFile = path.join(inputFolder, AUTHORITATIVE_MASTER_CANONICAL_FILE);
  const sourceMapFile = path.join(inputFolder, AUTHORITATIVE_MASTER_SOURCE_MAP_FILE);
  const targetProfilesFile = path.join(inputFolder, AUTHORITATIVE_MASTER_TARGET_PROFILES_FILE);
  const inputFilesExist = (await fileExists(canonicalFile)) || (await fileExists(sourceMapFile)) || (await fileExists(targetProfilesFile));
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_MASTER_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_MASTER_README_FILE),
    canonicalNormalized: path.join(outputDir, AUTHORITATIVE_MASTER_CANONICAL_NORMALIZED_FILE),
    sourceMapNormalized: path.join(outputDir, AUTHORITATIVE_MASTER_SOURCE_MAP_NORMALIZED_FILE),
    targetProfilesNormalized: path.join(outputDir, AUTHORITATIVE_MASTER_TARGET_PROFILES_NORMALIZED_FILE),
    errors: path.join(outputDir, AUTHORITATIVE_MASTER_ERRORS_FILE),
    warnings: path.join(outputDir, AUTHORITATIVE_MASTER_WARNINGS_FILE),
    sourceCoverage: path.join(outputDir, AUTHORITATIVE_MASTER_SOURCE_COVERAGE_FILE),
    targetCoverage: path.join(outputDir, AUTHORITATIVE_MASTER_TARGET_COVERAGE_FILE),
    legacyConflict: path.join(outputDir, AUTHORITATIVE_MASTER_LEGACY_CONFLICT_FILE),
    unmappedSource: path.join(outputDir, AUTHORITATIVE_MASTER_UNMAPPED_SOURCE_FILE),
    manifest: path.join(outputDir, AUTHORITATIVE_MASTER_TEMPLATES_MANIFEST_FILE)
  };
  const templateFiles = {
    canonical: path.join(inputFolder, AUTHORITATIVE_MASTER_CANONICAL_TEMPLATE_FILE),
    sourceMap: path.join(inputFolder, AUTHORITATIVE_MASTER_SOURCE_MAP_TEMPLATE_FILE),
    targetProfiles: path.join(inputFolder, AUTHORITATIVE_MASTER_TARGET_PROFILES_TEMPLATE_FILE)
  };

  console.log("Business Central P0.9m authoritative master intake");
  console.log("Mode: INTAKE_VALIDATION_EXPORT_ONLY");
  console.log(`Input folder: ${displayRepoPath(inputFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: intake/export only; database rows, production_outputs.entity_id, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  await mkdir(inputFolder, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  if (!(await fileExists(canonicalFile))) await writeFile(canonicalFile, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.canonicalEntities, []), "utf8");
  if (!(await fileExists(sourceMapFile))) await writeFile(sourceMapFile, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.sourceToEntityMap, []), "utf8");
  if (!(await fileExists(targetProfilesFile))) await writeFile(targetProfilesFile, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.targetProfiles, []), "utf8");
  await writeFile(templateFiles.canonical, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.canonicalEntities, []), "utf8");
  await writeFile(templateFiles.sourceMap, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.sourceToEntityMap, []), "utf8");
  await writeFile(templateFiles.targetProfiles, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.targetProfiles, []), "utf8");

  const canonicalRows = await readAuthoritativeCanonicalEntityRows(canonicalFile);
  const sourceMapRows = await readAuthoritativeSourceMapRows(sourceMapFile);
  const targetProfileRows = await readAuthoritativeTargetProfileRows(targetProfilesFile);
  const entityCoverageRows = await readAuthoritativeEntityCoverageRows(resolveRepoPath(DEFAULT_ENTITY_V2_CSV_PATH));
  const entityBackfillCoverageRows = entityCoverageRows.length > 0
    ? entityCoverageRows
    : await readAuthoritativeEntityCoverageRows(resolveRepoPath(DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH));
  const targetCoverageRows = await readAuthoritativeTargetCoverageRows(resolveRepoPath(DEFAULT_TARGET_PROFILE_DRY_RUN_CSV_PATH));
  const intake = buildAuthoritativeMasterIntake({
    canonicalEntityRows: canonicalRows,
    sourceMappingRows: sourceMapRows,
    targetProfileRows,
    bcCoverageRows: entityBackfillCoverageRows,
    targetProfileCoverageRows: targetCoverageRows,
    inputFilesExist,
    inputFolder: displayRepoPath(inputFolder),
    outputFolder: displayRepoPath(outputDir)
  });

  await writeFile(outputFiles.summary, `${JSON.stringify(intake.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeMasterIntakeReadme(intake.summary), "utf8");
  await writeFile(outputFiles.canonicalNormalized, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.canonicalEntities, intake.canonicalEntitiesNormalizedRows satisfies readonly AuthoritativeNormalizedCanonicalEntityRow[]), "utf8");
  await writeFile(outputFiles.sourceMapNormalized, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.sourceToEntityMap, intake.sourceToEntityMapNormalizedRows satisfies readonly AuthoritativeNormalizedSourceMapRow[]), "utf8");
  await writeFile(outputFiles.targetProfilesNormalized, resolutionPackageCsv(authoritativeMasterInputCsvHeaders.targetProfiles, intake.targetProfilesNormalizedRows satisfies readonly AuthoritativeNormalizedTargetProfileRow[]), "utf8");
  await writeFile(outputFiles.errors, resolutionPackageCsv(authoritativeMasterValidationIssueCsvHeaders, intake.validationErrorRows), "utf8");
  await writeFile(outputFiles.warnings, resolutionPackageCsv(authoritativeMasterValidationIssueCsvHeaders, intake.validationWarningRows), "utf8");
  await writeFile(outputFiles.sourceCoverage, resolutionPackageCsv(authoritativeMasterSourceCoverageCsvHeaders, intake.sourceCoveragePreviewRows), "utf8");
  await writeFile(outputFiles.targetCoverage, resolutionPackageCsv(authoritativeMasterTargetCoverageCsvHeaders, intake.targetProfileCoveragePreviewRows), "utf8");
  await writeFile(outputFiles.legacyConflict, resolutionPackageCsv(authoritativeMasterLegacyConflictCsvHeaders, intake.legacyConflictEvidenceRows), "utf8");
  await writeFile(outputFiles.unmappedSource, resolutionPackageCsv(authoritativeMasterUnmappedSourceCsvHeaders, intake.unmappedSourceValueRows), "utf8");
  await writeFile(outputFiles.manifest, `${JSON.stringify(intake.templatesManifest, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- intake_status=${intake.summary.intakeStatus}`);
  console.log(`- canonical_entity_rows=${intake.summary.canonicalEntityRows}`);
  console.log(`- source_mapping_rows=${intake.summary.sourceMappingRows}`);
  console.log(`- target_profile_rows=${intake.summary.targetProfileRows}`);
  console.log(`- validation_error_rows=${intake.summary.validationErrorRows}`);
  console.log(`- validation_warning_rows=${intake.summary.validationWarningRows}`);
  console.log(`- total_bc_rows=${intake.summary.coveragePreview.totalBcRows}`);
  console.log(`- authoritative_mapped_rows=${intake.summary.coveragePreview.authoritativeMappedRows}`);
  console.log(`- authoritative_unmapped_rows=${intake.summary.coveragePreview.authoritativeUnmappedRows}`);
  console.log(`- p10_status=${intake.summary.p10Gate.status}`);

  console.log("");
  console.log("Top unmapped source values");
  for (const row of intake.unmappedSourceValueRows.slice(0, 10)) console.log(`- ${row.source_field}; ${row.source_value}; rows=${row.rows}; scopes=${row.bc_scopes}`);
  if (intake.unmappedSourceValueRows.length === 0) console.log("- none");

  console.log("");
  console.log("Top legacy conflict evidence");
  for (const row of intake.legacyConflictEvidenceRows.slice(0, 10)) console.log(`- ${row.source_field}; ${row.source_value}; rows=${row.rows}; current=${row.current_entity_codes_legacy_evidence}; proposed=${row.proposed_legacy_entity_codes}`);
  if (intake.legacyConflictEvidenceRows.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  for (const file of Object.values(templateFiles)) console.log(`- ${displayRepoPath(file)}`);
  console.log(`- ${displayRepoPath(canonicalFile)}`);
  console.log(`- ${displayRepoPath(sourceMapFile)}`);
  console.log(`- ${displayRepoPath(targetProfilesFile)}`);
}

function buildAuthoritativeMasterSeedDraftReadme(summary: AuthoritativeMasterSeedDraftSummary): string {
  return `# Business Central P0.9n Authoritative Master Seed Draft

Generated at: ${summary.generatedAt}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This package generates draft authoritative master input from Business Central OData/report evidence to reduce manual typing.

Generated rows are drafts only:

- canonical entities use \`source_of_truth_status=draft\`
- source mappings have empty reviewer fields and require business review
- target profiles use \`approval_status=draft\`

## Files

- \`${AUTHORITATIVE_MASTER_SEED_SUMMARY_FILE}\`: seed counts, write mode, P1.0 gate, and safety flags.
- \`${AUTHORITATIVE_MASTER_SEED_CANONICAL_FILE}\`: draft canonical entity candidates.
- \`${AUTHORITATIVE_MASTER_SEED_SOURCE_MAP_FILE}\`: exact source-to-entity draft mappings.
- \`${AUTHORITATIVE_MASTER_SEED_TARGET_PROFILES_FILE}\`: draft target profile rows.
- \`${AUTHORITATIVE_MASTER_SEED_REVIEW_QUEUE_FILE}\`: source, mapping, and target rows that need manual review.
- \`${AUTHORITATIVE_MASTER_SEED_LEGACY_CROSSWALK_FILE}\`: legacy/current entity and v2 evidence crosswalk.
- \`${AUTHORITATIVE_MASTER_SEED_EXCLUDED_FILE}\`: source values excluded from generated master drafts.
- \`${AUTHORITATIVE_MASTER_SEED_WARNINGS_FILE}\`: quality warnings for draft rows.

## Write Mode

- wroteWorkingInputFiles: \`${summary.wroteWorkingInputFiles}\`
- wroteDraftFilesOnly: \`${summary.wroteDraftFilesOnly}\`

If existing authoritative master input files contain data, this command writes \`.draft.csv\` files instead of overwriting user-edited input.

## Safety

- Draft/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No conditional rule changes.
- No dashboard switch.
- No P1.0 enablement.
`;
}

async function runAuthoritativeMasterSeedDraft() {
  const inputFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INPUT_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_SEED_DRAFT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_SEED_DRAFT_DIR);
  const forceWrite = process.env.AUTHORITATIVE_MASTER_SEED_FORCE_WRITE === "true";
  const canonicalFile = path.join(inputFolder, AUTHORITATIVE_MASTER_CANONICAL_FILE);
  const sourceMapFile = path.join(inputFolder, AUTHORITATIVE_MASTER_SOURCE_MAP_FILE);
  const targetProfilesFile = path.join(inputFolder, AUTHORITATIVE_MASTER_TARGET_PROFILES_FILE);
  const canonicalDraftFile = path.join(inputFolder, AUTHORITATIVE_MASTER_CANONICAL_DRAFT_FILE);
  const sourceMapDraftFile = path.join(inputFolder, AUTHORITATIVE_MASTER_SOURCE_MAP_DRAFT_FILE);
  const targetProfilesDraftFile = path.join(inputFolder, AUTHORITATIVE_MASTER_TARGET_PROFILES_DRAFT_FILE);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_README_FILE),
    canonical: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_CANONICAL_FILE),
    sourceMap: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_SOURCE_MAP_FILE),
    targetProfiles: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_TARGET_PROFILES_FILE),
    reviewQueue: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_REVIEW_QUEUE_FILE),
    legacyCrosswalk: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_LEGACY_CROSSWALK_FILE),
    excluded: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_EXCLUDED_FILE),
    warnings: path.join(outputDir, AUTHORITATIVE_MASTER_SEED_WARNINGS_FILE)
  };

  console.log("Business Central P0.9n authoritative master seed draft");
  console.log("Mode: DRAFT_EXPORT_ONLY");
  console.log(`Input folder: ${displayRepoPath(inputFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: draft/export only; database rows, production_outputs.entity_id, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  await mkdir(inputFolder, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const writeDecision = decideAuthoritativeSeedWriteTarget({
    canonicalInputHasData: await csvFileHasDataRows(canonicalFile),
    sourceMapInputHasData: await csvFileHasDataRows(sourceMapFile),
    targetProfilesInputHasData: await csvFileHasDataRows(targetProfilesFile),
    forceWrite
  });
  const entityRows = await readAuthoritativeSeedEntityEvidenceRows(resolveRepoPath(DEFAULT_ENTITY_V2_CSV_PATH));
  const fallbackEntityRows = entityRows.length > 0
    ? entityRows
    : await readAuthoritativeSeedEntityEvidenceRows(resolveRepoPath(DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH));
  const targetRows = await readAuthoritativeTargetProfileSeedEvidenceRows(resolveRepoPath(DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_CSV_PATH));
  const seed = buildAuthoritativeMasterSeedDraft({
    entityEvidenceRows: fallbackEntityRows,
    targetProfileEvidenceRows: targetRows,
    outputFolder: displayRepoPath(outputDir),
    inputFolder: displayRepoPath(inputFolder),
    writeDecision
  });

  const canonicalCsv = resolutionPackageCsv(authoritativeMasterInputCsvHeaders.canonicalEntities, seed.canonicalSeedRows);
  const sourceMapCsv = resolutionPackageCsv(authoritativeMasterInputCsvHeaders.sourceToEntityMap, seed.sourceMapSeedRows);
  const targetProfilesCsv = resolutionPackageCsv(authoritativeMasterInputCsvHeaders.targetProfiles, seed.targetProfileSeedRows);

  await writeFile(outputFiles.summary, `${JSON.stringify(seed.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeMasterSeedDraftReadme(seed.summary), "utf8");
  await writeFile(outputFiles.canonical, canonicalCsv, "utf8");
  await writeFile(outputFiles.sourceMap, sourceMapCsv, "utf8");
  await writeFile(outputFiles.targetProfiles, targetProfilesCsv, "utf8");
  await writeFile(outputFiles.reviewQueue, resolutionPackageCsv(authoritativeSeedReviewQueueCsvHeaders, seed.seedReviewQueueRows), "utf8");
  await writeFile(outputFiles.legacyCrosswalk, resolutionPackageCsv(authoritativeSeedLegacyCrosswalkCsvHeaders, seed.legacyEvidenceCrosswalkRows), "utf8");
  await writeFile(outputFiles.excluded, resolutionPackageCsv(authoritativeSeedExcludedCsvHeaders, seed.excludedSourceValueRows), "utf8");
  await writeFile(outputFiles.warnings, resolutionPackageCsv(authoritativeSeedWarningsCsvHeaders, seed.seedQualityWarningRows), "utf8");

  if (writeDecision.writeWorkingInputFiles) {
    await writeFile(canonicalFile, canonicalCsv, "utf8");
    await writeFile(sourceMapFile, sourceMapCsv, "utf8");
    await writeFile(targetProfilesFile, targetProfilesCsv, "utf8");
  } else {
    await writeFile(canonicalDraftFile, canonicalCsv, "utf8");
    await writeFile(sourceMapDraftFile, sourceMapCsv, "utf8");
    await writeFile(targetProfilesDraftFile, targetProfilesCsv, "utf8");
  }

  console.log("");
  console.log("Summary");
  console.log(`- canonical_seed_rows=${seed.summary.canonicalSeedRows}`);
  console.log(`- source_map_seed_rows=${seed.summary.sourceMapSeedRows}`);
  console.log(`- target_profile_seed_rows=${seed.summary.targetProfileSeedRows}`);
  console.log(`- review_queue_rows=${seed.summary.reviewQueueRows}`);
  console.log(`- excluded_source_value_rows=${seed.summary.excludedSourceValueRows}`);
  console.log(`- warning_rows=${seed.summary.warningRows}`);
  console.log(`- wrote_working_input_files=${seed.summary.wroteWorkingInputFiles}`);
  console.log(`- wrote_draft_files_only=${seed.summary.wroteDraftFilesOnly}`);
  console.log(`- p10_status=${seed.summary.p10Gate.status}`);

  console.log("");
  console.log("Top generated families");
  for (const row of seed.summary.topGeneratedFamilies) console.log(`- ${row.family}; rows=${row.rows}`);
  if (seed.summary.topGeneratedFamilies.length === 0) console.log("- none");

  console.log("");
  console.log("Top review reasons");
  for (const row of seed.summary.topReviewReasons) console.log(`- ${row.reason}; rows=${row.rows}`);
  if (seed.summary.topReviewReasons.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  if (writeDecision.writeWorkingInputFiles) {
    console.log(`- ${displayRepoPath(canonicalFile)}`);
    console.log(`- ${displayRepoPath(sourceMapFile)}`);
    console.log(`- ${displayRepoPath(targetProfilesFile)}`);
  } else {
    console.log(`- ${displayRepoPath(canonicalDraftFile)}`);
    console.log(`- ${displayRepoPath(sourceMapDraftFile)}`);
    console.log(`- ${displayRepoPath(targetProfilesDraftFile)}`);
  }
}

function buildFutureUseRawRegistryReadme(summary: { readonly generatedAt: string; readonly registryStatus: string; readonly p10Gate: { readonly status: string; readonly reason: string } }): string {
  return `# Business Central P0.9o Future Use Raw Registry

Generated at: ${summary.generatedAt}

Registry status: ${summary.registryStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This registry is not KPI output. It keeps every Business Central raw row visible with a current KPI scope, future-use domain, registry status, P1.0 inclusion status, authoritative entity coverage status, and target-profile requirement status.

Future-use raw data is retained and classified instead of silently ignored. P1.0 uses only approved production output rows with approved entity and target-profile coverage. Future modules can later use this registry without polluting the P1.0 production output dashboard.

## Files

- \`${FUTURE_USE_RAW_REGISTRY_SUMMARY_FILE}\`: counts, coverage, P1.0 gate, and safety flags.
- \`${FUTURE_USE_RAW_REGISTRY_FILE}\`: row-level raw registry when row-level report input is available.
- \`${FUTURE_USE_DOMAIN_ROLLUP_FILE}\`: rows by future-use domain.
- \`${FUTURE_USE_MODULE_READINESS_FILE}\`: future module readiness by module candidate.
- \`${FUTURE_USE_P10_SPLIT_FILE}\`: P1.0 production/reject versus future-use split.
- \`${FUTURE_USE_SOURCE_COVERAGE_FILE}\`: source-value coverage by authoritative/draft/conflict status.
- \`${FUTURE_USE_REVIEW_QUEUE_FILE}\`: visible queue for unknown, source-data-gap, conflict, target, and quality reviews.
- \`${FUTURE_USE_SOURCE_DATA_GAP_FILE}\`: source-data-gap backlog.
- \`${FUTURE_USE_UNKNOWN_REVIEW_FILE}\`: unknown-review backlog.
- \`${FUTURE_USE_ENTITY_COVERAGE_FILE}\`: authoritative entity coverage by domain.
- \`${FUTURE_USE_TARGET_PROFILE_REQUIREMENT_FILE}\`: target-profile requirement by domain.
- \`${FUTURE_USE_SAFETY_REPORT_FILE}\`: safety flags.

## Safety

- Registry/export/coverage only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No authoritative master approval.
- No conditional rule changes.
- No dashboard switch.
- No P1.0 enablement.
`;
}

function buildAuthoritativeMasterReviewWorkspaceReadme(summary: { readonly generatedAt: string; readonly workspaceStatus: string; readonly p10Gate: { readonly status: string; readonly reason: string } }): string {
  return `# Business Central P0.9p Authoritative Master Review Workspace

Generated at: ${summary.generatedAt}

Workspace status: ${summary.workspaceStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This workspace is for human review. It turns the P0.9n seed drafts and P0.9o future-use raw registry into reviewer-friendly CSVs for canonical entities, source mappings, conflicts, source data gaps, future-use domains, and target profiles.

It does not approve or apply master data. Every generated review row defaults to \`pending\`.

## Target Profile Scope

- \`PRODUCTION_OUTPUT_DASHBOARD\` requires target profile by default.
- \`REJECT_ATTACHMENT\` is conditional.
- Future-use non-production domains do not require target profile by default.

Future-use raw remains registered and visible, but target profile absence outside the production output dashboard is not treated as a P1 blocker by this workspace.

## Safety

- Review workspace/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No authoritative master approval.
- No conditional rule changes.
- No dashboard switch.
- No P1.0 enablement.
`;
}

async function runAuthoritativeMasterReviewWorkspace() {
  const seedFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_SEED_DRAFT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_SEED_DRAFT_DIR);
  const intakeFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR);
  const registryFolder = resolveRepoPath(process.env.FUTURE_USE_RAW_REGISTRY_DIR?.trim() || DEFAULT_FUTURE_USE_RAW_REGISTRY_DIR);
  const scopedDecisionFolder = resolveRepoPath(process.env.SCOPED_DECISION_REVIEW_DIR?.trim() || DEFAULT_SCOPED_DECISION_REVIEW_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_README_FILE),
    entity: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_ENTITY_FILE),
    sourceMapping: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_SOURCE_MAPPING_FILE),
    targetProfile: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_TARGET_PROFILE_FILE),
    conflict: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_CONFLICT_FILE),
    sourceGap: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_SOURCE_GAP_FILE),
    futureUse: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_FUTURE_USE_FILE),
    decisionTemplate: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_TEMPLATE_FILE),
    priorityBoard: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_PRIORITY_BOARD_FILE),
    checklist: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_CHECKLIST_FILE),
    importManifest: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_IMPORT_MANIFEST_FILE)
  };

  console.log("Business Central P0.9p authoritative master review workspace");
  console.log("Mode: REVIEW_WORKSPACE_EXPORT_ONLY");
  console.log(`Seed draft folder: ${displayRepoPath(seedFolder)}`);
  console.log(`Authoritative intake folder: ${displayRepoPath(intakeFolder)}`);
  console.log(`Future-use registry folder: ${displayRepoPath(registryFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: review workspace/export only; database rows, production_outputs.entity_id, target_profiles, aliases, authoritative masters, conditional rules, and dashboard behavior are not changed.");

  const seedCanonicalFile = path.join(seedFolder, AUTHORITATIVE_MASTER_SEED_CANONICAL_FILE);
  const seedSourceMapFile = path.join(seedFolder, AUTHORITATIVE_MASTER_SEED_SOURCE_MAP_FILE);
  const seedTargetProfileFile = path.join(seedFolder, AUTHORITATIVE_MASTER_SEED_TARGET_PROFILES_FILE);
  const registryFile = path.join(registryFolder, FUTURE_USE_RAW_REGISTRY_FILE);
  const sourceGapFile = path.join(registryFolder, FUTURE_USE_SOURCE_DATA_GAP_FILE);
  const targetRequirementFile = path.join(registryFolder, FUTURE_USE_TARGET_PROFILE_REQUIREMENT_FILE);
  const inputsAvailable = await fileExists(seedCanonicalFile) && await fileExists(seedSourceMapFile) && await fileExists(registryFile);

  const workspace = buildAuthoritativeMasterReviewWorkspace({
    seedCanonicalRows: await readAuthoritativeCanonicalEntityRows(seedCanonicalFile),
    seedSourceMapRows: await readAuthoritativeSourceMapRows(seedSourceMapFile),
    seedTargetProfileRows: await readAuthoritativeTargetProfileRows(seedTargetProfileFile),
    seedReviewQueueRows: await readAuthoritativeSeedReviewQueueRows(path.join(seedFolder, AUTHORITATIVE_MASTER_SEED_REVIEW_QUEUE_FILE)),
    legacyCrosswalkRows: await readAuthoritativeSeedLegacyCrosswalkRows(path.join(seedFolder, AUTHORITATIVE_MASTER_SEED_LEGACY_CROSSWALK_FILE)),
    registryRows: await readFutureUseRegistryRows(registryFile),
    sourceDataGapRows: await readFutureUseReviewQueueRows(sourceGapFile),
    targetProfileRequirementRows: await readFutureUseTargetProfileRequirementRows(targetRequirementFile),
    sourceFolders: [
      displayRepoPath(seedFolder),
      displayRepoPath(intakeFolder),
      displayRepoPath(registryFolder),
      displayRepoPath(resolveRepoPath(".tmp/bc-unmapped-diagnosis")),
      displayRepoPath(scopedDecisionFolder)
    ],
    outputFolder: displayRepoPath(outputDir),
    inputsAvailable
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(workspace.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeMasterReviewWorkspaceReadme(workspace.summary), "utf8");
  await writeFile(outputFiles.entity, resolutionPackageCsv(authoritativeReviewEntityCsvHeaders, workspace.entityReviewRows), "utf8");
  await writeFile(outputFiles.sourceMapping, resolutionPackageCsv(authoritativeReviewSourceMappingCsvHeaders, workspace.sourceMappingReviewRows), "utf8");
  await writeFile(outputFiles.targetProfile, resolutionPackageCsv(authoritativeReviewTargetProfileCsvHeaders, workspace.targetProfileReviewRows), "utf8");
  await writeFile(outputFiles.conflict, resolutionPackageCsv(authoritativeReviewConflictCsvHeaders, workspace.conflictReviewRows), "utf8");
  await writeFile(outputFiles.sourceGap, resolutionPackageCsv(authoritativeReviewSourceGapCsvHeaders, workspace.sourceDataGapReviewRows), "utf8");
  await writeFile(outputFiles.futureUse, resolutionPackageCsv(authoritativeReviewFutureUseCsvHeaders, workspace.futureUseDomainReviewRows), "utf8");
  await writeFile(outputFiles.decisionTemplate, resolutionPackageCsv(authoritativeReviewDecisionTemplateCsvHeaders, workspace.reviewerDecisionTemplateRows), "utf8");
  await writeFile(outputFiles.priorityBoard, resolutionPackageCsv(authoritativeReviewPriorityBoardCsvHeaders, workspace.reviewPriorityBoardRows), "utf8");
  await writeFile(outputFiles.checklist, resolutionPackageCsv(authoritativeReviewChecklistCsvHeaders, workspace.reviewChecklistRows), "utf8");
  await writeFile(outputFiles.importManifest, `${JSON.stringify(workspace.importManifest, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- workspace_status=${workspace.summary.workspaceStatus}`);
  console.log(`- entity_review_rows=${workspace.summary.entityReviewRows}`);
  console.log(`- source_mapping_review_rows=${workspace.summary.sourceMappingReviewRows}`);
  console.log(`- target_profile_review_rows=${workspace.summary.targetProfileReviewRows}`);
  console.log(`- conflict_review_rows=${workspace.summary.conflictReviewRows}`);
  console.log(`- source_data_gap_review_rows=${workspace.summary.sourceDataGapReviewRows}`);
  console.log(`- future_use_domain_review_rows=${workspace.summary.futureUseDomainReviewRows}`);
  console.log(`- p1_rows=${workspace.summary.p1Rows}`);
  console.log(`- p2_rows=${workspace.summary.p2Rows}`);
  console.log(`- p3_rows=${workspace.summary.p3Rows}`);
  console.log(`- p10_status=${workspace.summary.p10Gate.status}`);

  console.log("");
  console.log("Top review priorities");
  for (const row of workspace.reviewPriorityBoardRows.slice(0, 10)) {
    console.log(`- ${row.priority}; ${row.review_type}; ${row.review_id}; rows=${row.rows}; action=${row.recommended_action}`);
  }
  if (workspace.reviewPriorityBoardRows.length === 0) console.log("- none");

  console.log("");
  console.log("Target profile review");
  for (const row of workspace.targetProfileReviewRows.slice(0, 10)) {
    console.log(`- ${row.priority}; entity=${row.canonical_entity_code || "(blank)"}; output_rows=${row.affected_output_rows}; required=${row.target_profile_required}; status=${row.target_profile_status}`);
  }
  if (workspace.targetProfileReviewRows.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

function buildAuthoritativeMasterReviewDecisionIntakeReadme(summary: { readonly generatedAt: string; readonly intakeStatus: string; readonly p10Gate: { readonly status: string; readonly reason: string } }): string {
  return `# Business Central P0.9q Authoritative Master Review Decision Intake

Generated at: ${summary.generatedAt}

Intake status: ${summary.intakeStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This command validates human reviewer decisions from the P0.9p authoritative master review workspace. It exports accepted, blocked, invalid, duplicate, unknown, pending, rejected, and deferred decision files plus preview CSVs for future dry-run planning.

Accepted previews are not database changes. The next step after this milestone is a separate dry-run application of accepted decisions, not mutation.

## Safety

- Decision intake/validation/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No authoritative master approval applied automatically.
- No conditional rule changes.
- No dashboard switch.
- No P1.0 enablement.
`;
}

async function runAuthoritativeMasterReviewDecisionIntake() {
  const inputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR);
  const workspaceDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR);
  const workspaceTemplateFile = path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_TEMPLATE_FILE);
  const reviewerInputFile = path.join(inputDir, AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE);
  const reviewerTemplateFile = path.join(inputDir, AUTHORITATIVE_MASTER_REVIEW_DECISIONS_TEMPLATE_FILE);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_README_FILE),
    accepted: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_ACCEPTED_FILE),
    blocked: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_BLOCKED_FILE),
    invalid: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_INVALID_FILE),
    duplicate: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DUPLICATE_FILE),
    unknown: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_UNKNOWN_FILE),
    pending: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_PENDING_FILE),
    rejected: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_REJECTED_FILE),
    deferred: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DEFERRED_FILE),
    canonicalPreview: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_APPROVED_CANONICAL_FILE),
    sourcePreview: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_APPROVED_SOURCE_MAP_FILE),
    targetProfilePreview: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_APPROVED_TARGET_PROFILE_FILE),
    sourceBacklog: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_SOURCE_BACKLOG_FILE),
    futureUseOnly: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_FUTURE_USE_ONLY_FILE),
    errors: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_INTAKE_ERRORS_FILE),
    warnings: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_INTAKE_WARNINGS_FILE),
    importManifest: path.join(outputDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_IMPORT_MANIFEST_FILE)
  };

  console.log("Business Central P0.9q authoritative master review decision intake");
  console.log("Mode: DECISION_INTAKE_VALIDATION_EXPORT_ONLY");
  console.log(`Input folder: ${displayRepoPath(inputDir)}`);
  console.log(`Source workspace folder: ${displayRepoPath(workspaceDir)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: decision intake/export only; database rows, production_outputs.entity_id, target_profiles, aliases, authoritative masters, conditional rules, and dashboard behavior are not changed.");

  const workspaceRows = await readAuthoritativeMasterReviewerDecisionTemplateRows(workspaceTemplateFile);
  const reviewerInputExists = await fileExists(reviewerInputFile);
  const reviewerRows = await readAuthoritativeMasterReviewerDecisionRows(reviewerInputFile);
  const intake = buildAuthoritativeMasterReviewDecisionIntake({
    workspaceRows,
    reviewerRows,
    reviewerInputExists,
    inputFolder: displayRepoPath(inputDir),
    sourceWorkspaceFolder: displayRepoPath(workspaceDir),
    outputFolder: displayRepoPath(outputDir)
  });

  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  if (!reviewerInputExists) {
    await writeFile(reviewerTemplateFile, resolutionPackageCsv(authoritativeReviewDecisionTemplateCsvHeaders, intake.templateRows), "utf8");
  }
  await writeFile(outputFiles.summary, `${JSON.stringify(intake.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeMasterReviewDecisionIntakeReadme(intake.summary), "utf8");
  await writeFile(outputFiles.accepted, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, intake.acceptedRows), "utf8");
  await writeFile(outputFiles.blocked, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.blockedRows), "utf8");
  await writeFile(outputFiles.invalid, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.invalidRows), "utf8");
  await writeFile(outputFiles.duplicate, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.duplicateRows), "utf8");
  await writeFile(outputFiles.unknown, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.unknownRows), "utf8");
  await writeFile(outputFiles.pending, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, intake.pendingRows), "utf8");
  await writeFile(outputFiles.rejected, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, intake.rejectedRows), "utf8");
  await writeFile(outputFiles.deferred, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, intake.deferredRows), "utf8");
  await writeFile(outputFiles.canonicalPreview, resolutionPackageCsv(authoritativeReviewDecisionPreviewCanonicalCsvHeaders, intake.canonicalEntityPreviewRows), "utf8");
  await writeFile(outputFiles.sourcePreview, resolutionPackageCsv(authoritativeReviewDecisionPreviewSourceMapCsvHeaders, intake.sourceMappingPreviewRows), "utf8");
  await writeFile(outputFiles.targetProfilePreview, resolutionPackageCsv(authoritativeReviewDecisionPreviewTargetProfileCsvHeaders, intake.targetProfilePreviewRows), "utf8");
  await writeFile(outputFiles.sourceBacklog, resolutionPackageCsv(authoritativeReviewDecisionBacklogPreviewCsvHeaders, intake.sourceDataBacklogPreviewRows), "utf8");
  await writeFile(outputFiles.futureUseOnly, resolutionPackageCsv(authoritativeReviewDecisionBacklogPreviewCsvHeaders, intake.futureUseOnlyPreviewRows), "utf8");
  await writeFile(outputFiles.errors, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.errors), "utf8");
  await writeFile(outputFiles.warnings, resolutionPackageCsv(authoritativeReviewDecisionIssueCsvHeaders, intake.warnings), "utf8");
  await writeFile(outputFiles.importManifest, `${JSON.stringify(intake.importManifest, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- intake_status=${intake.summary.intakeStatus}`);
  console.log(`- total_workspace_review_rows=${intake.summary.totalWorkspaceReviewRows}`);
  console.log(`- total_reviewer_input_rows=${intake.summary.totalReviewerInputRows}`);
  console.log(`- accepted_rows=${intake.summary.acceptedRows}`);
  console.log(`- blocked_rows=${intake.summary.blockedRows}`);
  console.log(`- invalid_rows=${intake.summary.invalidRows}`);
  console.log(`- duplicate_rows=${intake.summary.duplicateRows}`);
  console.log(`- unknown_rows=${intake.summary.unknownRows}`);
  console.log(`- pending_rows=${intake.summary.pendingRows}`);
  console.log(`- canonical_entity_approval_rows=${intake.summary.canonicalEntityApprovalRows}`);
  console.log(`- source_mapping_approval_rows=${intake.summary.sourceMappingApprovalRows}`);
  console.log(`- reviewed_alias_approval_rows=${intake.summary.reviewedAliasApprovalRows}`);
  console.log(`- target_profile_approval_rows=${intake.summary.targetProfileApprovalRows}`);
  console.log(`- warning_rows=${intake.summary.warningRows}`);
  console.log(`- error_rows=${intake.summary.errorRows}`);
  console.log(`- p10_status=${intake.summary.p10Gate.status}`);

  console.log("");
  console.log("Top blocked reasons");
  const blockedReasons = topCounts([...intake.blockedRows, ...intake.invalidRows, ...intake.duplicateRows, ...intake.unknownRows].map((row) => row.issue_code), 10);
  for (const row of blockedReasons) console.log(`- ${row.value}; rows=${row.rows}`);
  if (blockedReasons.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  if (!reviewerInputExists) console.log(`- ${displayRepoPath(reviewerTemplateFile)}`);
}

function buildAuthoritativeReviewDecisionSampleFixtureReadme(summary: { readonly generatedAt: string; readonly fixtureStatus: string; readonly p10Gate: { readonly status: string; readonly reason: string } }): string {
  return `# Business Central P0.9r Authoritative Review Decision Sample Fixture

Generated at: ${summary.generatedAt}

Fixture status: ${summary.fixtureStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This package generates sample reviewer decision CSVs for local simulation of P0.9q review-decision intake.

The sample files are not real business approvals. Every generated note contains \`TEST_FIXTURE_DRY_RUN_ONLY\`, and every generated reviewer is \`TEST_REVIEWER\`.

## Safety

- Fixture/export only.
- Does not write or overwrite \`.tmp/bc-authoritative-master-review-input/reviewer-decisions.csv\`.
- Does not approve authoritative master data.
- Does not mutate the database.
- Does not update \`production_outputs.entity_id\`.
- Does not insert, update, or delete \`target_profiles\`.
- Does not create, update, or delete aliases.
- Does not change conditional rules.
- Does not switch dashboard behavior.
- Does not enable P1.0.
`;
}

function buildAuthoritativeReviewDecisionSampleUsageInstructions(): string {
  return `# Sample Fixture Usage

These files are for local simulation only. They are not business approval.

To simulate intake with the representative sample:

\`\`\`bash
cp .tmp/bc-authoritative-master-review-input/reviewer-decisions.sample.csv \\
 .tmp/bc-authoritative-master-review-input/reviewer-decisions.csv

pnpm bc:authoritative-master-review-decision-intake

rm .tmp/bc-authoritative-master-review-input/reviewer-decisions.csv

pnpm bc:authoritative-master-review-decision-intake
\`\`\`

Remove \`reviewer-decisions.csv\` after testing. P1.0 must remain blocked; these fixture decisions do not apply or approve master data.
`;
}

async function runAuthoritativeReviewDecisionSampleFixture() {
  const workspaceDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR);
  const decisionIntakeDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR);
  const inputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FIXTURE_DIR?.trim() || DEFAULT_AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FIXTURE_DIR);
  const workspaceTemplateFile = path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_TEMPLATE_FILE);
  const convenienceSampleFile = path.join(inputDir, AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FILE);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_SAMPLE_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_SAMPLE_README_FILE),
    sample: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_SAMPLE_FILE),
    safeDefer: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_SAFE_DEFER_FILE),
    mixed: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_MIXED_FILE),
    expectations: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_EXPECTATIONS_FILE),
    usage: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_USAGE_FILE)
  };

  console.log("Business Central P0.9r authoritative review decision sample fixture");
  console.log("Mode: FIXTURE_EXPORT_ONLY");
  console.log(`Source workspace folder: ${displayRepoPath(workspaceDir)}`);
  console.log(`Source decision intake folder: ${displayRepoPath(decisionIntakeDir)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: fixture/export only; reviewer-decisions.csv, database rows, production_outputs.entity_id, target_profiles, aliases, authoritative masters, conditional rules, and dashboard behavior are not changed.");

  const workspaceAvailable = await fileExists(workspaceTemplateFile);
  const workspaceRows = workspaceAvailable
    ? await readAuthoritativeMasterReviewerDecisionTemplateRows(workspaceTemplateFile)
    : [];
  const fixture = buildAuthoritativeReviewDecisionSampleFixture({
    workspaceRows,
    sourceWorkspaceFolder: displayRepoPath(workspaceDir),
    outputFolder: displayRepoPath(outputDir),
    wroteConvenienceSampleFile: workspaceRows.length > 0
  });

  await mkdir(outputDir, { recursive: true });
  await mkdir(inputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(fixture.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeReviewDecisionSampleFixtureReadme(fixture.summary), "utf8");
  await writeFile(outputFiles.sample, resolutionPackageCsv(authoritativeReviewDecisionSampleCsvHeaders, fixture.sampleRows), "utf8");
  await writeFile(outputFiles.safeDefer, resolutionPackageCsv(authoritativeReviewDecisionSampleCsvHeaders, fixture.safeDeferRows), "utf8");
  await writeFile(outputFiles.mixed, resolutionPackageCsv(authoritativeReviewDecisionSampleCsvHeaders, fixture.mixedSimulationRows), "utf8");
  await writeFile(outputFiles.expectations, resolutionPackageCsv(authoritativeReviewDecisionSampleExpectationCsvHeaders, fixture.sampleValidationExpectations), "utf8");
  await writeFile(outputFiles.usage, buildAuthoritativeReviewDecisionSampleUsageInstructions(), "utf8");
  if (workspaceRows.length > 0) {
    await writeFile(convenienceSampleFile, resolutionPackageCsv(authoritativeReviewDecisionSampleCsvHeaders, fixture.sampleRows), "utf8");
  }

  console.log("");
  console.log("Summary");
  console.log(`- fixture_status=${fixture.summary.fixtureStatus}`);
  console.log(`- sample_rows=${fixture.summary.sampleRows}`);
  console.log(`- safe_defer_rows=${fixture.summary.safeDeferRows}`);
  console.log(`- mixed_simulation_rows=${fixture.summary.mixedSimulationRows}`);
  console.log(`- wrote_convenience_sample_file=${fixture.summary.wroteConvenienceSampleFile}`);
  console.log(`- overwrote_real_reviewer_decision_file=${fixture.summary.overwroteRealReviewerDecisionFile}`);
  console.log(`- p10_status=${fixture.summary.p10Gate.status}`);

  console.log("");
  console.log("Sample validation expectations");
  for (const row of fixture.sampleValidationExpectations) {
    console.log(`- ${row.fixture_file}; total=${row.expected_total_rows}; accepted_min=${row.expected_accepted_min}; deferred_min=${row.expected_deferred_min}; invalid_min=${row.expected_invalid_min}; duplicate_min=${row.expected_duplicate_min}; unknown_min=${row.expected_unknown_min}`);
  }

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  if (workspaceRows.length > 0) console.log(`- ${displayRepoPath(convenienceSampleFile)}`);
}

function buildAuthoritativeReviewDecisionBulkPrefillReadme(summary: AuthoritativeReviewDecisionBulkPrefillSummary): string {
  return `# Business Central P0.9t-pre Authoritative Review Decision Bulk Prefill

Generated at: ${summary.generatedAt}

Prefill status: ${summary.prefillStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This command generates a conservative bulk-prefilled reviewer decision CSV from the P0.9p authoritative review workspace.

It reduces manual editing by pre-filling low-risk exact decisions, deferring conflict and fallback rows, routing source gaps to backlog, routing non-production future-use domains to future-use-only, and marking incomplete production target profiles as needs-correction.

Every generated decision still requires user/business review before it can be copied to \`${AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE}\`.

## Files

- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_SUMMARY_FILE}\`: prefill counts, P1.0 gate, and safety flags.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_FILE}\`: complete bulk-prefilled reviewer decision CSV.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_SAFE_ACCEPTED_FILE}\`: rows prefilled as approved by conservative rules.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_HUMAN_REVIEW_FILE}\`: deferred or needs-correction rows.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_RULE_REPORT_FILE}\`: rule applied to each row.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_RISK_REPORT_FILE}\`: risk notes for each row.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_USAGE_FILE}\`: copy/validation instructions.
- \`${AUTHORITATIVE_REVIEW_DECISION_BULK_MANIFEST_FILE}\`: source, reviewer defaults, and safety manifest.

## Current Counts

- Total template rows: ${summary.totalTemplateRows}
- Approved prefill rows: ${summary.approvedPrefillRows}
- Deferred prefill rows: ${summary.deferredPrefillRows}
- Needs-correction rows: ${summary.needsCorrectionRows}
- Source data backlog rows: ${summary.sourceDataBacklogRows}
- Future-use only rows: ${summary.futureUseOnlyRows}
- Target profile needs-correction rows: ${summary.targetProfileNeedsCorrectionRows}
- Conflict deferred rows: ${summary.conflictDeferredRows}
- Wrote convenience prefill file: ${summary.wroteConveniencePrefillFile}
- Overwrote real reviewer decision file: ${summary.overwroteRealReviewerDecisionFile}

## Safety

- Prefill/export only.
- No database mutation.
- No authoritative master input mutation.
- No \`target_profiles\` mutation.
- No alias creation/update/delete.
- No dashboard switch.
- Does not write or overwrite \`${AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE}\`.
- P1.0 remains blocked.
`;
}

function buildAuthoritativeReviewDecisionBulkPrefillUsageInstructions(): string {
  return `# Bulk Prefill Usage

Run bulk prefill:

\`\`\`bash
pnpm bc:authoritative-review-decision-bulk-prefill
\`\`\`

Review generated file:

\`\`\`text
.tmp/bc-authoritative-master-review-input/reviewer-decisions.bulk-prefill.csv
\`\`\`

If the reviewer/business accepts the prefilled decisions, copy it manually:

\`\`\`bash
cp .tmp/bc-authoritative-master-review-input/reviewer-decisions.bulk-prefill.csv \\
 .tmp/bc-authoritative-master-review-input/reviewer-decisions.csv
\`\`\`

Validate:

\`\`\`bash
pnpm bc:authoritative-master-review-decision-intake
pnpm bc:authoritative-master-accepted-decision-dry-run
\`\`\`

If acceptedRows > 0, continue to apply plan:

\`\`\`bash
pnpm bc:authoritative-master-apply-plan
\`\`\`

This command never writes \`reviewer-decisions.csv\` directly. P1.0 remains blocked until later approved apply planning.
`;
}

async function runAuthoritativeReviewDecisionBulkPrefill() {
  const workspaceDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR);
  const inputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_INPUT_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_DIR?.trim() || DEFAULT_AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_DIR);
  const workspaceTemplateFile = path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_DECISION_TEMPLATE_FILE);
  const conveniencePrefillFile = path.join(inputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_FILE);
  const realReviewerDecisionFile = path.join(inputDir, AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_README_FILE),
    prefill: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_PREFILL_FILE),
    safeAccepted: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_SAFE_ACCEPTED_FILE),
    humanReview: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_HUMAN_REVIEW_FILE),
    ruleReport: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_RULE_REPORT_FILE),
    riskReport: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_RISK_REPORT_FILE),
    usage: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_USAGE_FILE),
    importManifest: path.join(outputDir, AUTHORITATIVE_REVIEW_DECISION_BULK_MANIFEST_FILE)
  };

  console.log("Business Central P0.9t-pre authoritative review decision bulk prefill");
  console.log("Mode: PREFILL_EXPORT_ONLY");
  console.log(`Source workspace folder: ${displayRepoPath(workspaceDir)}`);
  console.log(`Reviewer input folder: ${displayRepoPath(inputDir)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: prefill/export only; reviewer-decisions.csv, database rows, production_outputs.entity_id, target_profiles, aliases, authoritative masters, conditional rules, and dashboard behavior are not changed.");

  const workspaceExists = await fileExists(workspaceTemplateFile);
  const prefill = buildAuthoritativeReviewDecisionBulkPrefill({
    templateRows: await readAuthoritativeMasterReviewerDecisionTemplateRows(workspaceTemplateFile),
    entityRows: await readAuthoritativeReviewEntityRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_ENTITY_FILE)),
    sourceMappingRows: await readAuthoritativeReviewSourceMappingRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_SOURCE_MAPPING_FILE)),
    targetProfileRows: await readAuthoritativeReviewTargetProfileRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_TARGET_PROFILE_FILE)),
    conflictRows: await readAuthoritativeReviewConflictRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_CONFLICT_FILE)),
    sourceDataGapRows: await readAuthoritativeReviewSourceDataGapRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_SOURCE_GAP_FILE)),
    futureUseDomainRows: await readAuthoritativeReviewFutureUseDomainRows(path.join(workspaceDir, AUTHORITATIVE_MASTER_REVIEW_FUTURE_USE_FILE)),
    priorityRows: [],
    workspaceExists,
    sourceWorkspaceFolder: displayRepoPath(workspaceDir),
    outputFolder: displayRepoPath(outputDir),
    wroteConveniencePrefillFile: workspaceExists
  });

  await mkdir(outputDir, { recursive: true });
  await mkdir(inputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(prefill.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeReviewDecisionBulkPrefillReadme(prefill.summary), "utf8");
  await writeFile(outputFiles.prefill, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, prefill.bulkPrefillRows), "utf8");
  await writeFile(outputFiles.safeAccepted, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, prefill.safeAutoAcceptedRows), "utf8");
  await writeFile(outputFiles.humanReview, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, prefill.requiresHumanReviewRows), "utf8");
  await writeFile(outputFiles.ruleReport, resolutionPackageCsv(authoritativeReviewDecisionBulkPrefillRuleCsvHeaders, prefill.ruleReportRows), "utf8");
  await writeFile(outputFiles.riskReport, resolutionPackageCsv(authoritativeReviewDecisionBulkPrefillRiskCsvHeaders, prefill.riskReportRows), "utf8");
  await writeFile(outputFiles.usage, buildAuthoritativeReviewDecisionBulkPrefillUsageInstructions(), "utf8");
  await writeFile(outputFiles.importManifest, `${JSON.stringify(prefill.importManifest, null, 2)}\n`, "utf8");
  if (prefill.summary.prefillStatus === "GENERATED") {
    await writeFile(conveniencePrefillFile, resolutionPackageCsv(authoritativeReviewDecisionNormalizedCsvHeaders, prefill.bulkPrefillRows), "utf8");
  }

  console.log("");
  console.log("Summary");
  console.log(`- prefill_status=${prefill.summary.prefillStatus}`);
  console.log(`- total_template_rows=${prefill.summary.totalTemplateRows}`);
  console.log(`- approved_prefill_rows=${prefill.summary.approvedPrefillRows}`);
  console.log(`- deferred_prefill_rows=${prefill.summary.deferredPrefillRows}`);
  console.log(`- needs_correction_rows=${prefill.summary.needsCorrectionRows}`);
  console.log(`- source_data_backlog_rows=${prefill.summary.sourceDataBacklogRows}`);
  console.log(`- future_use_only_rows=${prefill.summary.futureUseOnlyRows}`);
  console.log(`- target_profile_needs_correction_rows=${prefill.summary.targetProfileNeedsCorrectionRows}`);
  console.log(`- conflict_deferred_rows=${prefill.summary.conflictDeferredRows}`);
  console.log(`- wrote_convenience_prefill_file=${prefill.summary.wroteConveniencePrefillFile}`);
  console.log(`- overwrote_real_reviewer_decision_file=${prefill.summary.overwroteRealReviewerDecisionFile}`);
  console.log(`- p10_status=${prefill.summary.p10Gate.status}`);
  console.log(`- p10_reason=${prefill.summary.p10Gate.reason}`);

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  if (prefill.summary.prefillStatus === "GENERATED") console.log(`- ${displayRepoPath(conveniencePrefillFile)}`);
  console.log(`- not written: ${displayRepoPath(realReviewerDecisionFile)}`);
}

function buildAuthoritativeAcceptedDecisionDryRunReadme(summary: AuthoritativeAcceptedDecisionDryRunSummary): string {
  return `# Business Central P0.9s Authoritative Master Accepted Decision Dry-Run

Generated at: ${summary.generatedAt}

Dry-run status: ${summary.dryRunStatus}

P1.0 status: ${summary.p10Gate.status}

Reason:

${summary.p10Gate.reason}

## Purpose

This command simulates accepted P0.9q reviewer decisions only. It reads \`${AUTHORITATIVE_MASTER_REVIEW_ACCEPTED_FILE}\` from the decision-intake output and produces merged preview CSVs plus coverage impact estimates.

It does not use sample fixture files unless a human explicitly copied them into \`${AUTHORITATIVE_MASTER_REVIEW_DECISIONS_FILE}\` and P0.9q accepted them first.

## Files

- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SUMMARY_FILE}\`: dry-run status, coverage impact, P1.0 gate, and safety flags.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CANONICAL_FILE}\`: dry-run canonical entity merged preview.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_MAP_FILE}\`: dry-run source-to-entity map merged preview.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_PROFILES_FILE}\`: dry-run target profile merged preview.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_ACCEPTED_PLAN_FILE}\`: accepted decisions simulated into previews or backlog/future-use impact.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_BLOCKED_PLAN_FILE}\`: accepted-input rows that are not apply candidates.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_COVERAGE_IMPACT_FILE}\`: before/after coverage estimate.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_P10_IMPACT_FILE}\`: P1.0 readiness estimate.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_FUTURE_USE_IMPACT_FILE}\`: domain-level future-use impact.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_GAP_FILE}\`: target profile gaps after dry-run.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_GAP_FILE}\`: source data gaps after dry-run.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CONFLICT_RISK_FILE}\`: conflict risks after dry-run.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SAFETY_FILE}\`: explicit no-mutation safety report.
- \`${AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_MANIFEST_FILE}\`: dry-run import manifest.

## Current Counts

- Accepted decision rows: ${summary.acceptedDecisionRows}
- Applied preview rows: ${summary.appliedPreviewRows}
- Blocked application rows: ${summary.blockedApplicationRows}
- Canonical preview rows: ${summary.canonicalEntityPreviewRows}
- Source mapping preview rows: ${summary.sourceMappingPreviewRows}
- Target profile preview rows: ${summary.targetProfilePreviewRows}
- Source data backlog rows: ${summary.sourceDataBacklogRows}
- Future-use only rows: ${summary.futureUseOnlyRows}

## Safety

- Dry-run/export only.
- No database mutation.
- No \`production_outputs.entity_id\` update.
- No \`target_profiles\` insert/update/delete.
- No alias creation/update/delete.
- No authoritative master input overwrite.
- No conditional rule changes.
- No dashboard switch.
- Next step is final approval/apply planning, not direct mutation.
- P1.0 remains blocked.
`;
}

async function runAuthoritativeMasterAcceptedDecisionDryRun() {
  const inputFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INPUT_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INPUT_DIR);
  const intakeFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR);
  const reviewWorkspaceFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_WORKSPACE_DIR);
  const decisionIntakeFolder = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_REVIEW_DECISION_INTAKE_DIR);
  const registryFolder = resolveRepoPath(process.env.FUTURE_USE_RAW_REGISTRY_DIR?.trim() || DEFAULT_FUTURE_USE_RAW_REGISTRY_DIR);
  const outputDir = resolveRepoPath(process.env.AUTHORITATIVE_MASTER_ACCEPTED_DECISION_DRY_RUN_DIR?.trim() || DEFAULT_AUTHORITATIVE_MASTER_ACCEPTED_DECISION_DRY_RUN_DIR);
  const acceptedDecisionFile = path.join(decisionIntakeFolder, AUTHORITATIVE_MASTER_REVIEW_ACCEPTED_FILE);
  const outputFiles = {
    summary: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SUMMARY_FILE),
    readme: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_README_FILE),
    canonical: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CANONICAL_FILE),
    sourceMap: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_MAP_FILE),
    targetProfiles: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_PROFILES_FILE),
    acceptedPlan: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_ACCEPTED_PLAN_FILE),
    blockedPlan: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_BLOCKED_PLAN_FILE),
    coverageImpact: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_COVERAGE_IMPACT_FILE),
    p10Impact: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_P10_IMPACT_FILE),
    futureUseImpact: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_FUTURE_USE_IMPACT_FILE),
    targetGap: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_TARGET_GAP_FILE),
    sourceGap: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SOURCE_GAP_FILE),
    conflictRisk: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_CONFLICT_RISK_FILE),
    safety: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_SAFETY_FILE),
    importManifest: path.join(outputDir, AUTHORITATIVE_ACCEPTED_DECISION_DRY_RUN_MANIFEST_FILE)
  };

  console.log("Business Central P0.9s authoritative master accepted decision dry-run");
  console.log("Mode: DRY_RUN_EXPORT_ONLY");
  console.log(`Authoritative input folder: ${displayRepoPath(inputFolder)}`);
  console.log(`Authoritative intake folder: ${displayRepoPath(intakeFolder)}`);
  console.log(`Review workspace folder: ${displayRepoPath(reviewWorkspaceFolder)}`);
  console.log(`Decision intake folder: ${displayRepoPath(decisionIntakeFolder)}`);
  console.log(`Future-use registry folder: ${displayRepoPath(registryFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: dry-run/export only; database rows, production_outputs.entity_id, target_profiles, aliases, authoritative master inputs, conditional rules, and dashboard behavior are not changed.");

  const acceptedDecisionInputExists = await fileExists(acceptedDecisionFile);
  const dryRun = buildAuthoritativeMasterAcceptedDecisionDryRun({
    acceptedDecisionRows: await readAuthoritativeMasterReviewerDecisionRows(acceptedDecisionFile) as readonly AuthoritativeReviewDecisionNormalizedRow[],
    acceptedDecisionInputExists,
    canonicalEntityRows: await readAuthoritativeCanonicalEntityRows(path.join(intakeFolder, AUTHORITATIVE_MASTER_CANONICAL_NORMALIZED_FILE)),
    sourceMappingRows: await readAuthoritativeSourceMapRows(path.join(intakeFolder, AUTHORITATIVE_MASTER_SOURCE_MAP_NORMALIZED_FILE)),
    targetProfileRows: await readAuthoritativeTargetProfileRows(path.join(intakeFolder, AUTHORITATIVE_MASTER_TARGET_PROFILES_NORMALIZED_FILE)),
    registryRows: await readFutureUseRegistryRows(path.join(registryFolder, FUTURE_USE_RAW_REGISTRY_FILE)),
    outputFolder: displayRepoPath(outputDir),
    inputSources: [
      displayRepoPath(inputFolder),
      displayRepoPath(intakeFolder),
      displayRepoPath(reviewWorkspaceFolder),
      displayRepoPath(decisionIntakeFolder),
      displayRepoPath(registryFolder)
    ]
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(dryRun.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildAuthoritativeAcceptedDecisionDryRunReadme(dryRun.summary), "utf8");
  await writeFile(outputFiles.canonical, resolutionPackageCsv(authoritativeReviewDecisionPreviewCanonicalCsvHeaders, dryRun.canonicalEntityMergedPreviewRows), "utf8");
  await writeFile(outputFiles.sourceMap, resolutionPackageCsv(authoritativeReviewDecisionPreviewSourceMapCsvHeaders, dryRun.sourceMappingMergedPreviewRows), "utf8");
  await writeFile(outputFiles.targetProfiles, resolutionPackageCsv(authoritativeReviewDecisionPreviewTargetProfileCsvHeaders, dryRun.targetProfileMergedPreviewRows), "utf8");
  await writeFile(outputFiles.acceptedPlan, resolutionPackageCsv(authoritativeAcceptedDecisionApplicationPlanCsvHeaders, dryRun.acceptedDecisionApplicationPlanRows), "utf8");
  await writeFile(outputFiles.blockedPlan, resolutionPackageCsv(authoritativeBlockedDecisionApplicationPlanCsvHeaders, dryRun.blockedDecisionApplicationPlanRows), "utf8");
  await writeFile(outputFiles.coverageImpact, resolutionPackageCsv(authoritativeCoverageImpactPreviewCsvHeaders, dryRun.coverageImpactPreviewRows), "utf8");
  await writeFile(outputFiles.p10Impact, resolutionPackageCsv(authoritativeP10ReadinessImpactCsvHeaders, dryRun.p10ReadinessImpactRows), "utf8");
  await writeFile(outputFiles.futureUseImpact, resolutionPackageCsv(authoritativeFutureUseCoverageImpactCsvHeaders, dryRun.futureUseCoverageImpactRows), "utf8");
  await writeFile(outputFiles.targetGap, resolutionPackageCsv(authoritativeTargetProfileGapAfterDryRunCsvHeaders, dryRun.targetProfileGapAfterDryRunRows), "utf8");
  await writeFile(outputFiles.sourceGap, resolutionPackageCsv(authoritativeSourceDataGapAfterDryRunCsvHeaders, dryRun.sourceDataGapAfterDryRunRows), "utf8");
  await writeFile(outputFiles.conflictRisk, resolutionPackageCsv(authoritativeConflictRiskAfterDryRunCsvHeaders, dryRun.conflictRiskAfterDryRunRows), "utf8");
  await writeFile(outputFiles.safety, `${JSON.stringify(dryRun.dryRunSafetyReport, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.importManifest, `${JSON.stringify(dryRun.importManifest, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- dry_run_status=${dryRun.summary.dryRunStatus}`);
  console.log(`- accepted_decision_rows=${dryRun.summary.acceptedDecisionRows}`);
  console.log(`- applied_preview_rows=${dryRun.summary.appliedPreviewRows}`);
  console.log(`- blocked_application_rows=${dryRun.summary.blockedApplicationRows}`);
  console.log(`- authoritative_mapped_rows_before=${dryRun.summary.coverageImpact.authoritativeMappedRowsBefore}`);
  console.log(`- authoritative_mapped_rows_after=${dryRun.summary.coverageImpact.authoritativeMappedRowsAfter}`);
  console.log(`- target_profile_missing_rows_after=${dryRun.summary.coverageImpact.targetProfileMissingRowsAfter}`);
  console.log(`- p10_missing_entity_rows=${dryRun.summary.p10ReadinessImpact.productionOutputRowsMissingApprovedEntity}`);
  console.log(`- p10_missing_target_profile_rows=${dryRun.summary.p10ReadinessImpact.productionOutputRowsMissingApprovedTargetProfile}`);
  console.log(`- p10_status=${dryRun.summary.p10Gate.status}`);
  console.log(`- p10_reason=${dryRun.summary.p10Gate.reason}`);

  console.log("");
  console.log("Remaining blockers");
  console.log(`- source_data_gaps_after=${dryRun.sourceDataGapAfterDryRunRows.reduce((sum, row) => sum + row.rows, 0)}`);
  console.log(`- conflict_risks_after=${dryRun.conflictRiskAfterDryRunRows.reduce((sum, row) => sum + row.rows, 0)}`);
  console.log(`- target_profile_gaps_after=${dryRun.targetProfileGapAfterDryRunRows.reduce((sum, row) => sum + row.rows, 0)}`);

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runFutureUseRawRegistry() {
  const outputDir = resolveRepoPath(process.env.FUTURE_USE_RAW_REGISTRY_DIR?.trim() || DEFAULT_FUTURE_USE_RAW_REGISTRY_DIR);
  const entitySourceFile = (await fileExists(resolveRepoPath(DEFAULT_ENTITY_V2_CSV_PATH)))
    ? resolveRepoPath(DEFAULT_ENTITY_V2_CSV_PATH)
    : resolveRepoPath(DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_CSV_PATH);
  const sourceReportsAvailable = await fileExists(entitySourceFile);
  const outputFiles = {
    summary: path.join(outputDir, FUTURE_USE_RAW_REGISTRY_SUMMARY_FILE),
    readme: path.join(outputDir, FUTURE_USE_RAW_REGISTRY_README_FILE),
    registry: path.join(outputDir, FUTURE_USE_RAW_REGISTRY_FILE),
    domainRollup: path.join(outputDir, FUTURE_USE_DOMAIN_ROLLUP_FILE),
    moduleReadiness: path.join(outputDir, FUTURE_USE_MODULE_READINESS_FILE),
    p10Split: path.join(outputDir, FUTURE_USE_P10_SPLIT_FILE),
    sourceCoverage: path.join(outputDir, FUTURE_USE_SOURCE_COVERAGE_FILE),
    reviewQueue: path.join(outputDir, FUTURE_USE_REVIEW_QUEUE_FILE),
    sourceDataGap: path.join(outputDir, FUTURE_USE_SOURCE_DATA_GAP_FILE),
    unknownReview: path.join(outputDir, FUTURE_USE_UNKNOWN_REVIEW_FILE),
    entityCoverage: path.join(outputDir, FUTURE_USE_ENTITY_COVERAGE_FILE),
    targetProfileRequirement: path.join(outputDir, FUTURE_USE_TARGET_PROFILE_REQUIREMENT_FILE),
    safety: path.join(outputDir, FUTURE_USE_SAFETY_REPORT_FILE)
  };

  console.log("Business Central P0.9o future-use raw registry");
  console.log("Mode: REGISTRY_EXPORT_COVERAGE_ONLY");
  console.log(`Source report: ${displayRepoPath(entitySourceFile)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: registry/export/coverage only; database rows, production_outputs.entity_id, target_profiles, aliases, authoritative masters, conditional rules, and dashboard behavior are not changed.");

  const rawRows = await readFutureUseRawEvidenceRows(entitySourceFile);
  const approvedCanonicalEntities = await readAuthoritativeCanonicalEntityRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR), AUTHORITATIVE_MASTER_CANONICAL_NORMALIZED_FILE));
  const approvedSourceMaps = await readAuthoritativeSourceMapRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR), AUTHORITATIVE_MASTER_SOURCE_MAP_NORMALIZED_FILE));
  const targetProfileRows = await readAuthoritativeTargetProfileRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR), AUTHORITATIVE_MASTER_TARGET_PROFILES_NORMALIZED_FILE));
  const seedDraftSourceMaps = await readAuthoritativeSourceMapRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_SEED_DRAFT_DIR), AUTHORITATIVE_MASTER_SEED_SOURCE_MAP_FILE));
  const seedConflictRows = await readFutureUseConflictRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_SEED_DRAFT_DIR), AUTHORITATIVE_MASTER_SEED_REVIEW_QUEUE_FILE));
  const intakeConflictRows = await readFutureUseConflictRows(path.join(resolveRepoPath(DEFAULT_AUTHORITATIVE_MASTER_INTAKE_DIR), AUTHORITATIVE_MASTER_LEGACY_CONFLICT_FILE));
  const registry = buildFutureUseRawRegistry({
    rawRows,
    sourceReportsAvailable,
    sourceFile: displayRepoPath(entitySourceFile),
    outputFolder: displayRepoPath(outputDir),
    approvedCanonicalEntities,
    approvedSourceMaps,
    seedDraftSourceMaps,
    conflictEvidenceRows: [...seedConflictRows, ...intakeConflictRows],
    targetProfileRows
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(registry.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildFutureUseRawRegistryReadme(registry.summary), "utf8");
  await writeFile(outputFiles.registry, resolutionPackageCsv(futureUseRawRegistryCsvHeaders, registry.registryRows), "utf8");
  await writeFile(outputFiles.domainRollup, resolutionPackageCsv(futureUseRollupCsvHeaders, registry.domainRollupRows), "utf8");
  await writeFile(outputFiles.moduleReadiness, resolutionPackageCsv(futureUseModuleReadinessCsvHeaders, registry.moduleReadinessRollupRows), "utf8");
  await writeFile(outputFiles.p10Split, resolutionPackageCsv(futureUseP10SplitCsvHeaders, registry.p10VsFutureSplitRows), "utf8");
  await writeFile(outputFiles.sourceCoverage, resolutionPackageCsv(futureUseSourceCoverageCsvHeaders, registry.futureUseSourceCoverageRows), "utf8");
  await writeFile(outputFiles.reviewQueue, resolutionPackageCsv(futureUseReviewQueueCsvHeaders, registry.futureUseReviewQueueRows), "utf8");
  await writeFile(outputFiles.sourceDataGap, resolutionPackageCsv(futureUseReviewQueueCsvHeaders, registry.sourceDataGapBacklogRows), "utf8");
  await writeFile(outputFiles.unknownReview, resolutionPackageCsv(futureUseReviewQueueCsvHeaders, registry.unknownReviewBacklogRows), "utf8");
  await writeFile(outputFiles.entityCoverage, resolutionPackageCsv(futureUseDomainCoverageCsvHeaders, registry.authoritativeEntityCoverageByDomainRows), "utf8");
  await writeFile(outputFiles.targetProfileRequirement, resolutionPackageCsv(futureUseTargetProfileRequirementCsvHeaders, registry.targetProfileRequirementByDomainRows), "utf8");
  await writeFile(outputFiles.safety, `${JSON.stringify(registry.safetyReport, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- registry_status=${registry.summary.registryStatus}`);
  console.log(`- registry_granularity=${registry.summary.registryGranularity}`);
  console.log(`- total_registered_rows=${registry.summary.totalRegisteredRows}`);
  console.log(`- review_queue_rows=${registry.summary.reviewQueueRows}`);
  console.log(`- source_data_gap_rows=${registry.summary.sourceDataGapRows}`);
  console.log(`- unknown_review_rows=${registry.summary.unknownReviewRows}`);
  console.log(`- authoritative_mapped_rows=${registry.summary.authoritativeCoverage.authoritativeMappedRows}`);
  console.log(`- draft_entity_candidate_rows=${registry.summary.authoritativeCoverage.draftEntityCandidateRows}`);
  console.log(`- target_profile_required_rows=${registry.summary.targetProfileCoverage.targetProfileRequiredRows}`);
  console.log(`- target_profile_missing_rows=${registry.summary.targetProfileCoverage.targetProfileMissingRows}`);
  console.log(`- p10_status=${registry.summary.p10Gate.status}`);

  console.log("");
  console.log("Domain rollup");
  for (const row of registry.domainRollupRows.slice(0, 10)) console.log(`- ${row.rollup_key}; rows=${row.rows}`);
  if (registry.domainRollupRows.length === 0) console.log("- none");

  console.log("");
  console.log("P1.0 vs future split");
  for (const row of registry.p10VsFutureSplitRows) console.log(`- ${row.split}; rows=${row.rows}`);
  if (registry.p10VsFutureSplitRows.length === 0) console.log("- none");

  console.log("");
  console.log("Top review queue");
  for (const row of registry.futureUseReviewQueueRows.slice(0, 10)) console.log(`- ${row.review_type}; ${row.source_field}:${row.source_value}; rows=${row.rows}; reason=${row.review_reason}`);
  if (registry.futureUseReviewQueueRows.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runScopedDecisionApprovalIntake() {
  const sourceApprovalWorkspace = resolveRepoPath(process.env.SCOPED_DECISION_APPROVAL_WORKSPACE_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPROVAL_WORKSPACE_DIR);
  const sourceValidationFolder = resolveRepoPath(process.env.SCOPED_DECISION_VALIDATION_DIR?.trim() || DEFAULT_SCOPED_DECISION_VALIDATION_DIR);
  const reviewerInputFolder = resolveRepoPath(process.env.SCOPED_DECISION_MANUAL_APPROVAL_INPUT_DIR?.trim() || DEFAULT_SCOPED_DECISION_MANUAL_APPROVAL_INPUT_DIR);
  const outputDir = resolveRepoPath(process.env.SCOPED_DECISION_APPROVAL_INTAKE_DIR?.trim() || DEFAULT_SCOPED_DECISION_APPROVAL_INTAKE_DIR);
  const approvalWorkbookFile = path.join(sourceApprovalWorkspace, SCOPED_DECISION_APPROVAL_WORKBOOK_FILE);
  const reviewerInputFile = path.join(reviewerInputFolder, SCOPED_DECISION_REVIEWER_DECISIONS_FILE);
  const reviewerTemplateFile = path.join(reviewerInputFolder, SCOPED_DECISION_REVIEWER_DECISIONS_TEMPLATE_FILE);
  const outputFiles = {
    summary: path.join(outputDir, SCOPED_DECISION_INTAKE_SUMMARY_FILE),
    readme: path.join(outputDir, SCOPED_DECISION_INTAKE_README_FILE),
    normalized: path.join(outputDir, SCOPED_DECISION_INTAKE_NORMALIZED_FILE),
    accepted: path.join(outputDir, SCOPED_DECISION_INTAKE_ACCEPTED_FILE),
    blocked: path.join(outputDir, SCOPED_DECISION_INTAKE_BLOCKED_FILE),
    missing: path.join(outputDir, SCOPED_DECISION_INTAKE_MISSING_FILE),
    duplicate: path.join(outputDir, SCOPED_DECISION_INTAKE_DUPLICATE_FILE),
    invalid: path.join(outputDir, SCOPED_DECISION_INTAKE_INVALID_FILE),
    readiness: path.join(outputDir, SCOPED_DECISION_INTAKE_READINESS_FILE),
    p10Gate: path.join(outputDir, SCOPED_DECISION_INTAKE_P10_GATE_FILE),
    safety: path.join(outputDir, SCOPED_DECISION_INTAKE_SAFETY_FILE)
  };

  console.log("Business Central P0.9k scoped decision approval intake");
  console.log("Mode: INTAKE_EXPORT_ONLY");
  console.log(`Source approval workspace: ${displayRepoPath(sourceApprovalWorkspace)}`);
  console.log(`Source validation folder: ${displayRepoPath(sourceValidationFolder)}`);
  console.log(`Reviewer input folder: ${displayRepoPath(reviewerInputFolder)}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: intake/export only; database rows, target_profiles, aliases, conditional rules, approval workspace, apply dry-run outputs, and dashboard behavior are not changed.");

  const workspaceRows = await readScopedDecisionApprovalWorkbookRows(approvalWorkbookFile);
  const reviewerInputExists = await fileExists(reviewerInputFile);
  const reviewerRows = await readScopedDecisionReviewerInputRows(reviewerInputFile);
  const intake = buildScopedDecisionApprovalIntake({
    workspaceRows,
    reviewerRows,
    reviewerInputExists,
    sourceApprovalWorkspace: displayRepoPath(sourceApprovalWorkspace),
    sourceValidationFolder: displayRepoPath(sourceValidationFolder),
    reviewerInputFolder: displayRepoPath(reviewerInputFolder),
    reviewerInputFile: displayRepoPath(reviewerInputFile),
    outputFolder: displayRepoPath(outputDir)
  });

  await mkdir(outputDir, { recursive: true });
  await mkdir(reviewerInputFolder, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(intake.summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.readme, buildScopedDecisionApprovalIntakeReadme(intake.summary), "utf8");
  await writeFile(outputFiles.normalized, resolutionPackageCsv(scopedDecisionNormalizedReviewerDecisionCsvHeaders, intake.normalizedReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.accepted, resolutionPackageCsv(scopedDecisionNormalizedReviewerDecisionCsvHeaders, intake.acceptedReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.blocked, resolutionPackageCsv(scopedDecisionBlockedReviewerDecisionCsvHeaders, intake.blockedReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.missing, resolutionPackageCsv(scopedDecisionMissingReviewerDecisionCsvHeaders, intake.missingReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.duplicate, resolutionPackageCsv(scopedDecisionDuplicateReviewerDecisionCsvHeaders, intake.duplicateReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.invalid, resolutionPackageCsv(scopedDecisionInvalidReviewerDecisionCsvHeaders, intake.invalidReviewerDecisionRows), "utf8");
  await writeFile(outputFiles.readiness, `${JSON.stringify(intake.approvalReadinessReport satisfies ScopedDecisionApprovalReadinessReport, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.p10Gate, `${JSON.stringify(intake.p10GatePreview, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.safety, `${JSON.stringify(intake.safetyReport, null, 2)}\n`, "utf8");
  await writeFile(reviewerTemplateFile, resolutionPackageCsv(scopedDecisionReviewerInputTemplateCsvHeaders, intake.reviewerInputTemplateRows), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- readiness_status=${intake.summary.readinessStatus}`);
  console.log(`- total_workspace_rows=${intake.summary.totalWorkspaceRows}`);
  console.log(`- total_reviewer_input_rows=${intake.summary.totalReviewerInputRows}`);
  console.log(`- matched_reviewer_rows=${intake.summary.matchedReviewerRows}`);
  console.log(`- accepted_reviewer_rows=${intake.summary.acceptedReviewerRows}`);
  console.log(`- blocked_reviewer_rows=${intake.summary.blockedReviewerRows}`);
  console.log(`- missing_reviewer_rows=${intake.summary.missingReviewerRows}`);
  console.log(`- duplicate_reviewer_rows=${intake.summary.duplicateReviewerRows}`);
  console.log(`- invalid_reviewer_rows=${intake.summary.invalidReviewerRows}`);
  console.log(`- p10_status=${intake.summary.p10Gate.status}`);

  console.log("");
  console.log("Top blocked reasons");
  const blockedReasonCounts = topCounts([
    ...intake.blockedReviewerDecisionRows.map((row) => row.blocker_code),
    ...intake.invalidReviewerDecisionRows.map((row) => row.invalid_code)
  ], 10);
  for (const row of blockedReasonCounts) console.log(`- ${row.value}; rows=${row.rows}`);
  if (blockedReasonCounts.length === 0) console.log("- none");

  console.log("");
  console.log("Files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
  console.log(`- ${displayRepoPath(reviewerTemplateFile)}`);
}

function higherRiskLevel(current: BackfillRiskLevel, next: BackfillRiskLevel): BackfillRiskLevel {
  return riskSort(next) > riskSort(current) ? next : current;
}

function prioritySort(value: ManualApprovalPriority): number {
  if (value === "P1") return 1;
  if (value === "P2") return 2;
  if (value === "P3") return 3;
  return 4;
}

async function runResolutionPackage(pool: DatabasePool) {
  const outputDir = resolveRepoPath(process.env.RESOLUTION_PACKAGE_DIR?.trim() || DEFAULT_RESOLUTION_PACKAGE_DIR);
  const outputFiles = {
    summary: path.join(outputDir, RESOLUTION_PACKAGE_SUMMARY_FILE),
    canonical: path.join(outputDir, RESOLUTION_PACKAGE_CANONICAL_FILE),
    alias: path.join(outputDir, RESOLUTION_PACKAGE_ALIAS_FILE),
    targetProfile: path.join(outputDir, RESOLUTION_PACKAGE_TARGET_PROFILE_FILE),
    manualQueue: path.join(outputDir, RESOLUTION_PACKAGE_MANUAL_QUEUE_FILE),
    blockedChecklist: path.join(outputDir, RESOLUTION_PACKAGE_BLOCKED_CHECKLIST_FILE),
    readme: path.join(outputDir, RESOLUTION_PACKAGE_README_FILE)
  };

  console.log("Business Central P0.9b resolution package");
  console.log("Mode: DRY_RUN");
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Output folder: ${displayRepoPath(outputDir)}`);
  console.log("Safety: export-only; database rows, target_profiles, aliases, conditional rules, and dashboard behavior are not changed.");

  const { summary: highRiskSummary, groups, entityRows, targetProfileRows } = await buildHighRiskReviewPlan(pool);
  const canonicalRows = buildCanonicalEntityCreationPlanRows(entityRows);
  const aliasRows = buildAliasCleanupReviewPlanRows(entityRows);
  const targetProfileSeedRows = buildTargetProfileSeedDraftPlanRows(targetProfileRows);
  const manualQueueRows = buildManualApprovalQueueRows(groups);
  const blockedChecklistRows = buildBlockedGroupsChecklistRows(groups);
  const unknownProfileCsvPath = await fileExists(resolveRepoPath(DEFAULT_UNKNOWN_SCOPE_PROFILE_CSV_PATH))
    ? DEFAULT_UNKNOWN_SCOPE_PROFILE_CSV_PATH
    : null;
  const summary = buildResolutionPackageSummary({
    sourceReports: {
      entityBackfillDryRun: DEFAULT_ENTITY_V2_BACKFILL_DRY_RUN_JSON_PATH,
      targetProfileBackfillDryRun: DEFAULT_TARGET_PROFILE_BACKFILL_DRY_RUN_JSON_PATH,
      highRiskReviewPlan: DEFAULT_HIGH_RISK_REVIEW_PLAN_JSON_PATH
    },
    canonicalEntityCreationCandidates: canonicalRows.length,
    aliasCleanupCandidates: aliasRows.length,
    targetProfileSeedDraftCandidates: targetProfileSeedRows.length,
    manualApprovalItems: manualQueueRows.length,
    blockedGroups: blockedChecklistRows.length,
    scopeSummary: {
      outputKpiOkScopeRows: highRiskSummary.outputKpiOkScopeRows,
      outputKpiRejectScopeRows: highRiskSummary.outputKpiRejectScopeRows,
      outOfCurrentKpiScopeRows: highRiskSummary.outOfCurrentKpiScopeRows,
      unknownScopeReviewRows: highRiskSummary.unknownScopeReviewRows,
      futureUseDomainCounts: highRiskSummary.futureUseDomainCounts,
      entitySourceBlankButClassifiedRows: highRiskSummary.entitySourceBlankButClassifiedRows,
      entitySourceBlankUnknownRows: highRiskSummary.entitySourceBlankUnknownRows,
      p10BlockingRowsBeforeScope: highRiskSummary.p10BlockingRowsBeforeScope,
      p10BlockingRowsAfterScope: highRiskSummary.p10BlockingRowsAfterScope,
      excludedFromP10ButRetainedRows: highRiskSummary.excludedFromP10ButRetainedRows
    },
    topUnknownScopeGroups: highRiskSummary.topBlockedGroups
      .filter((group) => group.bcCurrentKpiScope === "UNKNOWN_SCOPE_REVIEW")
      .slice(0, 10)
      .map((group) => ({
        sourceValue: group.sourceValue,
        rows: group.rows,
        blocksP10AfterScope: group.blocksP10AfterScope,
        currentKpiScope: group.bcCurrentKpiScope,
        futureUseDomain: group.bcFutureUseDomain
      })),
    unknownScopeProfileCsvPath: unknownProfileCsvPath,
    p10Gate: highRiskSummary.p10Gate
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFiles.summary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(outputFiles.canonical, resolutionPackageCsv(canonicalEntityCreationPlanCsvHeaders, canonicalRows), "utf8");
  await writeFile(outputFiles.alias, resolutionPackageCsv(aliasCleanupReviewPlanCsvHeaders, aliasRows), "utf8");
  await writeFile(outputFiles.targetProfile, resolutionPackageCsv(targetProfileSeedDraftPlanCsvHeaders, targetProfileSeedRows), "utf8");
  await writeFile(outputFiles.manualQueue, resolutionPackageCsv(manualApprovalQueueCsvHeaders, manualQueueRows), "utf8");
  await writeFile(outputFiles.blockedChecklist, resolutionPackageCsv(blockedGroupsChecklistCsvHeaders, blockedChecklistRows), "utf8");
  await writeFile(outputFiles.readme, buildResolutionPackageReadme(summary), "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- canonical_entity_creation_candidates=${summary.counts.canonicalEntityCreationCandidates}`);
  console.log(`- alias_cleanup_candidates=${summary.counts.aliasCleanupCandidates}`);
  console.log(`- target_profile_seed_draft_candidates=${summary.counts.targetProfileSeedDraftCandidates}`);
  console.log(`- manual_approval_items=${summary.counts.manualApprovalItems}`);
  console.log(`- blocked_groups=${summary.counts.blockedGroups}`);
  console.log(`- p10_status=${summary.p10Readiness.status}`);
  console.log(`- p10_reason=${summary.p10Readiness.reason}`);

  console.log("");
  console.log("Top manual approval queue items");
  for (const item of manualQueueRows.slice(0, 10)) {
    console.log(`- ${item.priority}; ${item.review_group_type}; source=${item.source_value}; rows=${item.rows}; risk=${item.risk_level}; blocks_p10=${item.blocks_p10}`);
  }

  console.log("");
  console.log("Package files written");
  for (const file of Object.values(outputFiles)) console.log(`- ${displayRepoPath(file)}`);
}

async function runMappingPlan(pool: DatabasePool) {
  const limit = Math.min(Number(process.env.MAPPING_PLAN_LIMIT ?? 250) || 250, 1000);
  const outputPathInput = process.env.MAPPING_PLAN_OUTPUT?.trim() || DEFAULT_MAPPING_PLAN_PATH;
  const outputPath = resolveRepoPath(outputPathInput);
  console.log("Business Central mapping plan");
  console.log(`Mode: DRY_RUN`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Output: ${displayRepoPath(outputPath)}`);
  console.log(`Limit: ${limit}`);

  const [coverage, entities] = await Promise.all([
    mappingCoverageSummary(pool),
    activeEntityCandidates(pool)
  ]);
  printCoverageSummary(coverage);
  await printEntitySourceUsage(pool);

  const groups = await fetchUnmappedSourceGroups(pool, limit, entities);
  const rows = buildMappingPlanRows(groups.map((group) => ({
    sourceSystem: SOURCE_SYSTEM,
    sourceField: group.sourceField,
    sourceValue: group.sourceValue,
    rowCount: group.rows,
    okQty: group.okQty,
    firstPostingDate: group.firstPostingDate,
    lastPostingDate: group.lastPostingDate,
    suggestions: group.suggestions
  })));
  const csv = mappingPlanRowsToCsv(rows);
  if (containsMappingSecretLikeText(csv)) {
    throw new Error("Generated mapping plan contains secret-like text; refusing to write it.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, "utf8");

  const suggestedRows = rows.filter((row) => row.suggested_entity_id);
  const highRows = rows.filter((row) => row.confidence === "HIGH");
  const mediumRows = rows.filter((row) => row.confidence === "MEDIUM");
  const targetRows = rows.filter((row) => row.target_exists === "TRUE");
  console.log("");
  console.log("Plan summary");
  console.log(`- rows_written=${rows.length}`);
  console.log(`- suggested_rows=${suggestedRows.length}; high=${highRows.length}; medium=${mediumRows.length}; low_or_none=${rows.length - highRows.length - mediumRows.length}`);
  console.log(`- target_exists_for_suggestion=${targetRows.length}`);
  console.log(`- default_action=REVIEW`);
  console.log(`- review_file=${displayRepoPath(outputPath)}`);
  console.log("Dry-run only. Edit action=COMMIT for reviewed rows, then run MAPPING_PLAN_COMMIT=true pnpm bc:mapping-plan-apply.");
}

function isPlanSourceField(value: string): value is (typeof mappingPlanSourceFields)[number] {
  return (mappingPlanSourceFields as readonly string[]).includes(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function runMappingPlanApply(pool: DatabasePool) {
  const filePathInput = process.env.MAPPING_PLAN_FILE?.trim() || DEFAULT_MAPPING_PLAN_PATH;
  const filePath = resolveRepoPath(filePathInput);
  const commit = process.env.MAPPING_PLAN_COMMIT === "true";
  console.log("Business Central mapping plan apply");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Plan file: ${displayRepoPath(filePath)}`);

  const csv = await readFile(filePath, "utf8");
  if (containsMappingSecretLikeText(csv)) {
    throw new Error("Mapping plan contains secret-like text; refusing to process it.");
  }
  const rows = parseMappingPlanCsv(csv);
  const commitRows = rows.filter((row) => row.action === "COMMIT");
  const warnings: string[] = [];
  const conflicts: string[] = [];
  console.log(`Rows in plan: ${rows.length}; action=COMMIT rows: ${commitRows.length}`);

  const entities = await activeEntityCandidates(pool);
  const entityIds = new Set(entities.map((entity) => entity.entityId));
  const validRows = commitRows.flatMap((row) => {
    if (row.source_system !== SOURCE_SYSTEM) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value || "(blank)"} because source_system is ${row.source_system}.`);
      return [];
    }
    if (!isPlanSourceField(row.source_field)) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value || "(blank)"} because the source field is not allowlisted for entity mapping.`);
      return [];
    }
    if (!normalizeAliasKey(row.source_value)) {
      warnings.push(`Skipped ${row.source_field} blank source value; blank machine groups require row context.`);
      return [];
    }
    if (!isUuid(row.suggested_entity_id) || !entityIds.has(row.suggested_entity_id)) {
      warnings.push(`Skipped ${row.source_field}:${row.source_value} because suggested_entity_id is not an active master entity.`);
      return [];
    }
    if (row.confidence === "LOW") {
      warnings.push(`Skipped LOW confidence row ${row.source_field}:${row.source_value}; low-confidence mappings require manual one-off handling.`);
      return [];
    }
    return [row];
  });

  let aliasesInserted = 0;
  let aliasesSkipped = 0;
  let rowsUpdated = 0;
  let rowsWouldUpdate = 0;
  let targetCoveredRows = 0;
  let alreadyMappedRows = 0;

  const previews = await Promise.all(validRows.map((row) => previewMappingPlanRow(pool, row)));
  const coverage = await mappingCoverageSummary(pool);
  previews.forEach((preview) => {
    rowsWouldUpdate += preview.affectedRows;
    targetCoveredRows += preview.targetCoveredRows;
    alreadyMappedRows += preview.alreadyMappedRows;
  });

  console.log("");
  console.log("Dry-run estimate");
  console.log(`- valid_commit_rows=${validRows.length}`);
  console.log(`- rows_would_update=${rowsWouldUpdate}`);
  console.log(`- mapped_rows_before=${coverage.mappedRows}; mapped_rows_after_estimate=${coverage.mappedRows + rowsWouldUpdate}`);
  console.log(`- unmapped_rows_before=${coverage.unmappedRows}; unmapped_rows_after_estimate=${Math.max(coverage.unmappedRows - rowsWouldUpdate, 0)}`);
  console.log(`- already_mapped_rows_not_overwritten=${alreadyMappedRows}`);
  console.log(`- target_covered_rows_after_mapping_estimate=${targetCoveredRows}`);

  if (!commit) {
    console.log("Dry-run only. Set MAPPING_PLAN_COMMIT=true after reviewing the CSV to create aliases and update unmapped rows.");
    if (warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of validRows) {
      const sourceValue = normalizeAliasDisplay(row.source_value);
      const normalized = normalizeAliasKey(sourceValue);
      const sourceColumn = sourceFieldColumn(row.source_field);
      const alias = await client.query<{
        id: string;
        entity_id: string;
        source_field: string;
        alias_normalized: string;
        is_active: boolean;
      }>(
        `
          select id, entity_id, source_field, alias_normalized, is_active
          from master_entity_aliases
          where alias = $4
             or (
               source_system = $1
               and source_field = $2
               and alias_normalized = $3
             )
          order by is_active desc, created_at desc
        `,
        [SOURCE_SYSTEM, row.source_field, normalized, sourceValue]
      );
      const conflictingAlias = alias.rows.find((candidate) => (
        candidate.entity_id !== row.suggested_entity_id
        || candidate.source_field !== row.source_field
        || candidate.alias_normalized !== normalized
      ));
      if (conflictingAlias) {
        conflicts.push(`${row.source_field}:${sourceValue} conflicts with existing alias ${conflictingAlias.id}`);
        continue;
      }
      const existingAlias = alias.rows[0];
      if (existingAlias) {
        if (!existingAlias.is_active) {
          await client.query("update master_entity_aliases set is_active = true, updated_at = now() where id = $1", [existingAlias.id]);
        }
        aliasesSkipped += 1;
      } else {
        await client.query(
          `
            insert into master_entity_aliases
              (entity_id, alias, source_system, source_field, alias_normalized, source, confidence, match_confidence)
            values ($1, $2, $3, $4, $5, 'mapping-plan', $6, $6)
          `,
          [
            row.suggested_entity_id,
            sourceValue,
            SOURCE_SYSTEM,
            row.source_field,
            normalized,
            row.confidence === "HIGH" ? 100 : 80
          ]
        );
        aliasesInserted += 1;
      }

      const updated = await client.query<{ entry_no: string }>(
        `
          update production_outputs
          set entity_id = $3,
              updated_at = now()
          where source_system = $1
            and ${sqlNormalizeExpression(sourceColumn)} = $2
            and entity_id is null
          returning entry_no::text
        `,
        [SOURCE_SYSTEM, normalized, row.suggested_entity_id]
      );
      rowsUpdated += updated.rowCount ?? 0;
      const entryNos = updated.rows.map((updatedRow) => updatedRow.entry_no);
      if (entryNos.length > 0) {
        await client.query(
          `
            update data_quality_issues
            set status = 'RESOLVED',
                resolved_at = now(),
                resolution_note = 'Resolved by reviewed mapping plan'
            where source_system = $1
              and status in ('OPEN', 'ACKNOWLEDGED')
              and issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
              and source_ref = any($2::text[])
          `,
          [SOURCE_SYSTEM, entryNos]
        );
      }
    }

    await client.query(
      `
        insert into audit_logs (action, entity_type, entity_id, before_value, after_value, user_agent)
        values ('master.mapping_plan.script_commit', 'production_output_mapping', $1, $2::jsonb, $3::jsonb, 'bc-metrics-script')
      `,
      [
        displayRepoPath(filePath),
        JSON.stringify({ sourceSystem: SOURCE_SYSTEM, filePath: displayRepoPath(filePath), planRows: rows.length, commitRows: commitRows.length }),
        JSON.stringify({ aliasesInserted, aliasesSkipped, rowsUpdated, conflicts: conflicts.length, warnings: warnings.length })
      ]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log("");
  console.log("Commit summary");
  console.log(`- aliases_inserted=${aliasesInserted}`);
  console.log(`- aliases_skipped=${aliasesSkipped}`);
  console.log(`- rows_updated=${rowsUpdated}`);
  console.log(`- conflicts=${conflicts.length}`);
  console.log(`- warnings=${warnings.length}`);
  if (conflicts.length > 0) {
    console.log("Conflicts:");
    for (const conflict of conflicts) console.log(`- ${conflict}`);
  }
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

async function runMappingApply(pool: ReturnType<typeof createDatabase>["pool"]) {
  const sourceField = requireSourceField();
  const sourceValue = normalizeAliasDisplay(requireEnv("SOURCE_VALUE"));
  const entityId = requireEnv("ENTITY_ID");
  const commit = process.env.APPLY_MAPPING_COMMIT === "true";
  const sourceColumn = sourceFieldColumn(sourceField);
  const normalized = normalizeAliasKey(sourceValue);

  console.log("Business Central mapping apply");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`Source system: ${SOURCE_SYSTEM}`);
  console.log(`Source field: ${sourceField}`);
  console.log(`Source value: ${sourceValue}`);
  console.log(`Entity ID: ${entityId}`);

  const entity = await pool.query<{ id: string; entity_code: string; display_name: string }>(
    "select id, entity_code, display_name from master_entities where id = $1 and is_active limit 1",
    [entityId]
  );
  if (!entity.rows[0]) throw new Error("ENTITY_ID must reference an active master entity");

  const preview = await pool.query<{
    affected_rows: string | number;
    already_mapped_rows: string | number;
    ok_qty: string | number;
  }>(
    `
      select
        count(*) filter (where entity_id is null) as affected_rows,
        count(*) filter (where entity_id is not null) as already_mapped_rows,
        coalesce(sum(quantity) filter (where entity_id is null and ${okOutputPredicate()}), 0) as ok_qty
      from production_outputs
      where source_system = $1
        and ${sqlNormalizeExpression(sourceColumn)} = $2
    `,
    [SOURCE_SYSTEM, normalized]
  );
  console.log(
    `Preview: affected_rows=${preview.rows[0]?.affected_rows ?? 0}; already_mapped_rows=${preview.rows[0]?.already_mapped_rows ?? 0}; unmapped_ok_qty=${preview.rows[0]?.ok_qty ?? 0}`
  );

  if (!commit) {
    console.log("Dry-run only. Set APPLY_MAPPING_COMMIT=true to create the alias and update unmapped rows.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const alias = await client.query<{ id: string; entity_id: string; is_active: boolean }>(
      `
        select id, entity_id, is_active
        from master_entity_aliases
        where source_system = $1
          and source_field = $2
          and alias_normalized = $3
        order by is_active desc, created_at desc
        limit 1
      `,
      [SOURCE_SYSTEM, sourceField, normalized]
    );
    const existingAlias = alias.rows[0];
    if (existingAlias && existingAlias.entity_id !== entityId) {
      throw new Error("An alias for this source value already belongs to another entity");
    }
    if (existingAlias && !existingAlias.is_active) {
      await client.query(
        "update master_entity_aliases set is_active = true, updated_at = now() where id = $1",
        [existingAlias.id]
      );
    }
    if (!existingAlias) {
      await client.query(
        `
          insert into master_entity_aliases
            (entity_id, alias, source_system, source_field, alias_normalized, source, confidence, match_confidence)
          values ($1, $2, $3, $4, $5, 'mapping-script', 100, 100)
        `,
        [entityId, sourceValue, SOURCE_SYSTEM, sourceField, normalized]
      );
    }

    const updated = await client.query(
      `
        update production_outputs
        set entity_id = $3,
            updated_at = now()
        where source_system = $1
          and ${sqlNormalizeExpression(sourceColumn)} = $2
          and entity_id is null
      `,
      [SOURCE_SYSTEM, normalized, entityId]
    );

    const issues = await client.query(
      `
        update data_quality_issues dqi
        set status = 'RESOLVED',
            resolved_at = now(),
            resolution_note = 'Resolved by mapping apply script'
        where dqi.source_system = $1
          and dqi.status in ('OPEN', 'ACKNOWLEDGED')
          and dqi.issue_code in ('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY')
          and exists (
            select 1
            from production_outputs po
            where po.source_system = $1
              and po.entry_no::text = dqi.source_ref
              and po.entity_id = $3
              and ${sqlNormalizeExpression(`po.${sourceColumn}`)} = $2
          )
      `,
      [SOURCE_SYSTEM, normalized, entityId]
    );

    await client.query(
      `
        insert into audit_logs (action, entity_type, entity_id, before_value, after_value, user_agent)
        values ('master.mapping.script_commit', 'production_output_mapping', $1, $2::jsonb, $3::jsonb, 'bc-metrics-script')
      `,
      [
        `${sourceField}:${sourceValue}`,
        JSON.stringify({ sourceSystem: SOURCE_SYSTEM, sourceField, sourceValue, mode: "dry-run-preview" }),
        JSON.stringify({
          sourceSystem: SOURCE_SYSTEM,
          sourceField,
          sourceValue,
          entityId,
          updatedRows: updated.rowCount ?? 0,
          resolvedIssues: issues.rowCount ?? 0
        })
      ]
    );

    await client.query("commit");
    console.log(`Commit: updated_rows=${updated.rowCount ?? 0}; resolved_issues=${issues.rowCount ?? 0}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function computeCoverage(
  activeDays: readonly { readonly entity_id: string; readonly posting_date: string }[],
  targets: readonly {
    readonly entity_id: string;
    readonly effective_from: string;
    readonly effective_to: string | null;
    readonly daily_target_qty: string | number;
    readonly min_achievement_pct: string | number;
    readonly max_achievement_pct: string | number;
  }[]
) {
  let prorataTarget = 0;
  let missingTargetEntityDays = 0;
  const minValues: number[] = [];
  const maxValues: number[] = [];
  for (const activeDay of activeDays) {
    const target = targets
      .filter((candidate) => {
        if (candidate.entity_id !== activeDay.entity_id) return false;
        if (dateText(candidate.effective_from) > activeDay.posting_date) return false;
        if (candidate.effective_to && dateText(candidate.effective_to) < activeDay.posting_date) return false;
        return true;
      })
      .sort((a, b) => dateText(b.effective_from).localeCompare(dateText(a.effective_from)))[0];
    if (!target) {
      missingTargetEntityDays += 1;
      continue;
    }
    prorataTarget += numberValue(target.daily_target_qty);
    minValues.push(numberValue(target.min_achievement_pct));
    maxValues.push(numberValue(target.max_achievement_pct));
  }
  return {
    prorataTarget,
    missingTargetEntityDays,
    activeEntityDays: activeDays.length,
    hasTarget: activeDays.length > 0 && missingTargetEntityDays === 0,
    minAchievementPct: minValues.length ? minValues.reduce((total, value) => total + value, 0) / minValues.length : undefined,
    maxAchievementPct: maxValues.length ? maxValues.reduce((total, value) => total + value, 0) / maxValues.length : undefined
  };
}

function targetCoverageSummary(pool: ReturnType<typeof createDatabase>["pool"]) {
  return pool.query(
    `
      with output_rows as (
        select
          date_trunc('month', po.posting_date)::date::text as month,
          po.posting_date,
          po.entity_id,
          ${preferredEntitySourceFieldSql("po")} as source_field,
          ${preferredEntitySourceValueSql("po")} as source_value,
          po.quantity,
          case
            when po.entity_id is null then 'UNMAPPED_ENTITY'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
                and pt.daily_target_qty = 0
            ) then 'TARGET_ZERO'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
                and pt.daily_target_qty > 0
            ) then 'COVERED'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status not in ('APPROVED', 'ACTIVE')
                and pt.effective_from <= po.posting_date
                and (pt.effective_to is null or pt.effective_to >= po.posting_date)
            ) then 'TARGET_NOT_APPROVED'
            when exists (
              select 1
              from production_targets pt
              where pt.entity_id = po.entity_id
                and pt.status in ('APPROVED', 'ACTIVE')
            ) then 'OUTSIDE_EFFECTIVE_DATE'
            else 'NO_ACTIVE_TARGET'
          end as coverage_status
        from production_outputs po
        where po.source_system = $1
          and ${outputEntryTypePredicate("po")}
          and ${okOutputPredicate("po")}
      )
      select
        output_rows.month,
        output_rows.source_field,
        coalesce(me.display_name, output_rows.source_value, 'Unmapped') as entity_or_machine,
        output_rows.coverage_status,
        count(*) as rows,
        coalesce(sum(output_rows.quantity), 0) as ok_qty
      from output_rows
      left join master_entities me on me.id = output_rows.entity_id
      group by output_rows.month, output_rows.source_field, coalesce(me.display_name, output_rows.source_value, 'Unmapped'), output_rows.coverage_status
      order by output_rows.month desc, output_rows.coverage_status desc, ok_qty desc
      limit 50
    `,
    [SOURCE_SYSTEM]
  );
}

function conversionGapSummary(pool: ReturnType<typeof createDatabase>["pool"]) {
  return pool.query(
    `
      select po.item_no,
             coalesce(po.uom, '') as uom,
             count(*) as rows,
             coalesce(sum(${rejectKgExpression("po")}), 0) as reject_kg,
             max(icm.gross_weight_per_pcs) as mapped_gross_weight_per_pcs
      from production_outputs po
      left join item_conversion_mappings icm
        on icm.is_active
       and upper(icm.item_no) = upper(po.item_no)
       and upper(coalesce(icm.uom, '')) = upper(coalesce(po.uom, ''))
      where po.source_system = $1
        and ${rejectOutputPredicate("po")}
        and (po.gross_weight_per_pcs is null or po.gross_weight_per_pcs <= 0)
      group by po.item_no, coalesce(po.uom, '')
      order by reject_kg desc, rows desc
      limit 20
    `,
    [SOURCE_SYSTEM]
  );
}

async function printRows(title: string, rowsPromise: Promise<{ rows: Record<string, unknown>[] }>) {
  const result = await rowsPromise;
  console.log("");
  console.log(title);
  if (result.rows.length === 0) {
    console.log("- none");
    return;
  }
  for (const row of result.rows) {
    const parts = Object.entries(row).map(([key, value]) => `${key}=${value instanceof Date ? value.toISOString() : String(value)}`);
    console.log(`- ${parts.join("; ")}`);
  }
}

async function main() {
  const command = (process.argv[2] ?? "profile") as Command;
  if (!["profile", "reconcile", "target-coverage", "daily-item-resume", "mapping-candidates", "mapping-apply", "mapping-plan", "mapping-plan-apply", "entity-v2-dry-run", "target-profile-dry-run", "entity-v2-backfill-dry-run", "target-profile-backfill-dry-run", "high-risk-review-plan", "resolution-package", "unknown-scope-profile", "scoped-blocker-package", "scoped-decision-review", "scoped-decision-validate", "scoped-decision-approval-workspace", "scoped-decision-apply-dry-run", "scoped-decision-approval-intake", "authoritative-master-intake", "authoritative-master-seed-draft", "future-use-raw-registry", "authoritative-master-review-workspace", "authoritative-master-review-decision-intake", "authoritative-review-decision-sample-fixture", "authoritative-review-decision-bulk-prefill", "authoritative-master-accepted-decision-dry-run", "kpi-compare-v1-v2"].includes(command)) {
    throw new Error("Usage: bc-metrics <profile|reconcile|target-coverage|daily-item-resume|mapping-candidates|mapping-apply|mapping-plan|mapping-plan-apply|entity-v2-dry-run|target-profile-dry-run|entity-v2-backfill-dry-run|target-profile-backfill-dry-run|high-risk-review-plan|resolution-package|unknown-scope-profile|scoped-blocker-package|scoped-decision-review|scoped-decision-validate|scoped-decision-approval-workspace|scoped-decision-apply-dry-run|scoped-decision-approval-intake|authoritative-master-intake|authoritative-master-seed-draft|future-use-raw-registry|authoritative-master-review-workspace|authoritative-master-review-decision-intake|authoritative-review-decision-sample-fixture|authoritative-review-decision-bulk-prefill|authoritative-master-accepted-decision-dry-run|kpi-compare-v1-v2>");
  }
  if (command === "scoped-decision-review") {
    await runScopedDecisionReview();
    return;
  }
  if (command === "scoped-decision-validate") {
    await runScopedDecisionValidate();
    return;
  }
  if (command === "scoped-decision-approval-workspace") {
    await runScopedDecisionApprovalWorkspace();
    return;
  }
  if (command === "scoped-decision-apply-dry-run") {
    await runScopedDecisionApplyDryRun();
    return;
  }
  if (command === "scoped-decision-approval-intake") {
    await runScopedDecisionApprovalIntake();
    return;
  }
  if (command === "authoritative-master-intake") {
    await runAuthoritativeMasterIntake();
    return;
  }
  if (command === "authoritative-master-seed-draft") {
    await runAuthoritativeMasterSeedDraft();
    return;
  }
  if (command === "future-use-raw-registry") {
    await runFutureUseRawRegistry();
    return;
  }
  if (command === "authoritative-master-review-workspace") {
    await runAuthoritativeMasterReviewWorkspace();
    return;
  }
  if (command === "authoritative-master-review-decision-intake") {
    await runAuthoritativeMasterReviewDecisionIntake();
    return;
  }
  if (command === "authoritative-review-decision-sample-fixture") {
    await runAuthoritativeReviewDecisionSampleFixture();
    return;
  }
  if (command === "authoritative-review-decision-bulk-prefill") {
    await runAuthoritativeReviewDecisionBulkPrefill();
    return;
  }
  if (command === "authoritative-master-accepted-decision-dry-run") {
    await runAuthoritativeMasterAcceptedDecisionDryRun();
    return;
  }
  const database = createDatabase({ connectionString: requireEnv("DATABASE_URL") });
  try {
    if (command === "profile") await runProfile(database.pool);
    else if (command === "reconcile") await runReconcile(database.pool);
    else if (command === "target-coverage") await runTargetCoverage(database.pool);
    else if (command === "daily-item-resume") await runDailyItemResume(database.pool);
    else if (command === "mapping-candidates") await runMappingCandidates(database.pool);
    else if (command === "mapping-plan") await runMappingPlan(database.pool);
    else if (command === "mapping-plan-apply") await runMappingPlanApply(database.pool);
    else if (command === "entity-v2-dry-run") await runEntityV2DryRun(database.pool);
    else if (command === "target-profile-dry-run") await runTargetProfileDryRun(database.pool);
    else if (command === "entity-v2-backfill-dry-run") await runEntityV2BackfillDryRun(database.pool);
    else if (command === "target-profile-backfill-dry-run") await runTargetProfileBackfillDryRun(database.pool);
    else if (command === "high-risk-review-plan") await runHighRiskReviewPlan(database.pool);
    else if (command === "resolution-package") await runResolutionPackage(database.pool);
    else if (command === "unknown-scope-profile") await runUnknownScopeProfile(database.pool);
    else if (command === "scoped-blocker-package") {
      try {
        await runScopedBlockerPackage(database.pool);
      } catch (error) {
        if (!isDatabaseConnectionRefused(error)) throw error;
        await runScopedBlockerPackageFromFiles(error);
      }
    }
    else if (command === "kpi-compare-v1-v2") await runKpiCompareV1V2(database.pool);
    else await runMappingApply(database.pool);
  } finally {
    await database.pool.end();
  }
}

function isDatabaseConnectionRefused(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return record.code === "ECONNREFUSED" || String(record.message ?? "").includes("ECONNREFUSED");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown BC metrics error";
  console.error(message);
  process.exitCode = 1;
});
