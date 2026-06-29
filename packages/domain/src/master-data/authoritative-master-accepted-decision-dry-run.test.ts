import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthoritativeMasterAcceptedDecisionDryRun, type AuthoritativeAcceptedDecisionDryRunResult } from "./authoritative-master-accepted-decision-dry-run.js";
import type { AuthoritativeNormalizedCanonicalEntityRow, AuthoritativeNormalizedSourceMapRow, AuthoritativeNormalizedTargetProfileRow } from "./authoritative-master-intake.js";
import type { AuthoritativeReviewDecisionNormalizedRow } from "./authoritative-master-review-decision-intake.js";
import type { FutureUseRawRegistryRow } from "./future-use-raw-registry.js";

const generatedAt = "2026-06-29T00:00:00.000Z";

function dryRun(input: {
  decisions?: readonly AuthoritativeReviewDecisionNormalizedRow[];
  inputExists?: boolean;
  canonical?: readonly AuthoritativeNormalizedCanonicalEntityRow[];
  sourceMap?: readonly AuthoritativeNormalizedSourceMapRow[];
  targets?: readonly AuthoritativeNormalizedTargetProfileRow[];
  registry?: readonly FutureUseRawRegistryRow[];
} = {}): AuthoritativeAcceptedDecisionDryRunResult {
  return buildAuthoritativeMasterAcceptedDecisionDryRun({
    acceptedDecisionRows: input.decisions ?? [],
    acceptedDecisionInputExists: input.inputExists ?? true,
    canonicalEntityRows: input.canonical ?? [],
    sourceMappingRows: input.sourceMap ?? [],
    targetProfileRows: input.targets ?? [],
    registryRows: input.registry ?? [registryRow()],
    outputFolder: ".tmp/bc-authoritative-master-accepted-decision-dry-run",
    inputSources: [".tmp/bc-authoritative-master-review-decision-intake"],
    generatedAt
  });
}

test("missing P0.9q input returns BLOCKED_MISSING_INPUTS", () => {
  const result = dryRun({ inputExists: false });

  assert.equal(result.summary.dryRunStatus, "BLOCKED_MISSING_INPUTS");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("no accepted decisions returns NO_ACCEPTED_DECISIONS", () => {
  const result = dryRun();

  assert.equal(result.summary.dryRunStatus, "NO_ACCEPTED_DECISIONS");
  assert.equal(result.summary.acceptedDecisionRows, 0);
});

test("approved canonical entity creates merged canonical preview row", () => {
  const result = dryRun({ decisions: [decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY")] });

  assert.equal(result.canonicalEntityMergedPreviewRows.some((row) => row.canonical_entity_code === "OMSO 2-OZ" && row.source_of_truth_status === "approved"), true);
  assert.equal(result.canonicalEntityMergedPreviewRows[0]?.source_review_id, "ENT00001");
});

test("approved source mapping creates merged source map preview row", () => {
  const result = dryRun({
    decisions: [
      decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY"),
      decision("MAP00001", "SOURCE_MAPPING", "APPROVE_SOURCE_MAPPING")
    ]
  });

  assert.equal(result.sourceMappingMergedPreviewRows.some((row) => row.source_value === "OMSO 2-OZ" && row.is_active === "true"), true);
});

test("approved reviewed alias creates source map preview row and warning for broad alias", () => {
  const result = dryRun({
    decisions: [
      decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY"),
      decision("ALIAS00001", "SOURCE_MAPPING", "APPROVE_REVIEWED_ALIAS", { approved_source_value: "OMSO", approved_mapping_type: "REVIEWED_SOURCE_ALIAS" })
    ]
  });

  assert.equal(result.sourceMappingMergedPreviewRows.some((row) => row.mapping_type === "REVIEWED_SOURCE_ALIAS" && row.source_value === "OMSO"), true);
  assert.equal(result.acceptedDecisionApplicationPlanRows.some((row) => row.warning_code === "BROAD_ALIAS_RISK"), true);
});

test("approved target profile creates merged target profile preview row", () => {
  const result = dryRun({ decisions: [decision("TGT00001", "TARGET_PROFILE", "APPROVE_TARGET_PROFILE")] });

  assert.equal(result.targetProfileMergedPreviewRows.some((row) => row.approval_status === "approved" && row.source_review_id === "TGT00001"), true);
});

test("SOURCE_DATA_BACKLOG does not create canonical/source mapping row", () => {
  const result = dryRun({ decisions: [decision("GAP00001", "SOURCE_DATA_GAP", "SOURCE_DATA_BACKLOG")] });

  assert.equal(result.summary.sourceDataBacklogRows, 1);
  assert.equal(result.canonicalEntityMergedPreviewRows.length, 0);
  assert.equal(result.sourceMappingMergedPreviewRows.length, 0);
});

test("FUTURE_USE_ONLY does not require target profile", () => {
  const result = dryRun({
    decisions: [decision("DOM00001", "FUTURE_USE_DOMAIN", "FUTURE_USE_ONLY")],
    registry: [registryRow({ bc_future_use_domain: "SALES_REPORT", target_profile_status: "NOT_REQUIRED", target_profile_required: "false" })]
  });

  assert.equal(result.summary.futureUseOnlyRows, 1);
  assert.equal(result.summary.coverageImpact.targetProfileMissingRowsAfter, 0);
});

test("pending rejected deferred invalid decisions are not applied", () => {
  const result = dryRun({
    decisions: [
      decision("PENDING", "ENTITY", "APPROVE_CANONICAL_ENTITY", { approval_status: "pending" }),
      decision("REJECTED", "ENTITY", "APPROVE_CANONICAL_ENTITY", { approval_status: "rejected" }),
      decision("DEFERRED", "ENTITY", "APPROVE_CANONICAL_ENTITY", { approval_status: "deferred" }),
      decision("INVALID", "ENTITY", "REJECT_CANDIDATE")
    ]
  });

  assert.equal(result.summary.appliedPreviewRows, 0);
  assert.equal(result.summary.blockedApplicationRows, 4);
});

test("target profile missing is counted only for production output domain", () => {
  const result = dryRun({
    registry: [
      registryRow({ bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD", target_profile_status: "MISSING_TARGET_PROFILE", target_profile_required: "true" }),
      registryRow({ registry_key: "BCROW-000002", bc_future_use_domain: "SALES_REPORT", target_profile_status: "NOT_REQUIRED", target_profile_required: "false" })
    ]
  });

  assert.equal(result.summary.coverageImpact.targetProfileMissingRowsAfter, 1);
  assert.equal(result.summary.coverageImpact.targetProfileNotRequiredRows, 1);
});

test("non-production future-use rows are not target-profile blockers", () => {
  const result = dryRun({
    registry: [registryRow({ bc_future_use_domain: "PURCHASE_OR_RECEIVING", target_profile_status: "NOT_REQUIRED", target_profile_required: "false" })]
  });

  assert.equal(result.targetProfileGapAfterDryRunRows.length, 0);
});

test("coverage impact is written", () => {
  const result = dryRun({ decisions: [decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY"), decision("MAP00001", "SOURCE_MAPPING", "APPROVE_SOURCE_MAPPING")] });

  assert.equal(result.coverageImpactPreviewRows.length > 0, true);
  assert.equal(result.summary.coverageImpact.authoritativeMappedRowsAfter, 1);
});

test("P1.0 remains blocked even if dry-run looks ready", () => {
  const result = dryRun({
    decisions: [
      decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY"),
      decision("MAP00001", "SOURCE_MAPPING", "APPROVE_SOURCE_MAPPING"),
      decision("TGT00001", "TARGET_PROFILE", "APPROVE_TARGET_PROFILE")
    ],
    registry: [registryRow({ target_bucket: "OZ_LT_20" } as Partial<FutureUseRawRegistryRow>)]
  });

  assert.equal(result.summary.dryRunStatus, "DRY_RUN_READY_FOR_FINAL_REVIEW");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.equal(result.summary.p10ReadinessImpact.p10StillBlocked, true);
});

test("safety flags remain false", () => {
  const result = dryRun({ decisions: [decision("ENT00001", "ENTITY", "APPROVE_CANONICAL_ENTITY")] });

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false,
    masterDataApplied: false
  });
});

function decision(
  reviewId: string,
  reviewType: string,
  action: string,
  overrides: Partial<AuthoritativeReviewDecisionNormalizedRow> = {}
): AuthoritativeReviewDecisionNormalizedRow {
  return {
    review_id: reviewId,
    review_type: reviewType,
    approval_status: "approved",
    approved_action: action,
    approved_canonical_entity_code: "OMSO 2-OZ",
    approved_source_field: "gProdOrRotLineDescription",
    approved_source_value: "OMSO 2-OZ",
    approved_mapping_type: "EXACT_SOURCE_VALUE",
    approved_target_bucket: "OZ_LT_20",
    approved_machine_center_no: "OMSO2 OZ",
    approved_target_qty: "360000",
    approved_unit: "PCS",
    effective_from: "2026-01-01",
    effective_to: "",
    reviewer: "Bima",
    reviewer_notes: "Reviewed by business owner.",
    ...overrides
  };
}

function registryRow(overrides: Partial<FutureUseRawRegistryRow> & { readonly target_bucket?: string } = {}): FutureUseRawRegistryRow {
  return {
    registry_key: "BCROW-000001",
    registry_granularity: "ROW",
    source_system: "business-central",
    source_file: ".tmp/source.csv",
    posting_date: "2026-06-01",
    document_no: "DOC-1",
    item_no: "ITEM-1",
    item_description: "Item",
    entry_type: "Output",
    item_category_code: "FG",
    source_field: "gProdOrRotLineDescription",
    source_value: "OMSO 2-OZ",
    machine_center_no: "OMSO2 OZ",
    bc_current_kpi_scope: "OUTPUT_KPI_OK_SCOPE",
    bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
    registry_status: "REGISTERED_FOR_P10_OUTPUT_KPI",
    p10_inclusion_status: "P10_INCLUDED_CANDIDATE",
    future_module_candidate: "production-output-dashboard",
    authoritative_entity_status: "DRAFT_ENTITY_CANDIDATE",
    authoritative_entity_code: "",
    target_profile_required: "true",
    target_profile_status: "MISSING_TARGET_PROFILE",
    review_required: "true",
    review_reason: "Production output candidate requires approved target profile coverage.",
    safety_reason: "test",
    ...overrides
  };
}
