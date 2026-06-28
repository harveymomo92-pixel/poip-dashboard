import type { AuthoritativeMasterReviewerDecisionTemplateRow } from "./authoritative-master-review-workspace.js";

export type AuthoritativeReviewDecisionSampleFixtureStatus = "GENERATED" | "BLOCKED_MISSING_WORKSPACE";

export interface AuthoritativeReviewDecisionSampleRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approval_status: "pending" | "approved" | "rejected" | "deferred" | "needs_correction";
  readonly approved_action:
    | ""
    | "APPROVE_CANONICAL_ENTITY"
    | "APPROVE_SOURCE_MAPPING"
    | "APPROVE_REVIEWED_ALIAS"
    | "APPROVE_TARGET_PROFILE"
    | "REJECT_CANDIDATE"
    | "DEFER_REVIEW"
    | "SOURCE_DATA_BACKLOG"
    | "FUTURE_USE_ONLY"
    | "NEEDS_CORRECTION";
  readonly approved_canonical_entity_code: string;
  readonly approved_source_field: string;
  readonly approved_source_value: string;
  readonly approved_mapping_type: string;
  readonly approved_target_bucket: string;
  readonly approved_machine_center_no: string;
  readonly approved_target_qty: string;
  readonly approved_unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeReviewDecisionSampleExpectationRow {
  readonly fixture_file: string;
  readonly expected_total_rows: number;
  readonly expected_accepted_min: number;
  readonly expected_deferred_min: number;
  readonly expected_rejected_min: number;
  readonly expected_invalid_min: number;
  readonly expected_duplicate_min: number;
  readonly expected_unknown_min: number;
  readonly expected_p10_status: "BLOCKED";
  readonly expected_safety: "all_false";
}

export interface AuthoritativeReviewDecisionSampleFixtureSummary {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly sourceWorkspaceFolder: string;
  readonly fixtureStatus: AuthoritativeReviewDecisionSampleFixtureStatus;
  readonly sampleRows: number;
  readonly safeDeferRows: number;
  readonly mixedSimulationRows: number;
  readonly wroteConvenienceSampleFile: boolean;
  readonly overwroteRealReviewerDecisionFile: false;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: AuthoritativeReviewDecisionSampleFixtureSafety;
}

export interface AuthoritativeReviewDecisionSampleFixtureSafety {
  readonly databaseUpdated: false;
  readonly productionOutputsUpdated: false;
  readonly targetProfilesUpdated: false;
  readonly aliasesChanged: false;
  readonly authoritativeMasterApproved: false;
  readonly conditionalRulesChanged: false;
  readonly dashboardChanged: false;
  readonly p10Enabled: false;
}

export interface AuthoritativeReviewDecisionSampleFixtureResult {
  readonly summary: AuthoritativeReviewDecisionSampleFixtureSummary;
  readonly sampleRows: readonly AuthoritativeReviewDecisionSampleRow[];
  readonly safeDeferRows: readonly AuthoritativeReviewDecisionSampleRow[];
  readonly mixedSimulationRows: readonly AuthoritativeReviewDecisionSampleRow[];
  readonly sampleValidationExpectations: readonly AuthoritativeReviewDecisionSampleExpectationRow[];
  readonly importManifest: {
    readonly generatedAt: string;
    readonly sourceWorkspaceFolder: string;
    readonly fixtureFiles: readonly string[];
    readonly realReviewerDecisionFileWritten: false;
    readonly safety: AuthoritativeReviewDecisionSampleFixtureSafety;
  };
}

const testReviewer = "TEST_REVIEWER";
const testNote = "TEST_FIXTURE_DRY_RUN_ONLY";

export function buildAuthoritativeReviewDecisionSampleFixture(input: {
  readonly workspaceRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly wroteConvenienceSampleFile?: boolean;
  readonly generatedAt?: string;
}): AuthoritativeReviewDecisionSampleFixtureResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = safetyFlags();
  if (input.workspaceRows.length === 0) {
    return {
      summary: {
        generatedAt,
        outputFolder: input.outputFolder,
        sourceWorkspaceFolder: input.sourceWorkspaceFolder,
        fixtureStatus: "BLOCKED_MISSING_WORKSPACE",
        sampleRows: 0,
        safeDeferRows: 0,
        mixedSimulationRows: 0,
        wroteConvenienceSampleFile: false,
        overwroteRealReviewerDecisionFile: false,
        p10Gate: {
          status: "BLOCKED",
          reason: "P1.0 remains blocked: authoritative review workspace is missing."
        },
        safety
      },
      sampleRows: [],
      safeDeferRows: [],
      mixedSimulationRows: [],
      sampleValidationExpectations: [],
      importManifest: manifest(generatedAt, input.sourceWorkspaceFolder, safety)
    };
  }

  const byType = groupByType(input.workspaceRows);
  const safeDeferRows = pickSmallSet(input.workspaceRows).map((row) => deferRow(row, "safe defer fixture."));
  const sampleRows = buildSampleRows(byType);
  const mixedSimulationRows = buildMixedSimulationRows(byType);
  const sampleValidationExpectations = expectations(sampleRows, safeDeferRows, mixedSimulationRows);

  return {
    summary: {
      generatedAt,
      outputFolder: input.outputFolder,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      fixtureStatus: "GENERATED",
      sampleRows: sampleRows.length,
      safeDeferRows: safeDeferRows.length,
      mixedSimulationRows: mixedSimulationRows.length,
      wroteConvenienceSampleFile: Boolean(input.wroteConvenienceSampleFile),
      overwroteRealReviewerDecisionFile: false,
      p10Gate: {
        status: "BLOCKED",
        reason: "P1.0 remains blocked: generated reviewer decision fixtures are sample-only and not real approvals."
      },
      safety
    },
    sampleRows,
    safeDeferRows,
    mixedSimulationRows,
    sampleValidationExpectations,
    importManifest: manifest(generatedAt, input.sourceWorkspaceFolder, safety)
  };
}

function buildSampleRows(byType: Map<string, AuthoritativeMasterReviewerDecisionTemplateRow[]>): AuthoritativeReviewDecisionSampleRow[] {
  const rows: AuthoritativeReviewDecisionSampleRow[] = [];
  const entity = first(byType, "ENTITY");
  if (entity) rows.push(approvedCanonicalEntity(entity));
  const source = first(byType, "SOURCE_MAPPING");
  if (source) rows.push(approvedSourceMapping(source));
  const target = firstWithTargetEvidence(byType.get("TARGET_PROFILE") ?? []);
  if (target) rows.push(approvedTargetProfile(target));
  else {
    const targetFallback = first(byType, "TARGET_PROFILE");
    if (targetFallback) rows.push(deferRow(targetFallback, "target profile fixture lacks enough fields; deferred."));
  }
  const gap = first(byType, "SOURCE_DATA_GAP");
  if (gap) rows.push(sourceDataBacklog(gap));
  const futureUse = first(byType, "FUTURE_USE_DOMAIN");
  if (futureUse) rows.push(futureUseOnly(futureUse));
  const conflict = first(byType, "CONFLICT");
  if (conflict) rows.push(deferRow(conflict, "conflict fixture requires real business review."));
  return rows;
}

function buildMixedSimulationRows(byType: Map<string, AuthoritativeMasterReviewerDecisionTemplateRow[]>): AuthoritativeReviewDecisionSampleRow[] {
  const rows: AuthoritativeReviewDecisionSampleRow[] = [];
  const entity = first(byType, "ENTITY");
  if (entity) rows.push(approvedCanonicalEntity(entity));
  const source = first(byType, "SOURCE_MAPPING");
  if (source) rows.push(approvedSourceMapping(source));
  const futureUse = first(byType, "FUTURE_USE_DOMAIN");
  if (futureUse) rows.push(pendingRow(futureUse));
  const conflict = first(byType, "CONFLICT");
  if (conflict) rows.push(rejectedRow(conflict));
  const gap = first(byType, "SOURCE_DATA_GAP");
  if (gap) rows.push(deferRow(gap, "mixed simulation deferred source data gap."));
  const target = firstWithTargetEvidence(byType.get("TARGET_PROFILE") ?? []);
  if (target) rows.push({ ...approvedTargetProfile(target), reviewer_notes: "" });
  if (entity) rows.push({ ...approvedCanonicalEntity(entity), reviewer_notes: `${testNote} duplicate approval example.` });
  rows.push({
    review_id: "UNKNOWN_REVIEW_ID_FOR_TEST_FIXTURE",
    review_type: "ENTITY",
    approval_status: "approved",
    approved_action: "APPROVE_CANONICAL_ENTITY",
    approved_canonical_entity_code: "TEST_UNKNOWN_ENTITY",
    approved_source_field: "",
    approved_source_value: "",
    approved_mapping_type: "",
    approved_target_bucket: "",
    approved_machine_center_no: "",
    approved_target_qty: "",
    approved_unit: "",
    effective_from: "2026-01-01",
    effective_to: "",
    reviewer: testReviewer,
    reviewer_notes: `${testNote} unknown review_id example.`
  });
  return rows;
}

function expectations(
  sampleRows: readonly AuthoritativeReviewDecisionSampleRow[],
  safeDeferRows: readonly AuthoritativeReviewDecisionSampleRow[],
  mixedRows: readonly AuthoritativeReviewDecisionSampleRow[]
): AuthoritativeReviewDecisionSampleExpectationRow[] {
  return [
    {
      fixture_file: "reviewer-decisions.sample.csv",
      expected_total_rows: sampleRows.length,
      expected_accepted_min: sampleRows.filter((row) => row.approval_status === "approved").length,
      expected_deferred_min: sampleRows.filter((row) => row.approval_status === "deferred").length,
      expected_rejected_min: 0,
      expected_invalid_min: 0,
      expected_duplicate_min: 0,
      expected_unknown_min: 0,
      expected_p10_status: "BLOCKED",
      expected_safety: "all_false"
    },
    {
      fixture_file: "reviewer-decisions.safe-defer-all.csv",
      expected_total_rows: safeDeferRows.length,
      expected_accepted_min: 0,
      expected_deferred_min: safeDeferRows.length,
      expected_rejected_min: 0,
      expected_invalid_min: 0,
      expected_duplicate_min: 0,
      expected_unknown_min: 0,
      expected_p10_status: "BLOCKED",
      expected_safety: "all_false"
    },
    {
      fixture_file: "reviewer-decisions.mixed-simulation.csv",
      expected_total_rows: mixedRows.length,
      expected_accepted_min: 1,
      expected_deferred_min: 1,
      expected_rejected_min: 1,
      expected_invalid_min: 1,
      expected_duplicate_min: 1,
      expected_unknown_min: 1,
      expected_p10_status: "BLOCKED",
      expected_safety: "all_false"
    }
  ];
}

function groupByType(rows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[]): Map<string, AuthoritativeMasterReviewerDecisionTemplateRow[]> {
  const grouped = new Map<string, AuthoritativeMasterReviewerDecisionTemplateRow[]>();
  for (const row of rows) {
    grouped.set(row.review_type, [...(grouped.get(row.review_type) ?? []), row]);
  }
  return grouped;
}

function pickSmallSet(rows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[]): AuthoritativeMasterReviewerDecisionTemplateRow[] {
  const selected: AuthoritativeMasterReviewerDecisionTemplateRow[] = [];
  for (const type of ["ENTITY", "SOURCE_MAPPING", "TARGET_PROFILE", "CONFLICT", "SOURCE_DATA_GAP", "FUTURE_USE_DOMAIN"]) {
    const row = rows.find((candidate) => candidate.review_type === type);
    if (row) selected.push(row);
  }
  return selected;
}

function first(grouped: Map<string, AuthoritativeMasterReviewerDecisionTemplateRow[]>, type: string): AuthoritativeMasterReviewerDecisionTemplateRow | undefined {
  return grouped.get(type)?.[0];
}

function firstWithTargetEvidence(rows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[]): AuthoritativeMasterReviewerDecisionTemplateRow | undefined {
  return rows.find((row) => clean(row.approved_target_bucket) && clean(row.approved_target_qty) && clean(row.approved_unit) && clean(row.effective_from));
}

function approvedCanonicalEntity(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "approved",
    approved_action: "APPROVE_CANONICAL_ENTITY",
    approved_canonical_entity_code: clean(row.approved_canonical_entity_code) || `TEST_${row.review_id}`,
    effective_from: clean(row.effective_from) || "2026-01-01",
    reviewer_notes: `${testNote} sample canonical entity approval.`
  });
}

function approvedSourceMapping(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "approved",
    approved_action: "APPROVE_SOURCE_MAPPING",
    approved_canonical_entity_code: clean(row.approved_canonical_entity_code) || `TEST_${row.review_id}`,
    approved_source_field: clean(row.approved_source_field) || "gProdOrRotLineDescription",
    approved_source_value: clean(row.approved_source_value) || `TEST_SOURCE_${row.review_id}`,
    approved_mapping_type: clean(row.approved_mapping_type) || "EXACT_SOURCE_VALUE",
    effective_from: clean(row.effective_from) || "2026-01-01",
    reviewer_notes: `${testNote} sample source mapping approval.`
  });
}

function approvedTargetProfile(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "approved",
    approved_action: "APPROVE_TARGET_PROFILE",
    approved_canonical_entity_code: clean(row.approved_canonical_entity_code) || `TEST_${row.review_id}`,
    approved_target_bucket: clean(row.approved_target_bucket) || "UNKNOWN",
    approved_target_qty: clean(row.approved_target_qty) || "1",
    approved_unit: clean(row.approved_unit) || "PCS",
    effective_from: clean(row.effective_from) || "2026-01-01",
    reviewer_notes: `${testNote} sample target profile approval.`
  });
}

function sourceDataBacklog(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "approved",
    approved_action: "SOURCE_DATA_BACKLOG",
    reviewer_notes: `${testNote} sample source data backlog decision.`
  });
}

function futureUseOnly(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "approved",
    approved_action: "FUTURE_USE_ONLY",
    reviewer_notes: `${testNote} sample future-use-only decision.`
  });
}

function deferRow(row: AuthoritativeMasterReviewerDecisionTemplateRow, noteSuffix: string): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "deferred",
    approved_action: "DEFER_REVIEW",
    reviewer_notes: `${testNote} ${noteSuffix}`
  });
}

function rejectedRow(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "rejected",
    approved_action: "REJECT_CANDIDATE",
    reviewer_notes: `${testNote} mixed simulation rejected candidate.`
  });
}

function pendingRow(row: AuthoritativeMasterReviewerDecisionTemplateRow): AuthoritativeReviewDecisionSampleRow {
  return withDefaults(row, {
    approval_status: "pending",
    approved_action: "",
    reviewer: "",
    reviewer_notes: ""
  });
}

function withDefaults(
  row: AuthoritativeMasterReviewerDecisionTemplateRow,
  overrides: Partial<AuthoritativeReviewDecisionSampleRow>
): AuthoritativeReviewDecisionSampleRow {
  return {
    review_id: row.review_id,
    review_type: row.review_type,
    approval_status: overrides.approval_status ?? "pending",
    approved_action: overrides.approved_action ?? "",
    approved_canonical_entity_code: overrides.approved_canonical_entity_code ?? row.approved_canonical_entity_code,
    approved_source_field: overrides.approved_source_field ?? row.approved_source_field,
    approved_source_value: overrides.approved_source_value ?? row.approved_source_value,
    approved_mapping_type: overrides.approved_mapping_type ?? row.approved_mapping_type,
    approved_target_bucket: overrides.approved_target_bucket ?? row.approved_target_bucket,
    approved_machine_center_no: overrides.approved_machine_center_no ?? row.approved_machine_center_no,
    approved_target_qty: overrides.approved_target_qty ?? row.approved_target_qty,
    approved_unit: overrides.approved_unit ?? row.approved_unit,
    effective_from: overrides.effective_from ?? row.effective_from,
    effective_to: overrides.effective_to ?? row.effective_to,
    reviewer: overrides.reviewer ?? testReviewer,
    reviewer_notes: overrides.reviewer_notes ?? `${testNote} sample fixture row.`
  };
}

function manifest(
  generatedAt: string,
  sourceWorkspaceFolder: string,
  safety: AuthoritativeReviewDecisionSampleFixtureSafety
): AuthoritativeReviewDecisionSampleFixtureResult["importManifest"] {
  return {
    generatedAt,
    sourceWorkspaceFolder,
    fixtureFiles: [
      "reviewer-decisions.sample.csv",
      "reviewer-decisions.safe-defer-all.csv",
      "reviewer-decisions.mixed-simulation.csv"
    ],
    realReviewerDecisionFileWritten: false,
    safety
  };
}

function safetyFlags(): AuthoritativeReviewDecisionSampleFixtureSafety {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    authoritativeMasterApproved: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}
