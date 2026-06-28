export type AuthoritativeMasterIntakeStatus =
  | "AWAITING_MASTER_INPUT"
  | "INVALID"
  | "VALID_WITH_WARNINGS"
  | "VALID";

export type AuthoritativeEntityType = "MACHINE" | "LINE" | "WORK_CENTER" | "PROCESS" | "OTHER";
export type AuthoritativeSourceOfTruthStatus = "approved" | "draft" | "deprecated";
export type AuthoritativeSourceSystem = "business-central";
export type AuthoritativeSourceField = "gProdOrRotLineDescription" | "gProdOrRotLineNo" | "machineCenterNo";
export type AuthoritativeMappingType = "EXACT_SOURCE_VALUE" | "REVIEWED_SOURCE_ALIAS" | "FALLBACK_MACHINE_CENTER";
export type AuthoritativeConfidence = "HIGH" | "MEDIUM" | "LOW";
export type AuthoritativeTargetApprovalStatus = "approved" | "draft" | "deprecated";

export interface AuthoritativeCanonicalEntityInputRow {
  readonly canonical_entity_code?: string;
  readonly canonical_entity_display_name?: string;
  readonly entity_family?: string;
  readonly entity_type?: string;
  readonly production_area?: string;
  readonly is_active?: string;
  readonly source_of_truth_status?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
}

export interface AuthoritativeSourceToEntityMapInputRow {
  readonly source_system?: string;
  readonly source_field?: string;
  readonly source_value?: string;
  readonly canonical_entity_code?: string;
  readonly mapping_type?: string;
  readonly confidence?: string;
  readonly is_active?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
}

export interface AuthoritativeTargetProfileInputRow {
  readonly canonical_entity_code?: string;
  readonly target_bucket?: string;
  readonly machine_center_no?: string;
  readonly target_qty?: string;
  readonly unit?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
  readonly is_active?: string;
  readonly approval_status?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
}

export interface AuthoritativeBcCoverageInputRow {
  readonly source_field?: string;
  readonly source_value?: string;
  readonly g_prod_or_rot_line_description?: string;
  readonly g_prod_or_rot_line_no?: string;
  readonly machine_center_no?: string;
  readonly current_entity_code?: string;
  readonly proposed_canonical_entity_code?: string;
  readonly v2_entity_code?: string;
  readonly resolver_v2_entity_code?: string;
  readonly bc_current_kpi_scope?: string;
  readonly document_no?: string;
  readonly item_no?: string;
  readonly target_bucket?: string;
  readonly resolver_v2_target_bucket_candidate?: string;
  readonly v2_target_bucket_candidate?: string;
}

export interface AuthoritativeNormalizedCanonicalEntityRow {
  readonly canonical_entity_code: string;
  readonly canonical_entity_display_name: string;
  readonly entity_family: string;
  readonly entity_type: string;
  readonly production_area: string;
  readonly is_active: "true" | "false";
  readonly source_of_truth_status: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly effective_from: string;
  readonly effective_to: string;
}

export interface AuthoritativeNormalizedSourceMapRow {
  readonly source_system: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly mapping_type: string;
  readonly confidence: string;
  readonly is_active: "true" | "false";
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly effective_from: string;
  readonly effective_to: string;
}

export interface AuthoritativeNormalizedTargetProfileRow {
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly target_qty: string;
  readonly unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly is_active: "true" | "false";
  readonly approval_status: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeMasterValidationIssueRow {
  readonly issue_id: string;
  readonly severity: "ERROR" | "WARNING";
  readonly record_type: "CANONICAL_ENTITY" | "SOURCE_TO_ENTITY_MAP" | "TARGET_PROFILE";
  readonly row_number: number;
  readonly field: string;
  readonly issue_code: string;
  readonly issue_message: string;
  readonly required_action: string;
}

export interface AuthoritativeSourceCoveragePreviewRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly rows: number;
  readonly authoritative_status: "MAPPED" | "UNMAPPED" | "SOURCE_DATA_GAP";
  readonly canonical_entity_code: string;
  readonly bc_scopes: string;
  readonly current_entity_codes_legacy_evidence: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeTargetProfileCoveragePreviewRow {
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly rows: number;
  readonly coverage_status: "COVERED" | "MISSING_TARGET_PROFILE" | "UNMAPPED_ENTITY";
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeLegacyConflictEvidenceRow {
  readonly evidence_id: string;
  readonly source_field: string;
  readonly source_value: string;
  readonly rows: number;
  readonly current_entity_codes_legacy_evidence: string;
  readonly proposed_legacy_entity_codes: string;
  readonly conflict_reason: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeUnmappedSourceValueRow {
  readonly source_field: string;
  readonly source_value: string;
  readonly rows: number;
  readonly bc_scopes: string;
  readonly current_entity_codes_legacy_evidence: string;
  readonly sample_documents: string;
  readonly sample_items: string;
}

export interface AuthoritativeMasterTemplatesManifest {
  readonly generatedAt: string;
  readonly inputFolder: string;
  readonly templates: readonly string[];
  readonly workingFiles: readonly string[];
  readonly note: string;
}

export interface AuthoritativeMasterIntakeSummary {
  readonly generatedAt: string;
  readonly inputFolder: string;
  readonly outputFolder: string;
  readonly intakeStatus: AuthoritativeMasterIntakeStatus;
  readonly canonicalEntityRows: number;
  readonly activeCanonicalEntityRows: number;
  readonly approvedCanonicalEntityRows: number;
  readonly sourceMappingRows: number;
  readonly activeSourceMappingRows: number;
  readonly targetProfileRows: number;
  readonly activeTargetProfileRows: number;
  readonly validationErrorRows: number;
  readonly validationWarningRows: number;
  readonly coveragePreview: {
    readonly totalBcRows: number;
    readonly outputKpiOkScopeRows: number;
    readonly outputKpiRejectScopeRows: number;
    readonly outOfCurrentKpiScopeRows: number;
    readonly unknownScopeReviewRows: number;
    readonly authoritativeMappedRows: number;
    readonly authoritativeUnmappedRows: number;
    readonly sourceDataGapRows: number;
    readonly rejectMappedRows: number;
    readonly outputOkMappedRows: number;
    readonly targetProfileCoveredRows: number;
    readonly targetProfileMissingRows: number;
  };
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly dashboardChanged: false;
    readonly p10Enabled: false;
    readonly masterDataApplied: false;
  };
}

export interface AuthoritativeMasterTemplateRows {
  readonly canonicalEntities: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  readonly sourceToEntityMap: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly targetProfiles: readonly AuthoritativeNormalizedTargetProfileRow[];
}

const allowedEntityTypes = new Set(["MACHINE", "LINE", "WORK_CENTER", "PROCESS", "OTHER"]);
const allowedSourceStatuses = new Set(["approved", "draft", "deprecated"]);
const allowedBooleanValues = new Set(["true", "false"]);
const allowedSourceSystems = new Set(["business-central"]);
const allowedSourceFields = new Set(["gProdOrRotLineDescription", "gProdOrRotLineNo", "machineCenterNo"]);
const allowedMappingTypes = new Set(["EXACT_SOURCE_VALUE", "REVIEWED_SOURCE_ALIAS", "FALLBACK_MACHINE_CENTER"]);
const allowedConfidenceValues = new Set(["HIGH", "MEDIUM", "LOW"]);
const allowedTargetApprovalStatuses = new Set(["approved", "draft", "deprecated"]);
const broadUnsafeSourceValues = new Set(["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"]);

export const authoritativeMasterInputCsvHeaders = {
  canonicalEntities: [
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
    "effective_to"
  ] as const satisfies readonly (keyof AuthoritativeNormalizedCanonicalEntityRow)[],
  sourceToEntityMap: [
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
    "effective_to"
  ] as const satisfies readonly (keyof AuthoritativeNormalizedSourceMapRow)[],
  targetProfiles: [
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
    "reviewer_notes"
  ] as const satisfies readonly (keyof AuthoritativeNormalizedTargetProfileRow)[]
} as const;

export function buildAuthoritativeMasterIntake(input: {
  readonly canonicalEntityRows: readonly AuthoritativeCanonicalEntityInputRow[];
  readonly sourceMappingRows: readonly AuthoritativeSourceToEntityMapInputRow[];
  readonly targetProfileRows: readonly AuthoritativeTargetProfileInputRow[];
  readonly bcCoverageRows?: readonly AuthoritativeBcCoverageInputRow[];
  readonly targetProfileCoverageRows?: readonly AuthoritativeBcCoverageInputRow[];
  readonly inputFilesExist: boolean;
  readonly generatedAt?: string;
  readonly inputFolder: string;
  readonly outputFolder: string;
}): {
  readonly summary: AuthoritativeMasterIntakeSummary;
  readonly canonicalEntitiesNormalizedRows: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  readonly sourceToEntityMapNormalizedRows: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly targetProfilesNormalizedRows: readonly AuthoritativeNormalizedTargetProfileRow[];
  readonly validationErrorRows: readonly AuthoritativeMasterValidationIssueRow[];
  readonly validationWarningRows: readonly AuthoritativeMasterValidationIssueRow[];
  readonly sourceCoveragePreviewRows: readonly AuthoritativeSourceCoveragePreviewRow[];
  readonly targetProfileCoveragePreviewRows: readonly AuthoritativeTargetProfileCoveragePreviewRow[];
  readonly legacyConflictEvidenceRows: readonly AuthoritativeLegacyConflictEvidenceRow[];
  readonly unmappedSourceValueRows: readonly AuthoritativeUnmappedSourceValueRow[];
  readonly templateRows: AuthoritativeMasterTemplateRows;
  readonly templatesManifest: AuthoritativeMasterTemplatesManifest;
} {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const canonicalRows = input.canonicalEntityRows.map(normalizeCanonicalRow);
  const sourceRows = input.sourceMappingRows.map(normalizeSourceMapRow);
  const targetRows = input.targetProfileRows.map(normalizeTargetProfileRow);
  const totalInputRows = canonicalRows.length + sourceRows.length + targetRows.length;
  const issues = validateRows(canonicalRows, sourceRows, targetRows);
  const validationErrorRows = issues.filter((issue) => issue.severity === "ERROR").map((issue, index) => ({
    ...issue,
    issue_id: `E${String(index + 1).padStart(5, "0")}`
  }));
  const validationWarningRows = issues.filter((issue) => issue.severity === "WARNING").map((issue, index) => ({
    ...issue,
    issue_id: `W${String(index + 1).padStart(5, "0")}`
  }));
  const activeApprovedEntityCodes = new Set(canonicalRows
    .filter((row) => row.is_active === "true" && row.source_of_truth_status === "approved")
    .map((row) => normalizeKey(row.canonical_entity_code)));
  const activeSourceMappings = sourceRows.filter((row) => row.is_active === "true");
  const coverage = buildCoveragePreview({
    bcRows: input.bcCoverageRows ?? [],
    targetRows: input.targetProfileCoverageRows ?? input.bcCoverageRows ?? [],
    activeSourceMappings,
    activeTargetProfiles: targetRows.filter((row) => row.is_active === "true" && row.approval_status === "approved"),
    activeApprovedEntityCodes
  });
  const intakeStatus: AuthoritativeMasterIntakeStatus = totalInputRows === 0 || !input.inputFilesExist
    ? "AWAITING_MASTER_INPUT"
    : validationErrorRows.length > 0
      ? "INVALID"
      : validationWarningRows.length > 0
        ? "VALID_WITH_WARNINGS"
        : "VALID";
  const p10Reason = intakeStatus === "AWAITING_MASTER_INPUT"
    ? "P1.0 remains blocked: authoritative master input is missing."
    : intakeStatus === "INVALID"
      ? `P1.0 remains blocked: authoritative master validation has ${validationErrorRows.length} error rows.`
      : intakeStatus === "VALID_WITH_WARNINGS"
        ? `P1.0 remains blocked: authoritative master validation has ${validationWarningRows.length} warning rows and this command does not apply master data.`
        : "P1.0 remains blocked: authoritative master intake is valid, but this command does not apply master data or enable P1.0.";

  const summary: AuthoritativeMasterIntakeSummary = {
    generatedAt,
    inputFolder: input.inputFolder,
    outputFolder: input.outputFolder,
    intakeStatus,
    canonicalEntityRows: canonicalRows.length,
    activeCanonicalEntityRows: canonicalRows.filter((row) => row.is_active === "true").length,
    approvedCanonicalEntityRows: canonicalRows.filter((row) => row.source_of_truth_status === "approved").length,
    sourceMappingRows: sourceRows.length,
    activeSourceMappingRows: activeSourceMappings.length,
    targetProfileRows: targetRows.length,
    activeTargetProfileRows: targetRows.filter((row) => row.is_active === "true").length,
    validationErrorRows: validationErrorRows.length,
    validationWarningRows: validationWarningRows.length,
    coveragePreview: coverage.summary,
    p10Gate: {
      status: "BLOCKED",
      reason: p10Reason
    },
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      aliasesChanged: false,
      conditionalRulesChanged: false,
      dashboardChanged: false,
      p10Enabled: false,
      masterDataApplied: false
    }
  };

  return {
    summary,
    canonicalEntitiesNormalizedRows: canonicalRows,
    sourceToEntityMapNormalizedRows: sourceRows,
    targetProfilesNormalizedRows: targetRows,
    validationErrorRows,
    validationWarningRows,
    sourceCoveragePreviewRows: coverage.sourceCoveragePreviewRows,
    targetProfileCoveragePreviewRows: coverage.targetProfileCoveragePreviewRows,
    legacyConflictEvidenceRows: coverage.legacyConflictEvidenceRows,
    unmappedSourceValueRows: coverage.unmappedSourceValueRows,
    templateRows: emptyTemplateRows(),
    templatesManifest: {
      generatedAt,
      inputFolder: input.inputFolder,
      templates: [
        "canonical-entities.template.csv",
        "source-to-entity-map.template.csv",
        "target-profiles.template.csv"
      ],
      workingFiles: [
        "canonical-entities.csv",
        "source-to-entity-map.csv",
        "target-profiles.csv"
      ],
      note: "Templates are blank by design and do not approve or apply any master data."
    }
  };
}

function validateRows(
  canonicalRows: readonly AuthoritativeNormalizedCanonicalEntityRow[],
  sourceRows: readonly AuthoritativeNormalizedSourceMapRow[],
  targetRows: readonly AuthoritativeNormalizedTargetProfileRow[]
): readonly Omit<AuthoritativeMasterValidationIssueRow, "issue_id">[] {
  const issues: Omit<AuthoritativeMasterValidationIssueRow, "issue_id">[] = [];
  const entityByCode = new Map<string, AuthoritativeNormalizedCanonicalEntityRow>();
  const activeEntityCounts = new Map<string, number>();

  canonicalRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const key = normalizeKey(row.canonical_entity_code);
    if (!row.canonical_entity_code) addError(issues, "CANONICAL_ENTITY", rowNumber, "canonical_entity_code", "CANONICAL_CODE_REQUIRED", "canonical_entity_code is required.", "Provide a stable authoritative canonical entity code.");
    if (row.entity_type && !allowedEntityTypes.has(row.entity_type)) addError(issues, "CANONICAL_ENTITY", rowNumber, "entity_type", "ENTITY_TYPE_NOT_ALLOWED", "entity_type is not allowed.", "Use MACHINE, LINE, WORK_CENTER, PROCESS, or OTHER.");
    if (row.source_of_truth_status && !allowedSourceStatuses.has(row.source_of_truth_status)) addError(issues, "CANONICAL_ENTITY", rowNumber, "source_of_truth_status", "SOURCE_OF_TRUTH_STATUS_NOT_ALLOWED", "source_of_truth_status is not allowed.", "Use approved, draft, or deprecated.");
    if (!allowedBooleanValues.has(row.is_active)) addError(issues, "CANONICAL_ENTITY", rowNumber, "is_active", "IS_ACTIVE_NOT_ALLOWED", "is_active must be true or false.", "Set is_active to true or false.");
    if (row.source_of_truth_status === "approved") {
      if (!row.canonical_entity_display_name) addError(issues, "CANONICAL_ENTITY", rowNumber, "canonical_entity_display_name", "APPROVED_ENTITY_REQUIRES_DISPLAY_NAME", "Approved canonical entity requires a display name.", "Provide canonical_entity_display_name before approval.");
      if (!row.reviewer) addError(issues, "CANONICAL_ENTITY", rowNumber, "reviewer", "APPROVED_ENTITY_REQUIRES_REVIEWER", "Approved canonical entity requires reviewer.", "Provide reviewer before approval.");
      if (!row.reviewer_notes) addWarning(issues, "CANONICAL_ENTITY", rowNumber, "reviewer_notes", "APPROVED_ENTITY_REVIEWER_NOTES_RECOMMENDED", "Approved canonical entity should include reviewer_notes.", "Add reviewer_notes explaining the authoritative decision.");
    }
    if (key) {
      if (!entityByCode.has(key)) entityByCode.set(key, row);
      if (row.is_active === "true") activeEntityCounts.set(key, (activeEntityCounts.get(key) ?? 0) + 1);
    }
  });

  for (const [key, count] of activeEntityCounts.entries()) {
    if (count > 1) {
      canonicalRows.forEach((row, index) => {
        if (row.is_active === "true" && normalizeKey(row.canonical_entity_code) === key) {
          addError(issues, "CANONICAL_ENTITY", index + 2, "canonical_entity_code", "DUPLICATE_ACTIVE_CANONICAL_ENTITY", "Active canonical_entity_code must be unique.", "Keep one active row per canonical entity code.");
        }
      });
    }
  }

  const activeSourceKeyCounts = new Map<string, number>();
  const activeSourceKeyCanonicals = new Map<string, Set<string>>();
  sourceRows.forEach((row) => {
    if (row.is_active !== "true") return;
    const key = sourceKey(row);
    activeSourceKeyCounts.set(key, (activeSourceKeyCounts.get(key) ?? 0) + 1);
    const canonicalSet = activeSourceKeyCanonicals.get(key) ?? new Set<string>();
    canonicalSet.add(normalizeKey(row.canonical_entity_code));
    activeSourceKeyCanonicals.set(key, canonicalSet);
  });

  sourceRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const entity = entityByCode.get(normalizeKey(row.canonical_entity_code));
    if (!row.source_system) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_system", "SOURCE_SYSTEM_REQUIRED", "source_system is required.", "Use business-central.");
    if (row.source_system && !allowedSourceSystems.has(row.source_system)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_system", "SOURCE_SYSTEM_NOT_ALLOWED", "source_system must be business-central.", "Use business-central.");
    if (!row.source_field) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_field", "SOURCE_FIELD_REQUIRED", "source_field is required.", "Use a supported Business Central source field.");
    if (row.source_field && !allowedSourceFields.has(row.source_field)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_field", row.source_field.toLowerCase().includes("current") ? "CURRENT_ENTITY_NOT_SOURCE_OF_TRUTH" : "SOURCE_FIELD_NOT_ALLOWED", "source_field is not an authoritative source field.", "Use gProdOrRotLineDescription, gProdOrRotLineNo, or machineCenterNo.");
    if (!row.source_value || isBlankSourceValue(row.source_value)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_value", "SOURCE_VALUE_REQUIRED", "source_value is required and cannot be blank/UNMAPPED.", "Provide an exact reviewed source value.");
    if (broadUnsafeSourceValues.has(normalizeKey(row.source_value))) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_value", "BROAD_FAMILY_SOURCE_VALUE_INVALID", "Broad family-only source values are unsafe.", "Map exact reviewed source values only; never create broad/global aliases.");
    if (!row.canonical_entity_code || !entity) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "canonical_entity_code", "MAPPING_CANONICAL_ENTITY_MISSING", "Source mapping references a missing canonical entity.", "Add and approve the canonical entity before mapping this source.");
    if (entity && row.is_active === "true" && entity.is_active !== "true") addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "canonical_entity_code", "ACTIVE_MAPPING_TO_INACTIVE_ENTITY", "Active source mapping points to inactive canonical entity.", "Point active mappings only to active canonical entities.");
    if (entity && row.is_active === "true" && entity.source_of_truth_status === "deprecated") addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "canonical_entity_code", "ACTIVE_MAPPING_TO_DEPRECATED_ENTITY", "Active source mapping points to deprecated canonical entity.", "Use an approved active canonical entity.");
    if (row.mapping_type && !allowedMappingTypes.has(row.mapping_type)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "mapping_type", "MAPPING_TYPE_NOT_ALLOWED", "mapping_type is not allowed.", "Use EXACT_SOURCE_VALUE, REVIEWED_SOURCE_ALIAS, or FALLBACK_MACHINE_CENTER.");
    if (row.confidence && !allowedConfidenceValues.has(row.confidence)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "confidence", "CONFIDENCE_NOT_ALLOWED", "confidence is not allowed.", "Use HIGH, MEDIUM, or LOW.");
    if (!allowedBooleanValues.has(row.is_active)) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "is_active", "IS_ACTIVE_NOT_ALLOWED", "is_active must be true or false.", "Set is_active to true or false.");
    if (row.source_field === "machineCenterNo" && row.mapping_type !== "FALLBACK_MACHINE_CENTER") addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "mapping_type", "MACHINE_CENTER_REQUIRES_FALLBACK_MAPPING", "machineCenterNo is fallback only and requires FALLBACK_MACHINE_CENTER.", "Use FALLBACK_MACHINE_CENTER or prefer gProdOrRotLineDescription.");
    if (row.source_field === "machineCenterNo" && row.confidence === "HIGH" && !hasFallbackJustification(row.reviewer_notes)) addWarning(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "confidence", "MACHINE_CENTER_HIGH_CONFIDENCE_NEEDS_JUSTIFICATION", "machineCenterNo HIGH confidence should be justified in reviewer_notes.", "Add explicit fallback justification or lower confidence.");
    if (row.is_active === "true") {
      const key = sourceKey(row);
      if ((activeSourceKeyCounts.get(key) ?? 0) > 1) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "source_value", "DUPLICATE_ACTIVE_SOURCE_MAPPING", "Duplicate active source mapping exists for the same source key.", "Keep one active mapping per source system, source field, and source value.");
      if ((activeSourceKeyCanonicals.get(key)?.size ?? 0) > 1) addError(issues, "SOURCE_TO_ENTITY_MAP", rowNumber, "canonical_entity_code", "CONFLICTING_ACTIVE_SOURCE_MAPPING", "Same active source key maps to multiple canonical entities.", "Resolve to one reviewed canonical entity.");
    }
  });

  const activeTargetKeys = new Map<string, number>();
  targetRows.forEach((row) => {
    if (row.is_active !== "true") return;
    const key = [normalizeKey(row.canonical_entity_code), normalizeKey(row.target_bucket), normalizeKey(row.machine_center_no), row.effective_from, row.effective_to].join("|");
    activeTargetKeys.set(key, (activeTargetKeys.get(key) ?? 0) + 1);
  });
  targetRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const entity = entityByCode.get(normalizeKey(row.canonical_entity_code));
    if (!row.canonical_entity_code || !entity) addError(issues, "TARGET_PROFILE", rowNumber, "canonical_entity_code", "TARGET_PROFILE_CANONICAL_ENTITY_MISSING", "Target profile references a missing canonical entity.", "Add and approve the canonical entity before target profile review.");
    if (entity && (entity.is_active !== "true" || entity.source_of_truth_status !== "approved")) addError(issues, "TARGET_PROFILE", rowNumber, "canonical_entity_code", "TARGET_PROFILE_REQUIRES_APPROVED_ACTIVE_ENTITY", "Target profile must reference an approved active canonical entity.", "Use an approved active canonical entity.");
    if (!allowedBooleanValues.has(row.is_active)) addError(issues, "TARGET_PROFILE", rowNumber, "is_active", "IS_ACTIVE_NOT_ALLOWED", "is_active must be true or false.", "Set is_active to true or false.");
    if (row.approval_status && !allowedTargetApprovalStatuses.has(row.approval_status)) addError(issues, "TARGET_PROFILE", rowNumber, "approval_status", "TARGET_APPROVAL_STATUS_NOT_ALLOWED", "approval_status is not allowed.", "Use approved, draft, or deprecated.");
    if (row.is_active === "true" && row.approval_status === "approved") {
      if (!row.target_bucket) addError(issues, "TARGET_PROFILE", rowNumber, "target_bucket", "APPROVED_TARGET_REQUIRES_BUCKET", "Approved active target profile requires target_bucket.", "Provide target_bucket.");
      if (!row.target_qty) addError(issues, "TARGET_PROFILE", rowNumber, "target_qty", "APPROVED_TARGET_REQUIRES_QTY", "Approved active target profile requires target_qty.", "Provide a positive numeric target_qty.");
      if (!row.unit) addError(issues, "TARGET_PROFILE", rowNumber, "unit", "APPROVED_TARGET_REQUIRES_UNIT", "Approved active target profile requires unit.", "Provide unit.");
      if (!row.effective_from) addError(issues, "TARGET_PROFILE", rowNumber, "effective_from", "APPROVED_TARGET_REQUIRES_EFFECTIVE_FROM", "Approved active target profile requires effective_from.", "Provide effective_from.");
      if (!row.reviewer) addError(issues, "TARGET_PROFILE", rowNumber, "reviewer", "APPROVED_TARGET_REQUIRES_REVIEWER", "Approved active target profile requires reviewer.", "Provide reviewer.");
      const qty = Number(row.target_qty);
      if (!Number.isFinite(qty) || qty <= 0) addError(issues, "TARGET_PROFILE", rowNumber, "target_qty", "TARGET_QTY_MUST_BE_POSITIVE_NUMERIC", "target_qty must be positive numeric.", "Provide a positive numeric target_qty.");
    }
    if (row.is_active === "true") {
      const key = [normalizeKey(row.canonical_entity_code), normalizeKey(row.target_bucket), normalizeKey(row.machine_center_no), row.effective_from, row.effective_to].join("|");
      if ((activeTargetKeys.get(key) ?? 0) > 1) addError(issues, "TARGET_PROFILE", rowNumber, "effective_from", "OVERLAPPING_ACTIVE_TARGET_PROFILE", "Duplicate active target profile exists for the same canonical/bucket/machine/effective range.", "Keep one active target profile for each canonical/bucket/machine/effective range.");
    }
  });

  return issues;
}

function buildCoveragePreview(input: {
  readonly bcRows: readonly AuthoritativeBcCoverageInputRow[];
  readonly targetRows: readonly AuthoritativeBcCoverageInputRow[];
  readonly activeSourceMappings: readonly AuthoritativeNormalizedSourceMapRow[];
  readonly activeTargetProfiles: readonly AuthoritativeNormalizedTargetProfileRow[];
  readonly activeApprovedEntityCodes: ReadonlySet<string>;
}) {
  const sourceMap = new Map(input.activeSourceMappings.map((row) => [coverageSourceKey(row.source_field, row.source_value), row]));
  const targetProfileKeys = new Set(input.activeTargetProfiles.map((row) => targetProfileKey(row.canonical_entity_code, row.target_bucket, row.machine_center_no)));
  let authoritativeMappedRows = 0;
  let authoritativeUnmappedRows = 0;
  let sourceDataGapRows = 0;
  let rejectMappedRows = 0;
  let outputOkMappedRows = 0;
  const sourceGroups = new Map<string, CoverageGroup>();
  const legacyGroups = new Map<string, CoverageGroup>();

  for (const row of input.bcRows) {
    const source = preferredSource(row);
    const key = coverageSourceKey(source.field, source.value);
    const scope = clean(row.bc_current_kpi_scope);
    const group = sourceGroups.get(key) ?? emptyCoverageGroup(source.field, source.value);
    group.rows += 1;
    addSet(group.scopes, scope);
    addSet(group.currentEntityCodes, clean(row.current_entity_code));
    addSet(group.sampleDocuments, clean(row.document_no), 3);
    addSet(group.sampleItems, clean(row.item_no), 3);
    sourceGroups.set(key, group);
    const isGap = !source.value || isBlankSourceValue(source.value);
    const mapping = sourceMap.get(key);
    if (isGap) {
      sourceDataGapRows += 1;
      authoritativeUnmappedRows += 1;
    } else if (mapping) {
      authoritativeMappedRows += 1;
      if (scope === "OUTPUT_KPI_REJECT_SCOPE") rejectMappedRows += 1;
      if (scope === "OUTPUT_KPI_OK_SCOPE") outputOkMappedRows += 1;
    } else {
      authoritativeUnmappedRows += 1;
    }
    const legacyCode = clean(row.current_entity_code);
    const proposedCode = clean(row.proposed_canonical_entity_code) || clean(row.v2_entity_code) || clean(row.resolver_v2_entity_code);
    if (legacyCode && proposedCode && normalizeKey(legacyCode) !== normalizeKey(proposedCode)) {
      const legacyKey = [source.field, normalizeKey(source.value), normalizeKey(legacyCode), normalizeKey(proposedCode)].join("|");
      const legacy = legacyGroups.get(legacyKey) ?? emptyCoverageGroup(source.field, source.value);
      legacy.rows += 1;
      addSet(legacy.currentEntityCodes, legacyCode);
      addSet(legacy.proposedEntityCodes, proposedCode);
      addSet(legacy.sampleDocuments, clean(row.document_no), 3);
      addSet(legacy.sampleItems, clean(row.item_no), 3);
      legacyGroups.set(legacyKey, legacy);
    }
  }

  const sourceCoveragePreviewRows = [...sourceGroups.values()]
    .sort((a, b) => b.rows - a.rows)
    .slice(0, 200)
    .map((group): AuthoritativeSourceCoveragePreviewRow => {
      const key = coverageSourceKey(group.sourceField, group.sourceValue);
      const mapping = sourceMap.get(key);
      const status = !group.sourceValue || isBlankSourceValue(group.sourceValue)
        ? "SOURCE_DATA_GAP"
        : mapping
          ? "MAPPED"
          : "UNMAPPED";
      return {
        source_field: group.sourceField,
        source_value: group.sourceValue || "(blank)",
        rows: group.rows,
        authoritative_status: status,
        canonical_entity_code: mapping?.canonical_entity_code ?? "",
        bc_scopes: [...group.scopes].join("|"),
        current_entity_codes_legacy_evidence: [...group.currentEntityCodes].join("|"),
        sample_documents: [...group.sampleDocuments].join("|"),
        sample_items: [...group.sampleItems].join("|")
      };
    });

  let targetProfileCoveredRows = 0;
  let targetProfileMissingRows = 0;
  const targetGroups = new Map<string, CoverageGroup>();
  for (const row of input.targetRows) {
    const source = preferredSource(row);
    const mapping = sourceMap.get(coverageSourceKey(source.field, source.value));
    const canonical = mapping?.canonical_entity_code ?? "";
    const bucket = clean(row.target_bucket) || clean(row.resolver_v2_target_bucket_candidate) || clean(row.v2_target_bucket_candidate);
    const machine = clean(row.machine_center_no);
    const key = [normalizeKey(canonical), normalizeKey(bucket), normalizeKey(machine)].join("|");
    const group = targetGroups.get(key) ?? emptyCoverageGroup(canonical, bucket);
    group.sourceField = canonical;
    group.sourceValue = bucket;
    group.machineCenterNo = machine;
    group.rows += 1;
    addSet(group.sampleDocuments, clean(row.document_no), 3);
    addSet(group.sampleItems, clean(row.item_no), 3);
    targetGroups.set(key, group);
    if (canonical && input.activeApprovedEntityCodes.has(normalizeKey(canonical)) && targetProfileKeys.has(targetProfileKey(canonical, bucket, machine))) {
      targetProfileCoveredRows += 1;
    } else {
      targetProfileMissingRows += 1;
    }
  }

  const targetProfileCoveragePreviewRows = [...targetGroups.values()]
    .sort((a, b) => b.rows - a.rows)
    .slice(0, 200)
    .map((group): AuthoritativeTargetProfileCoveragePreviewRow => {
      const canonical = group.sourceField;
      const bucket = group.sourceValue;
      const covered = canonical && input.activeApprovedEntityCodes.has(normalizeKey(canonical)) && targetProfileKeys.has(targetProfileKey(canonical, bucket, group.machineCenterNo));
      return {
        canonical_entity_code: canonical,
        target_bucket: bucket,
        machine_center_no: group.machineCenterNo,
        rows: group.rows,
        coverage_status: !canonical ? "UNMAPPED_ENTITY" : covered ? "COVERED" : "MISSING_TARGET_PROFILE",
        sample_documents: [...group.sampleDocuments].join("|"),
        sample_items: [...group.sampleItems].join("|")
      };
    });

  return {
    summary: {
      totalBcRows: input.bcRows.length,
      outputKpiOkScopeRows: input.bcRows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_OK_SCOPE").length,
      outputKpiRejectScopeRows: input.bcRows.filter((row) => row.bc_current_kpi_scope === "OUTPUT_KPI_REJECT_SCOPE").length,
      outOfCurrentKpiScopeRows: input.bcRows.filter((row) => row.bc_current_kpi_scope === "OUT_OF_CURRENT_KPI_SCOPE").length,
      unknownScopeReviewRows: input.bcRows.filter((row) => row.bc_current_kpi_scope === "UNKNOWN_SCOPE_REVIEW").length,
      authoritativeMappedRows,
      authoritativeUnmappedRows,
      sourceDataGapRows,
      rejectMappedRows,
      outputOkMappedRows,
      targetProfileCoveredRows,
      targetProfileMissingRows
    },
    sourceCoveragePreviewRows,
    targetProfileCoveragePreviewRows,
    legacyConflictEvidenceRows: [...legacyGroups.values()]
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 200)
      .map((group, index): AuthoritativeLegacyConflictEvidenceRow => ({
        evidence_id: `L${String(index + 1).padStart(5, "0")}`,
        source_field: group.sourceField,
        source_value: group.sourceValue || "(blank)",
        rows: group.rows,
        current_entity_codes_legacy_evidence: [...group.currentEntityCodes].join("|"),
        proposed_legacy_entity_codes: [...group.proposedEntityCodes].join("|"),
        conflict_reason: "Legacy current entity differs from resolver/report evidence; record as conflict evidence only, not source of truth.",
        sample_documents: [...group.sampleDocuments].join("|"),
        sample_items: [...group.sampleItems].join("|")
      })),
    unmappedSourceValueRows: sourceCoveragePreviewRows
      .filter((row) => row.authoritative_status !== "MAPPED")
      .map((row): AuthoritativeUnmappedSourceValueRow => ({
        source_field: row.source_field,
        source_value: row.source_value,
        rows: row.rows,
        bc_scopes: row.bc_scopes,
        current_entity_codes_legacy_evidence: row.current_entity_codes_legacy_evidence,
        sample_documents: row.sample_documents,
        sample_items: row.sample_items
      }))
  };
}

function normalizeCanonicalRow(row: AuthoritativeCanonicalEntityInputRow): AuthoritativeNormalizedCanonicalEntityRow {
  return {
    canonical_entity_code: clean(row.canonical_entity_code),
    canonical_entity_display_name: clean(row.canonical_entity_display_name),
    entity_family: clean(row.entity_family),
    entity_type: clean(row.entity_type).toUpperCase(),
    production_area: clean(row.production_area),
    is_active: normalizeBoolean(row.is_active),
    source_of_truth_status: clean(row.source_of_truth_status).toLowerCase(),
    reviewer: clean(row.reviewer),
    reviewer_notes: clean(row.reviewer_notes),
    effective_from: clean(row.effective_from),
    effective_to: clean(row.effective_to)
  };
}

function normalizeSourceMapRow(row: AuthoritativeSourceToEntityMapInputRow): AuthoritativeNormalizedSourceMapRow {
  return {
    source_system: clean(row.source_system).toLowerCase(),
    source_field: clean(row.source_field),
    source_value: clean(row.source_value),
    canonical_entity_code: clean(row.canonical_entity_code),
    mapping_type: clean(row.mapping_type).toUpperCase(),
    confidence: clean(row.confidence).toUpperCase(),
    is_active: normalizeBoolean(row.is_active),
    reviewer: clean(row.reviewer),
    reviewer_notes: clean(row.reviewer_notes),
    effective_from: clean(row.effective_from),
    effective_to: clean(row.effective_to)
  };
}

function normalizeTargetProfileRow(row: AuthoritativeTargetProfileInputRow): AuthoritativeNormalizedTargetProfileRow {
  return {
    canonical_entity_code: clean(row.canonical_entity_code),
    target_bucket: clean(row.target_bucket),
    machine_center_no: clean(row.machine_center_no),
    target_qty: clean(row.target_qty),
    unit: clean(row.unit),
    effective_from: clean(row.effective_from),
    effective_to: clean(row.effective_to),
    is_active: normalizeBoolean(row.is_active),
    approval_status: clean(row.approval_status).toLowerCase(),
    reviewer: clean(row.reviewer),
    reviewer_notes: clean(row.reviewer_notes)
  };
}

function emptyTemplateRows(): AuthoritativeMasterTemplateRows {
  return {
    canonicalEntities: [],
    sourceToEntityMap: [],
    targetProfiles: []
  };
}

function addError(
  issues: Omit<AuthoritativeMasterValidationIssueRow, "issue_id">[],
  recordType: AuthoritativeMasterValidationIssueRow["record_type"],
  rowNumber: number,
  field: string,
  code: string,
  message: string,
  requiredAction: string
) {
  issues.push({ severity: "ERROR", record_type: recordType, row_number: rowNumber, field, issue_code: code, issue_message: message, required_action: requiredAction });
}

function addWarning(
  issues: Omit<AuthoritativeMasterValidationIssueRow, "issue_id">[],
  recordType: AuthoritativeMasterValidationIssueRow["record_type"],
  rowNumber: number,
  field: string,
  code: string,
  message: string,
  requiredAction: string
) {
  issues.push({ severity: "WARNING", record_type: recordType, row_number: rowNumber, field, issue_code: code, issue_message: message, required_action: requiredAction });
}

function preferredSource(row: AuthoritativeBcCoverageInputRow): { field: string; value: string } {
  const desc = clean(row.g_prod_or_rot_line_description);
  if (desc) return { field: "gProdOrRotLineDescription", value: desc };
  const lineNo = clean(row.g_prod_or_rot_line_no);
  if (lineNo) return { field: "gProdOrRotLineNo", value: lineNo };
  const sourceField = clean(row.source_field);
  const sourceValue = clean(row.source_value);
  if (sourceField && sourceValue) return { field: normalizeSourceField(sourceField), value: sourceValue };
  return { field: "machineCenterNo", value: clean(row.machine_center_no) };
}

function normalizeSourceField(value: string): string {
  if (value === "g_prod_or_rot_line_description") return "gProdOrRotLineDescription";
  if (value === "g_prod_or_rot_line_no") return "gProdOrRotLineNo";
  if (value === "machine_center_no") return "machineCenterNo";
  return value;
}

function sourceKey(row: Pick<AuthoritativeNormalizedSourceMapRow, "source_system" | "source_field" | "source_value">): string {
  return [row.source_system, row.source_field, normalizeKey(row.source_value)].join("|");
}

function coverageSourceKey(sourceField: string, sourceValue: string): string {
  return [sourceField, normalizeKey(sourceValue)].join("|");
}

function targetProfileKey(canonical: string, bucket: string, machine: string): string {
  return [normalizeKey(canonical), normalizeKey(bucket), normalizeKey(machine)].join("|");
}

function isBlankSourceValue(value: string): boolean {
  const key = normalizeKey(value);
  return key === "" || key === "(BLANK)" || key === "BLANK" || key === "UNMAPPED";
}

function hasFallbackJustification(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("justify") || lower.includes("justified") || lower.includes("fallback") || lower.includes("reviewed machine center");
}

function normalizeBoolean(value: string | undefined): "true" | "false" {
  const normalized = clean(value).toLowerCase();
  return normalized === "true" ? "true" : normalized === "false" ? "false" : (normalized as "true" | "false");
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

interface CoverageGroup {
  sourceField: string;
  sourceValue: string;
  machineCenterNo: string;
  rows: number;
  scopes: Set<string>;
  currentEntityCodes: Set<string>;
  proposedEntityCodes: Set<string>;
  sampleDocuments: Set<string>;
  sampleItems: Set<string>;
}

function emptyCoverageGroup(sourceField: string, sourceValue: string): CoverageGroup {
  return {
    sourceField,
    sourceValue,
    machineCenterNo: "",
    rows: 0,
    scopes: new Set<string>(),
    currentEntityCodes: new Set<string>(),
    proposedEntityCodes: new Set<string>(),
    sampleDocuments: new Set<string>(),
    sampleItems: new Set<string>()
  };
}

function addSet(set: Set<string>, value: string, limit = 20): void {
  if (!value || set.size >= limit) return;
  set.add(value);
}
