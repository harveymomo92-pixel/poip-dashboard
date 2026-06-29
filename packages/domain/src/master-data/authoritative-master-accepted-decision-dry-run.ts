import type {
  AuthoritativeNormalizedCanonicalEntityRow,
  AuthoritativeNormalizedSourceMapRow,
  AuthoritativeNormalizedTargetProfileRow
} from "./authoritative-master-intake.js";
import type {
  AuthoritativeReviewDecisionNormalizedRow,
  AuthoritativeReviewDecisionPreviewCanonicalRow,
  AuthoritativeReviewDecisionPreviewSourceMapRow,
  AuthoritativeReviewDecisionPreviewTargetProfileRow
} from "./authoritative-master-review-decision-intake.js";
import type { FutureUseRawRegistryRow } from "./future-use-raw-registry.js";

export type AuthoritativeAcceptedDecisionDryRunStatus =
  | "NO_ACCEPTED_DECISIONS"
  | "DRY_RUN_WITH_REMAINING_BLOCKERS"
  | "DRY_RUN_READY_FOR_FINAL_REVIEW"
  | "BLOCKED_MISSING_INPUTS";

export interface AuthoritativeAcceptedDecisionApplicationPlanRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approved_action: string;
  readonly application_status: "APPLIED_TO_PREVIEW" | "BACKLOG_ONLY" | "FUTURE_USE_ONLY";
  readonly preview_artifact: string;
  readonly canonical_entity_code: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly warning_code: string;
  readonly warning_message: string;
}

export interface AuthoritativeBlockedDecisionApplicationPlanRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approval_status: string;
  readonly approved_action: string;
  readonly blocker_code: string;
  readonly blocker_message: string;
}

export interface AuthoritativeCoverageImpactPreviewRow {
  readonly metric: keyof AuthoritativeAcceptedDecisionCoverageImpact;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface AuthoritativeAcceptedDecisionCoverageImpact {
  readonly authoritativeMappedRowsBefore: number;
  readonly authoritativeMappedRowsAfter: number;
  readonly authoritativeUnmappedRowsBefore: number;
  readonly authoritativeUnmappedRowsAfter: number;
  readonly draftEntityCandidateRowsBefore: number;
  readonly draftEntityCandidateRowsAfter: number;
  readonly conflictReviewRowsBefore: number;
  readonly conflictReviewRowsAfter: number;
  readonly sourceDataGapRowsBefore: number;
  readonly sourceDataGapRowsAfter: number;
  readonly outputOkMappedRowsBefore: number;
  readonly outputOkMappedRowsAfter: number;
  readonly rejectMappedRowsBefore: number;
  readonly rejectMappedRowsAfter: number;
  readonly targetProfileRequiredRows: number;
  readonly targetProfileCoveredRowsBefore: number;
  readonly targetProfileCoveredRowsAfter: number;
  readonly targetProfileMissingRowsBefore: number;
  readonly targetProfileMissingRowsAfter: number;
  readonly targetProfileNotRequiredRows: number;
}

export interface AuthoritativeP10ReadinessImpactRow {
  readonly metric: keyof AuthoritativeAcceptedDecisionP10ReadinessImpact;
  readonly rows: number | string;
}

export interface AuthoritativeAcceptedDecisionP10ReadinessImpact {
  readonly productionOutputRowsWithApprovedEntityCoverage: number;
  readonly productionOutputRowsMissingApprovedEntity: number;
  readonly productionOutputRowsWithApprovedTargetProfile: number;
  readonly productionOutputRowsMissingApprovedTargetProfile: number;
  readonly sourceDataGapsAffectingP10: number;
  readonly conflictsStillAffectingP10: number;
  readonly rejectAttachmentRowsNeedingReview: number;
  readonly p10StillBlocked: true;
}

export interface AuthoritativeFutureUseCoverageImpactRow {
  readonly bc_future_use_domain: string;
  readonly rows: number;
  readonly authoritative_mapped_rows_before: number;
  readonly authoritative_mapped_rows_after: number;
  readonly target_profile_missing_rows_before: number;
  readonly target_profile_missing_rows_after: number;
  readonly future_use_only_rows: number;
}

export interface AuthoritativeTargetProfileGapAfterDryRunRow {
  readonly bc_future_use_domain: string;
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly p10_blocker: "true" | "false";
}

export interface AuthoritativeSourceDataGapAfterDryRunRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly bc_future_use_domain: string;
  readonly rows: number;
  readonly p10_blocker: "true" | "false";
}

export interface AuthoritativeConflictRiskAfterDryRunRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly bc_future_use_domain: string;
  readonly rows: number;
  readonly p10_blocker: "true" | "false";
}

export interface AuthoritativeAcceptedDecisionDryRunSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly inputSources: readonly string[];
  readonly dryRunStatus: AuthoritativeAcceptedDecisionDryRunStatus;
  readonly acceptedDecisionRows: number;
  readonly appliedPreviewRows: number;
  readonly blockedApplicationRows: number;
  readonly canonicalEntityPreviewRows: number;
  readonly sourceMappingPreviewRows: number;
  readonly targetProfilePreviewRows: number;
  readonly sourceDataBacklogRows: number;
  readonly futureUseOnlyRows: number;
  readonly coverageImpact: AuthoritativeAcceptedDecisionCoverageImpact;
  readonly p10ReadinessImpact: AuthoritativeAcceptedDecisionP10ReadinessImpact;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: AuthoritativeAcceptedDecisionDryRunSafety;
}

export interface AuthoritativeAcceptedDecisionDryRunSafety {
  readonly databaseUpdated: false;
  readonly productionOutputsUpdated: false;
  readonly targetProfilesUpdated: false;
  readonly aliasesChanged: false;
  readonly conditionalRulesChanged: false;
  readonly dashboardChanged: false;
  readonly p10Enabled: false;
  readonly masterDataApplied: false;
}

export interface AuthoritativeAcceptedDecisionDryRunResult {
  readonly summary: AuthoritativeAcceptedDecisionDryRunSummary;
  readonly canonicalEntityMergedPreviewRows: readonly AuthoritativeReviewDecisionPreviewCanonicalRow[];
  readonly sourceMappingMergedPreviewRows: readonly AuthoritativeReviewDecisionPreviewSourceMapRow[];
  readonly targetProfileMergedPreviewRows: readonly AuthoritativeReviewDecisionPreviewTargetProfileRow[];
  readonly acceptedDecisionApplicationPlanRows: readonly AuthoritativeAcceptedDecisionApplicationPlanRow[];
  readonly blockedDecisionApplicationPlanRows: readonly AuthoritativeBlockedDecisionApplicationPlanRow[];
  readonly coverageImpactPreviewRows: readonly AuthoritativeCoverageImpactPreviewRow[];
  readonly p10ReadinessImpactRows: readonly AuthoritativeP10ReadinessImpactRow[];
  readonly futureUseCoverageImpactRows: readonly AuthoritativeFutureUseCoverageImpactRow[];
  readonly targetProfileGapAfterDryRunRows: readonly AuthoritativeTargetProfileGapAfterDryRunRow[];
  readonly sourceDataGapAfterDryRunRows: readonly AuthoritativeSourceDataGapAfterDryRunRow[];
  readonly conflictRiskAfterDryRunRows: readonly AuthoritativeConflictRiskAfterDryRunRow[];
  readonly dryRunSafetyReport: AuthoritativeAcceptedDecisionDryRunSafety;
  readonly importManifest: {
    readonly generatedAt: string;
    readonly outputFolder: string;
    readonly inputSources: readonly string[];
    readonly dryRunOnly: true;
    readonly p10Enabled: false;
    readonly safety: AuthoritativeAcceptedDecisionDryRunSafety;
  };
}

export function buildAuthoritativeMasterAcceptedDecisionDryRun(input: {
  readonly acceptedDecisionRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly acceptedDecisionInputExists: boolean;
  readonly canonicalEntityRows: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  readonly sourceMappingRows: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly targetProfileRows: readonly AuthoritativeNormalizedTargetProfileRow[];
  readonly registryRows: readonly FutureUseRawRegistryRow[];
  readonly outputFolder: string;
  readonly inputSources: readonly string[];
  readonly generatedAt?: string;
}): AuthoritativeAcceptedDecisionDryRunResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = safetyFlags();
  const baseCanonicalRows = input.canonicalEntityRows
    .filter((row) => row.is_active === "true" && row.source_of_truth_status === "approved")
    .map(canonicalBasePreview);
  const baseSourceRows = input.sourceMappingRows
    .filter((row) => row.is_active === "true")
    .map(sourceBasePreview);
  const baseTargetRows = input.targetProfileRows
    .filter((row) => row.is_active === "true" && row.approval_status === "approved")
    .map(targetBasePreview);
  const blockedRows: AuthoritativeBlockedDecisionApplicationPlanRow[] = [];
  const applicationRows: AuthoritativeAcceptedDecisionApplicationPlanRow[] = [];
  const canonicalRowsByCode = new Map(baseCanonicalRows.map((row) => [normalizeKey(row.canonical_entity_code), row]));
  const sourceRowsByKey = new Map(baseSourceRows.map((row) => [sourceMapPreviewKey(row), row]));
  const targetRowsByKey = new Map(baseTargetRows.map((row) => [targetProfilePreviewKey(row), row]));
  let sourceDataBacklogRows = 0;
  let futureUseOnlyRows = 0;

  if (input.acceptedDecisionInputExists) {
    for (const row of input.acceptedDecisionRows) {
      if (row.approval_status !== "approved") {
        blockedRows.push(blocked(row, "NON_APPROVED_DECISION", "Only approval_status=approved rows from P0.9q can be applied to this dry-run preview."));
        continue;
      }
      switch (row.approved_action) {
        case "APPROVE_CANONICAL_ENTITY": {
          const preview = canonicalPreview(row);
          canonicalRowsByCode.set(normalizeKey(preview.canonical_entity_code), preview);
          applicationRows.push(applied(row, "APPLIED_TO_PREVIEW", "canonical-entities.merged-preview.csv"));
          break;
        }
        case "APPROVE_SOURCE_MAPPING":
        case "APPROVE_REVIEWED_ALIAS": {
          const preview = sourcePreview(row);
          sourceRowsByKey.set(sourceMapPreviewKey(preview), preview);
          const warning = broadAliasWarning(row);
          applicationRows.push(applied(row, "APPLIED_TO_PREVIEW", "source-to-entity-map.merged-preview.csv", warning));
          break;
        }
        case "APPROVE_TARGET_PROFILE": {
          const preview = targetPreview(row);
          targetRowsByKey.set(targetProfilePreviewKey(preview), preview);
          applicationRows.push(applied(row, "APPLIED_TO_PREVIEW", "target-profiles.merged-preview.csv"));
          break;
        }
        case "SOURCE_DATA_BACKLOG":
          sourceDataBacklogRows += 1;
          applicationRows.push(applied(row, "BACKLOG_ONLY", "source-data-gap-after-dry-run.csv"));
          break;
        case "FUTURE_USE_ONLY":
          futureUseOnlyRows += 1;
          applicationRows.push(applied(row, "FUTURE_USE_ONLY", "future-use-coverage-impact.csv"));
          break;
        case "REJECT_CANDIDATE":
        case "DEFER_REVIEW":
        case "NEEDS_CORRECTION":
          blockedRows.push(blocked(row, "NON_APPLY_ACTION_IN_ACCEPTED_INPUT", `${row.approved_action} cannot be applied by the accepted-decision dry-run.`));
          break;
        default:
          blockedRows.push(blocked(row, "UNSUPPORTED_APPROVED_ACTION", "approved_action is not supported by this dry-run."));
      }
    }
  }

  const canonicalPreviewRows = [...canonicalRowsByCode.values()].sort((a, b) => a.canonical_entity_code.localeCompare(b.canonical_entity_code));
  const sourcePreviewRows = [...sourceRowsByKey.values()].sort((a, b) => sourceMapPreviewKey(a).localeCompare(sourceMapPreviewKey(b)));
  const targetPreviewRows = [...targetRowsByKey.values()].sort((a, b) => targetProfilePreviewKey(a).localeCompare(targetProfilePreviewKey(b)));
  const before = coverageSnapshot(input.registryRows, baseCanonicalRows, baseSourceRows, baseTargetRows);
  const after = coverageSnapshot(input.registryRows, canonicalPreviewRows, sourcePreviewRows, targetPreviewRows);
  const coverageImpact = coverageImpactFromSnapshots(before, after);
  const p10Impact = p10ImpactFromSnapshot(after);
  const appliedPreviewRows = applicationRows.filter((row) => row.application_status === "APPLIED_TO_PREVIEW").length;
  const validAcceptedRows = input.acceptedDecisionRows.filter((row) => row.approval_status === "approved").length;
  const dryRunStatus = statusFor(input.acceptedDecisionInputExists, validAcceptedRows, coverageImpact, p10Impact);
  const p10Reason = p10ReasonFor(dryRunStatus, coverageImpact, p10Impact);

  const summary: AuthoritativeAcceptedDecisionDryRunSummary = {
    generatedAt,
    outputFolder: input.outputFolder,
    inputSources: input.inputSources,
    dryRunStatus,
    acceptedDecisionRows: validAcceptedRows,
    appliedPreviewRows,
    blockedApplicationRows: blockedRows.length,
    canonicalEntityPreviewRows: canonicalPreviewRows.length,
    sourceMappingPreviewRows: sourcePreviewRows.length,
    targetProfilePreviewRows: targetPreviewRows.length,
    sourceDataBacklogRows,
    futureUseOnlyRows,
    coverageImpact,
    p10ReadinessImpact: p10Impact,
    p10Gate: { status: "BLOCKED", reason: p10Reason },
    safety
  };

  return {
    summary,
    canonicalEntityMergedPreviewRows: canonicalPreviewRows,
    sourceMappingMergedPreviewRows: sourcePreviewRows,
    targetProfileMergedPreviewRows: targetPreviewRows,
    acceptedDecisionApplicationPlanRows: applicationRows,
    blockedDecisionApplicationPlanRows: blockedRows,
    coverageImpactPreviewRows: coverageImpactRows(coverageImpact),
    p10ReadinessImpactRows: p10ImpactRows(p10Impact),
    futureUseCoverageImpactRows: futureUseImpactRows(input.registryRows, before, after, futureUseOnlyRows),
    targetProfileGapAfterDryRunRows: targetGapRows(after.rows),
    sourceDataGapAfterDryRunRows: sourceGapRows(after.rows),
    conflictRiskAfterDryRunRows: conflictRows(after.rows),
    dryRunSafetyReport: safety,
    importManifest: {
      generatedAt,
      outputFolder: input.outputFolder,
      inputSources: input.inputSources,
      dryRunOnly: true,
      p10Enabled: false,
      safety
    }
  };
}

interface SimulatedRegistryRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly bc_future_use_domain: string;
  readonly p10_inclusion_status: string;
  readonly authoritative_entity_status_before: string;
  readonly authoritative_entity_status_after: string;
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly target_profile_status_before: string;
  readonly target_profile_status_after: string;
}

interface CoverageSnapshot {
  readonly rows: readonly SimulatedRegistryRow[];
}

function coverageSnapshot(
  registryRows: readonly FutureUseRawRegistryRow[],
  canonicalRows: readonly AuthoritativeReviewDecisionPreviewCanonicalRow[],
  sourceRows: readonly AuthoritativeReviewDecisionPreviewSourceMapRow[],
  targetRows: readonly AuthoritativeReviewDecisionPreviewTargetProfileRow[]
): CoverageSnapshot {
  const approvedEntityCodes = new Set(canonicalRows
    .filter((row) => row.is_active === "true" && row.source_of_truth_status === "approved")
    .map((row) => normalizeKey(row.canonical_entity_code)));
  const sourceMap = new Map<string, string>();
  for (const row of sourceRows) {
    if (row.is_active !== "true") continue;
    if (!approvedEntityCodes.has(normalizeKey(row.canonical_entity_code))) continue;
    sourceMap.set(sourceKey(row.source_field, row.source_value), row.canonical_entity_code);
  }
  const targetKeys = new Set(targetRows
    .filter((row) => row.is_active === "true" && row.approval_status === "approved")
    .map((row) => targetKey(row.canonical_entity_code, row.target_bucket, row.machine_center_no)));

  return {
    rows: registryRows.map((row) => {
      const canonical = sourceMap.get(sourceKey(row.source_field, row.source_value)) || (row.authoritative_entity_status === "AUTHORITATIVE_MAPPED" ? row.authoritative_entity_code : "");
      const productionDomain = row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD";
      const afterStatus = canonical ? "AUTHORITATIVE_MAPPED" : row.authoritative_entity_status;
      const targetBucket = clean((row as { readonly target_bucket?: string }).target_bucket);
      const targetStatusAfter = productionDomain
        ? canonical && (row.target_profile_status === "COVERED" || targetKeys.has(targetKey(canonical, targetBucket, row.machine_center_no))) ? "COVERED" : "MISSING_TARGET_PROFILE"
        : "NOT_REQUIRED";
      return {
        source_field: row.source_field,
        source_value: row.source_value,
        bc_future_use_domain: row.bc_future_use_domain,
        p10_inclusion_status: row.p10_inclusion_status,
        authoritative_entity_status_before: row.authoritative_entity_status,
        authoritative_entity_status_after: afterStatus,
        canonical_entity_code: canonical,
        target_bucket: targetBucket,
        machine_center_no: row.machine_center_no,
        target_profile_status_before: row.target_profile_status,
        target_profile_status_after: targetStatusAfter
      };
    })
  };
}

function coverageImpactFromSnapshots(before: CoverageSnapshot, after: CoverageSnapshot): AuthoritativeAcceptedDecisionCoverageImpact {
  return {
    authoritativeMappedRowsBefore: countStatus(before.rows, "authoritative_entity_status_after", "AUTHORITATIVE_MAPPED"),
    authoritativeMappedRowsAfter: countStatus(after.rows, "authoritative_entity_status_after", "AUTHORITATIVE_MAPPED"),
    authoritativeUnmappedRowsBefore: before.rows.filter((row) => row.authoritative_entity_status_after !== "AUTHORITATIVE_MAPPED").length,
    authoritativeUnmappedRowsAfter: after.rows.filter((row) => row.authoritative_entity_status_after !== "AUTHORITATIVE_MAPPED").length,
    draftEntityCandidateRowsBefore: countStatus(before.rows, "authoritative_entity_status_after", "DRAFT_ENTITY_CANDIDATE"),
    draftEntityCandidateRowsAfter: countStatus(after.rows, "authoritative_entity_status_after", "DRAFT_ENTITY_CANDIDATE"),
    conflictReviewRowsBefore: countStatus(before.rows, "authoritative_entity_status_after", "CONFLICT_REVIEW"),
    conflictReviewRowsAfter: countStatus(after.rows, "authoritative_entity_status_after", "CONFLICT_REVIEW"),
    sourceDataGapRowsBefore: countStatus(before.rows, "authoritative_entity_status_after", "SOURCE_DATA_GAP"),
    sourceDataGapRowsAfter: countStatus(after.rows, "authoritative_entity_status_after", "SOURCE_DATA_GAP"),
    outputOkMappedRowsBefore: before.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    outputOkMappedRowsAfter: after.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    rejectMappedRowsBefore: before.rows.filter((row) => row.bc_future_use_domain === "REJECT_ATTACHMENT" && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    rejectMappedRowsAfter: after.rows.filter((row) => row.bc_future_use_domain === "REJECT_ATTACHMENT" && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    targetProfileRequiredRows: after.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD").length,
    targetProfileCoveredRowsBefore: countStatus(before.rows, "target_profile_status_after", "COVERED"),
    targetProfileCoveredRowsAfter: countStatus(after.rows, "target_profile_status_after", "COVERED"),
    targetProfileMissingRowsBefore: before.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" && row.target_profile_status_after === "MISSING_TARGET_PROFILE").length,
    targetProfileMissingRowsAfter: after.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" && row.target_profile_status_after === "MISSING_TARGET_PROFILE").length,
    targetProfileNotRequiredRows: after.rows.filter((row) => row.bc_future_use_domain !== "PRODUCTION_OUTPUT_DASHBOARD").length
  };
}

function p10ImpactFromSnapshot(snapshot: CoverageSnapshot): AuthoritativeAcceptedDecisionP10ReadinessImpact {
  const productionRows = snapshot.rows.filter((row) => row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD");
  return {
    productionOutputRowsWithApprovedEntityCoverage: productionRows.filter((row) => row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    productionOutputRowsMissingApprovedEntity: productionRows.filter((row) => row.authoritative_entity_status_after !== "AUTHORITATIVE_MAPPED").length,
    productionOutputRowsWithApprovedTargetProfile: productionRows.filter((row) => row.target_profile_status_after === "COVERED").length,
    productionOutputRowsMissingApprovedTargetProfile: productionRows.filter((row) => row.target_profile_status_after === "MISSING_TARGET_PROFILE").length,
    sourceDataGapsAffectingP10: productionRows.filter((row) => row.authoritative_entity_status_after === "SOURCE_DATA_GAP").length,
    conflictsStillAffectingP10: productionRows.filter((row) => row.authoritative_entity_status_after === "CONFLICT_REVIEW").length,
    rejectAttachmentRowsNeedingReview: snapshot.rows.filter((row) => row.bc_future_use_domain === "REJECT_ATTACHMENT" && row.authoritative_entity_status_after !== "AUTHORITATIVE_MAPPED").length,
    p10StillBlocked: true
  };
}

function statusFor(
  inputExists: boolean,
  acceptedRows: number,
  coverage: AuthoritativeAcceptedDecisionCoverageImpact,
  p10: AuthoritativeAcceptedDecisionP10ReadinessImpact
): AuthoritativeAcceptedDecisionDryRunStatus {
  if (!inputExists) return "BLOCKED_MISSING_INPUTS";
  if (acceptedRows === 0) return "NO_ACCEPTED_DECISIONS";
  if (coverage.targetProfileMissingRowsAfter === 0 && p10.productionOutputRowsMissingApprovedEntity === 0 && p10.sourceDataGapsAffectingP10 === 0 && p10.conflictsStillAffectingP10 === 0) {
    return "DRY_RUN_READY_FOR_FINAL_REVIEW";
  }
  return "DRY_RUN_WITH_REMAINING_BLOCKERS";
}

function p10ReasonFor(
  status: AuthoritativeAcceptedDecisionDryRunStatus,
  coverage: AuthoritativeAcceptedDecisionCoverageImpact,
  p10: AuthoritativeAcceptedDecisionP10ReadinessImpact
): string {
  if (status === "BLOCKED_MISSING_INPUTS") return "P1.0 remains blocked: P0.9q accepted-review-decisions.csv is missing.";
  if (status === "NO_ACCEPTED_DECISIONS") return "P1.0 remains blocked: no accepted decisions were available for dry-run application.";
  if (status === "DRY_RUN_READY_FOR_FINAL_REVIEW") return "P1.0 remains blocked: accepted decisions only make a dry-run preview and require final approval/apply planning before mutation.";
  return `P1.0 remains blocked: dry-run still has missing entity rows=${p10.productionOutputRowsMissingApprovedEntity}, missing target profile rows=${coverage.targetProfileMissingRowsAfter}, source data gaps=${p10.sourceDataGapsAffectingP10}, conflicts=${p10.conflictsStillAffectingP10}.`;
}

function coverageImpactRows(impact: AuthoritativeAcceptedDecisionCoverageImpact): AuthoritativeCoverageImpactPreviewRow[] {
  return (Object.keys(impact) as (keyof AuthoritativeAcceptedDecisionCoverageImpact)[]).map((metric) => {
    const value = impact[metric];
    const beforeKey = metric.replace(/After$|Before$/, "Before") as keyof AuthoritativeAcceptedDecisionCoverageImpact;
    const afterKey = metric.replace(/Before$|After$/, "After") as keyof AuthoritativeAcceptedDecisionCoverageImpact;
    const before = typeof impact[beforeKey] === "number" ? impact[beforeKey] : value;
    const after = typeof impact[afterKey] === "number" ? impact[afterKey] : value;
    return { metric, before, after, delta: after - before };
  });
}

function p10ImpactRows(impact: AuthoritativeAcceptedDecisionP10ReadinessImpact): AuthoritativeP10ReadinessImpactRow[] {
  return (Object.keys(impact) as (keyof AuthoritativeAcceptedDecisionP10ReadinessImpact)[]).map((metric) => ({ metric, rows: String(impact[metric]) }));
}

function futureUseImpactRows(
  registryRows: readonly FutureUseRawRegistryRow[],
  before: CoverageSnapshot,
  after: CoverageSnapshot,
  futureUseOnlyRows: number
): AuthoritativeFutureUseCoverageImpactRow[] {
  const domains = [...new Set(registryRows.map((row) => row.bc_future_use_domain))].sort();
  return domains.map((domain) => ({
    bc_future_use_domain: domain,
    rows: after.rows.filter((row) => row.bc_future_use_domain === domain).length,
    authoritative_mapped_rows_before: before.rows.filter((row) => row.bc_future_use_domain === domain && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    authoritative_mapped_rows_after: after.rows.filter((row) => row.bc_future_use_domain === domain && row.authoritative_entity_status_after === "AUTHORITATIVE_MAPPED").length,
    target_profile_missing_rows_before: before.rows.filter((row) => row.bc_future_use_domain === domain && row.target_profile_status_after === "MISSING_TARGET_PROFILE").length,
    target_profile_missing_rows_after: after.rows.filter((row) => row.bc_future_use_domain === domain && row.target_profile_status_after === "MISSING_TARGET_PROFILE").length,
    future_use_only_rows: domain === "PRODUCTION_OUTPUT_DASHBOARD" ? 0 : futureUseOnlyRows
  }));
}

function targetGapRows(rows: readonly SimulatedRegistryRow[]): AuthoritativeTargetProfileGapAfterDryRunRow[] {
  return grouped(rows.filter((row) => row.target_profile_status_after === "MISSING_TARGET_PROFILE"), (row) => [row.bc_future_use_domain, row.canonical_entity_code, row.target_bucket, row.machine_center_no].join("|"))
    .map((groupRows) => {
      const row = groupRows[0]!;
      return {
        bc_future_use_domain: row.bc_future_use_domain,
        canonical_entity_code: row.canonical_entity_code,
        target_bucket: row.target_bucket,
        machine_center_no: row.machine_center_no,
        rows: groupRows.length,
        p10_blocker: row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "true" : "false"
      };
    });
}

function sourceGapRows(rows: readonly SimulatedRegistryRow[]): AuthoritativeSourceDataGapAfterDryRunRow[] {
  return grouped(rows.filter((row) => row.authoritative_entity_status_after === "SOURCE_DATA_GAP"), (row) => [row.source_field, row.source_value, row.bc_future_use_domain].join("|"))
    .map((groupRows) => {
      const row = groupRows[0]!;
      return {
        source_field: row.source_field,
        source_value: row.source_value,
        bc_future_use_domain: row.bc_future_use_domain,
        rows: groupRows.length,
        p10_blocker: row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "true" : "false"
      };
    });
}

function conflictRows(rows: readonly SimulatedRegistryRow[]): AuthoritativeConflictRiskAfterDryRunRow[] {
  return grouped(rows.filter((row) => row.authoritative_entity_status_after === "CONFLICT_REVIEW"), (row) => [row.source_field, row.source_value, row.bc_future_use_domain].join("|"))
    .map((groupRows) => {
      const row = groupRows[0]!;
      return {
        source_field: row.source_field,
        source_value: row.source_value,
        bc_future_use_domain: row.bc_future_use_domain,
        rows: groupRows.length,
        p10_blocker: row.bc_future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD" ? "true" : "false"
      };
    });
}

function grouped<T>(rows: readonly T[], keyFor: (row: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

function countStatus<K extends "authoritative_entity_status_after" | "target_profile_status_after">(rows: readonly SimulatedRegistryRow[], key: K, status: string): number {
  return rows.filter((row) => row[key] === status).length;
}

function canonicalBasePreview(row: AuthoritativeNormalizedCanonicalEntityRow): AuthoritativeReviewDecisionPreviewCanonicalRow {
  return { ...row, is_active: "true", source_of_truth_status: "approved", source_review_id: "" };
}

function sourceBasePreview(row: AuthoritativeNormalizedSourceMapRow): AuthoritativeReviewDecisionPreviewSourceMapRow {
  return { ...row, source_system: "business-central", is_active: "true", confidence: row.confidence === "LOW" ? "MEDIUM" : row.confidence === "MEDIUM" ? "MEDIUM" : "HIGH", source_review_id: "" };
}

function targetBasePreview(row: AuthoritativeNormalizedTargetProfileRow): AuthoritativeReviewDecisionPreviewTargetProfileRow {
  return { ...row, is_active: "true", approval_status: "approved", source_review_id: "" };
}

function canonicalPreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewCanonicalRow {
  return {
    canonical_entity_code: row.approved_canonical_entity_code,
    canonical_entity_display_name: row.approved_canonical_entity_code,
    entity_family: inferFamily(row.approved_canonical_entity_code),
    entity_type: "OTHER",
    production_area: "",
    is_active: "true",
    source_of_truth_status: "approved",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    source_review_id: row.review_id
  };
}

function sourcePreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewSourceMapRow {
  return {
    source_system: "business-central",
    source_field: row.approved_source_field,
    source_value: row.approved_source_value,
    canonical_entity_code: row.approved_canonical_entity_code,
    mapping_type: row.approved_action === "APPROVE_REVIEWED_ALIAS" && !row.approved_mapping_type ? "REVIEWED_SOURCE_ALIAS" : row.approved_mapping_type,
    confidence: row.approved_action === "APPROVE_SOURCE_MAPPING" ? "HIGH" : "MEDIUM",
    is_active: "true",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    source_review_id: row.review_id
  };
}

function targetPreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewTargetProfileRow {
  return {
    canonical_entity_code: row.approved_canonical_entity_code,
    target_bucket: row.approved_target_bucket,
    machine_center_no: row.approved_machine_center_no,
    target_qty: row.approved_target_qty,
    unit: row.approved_unit,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    is_active: "true",
    approval_status: "approved",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    source_review_id: row.review_id
  };
}

function applied(
  row: AuthoritativeReviewDecisionNormalizedRow,
  application_status: AuthoritativeAcceptedDecisionApplicationPlanRow["application_status"],
  preview_artifact: string,
  warning?: { readonly code: string; readonly message: string }
): AuthoritativeAcceptedDecisionApplicationPlanRow {
  return {
    review_id: row.review_id,
    review_type: row.review_type,
    approved_action: row.approved_action,
    application_status,
    preview_artifact,
    canonical_entity_code: row.approved_canonical_entity_code,
    source_field: row.approved_source_field,
    source_value: row.approved_source_value,
    target_bucket: row.approved_target_bucket,
    machine_center_no: row.approved_machine_center_no,
    warning_code: warning?.code ?? "",
    warning_message: warning?.message ?? ""
  };
}

function blocked(row: AuthoritativeReviewDecisionNormalizedRow, blocker_code: string, blocker_message: string): AuthoritativeBlockedDecisionApplicationPlanRow {
  return {
    review_id: row.review_id,
    review_type: row.review_type,
    approval_status: row.approval_status,
    approved_action: row.approved_action,
    blocker_code,
    blocker_message
  };
}

function broadAliasWarning(row: AuthoritativeReviewDecisionNormalizedRow): { readonly code: string; readonly message: string } | undefined {
  if (row.approved_action !== "APPROVE_REVIEWED_ALIAS") return undefined;
  if (!["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"].includes(normalizeKey(row.approved_source_value))) return undefined;
  return { code: "BROAD_ALIAS_RISK", message: "Reviewed alias is broad/family-level; keep manual review evidence before any real apply." };
}

function sourceMapPreviewKey(row: AuthoritativeReviewDecisionPreviewSourceMapRow): string {
  return [row.source_field, row.source_value, row.mapping_type].map(normalizeKey).join("|");
}

function targetProfilePreviewKey(row: AuthoritativeReviewDecisionPreviewTargetProfileRow): string {
  return targetKey(row.canonical_entity_code, row.target_bucket, row.machine_center_no);
}

function sourceKey(sourceField: unknown, sourceValue: unknown): string {
  return [normalizeSourceField(sourceField), normalizeKey(sourceValue)].join("|");
}

function targetKey(canonical: unknown, targetBucket: unknown, machineCenter: unknown): string {
  return [canonical, targetBucket, machineCenter].map(normalizeKey).join("|");
}

function normalizeSourceField(value: unknown): string {
  const text = clean(value);
  if (text === "g_prod_or_rot_line_description") return "gProdOrRotLineDescription";
  if (text === "g_prod_or_rot_line_no") return "gProdOrRotLineNo";
  if (text === "machine_center_no") return "machineCenterNo";
  return text;
}

function inferFamily(value: string): string {
  const text = normalizeKey(value);
  for (const family of ["OMSO", "POLYPRINT", "VFINE", "LONGSUN", "THERMO HENGFENG", "BORCH", "NEWDO", "GILINGAN", "REPACKING"]) {
    if (text.includes(family)) return family;
  }
  return "OTHER";
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safetyFlags(): AuthoritativeAcceptedDecisionDryRunSafety {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false,
    masterDataApplied: false
  };
}
