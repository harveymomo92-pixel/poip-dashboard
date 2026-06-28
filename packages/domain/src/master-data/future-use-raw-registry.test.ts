import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFutureUseRawRegistry,
  type FutureUseRawEvidenceRow
} from "./future-use-raw-registry.js";

const baseRow: FutureUseRawEvidenceRow = {
  posting_date: "2026-01-01",
  document_no: "SPK2601/P0001",
  entry_no: "1",
  item_no: "FG001",
  item_description: "Cup",
  item_category_code: "FG",
  entry_type: "OUTPUT",
  g_prod_or_rot_line_description: "OMSO 2-OZ",
  machine_center_no: "OMSO2 OZ",
  v2_target_bucket_candidate: "OZ_LT_20",
  bc_current_kpi_scope: "OUTPUT_KPI_OK_SCOPE",
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  blocks_p10_after_scope: "false"
};

function registry(rows: readonly FutureUseRawEvidenceRow[], extra: Partial<Parameters<typeof buildFutureUseRawRegistry>[0]> = {}) {
  return buildFutureUseRawRegistry({
    rawRows: rows,
    sourceReportsAvailable: true,
    sourceFile: ".tmp/bc-entity-v2-dry-run.csv",
    outputFolder: ".tmp/bc-future-use-raw-registry",
    generatedAt: "2026-06-28T00:00:00.000Z",
    ...extra
  });
}

test("missing source reports returns BLOCKED_MISSING_SOURCE_REPORTS", () => {
  const result = buildFutureUseRawRegistry({
    rawRows: [],
    sourceReportsAvailable: false,
    sourceFile: ".tmp/missing.csv",
    outputFolder: ".tmp/bc-future-use-raw-registry",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });

  assert.equal(result.summary.registryStatus, "BLOCKED_MISSING_SOURCE_REPORTS");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("Output KPI rows register as PRODUCTION_OUTPUT_DASHBOARD", () => {
  const result = registry([baseRow]);

  assert.equal(result.registryRows[0]?.bc_future_use_domain, "PRODUCTION_OUTPUT_DASHBOARD");
  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_P10_OUTPUT_KPI");
  assert.equal(result.registryRows[0]?.future_module_candidate, "production-output-dashboard");
});

test("Reject rows register as REJECT_ATTACHMENT", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUTPUT_KPI_REJECT_SCOPE", bc_future_use_domain: "REJECT_ATTACHMENT" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_REJECT_ATTACHMENT");
  assert.equal(result.registryRows[0]?.p10_inclusion_status, "P10_REJECT_ATTACHMENT_CANDIDATE");
});

test("Sales rows register as future sales", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "SALES_REPORT" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_SALES");
  assert.equal(result.registryRows[0]?.future_module_candidate, "sales-report");
});

test("Transfer rows register as future transfer or inventory", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "TRANSFER_OR_INVENTORY_MOVEMENT" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_TRANSFER_INVENTORY");
});

test("Consumption rows register as future consumption or material usage", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "CONSUMPTION_OR_MATERIAL_USAGE" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_CONSUMPTION_MATERIAL_USAGE");
});

test("Sparepart material rows register as future sparepart material", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "DOWNTIME_SPAREPART_OR_MATERIAL" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_SPAREPART_MATERIAL");
});

test("Purchase rows register as future purchase receiving", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "PURCHASE_OR_RECEIVING" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_PURCHASE_RECEIVING");
});

test("Scrap rows register as future scrap waste", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUTPUT_KPI_REJECT_SCOPE", bc_future_use_domain: "SCRAP_WASTE_OR_AVALAN" }]);

  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_FUTURE_SCRAP_WASTE");
});

test("Unknown review rows are registered and not dropped", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "UNKNOWN_SCOPE_REVIEW", bc_future_use_domain: "UNKNOWN_REVIEW" }]);

  assert.equal(result.summary.totalRegisteredRows, 1);
  assert.equal(result.registryRows[0]?.registry_status, "REGISTERED_FOR_UNKNOWN_REVIEW");
  assert.equal(result.summary.unknownReviewRows, 1);
});

test("Source data gap rows are registered and not dropped", () => {
  const result = registry([{
    ...baseRow,
    g_prod_or_rot_line_description: "",
    machine_center_no: "",
    v2_source_value_used: "UNMAPPED",
    bc_current_kpi_scope: "UNKNOWN_SCOPE_REVIEW",
    bc_future_use_domain: "UNKNOWN_REVIEW"
  }]);

  assert.equal(result.summary.totalRegisteredRows, 1);
  assert.equal(result.registryRows[0]?.authoritative_entity_status, "SOURCE_DATA_GAP");
  assert.equal(result.summary.sourceDataGapRows, 1);
});

test("Non-production future-use rows do not require target profile by default", () => {
  const result = registry([{ ...baseRow, bc_current_kpi_scope: "OUT_OF_CURRENT_KPI_SCOPE", bc_future_use_domain: "SALES_REPORT" }]);

  assert.equal(result.registryRows[0]?.target_profile_required, "false");
  assert.equal(result.registryRows[0]?.target_profile_status, "NOT_REQUIRED");
});

test("Production output rows require target profile coverage", () => {
  const result = registry([baseRow]);

  assert.equal(result.registryRows[0]?.target_profile_required, "true");
  assert.equal(result.registryRows[0]?.target_profile_status, "MISSING_TARGET_PROFILE");
  assert.equal(result.summary.targetProfileCoverage.targetProfileMissingRows, 1);
});

test("Authoritative seed draft counts as draft coverage, not approved coverage", () => {
  const result = registry([baseRow], {
    seedDraftSourceMaps: [{
      source_system: "business-central",
      source_field: "gProdOrRotLineDescription",
      source_value: "OMSO 2-OZ",
      canonical_entity_code: "OMSO 2-OZ",
      is_active: "true"
    }]
  });

  assert.equal(result.registryRows[0]?.authoritative_entity_status, "DRAFT_ENTITY_CANDIDATE");
  assert.equal(result.summary.authoritativeCoverage.authoritativeMappedRows, 0);
  assert.equal(result.summary.authoritativeCoverage.draftEntityCandidateRows, 1);
});

test("Legacy current entity is evidence only and does not create authoritative coverage", () => {
  const result = registry([{ ...baseRow, current_entity_code: "OMSO 2-OZ - Printing 22 OZ" }]);

  assert.notEqual(result.registryRows[0]?.authoritative_entity_status, "AUTHORITATIVE_MAPPED");
});

test("Safety flags remain false", () => {
  const result = registry([baseRow]);

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  });
});

test("P1.0 remains blocked", () => {
  const result = registry([baseRow]);

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});
