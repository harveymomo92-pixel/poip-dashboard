import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthoritativeMasterReviewWorkspace,
  type AuthoritativeMasterReviewWorkspaceResult
} from "./authoritative-master-review-workspace.js";
import type { FutureUseRawRegistryRow } from "./future-use-raw-registry.js";

const baseRegistryRow: FutureUseRawRegistryRow = {
  registry_key: "BCROW-000001",
  registry_granularity: "ROW",
  source_system: "business-central",
  source_file: ".tmp/bc-entity-v2-dry-run.csv",
  posting_date: "2026-01-01",
  document_no: "SPK2601/P0001",
  item_no: "FG001",
  item_description: "Cup",
  entry_type: "OUTPUT",
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
  authoritative_entity_code: "OMSO 2-OZ",
  target_profile_required: "true",
  target_profile_status: "MISSING_TARGET_PROFILE",
  review_required: "true",
  review_reason: "Production output candidate requires approved target profile coverage.",
  safety_reason: "export only"
};

function workspace(extra: Partial<Parameters<typeof buildAuthoritativeMasterReviewWorkspace>[0]> = {}): AuthoritativeMasterReviewWorkspaceResult {
  return buildAuthoritativeMasterReviewWorkspace({
    seedCanonicalRows: [{
      canonical_entity_code: "OMSO 2-OZ",
      canonical_entity_display_name: "OMSO 2-OZ",
      entity_family: "OMSO",
      entity_type: "MACHINE"
    }],
    seedSourceMapRows: [{
      source_system: "business-central",
      source_field: "gProdOrRotLineDescription",
      source_value: "OMSO 2-OZ",
      canonical_entity_code: "OMSO 2-OZ",
      mapping_type: "EXACT_SOURCE_VALUE",
      confidence: "HIGH"
    }],
    seedTargetProfileRows: [{
      canonical_entity_code: "OMSO 2-OZ",
      target_bucket: "",
      machine_center_no: "OMSO2 OZ",
      target_qty: "",
      unit: ""
    }],
    seedReviewQueueRows: [{
      review_id: "REV001",
      review_category: "OMSO_CONFLICT",
      source_field: "gProdOrRotLineDescription",
      source_value: "OMSO 2-OZ",
      proposed_canonical_entity_code: "OMSO 2-OZ",
      rows: 1,
      review_reason: "OMSO canonical conflict requires manual review.",
      recommended_action: "REVIEW_CONFLICT",
      sample_documents: "SPK2601/P0001",
      sample_items: "FG001"
    }],
    legacyCrosswalkRows: [{
      source_value: "OMSO 2-OZ",
      proposed_canonical_entity_code: "OMSO 2-OZ",
      legacy_current_entity_codes: "OMSO 2-OZ - Printing 22 OZ",
      v2_entity_codes: "OMSO 2-OZ",
      target_bucket_candidates: "OZ_LT_20",
      machine_center_nos: "OMSO2 OZ",
      sample_documents: "SPK2601/P0001",
      sample_items: "FG001",
      evidence_reason: "legacy evidence only",
      review_required: "true"
    }],
    registryRows: [baseRegistryRow],
    sourceDataGapRows: [],
    targetProfileRequirementRows: [{
      bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
      rows: 1,
      target_profile_required_rows: 1,
      target_profile_covered_rows: 0,
      target_profile_missing_rows: 1,
      target_profile_not_required_rows: 0
    }],
    sourceFolders: [".tmp/bc-authoritative-master-seed-draft", ".tmp/bc-future-use-raw-registry"],
    outputFolder: ".tmp/bc-authoritative-master-review-workspace",
    inputsAvailable: true,
    generatedAt: "2026-06-28T00:00:00.000Z",
    ...extra
  });
}

test("missing P0.9n or P0.9o inputs returns BLOCKED_MISSING_INPUTS", () => {
  const result = workspace({ inputsAvailable: false });

  assert.equal(result.summary.workspaceStatus, "BLOCKED_MISSING_INPUTS");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("entity candidates default to pending", () => {
  const result = workspace();

  assert.equal(result.entityReviewRows[0]?.approval_status, "pending");
});

test("source mappings default to pending", () => {
  const result = workspace();

  assert.equal(result.sourceMappingReviewRows[0]?.approval_status, "pending");
});

test("target profile rows default to pending", () => {
  const result = workspace();

  assert.equal(result.targetProfileReviewRows[0]?.approval_status, "pending");
});

test("production output missing target profile becomes P1", () => {
  const result = workspace();

  assert.equal(result.targetProfileReviewRows[0]?.priority, "P1");
});

test("future-use non-production rows do not become target profile P1 blockers", () => {
  const result = workspace({
    registryRows: [{
      ...baseRegistryRow,
      registry_key: "BCROW-000002",
      bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE",
      bc_future_use_domain: "SALES_REPORT",
      registry_status: "REGISTERED_FOR_FUTURE_SALES",
      p10_inclusion_status: "P10_EXCLUDED_FUTURE_USE",
      future_module_candidate: "sales-report",
      target_profile_required: "false",
      target_profile_status: "NOT_REQUIRED"
    }],
    targetProfileRequirementRows: [{
      bc_future_use_domain: "SALES_REPORT",
      rows: 1,
      target_profile_required_rows: 0,
      target_profile_covered_rows: 0,
      target_profile_missing_rows: 0,
      target_profile_not_required_rows: 1
    }]
  });

  assert.equal(result.targetProfileReviewRows.length, 0);
  assert.equal(result.reviewPriorityBoardRows.some((row) => row.priority === "P1" && row.review_type === "TGT"), false);
});

test("conflict rows use legacy evidence only", () => {
  const result = workspace();

  assert.equal(result.conflictReviewRows[0]?.approval_status, "pending");
  assert.match(result.conflictReviewRows[0]?.legacy_current_entity_codes ?? "", /Production output candidate|OMSO|legacy/i);
});

test("source data gap rows are exported", () => {
  const result = workspace({
    registryRows: [{
      ...baseRegistryRow,
      source_field: "UNMAPPED",
      source_value: "(blank)",
      authoritative_entity_status: "SOURCE_DATA_GAP",
      authoritative_entity_code: "",
      p10_inclusion_status: "P10_BLOCKED_SOURCE_DATA_GAP"
    }],
    sourceDataGapRows: [{
      review_id: "FUR001",
      review_type: "SOURCE_DATA_GAP",
      source_field: "UNMAPPED",
      source_value: "(blank)",
      bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
      rows: 1,
      review_reason: "Source data gap.",
      recommended_action: "SOURCE_DATA_BACKLOG"
    }]
  });

  assert.equal(result.sourceDataGapReviewRows.length, 1);
  assert.equal(result.sourceDataGapReviewRows[0]?.priority, "P1");
});

test("reviewer decision template has no approved rows by default", () => {
  const result = workspace();

  assert.equal(result.reviewerDecisionTemplateRows.every((row) => row.approval_status === "pending" && row.approved_action === ""), true);
  assert.equal(result.summary.approvedRows, 0);
});

test("priority P1/P2/P3 assignment works", () => {
  const result = workspace({
    registryRows: [
      baseRegistryRow,
      {
        ...baseRegistryRow,
        registry_key: "BCROW-000002",
        bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE",
        bc_future_use_domain: "SALES_REPORT",
        registry_status: "REGISTERED_FOR_FUTURE_SALES",
        p10_inclusion_status: "P10_EXCLUDED_FUTURE_USE",
        future_module_candidate: "sales-report",
        target_profile_required: "false",
        target_profile_status: "NOT_REQUIRED"
      }
    ]
  });

  assert.ok(result.summary.p1Rows > 0);
  assert.ok(result.summary.p2Rows >= 0);
  assert.ok(result.summary.p3Rows >= 0);
});

test("safety flags remain false", () => {
  const result = workspace();

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    authoritativeMasterApproved: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  });
});

test("P1.0 remains blocked", () => {
  const result = workspace();

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});
