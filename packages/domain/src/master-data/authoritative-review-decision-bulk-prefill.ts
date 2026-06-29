import type {
  AuthoritativeMasterConflictReviewRow,
  AuthoritativeMasterEntityReviewRow,
  AuthoritativeMasterFutureUseDomainReviewRow,
  AuthoritativeMasterReviewerDecisionTemplateRow,
  AuthoritativeMasterReviewPriorityBoardRow,
  AuthoritativeMasterSourceDataGapReviewRow,
  AuthoritativeMasterSourceMappingReviewRow,
  AuthoritativeMasterTargetProfileReviewRow
} from "./authoritative-master-review-workspace.js";
import type { AuthoritativeReviewDecisionNormalizedRow } from "./authoritative-master-review-decision-intake.js";

export type AuthoritativeReviewDecisionBulkPrefillStatus = "GENERATED" | "BLOCKED_MISSING_WORKSPACE";

export interface AuthoritativeReviewDecisionBulkPrefillRuleReportRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly rule_id: string;
  readonly rule_result: "APPROVED_PREFILL" | "DEFERRED_PREFILL" | "NEEDS_CORRECTION_PREFILL";
  readonly approved_action: string;
  readonly rule_reason: string;
}

export interface AuthoritativeReviewDecisionBulkPrefillRiskReportRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  readonly risk_reason: string;
  readonly requires_human_review: "true";
}

export interface AuthoritativeReviewDecisionBulkPrefillSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly sourceWorkspaceFolder: string;
  readonly prefillStatus: AuthoritativeReviewDecisionBulkPrefillStatus;
  readonly totalTemplateRows: number;
  readonly approvedPrefillRows: number;
  readonly deferredPrefillRows: number;
  readonly needsCorrectionRows: number;
  readonly rejectedPrefillRows: number;
  readonly sourceDataBacklogRows: number;
  readonly futureUseOnlyRows: number;
  readonly targetProfileNeedsCorrectionRows: number;
  readonly conflictDeferredRows: number;
  readonly safeAutoAcceptedRows: number;
  readonly requiresHumanReviewRows: number;
  readonly wroteConveniencePrefillFile: boolean;
  readonly overwroteRealReviewerDecisionFile: false;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: AuthoritativeReviewDecisionBulkPrefillSafety;
}

export interface AuthoritativeReviewDecisionBulkPrefillSafety {
  readonly databaseUpdated: false;
  readonly productionOutputsUpdated: false;
  readonly targetProfilesUpdated: false;
  readonly aliasesChanged: false;
  readonly conditionalRulesChanged: false;
  readonly dashboardChanged: false;
  readonly p10Enabled: false;
  readonly masterDataApplied: false;
}

export interface AuthoritativeReviewDecisionBulkPrefillResult {
  readonly summary: AuthoritativeReviewDecisionBulkPrefillSummary;
  readonly bulkPrefillRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly safeAutoAcceptedRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly requiresHumanReviewRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly ruleReportRows: readonly AuthoritativeReviewDecisionBulkPrefillRuleReportRow[];
  readonly riskReportRows: readonly AuthoritativeReviewDecisionBulkPrefillRiskReportRow[];
  readonly importManifest: {
    readonly generatedAt: string;
    readonly sourceWorkspaceFolder: string;
    readonly outputFolder: string;
    readonly wroteRealReviewerDecisionFile: false;
    readonly defaultReviewer: typeof defaultReviewer;
    readonly reviewerNotesPrefix: typeof notesPrefix;
    readonly safety: AuthoritativeReviewDecisionBulkPrefillSafety;
  };
}

const defaultReviewer = "SYSTEM_BULK_PREFILL_REVIEW_REQUIRED";
const notesPrefix = "BULK_PREFILL_REQUIRES_USER_REVIEW:";
const broadFamilyOnlySources = new Set(["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"]);

export function buildAuthoritativeReviewDecisionBulkPrefill(input: {
  readonly templateRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly entityRows: readonly AuthoritativeMasterEntityReviewRow[];
  readonly sourceMappingRows: readonly AuthoritativeMasterSourceMappingReviewRow[];
  readonly targetProfileRows: readonly AuthoritativeMasterTargetProfileReviewRow[];
  readonly conflictRows: readonly AuthoritativeMasterConflictReviewRow[];
  readonly sourceDataGapRows: readonly AuthoritativeMasterSourceDataGapReviewRow[];
  readonly futureUseDomainRows: readonly AuthoritativeMasterFutureUseDomainReviewRow[];
  readonly priorityRows?: readonly AuthoritativeMasterReviewPriorityBoardRow[];
  readonly workspaceExists: boolean;
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly wroteConveniencePrefillFile?: boolean;
  readonly generatedAt?: string;
}): AuthoritativeReviewDecisionBulkPrefillResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = safetyFlags();
  if (!input.workspaceExists || input.templateRows.length === 0) {
    return result({
      generatedAt,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      outputFolder: input.outputFolder,
      prefillStatus: "BLOCKED_MISSING_WORKSPACE",
      totalTemplateRows: input.templateRows.length,
      rows: [],
      ruleRows: [],
      riskRows: [],
      wroteConveniencePrefillFile: false,
      safety
    });
  }

  const context = {
    entityRows: new Map(input.entityRows.map((row) => [row.review_id, row])),
    sourceRows: new Map(input.sourceMappingRows.map((row) => [row.review_id, row])),
    targetRows: new Map(input.targetProfileRows.map((row) => [row.review_id, row])),
    conflictRows: new Map(input.conflictRows.map((row) => [row.review_id, row])),
    gapRows: new Map(input.sourceDataGapRows.map((row) => [row.review_id, row])),
    futureRows: new Map(input.futureUseDomainRows.map((row) => [row.review_id, row]))
  };
  const rows: AuthoritativeReviewDecisionNormalizedRow[] = [];
  const ruleRows: AuthoritativeReviewDecisionBulkPrefillRuleReportRow[] = [];
  const riskRows: AuthoritativeReviewDecisionBulkPrefillRiskReportRow[] = [];

  for (const template of input.templateRows) {
    const prefill = prefillRow(template, context);
    rows.push(prefill.row);
    ruleRows.push(prefill.rule);
    riskRows.push(prefill.risk);
  }

  return result({
    generatedAt,
    sourceWorkspaceFolder: input.sourceWorkspaceFolder,
    outputFolder: input.outputFolder,
    prefillStatus: "GENERATED",
    totalTemplateRows: input.templateRows.length,
    rows,
    ruleRows,
    riskRows,
    wroteConveniencePrefillFile: Boolean(input.wroteConveniencePrefillFile),
    safety
  });
}

type PrefillContext = {
  readonly entityRows: ReadonlyMap<string, AuthoritativeMasterEntityReviewRow>;
  readonly sourceRows: ReadonlyMap<string, AuthoritativeMasterSourceMappingReviewRow>;
  readonly targetRows: ReadonlyMap<string, AuthoritativeMasterTargetProfileReviewRow>;
  readonly conflictRows: ReadonlyMap<string, AuthoritativeMasterConflictReviewRow>;
  readonly gapRows: ReadonlyMap<string, AuthoritativeMasterSourceDataGapReviewRow>;
  readonly futureRows: ReadonlyMap<string, AuthoritativeMasterFutureUseDomainReviewRow>;
};

interface PrefillDecision {
  readonly row: AuthoritativeReviewDecisionNormalizedRow;
  readonly rule: AuthoritativeReviewDecisionBulkPrefillRuleReportRow;
  readonly risk: AuthoritativeReviewDecisionBulkPrefillRiskReportRow;
}

function prefillRow(template: AuthoritativeMasterReviewerDecisionTemplateRow, context: PrefillContext): PrefillDecision {
  if (template.review_type === "ENTITY") return entityPrefill(template, context.entityRows.get(template.review_id));
  if (template.review_type === "SOURCE_MAPPING") return sourceMappingPrefill(template, context.sourceRows.get(template.review_id));
  if (template.review_type === "TARGET_PROFILE") return targetProfilePrefill(template, context.targetRows.get(template.review_id));
  if (template.review_type === "CONFLICT") return conflictPrefill(template, context.conflictRows.get(template.review_id));
  if (template.review_type === "SOURCE_DATA_GAP") return sourceDataGapPrefill(template, context.gapRows.get(template.review_id));
  if (template.review_type === "FUTURE_USE_DOMAIN") return futureUsePrefill(template, context.futureRows.get(template.review_id));
  return unsupportedPrefill(template);
}

function entityPrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterEntityReviewRow | undefined): PrefillDecision {
  const code = clean(row?.proposed_canonical_entity_code) || template.approved_canonical_entity_code;
  const lowRisk = row !== undefined
    && Boolean(code)
    && !isBlankOrUnmapped(code)
    && !isBroadFamilyOnly(code)
    && row.conflict_rows === 0
    && row.source_data_gap_rows === 0
    && lowRiskRecommendedAction(row.recommended_action);
  if (!lowRisk) {
    return decision(template, {
      status: "deferred",
      action: "DEFER_REVIEW",
      canonical: code,
      ruleId: "ENTITY_DEFER_UNCLEAR_RISK",
      ruleResult: "DEFERRED_PREFILL",
      reason: "Entity candidate risk is unclear or requires manual canonical review.",
      riskLevel: row?.conflict_rows || row?.source_data_gap_rows ? "HIGH" : "UNKNOWN",
      riskReason: "Canonical entity approval requires business review."
    });
  }
  return decision(template, {
    status: "approved",
    action: "APPROVE_CANONICAL_ENTITY",
    canonical: code,
    ruleId: "ENTITY_LOW_RISK_APPROVE",
    ruleResult: "APPROVED_PREFILL",
    reason: "Low-risk canonical entity candidate from OData evidence.",
    riskLevel: "LOW",
    riskReason: "No conflict/source-data-gap evidence and recommended action allows approval."
  });
}

function sourceMappingPrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterSourceMappingReviewRow | undefined): PrefillDecision {
  const sourceField = clean(row?.source_field) || template.approved_source_field;
  const sourceValue = clean(row?.source_value) || template.approved_source_value;
  const canonical = clean(row?.proposed_canonical_entity_code) || template.approved_canonical_entity_code;
  const mappingType = clean(row?.mapping_type) || template.approved_mapping_type;
  if (sourceField === "machineCenterNo") {
    return decision(template, {
      status: "deferred",
      action: "DEFER_REVIEW",
      canonical,
      sourceField,
      sourceValue,
      mappingType,
      ruleId: "SOURCE_MAPPING_DEFER_MACHINE_CENTER",
      ruleResult: "DEFERRED_PREFILL",
      reason: "machineCenterNo is fallback-only evidence.",
      riskLevel: "MEDIUM",
      riskReason: "Fallback-only source field requires manual review."
    });
  }
  const safeExact = row !== undefined
    && sourceField === "gProdOrRotLineDescription"
    && Boolean(sourceValue)
    && !isBlankOrUnmapped(sourceValue)
    && !isBroadFamilyOnly(sourceValue)
    && Boolean(canonical)
    && mappingType === "EXACT_SOURCE_VALUE"
    && row.conflict_flag !== "true";
  if (!safeExact) {
    return decision(template, {
      status: "deferred",
      action: "DEFER_REVIEW",
      canonical,
      sourceField,
      sourceValue,
      mappingType,
      ruleId: "SOURCE_MAPPING_DEFER_UNSAFE",
      ruleResult: "DEFERRED_PREFILL",
      reason: "Source mapping is not an exact low-risk production-line description mapping.",
      riskLevel: isBroadFamilyOnly(sourceValue) || row?.conflict_flag === "true" ? "HIGH" : "UNKNOWN",
      riskReason: "Source mapping requires manual review before approval."
    });
  }
  return decision(template, {
    status: "approved",
    action: "APPROVE_SOURCE_MAPPING",
    canonical,
    sourceField,
    sourceValue,
    mappingType: "EXACT_SOURCE_VALUE",
    ruleId: "SOURCE_MAPPING_EXACT_APPROVE",
    ruleResult: "APPROVED_PREFILL",
    reason: "Exact OData source value mapped to proposed canonical entity.",
    riskLevel: "LOW",
    riskReason: "Exact source value with no conflict flag."
  });
}

function targetProfilePrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterTargetProfileReviewRow | undefined): PrefillDecision {
  const canonical = clean(row?.canonical_entity_code) || template.approved_canonical_entity_code;
  const targetBucket = clean(row?.target_bucket) || template.approved_target_bucket;
  const machineCenter = clean(row?.machine_center_no) || template.approved_machine_center_no;
  const targetQty = clean(row?.proposed_target_qty) || template.approved_target_qty;
  const unit = clean(row?.proposed_unit) || template.approved_unit;
  const effectiveFrom = clean(row?.effective_from) || template.effective_from;
  const productionRequired = row?.target_profile_required === "true" || (row?.affected_output_rows ?? 0) > 0;
  if (productionRequired && canonical && targetBucket && targetQty && unit && effectiveFrom) {
    return decision(template, {
      status: "approved",
      action: "APPROVE_TARGET_PROFILE",
      canonical,
      targetBucket,
      machineCenter,
      targetQty,
      unit,
      effectiveFrom,
      effectiveTo: clean(row?.effective_to) || template.effective_to,
      ruleId: "TARGET_PROFILE_FIELDS_PRESENT_APPROVE",
      ruleResult: "APPROVED_PREFILL",
      reason: "Target profile fields present; verify capacity before apply.",
      riskLevel: "MEDIUM",
      riskReason: "Capacity still requires user/business verification."
    });
  }
  if (productionRequired) {
    return decision(template, {
      status: "needs_correction",
      action: "NEEDS_CORRECTION",
      canonical,
      targetBucket,
      machineCenter,
      targetQty,
      unit,
      effectiveFrom,
      effectiveTo: clean(row?.effective_to) || template.effective_to,
      ruleId: "TARGET_PROFILE_NEEDS_REQUIRED_FIELDS",
      ruleResult: "NEEDS_CORRECTION_PREFILL",
      reason: "Fill target_qty, unit, and effective_from before approval.",
      riskLevel: "MEDIUM",
      riskReason: "Production output target profile is missing required approval fields."
    });
  }
  return decision(template, {
    status: "deferred",
    action: "DEFER_REVIEW",
    canonical,
    targetBucket,
    machineCenter,
    ruleId: "TARGET_PROFILE_NOT_PRODUCTION_DEFER",
    ruleResult: "DEFERRED_PREFILL",
    reason: "Non-production target profile row is not a default P1.0 blocker.",
    riskLevel: "LOW",
    riskReason: "Target profile is not required by default outside production output."
  });
}

function conflictPrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterConflictReviewRow | undefined): PrefillDecision {
  return decision(template, {
    status: "deferred",
    action: "DEFER_REVIEW",
    canonical: clean(row?.proposed_canonical_entity_code) || template.approved_canonical_entity_code,
    sourceField: clean(row?.source_field) || template.approved_source_field,
    sourceValue: clean(row?.source_value) || template.approved_source_value,
    ruleId: "CONFLICT_DEFER_BUSINESS_REVIEW",
    ruleResult: "DEFERRED_PREFILL",
    reason: "Conflict evidence requires business review.",
    riskLevel: "HIGH",
    riskReason: clean(row?.conflict_type) || clean(row?.recommended_action) || "Conflict evidence requires manual review."
  });
}

function sourceDataGapPrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterSourceDataGapReviewRow | undefined): PrefillDecision {
  return decision(template, {
    status: "approved",
    action: "SOURCE_DATA_BACKLOG",
    ruleId: "SOURCE_DATA_GAP_BACKLOG",
    ruleResult: "APPROVED_PREFILL",
    reason: "Source value is blank or insufficient; keep in source-data backlog.",
    riskLevel: "LOW",
    riskReason: clean(row?.source_gap_type) || "Backlog only; no entity or mapping is created."
  });
}

function futureUsePrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow, row: AuthoritativeMasterFutureUseDomainReviewRow | undefined): PrefillDecision {
  const production = row?.future_use_domain === "PRODUCTION_OUTPUT_DASHBOARD";
  return decision(template, {
    status: production ? "deferred" : "approved",
    action: production ? "DEFER_REVIEW" : "FUTURE_USE_ONLY",
    ruleId: production ? "FUTURE_USE_PRODUCTION_DEFER" : "FUTURE_USE_ONLY_NON_PRODUCTION",
    ruleResult: production ? "DEFERRED_PREFILL" : "APPROVED_PREFILL",
    reason: production
      ? "Production output domain requires P1.0 readiness review."
      : "Registered for future-use module only, not P1.0 production KPI.",
    riskLevel: production ? "MEDIUM" : "LOW",
    riskReason: clean(row?.future_use_domain) || "Future-use domain review."
  });
}

function unsupportedPrefill(template: AuthoritativeMasterReviewerDecisionTemplateRow): PrefillDecision {
  return decision(template, {
    status: "deferred",
    action: "DEFER_REVIEW",
    ruleId: "UNSUPPORTED_ROW_TYPE",
    ruleResult: "DEFERRED_PREFILL",
    reason: "Unsupported row type requires manual review.",
    riskLevel: "UNKNOWN",
    riskReason: "Unsupported row type."
  });
}

function decision(template: AuthoritativeMasterReviewerDecisionTemplateRow, input: {
  readonly status: AuthoritativeReviewDecisionNormalizedRow["approval_status"];
  readonly action: string;
  readonly canonical?: string;
  readonly sourceField?: string;
  readonly sourceValue?: string;
  readonly mappingType?: string;
  readonly targetBucket?: string;
  readonly machineCenter?: string;
  readonly targetQty?: string;
  readonly unit?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly ruleId: string;
  readonly ruleResult: AuthoritativeReviewDecisionBulkPrefillRuleReportRow["rule_result"];
  readonly reason: string;
  readonly riskLevel: AuthoritativeReviewDecisionBulkPrefillRiskReportRow["risk_level"];
  readonly riskReason: string;
}): PrefillDecision {
  const row: AuthoritativeReviewDecisionNormalizedRow = {
    review_id: template.review_id,
    review_type: template.review_type,
    approval_status: input.status,
    approved_action: input.action,
    approved_canonical_entity_code: clean(input.canonical) || template.approved_canonical_entity_code,
    approved_source_field: clean(input.sourceField) || template.approved_source_field,
    approved_source_value: clean(input.sourceValue) || template.approved_source_value,
    approved_mapping_type: clean(input.mappingType) || template.approved_mapping_type,
    approved_target_bucket: clean(input.targetBucket) || template.approved_target_bucket,
    approved_machine_center_no: clean(input.machineCenter) || template.approved_machine_center_no,
    approved_target_qty: clean(input.targetQty) || template.approved_target_qty,
    approved_unit: clean(input.unit) || template.approved_unit,
    effective_from: clean(input.effectiveFrom) || template.effective_from,
    effective_to: clean(input.effectiveTo) || template.effective_to,
    reviewer: defaultReviewer,
    reviewer_notes: `${notesPrefix} ${input.reason}`
  };
  return {
    row,
    rule: {
      review_id: row.review_id,
      review_type: row.review_type,
      rule_id: input.ruleId,
      rule_result: input.ruleResult,
      approved_action: row.approved_action,
      rule_reason: input.reason
    },
    risk: {
      review_id: row.review_id,
      review_type: row.review_type,
      risk_level: input.riskLevel,
      risk_reason: input.riskReason,
      requires_human_review: "true"
    }
  };
}

function result(input: {
  readonly generatedAt: string;
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly prefillStatus: AuthoritativeReviewDecisionBulkPrefillStatus;
  readonly totalTemplateRows: number;
  readonly rows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly ruleRows: readonly AuthoritativeReviewDecisionBulkPrefillRuleReportRow[];
  readonly riskRows: readonly AuthoritativeReviewDecisionBulkPrefillRiskReportRow[];
  readonly wroteConveniencePrefillFile: boolean;
  readonly safety: AuthoritativeReviewDecisionBulkPrefillSafety;
}): AuthoritativeReviewDecisionBulkPrefillResult {
  const approvedRows = input.rows.filter((row) => row.approval_status === "approved");
  const requiresHumanReviewRows = input.rows.filter((row) => row.approval_status !== "approved");
  const summary: AuthoritativeReviewDecisionBulkPrefillSummary = {
    generatedAt: input.generatedAt,
    outputFolder: input.outputFolder,
    sourceWorkspaceFolder: input.sourceWorkspaceFolder,
    prefillStatus: input.prefillStatus,
    totalTemplateRows: input.totalTemplateRows,
    approvedPrefillRows: approvedRows.length,
    deferredPrefillRows: input.rows.filter((row) => row.approval_status === "deferred").length,
    needsCorrectionRows: input.rows.filter((row) => row.approval_status === "needs_correction").length,
    rejectedPrefillRows: input.rows.filter((row) => row.approval_status === "rejected").length,
    sourceDataBacklogRows: input.rows.filter((row) => row.approved_action === "SOURCE_DATA_BACKLOG").length,
    futureUseOnlyRows: input.rows.filter((row) => row.approved_action === "FUTURE_USE_ONLY").length,
    targetProfileNeedsCorrectionRows: input.rows.filter((row) => row.review_type === "TARGET_PROFILE" && row.approval_status === "needs_correction").length,
    conflictDeferredRows: input.rows.filter((row) => row.review_type === "CONFLICT" && row.approval_status === "deferred").length,
    safeAutoAcceptedRows: approvedRows.length,
    requiresHumanReviewRows: requiresHumanReviewRows.length,
    wroteConveniencePrefillFile: input.wroteConveniencePrefillFile,
    overwroteRealReviewerDecisionFile: false,
    p10Gate: {
      status: "BLOCKED",
      reason: "P1.0 remains blocked: bulk-prefill decisions require user/business review and this command is export-only."
    },
    safety: input.safety
  };
  return {
    summary,
    bulkPrefillRows: input.rows,
    safeAutoAcceptedRows: approvedRows,
    requiresHumanReviewRows,
    ruleReportRows: input.ruleRows,
    riskReportRows: input.riskRows,
    importManifest: {
      generatedAt: input.generatedAt,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      outputFolder: input.outputFolder,
      wroteRealReviewerDecisionFile: false,
      defaultReviewer,
      reviewerNotesPrefix: notesPrefix,
      safety: input.safety
    }
  };
}

function lowRiskRecommendedAction(value: string): boolean {
  const action = value.toUpperCase();
  return action.includes("APPROVE") || action.includes("CREATE_CANONICAL") || action.includes("LOW_RISK");
}

function isBlankOrUnmapped(value: string): boolean {
  const key = normalizeKey(value);
  return !key || key === "(BLANK)" || key === "UNMAPPED";
}

function isBroadFamilyOnly(value: string): boolean {
  return broadFamilyOnlySources.has(normalizeKey(value));
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safetyFlags(): AuthoritativeReviewDecisionBulkPrefillSafety {
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
