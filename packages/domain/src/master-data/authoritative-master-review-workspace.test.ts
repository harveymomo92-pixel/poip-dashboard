import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthoritativeMasterReviewWorkspace } from "./authoritative-master-review-workspace.js";
import type {
  AuthoritativeNormalizedCanonicalEntityRow,
  AuthoritativeNormalizedSourceMapRow,
  AuthoritativeNormalizedTargetProfileRow
} from "./authoritative-master-intake.js";
import type { AuthoritativeLegacyEvidenceCrosswalkRow, AuthoritativeSeedReviewQueueRow } from "./authoritative-master-seed-draft.js";
import type {
  FutureUseDomainCoverageRow,
  FutureUseRawRegistryRow,
  FutureUseReviewQueueRow,
  FutureUseSourceCoverageRow,
  FutureUseTargetProfileRequirementRow
} from "./future-use-raw-registry.js";

const canonical: AuthoritativeNormalizedCanonicalEntityRow = {
  canonical_entity_code: "OMSO 2-OZ",
  canonical_entity_display_name: "OMSO 2 OZ",
  entity_family: "OMSO",
  entity_type: "MACHINE",
  production_area: "Printing",
  is_active: "true",
  source_of_truth_status: "draft",
  reviewer: "",
  reviewer_notes: "generated draft",
  effective_from: "",
  effective_to: ""
};

const sourceMap: AuthoritativeNormalizedSourceMapRow = {
  source_system: "business-central",
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  canonical_entity_code: "OMSO 2-OZ",
  mapping_type: "EXACT_SOURCE_VALUE",
  confidence: "MEDIUM",
  is_active: "true",
  reviewer: "",
  reviewer_notes: "generated draft",
  effective_from: "",
  effective_to: ""
};

const targetProfile: AuthoritativeNormalizedTargetProfileRow = {
  canonical_entity_code: "OMSO 2-OZ",
  target_bucket: "OZ_LT_20",
  machine_center_no: "OMSO2 OZ",
  target_qty: "",
  unit: "",
  effective_from: "",
  effective_to: "",
  is_active: "true",
  approval_status: "draft",
  reviewer: "",
  reviewer_notes: "generated draft"
};

const registryRow: FutureUseRawRegistryRow = {
  registry_key: "BCROW-000001",
  registry_granularity: "ROW",
  source_system: "business-central",
  source_file: ".tmp/bc-entity-v2-dry-run.csv",
  posting_date: "2026-01-01",
  document_no: "SPK2601/P0001",
  item_no: "CR16OZOTPC",
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
  authoritative_entity_status: "CONFLICT_REVIEW",
  authoritative_entity_code: "OMSO 2-OZ",
  target_profile_required: "true",
  target_profile_status: "MISSING_TARGET_PROFILE",
  review_required: "true",
  review_reason: "OMSO conflict requires manual canonical review.",
  safety_reason: "export only"
};

const seedReview: AuthoritativeSeedReviewQueueRow = {
  review_id: "R00001",
  review_category: "MAPPING_REVIEW",
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  proposed_canonical_entity_code: "OMSO 2-OZ",
  rows: 10,
  review_reason: "OMSO conflict requires manual canonical review.",
  recommended_action: "Review manually.",
  sample_documents: "SPK2601/P0001",
  sample_items: "CR16OZOTPC"
};

const crosswalk: AuthoritativeLegacyEvidenceCrosswalkRow = {
  source_value: "OMSO 2-OZ",
  proposed_canonical_entity_code: "OMSO 2-OZ",
  legacy_current_entity_codes: "OMSO 1-OZ - Printing 22 OZ|OMSO 2-OZ - Printing 22 OZ",
  v2_entity_codes: "OMSO 2-OZ",
  target_bucket_candidates: "OZ_LT_20",
  machine_center_nos: "OMSO2 OZ",
  sample_documents: "SPK2601/P0001",
  sample_items: "CR16OZOTPC",
  evidence_reason: "conflict",
  review_required: "true"
};

const sourceCoverage: FutureUseSourceCoverageRow = {
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  rows: 1,
  authoritative_entity_status: "CONFLICT_REVIEW",
  authoritative_entity_code: "OMSO 2-OZ",
  review_required: "true",
  review_reason: "OMSO conflict requires manual canonical review."
};

const registryReview: FutureUseReviewQueueRow = {
  review_id: "FUR00001",
  review_type: "CONFLICT_REVIEW",
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  rows: 1,
  review_reason: "OMSO conflict requires manual canonical review.",
  recommended_action: "Review."
};

const domainCoverage: FutureUseDomainCoverageRow = {
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  rows: 1,
  authoritative_mapped_rows: 0,
  draft_entity_candidate_rows: 0,
  source_data_gap_rows: 0,
  conflict_review_rows: 1,
  unknown_rows: 0
};

const targetRequirement: FutureUseTargetProfileRequirementRow = {
  bc_future_use_domain: "PRODUCTION_OUTPUT_DASHBOARD",
  rows: 1,
  target_profile_required_rows: 1,
  target_profile_covered_rows: 0,
  target_profile_missing_rows: 1,
  target_profile_not_required_rows: 0
};

function workspace(overrides: Partial<Parameters<typeof buildAuthoritativeMasterReviewWorkspace>[0]> = {}) {
  return buildAuthoritativeMasterReviewWorkspace({
    seedCanonicalRows: [canonical],
    seedSourceMapRows: [sourceMap],
    seedTargetProfileRows: [targetProfile],
    seedReviewQueueRows: [seedReview],
    legacyCrosswalkRows: [crosswalk],
    registryRows: [registryRow],
    registrySourceCoverageRows: [sourceCoverage],
    registryReviewQueueRows: [registryReview],
    domainCoverageRows: [domainCoverage],
    targetProfileRequirementRows: [targetRequirement],
    requiredInputsAvailable: true,
    outputFolder: ".tmp/bc-authoritative-master-review-workspace",
    sourceFolders: [".tmp/bc-authoritative-master-seed-draft", ".tmp/bc-future-use-raw-registry"],
    generatedAt: "2026-06-29T00:00:00.000Z",
    ...overrides
  });
}

test("missing P0.9n or P0.9o inputs returns BLOCKED_MISSING_INPUTS", () => {
  const result = workspace({ requiredInputsAvailable: false });

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

test("target profile review rows default to pending", () => {
  const result = workspace();

  assert.equal(result.targetProfileReviewRows[0]?.approval_status, "pending");
});

test("production output target profile missing becomes P1", () => {
  const result = workspace();

  assert.equal(result.targetProfileReviewRows[0]?.priority, "P1");
  assert.equal(result.targetProfileReviewRows[0]?.recommended_action, "FILL_TARGET_PROFILE");
});

test("future-use non-production rows do not become target-profile P1 blockers", () => {
  const result = workspace({
    registryRows: [{ ...registryRow, bc_future_use_domain: "SALES_REPORT", target_profile_required: "false", target_profile_status: "NOT_REQUIRED", p10_inclusion_status: "P10_EXCLUDED_FUTURE_USE" }],
    targetProfileRequirementRows: [{ ...targetRequirement, bc_future_use_domain: "SALES_REPORT", target_profile_required_rows: 0, target_profile_missing_rows: 0, target_profile_not_required_rows: 1 }]
  });

  assert.notEqual(result.targetProfileReviewRows[0]?.priority, "P1");
});

test("conflict rows include legacy evidence only, not authoritative approval", () => {
  const result = workspace();

  assert.equal(result.conflictReviewRows[0]?.legacy_current_entity_codes, crosswalk.legacy_current_entity_codes);
  assert.equal(result.conflictReviewRows[0]?.approval_status, "pending");
});

test("source data gap rows are exported", () => {
  const gapRow: FutureUseReviewQueueRow = {
    ...registryReview,
    review_type: "SOURCE_DATA_GAP",
    source_field: "UNMAPPED",
    source_value: "(blank)",
    rows: 5,
    review_reason: "Source data gap."
  };
  const result = workspace({ registryReviewQueueRows: [gapRow] });

  assert.equal(result.sourceDataGapReviewRows.length, 1);
  assert.equal(result.sourceDataGapReviewRows[0]?.approval_status, "pending");
});

test("reviewer decision template has no approved rows by default", () => {
  const result = workspace();

  assert.equal(result.reviewerDecisionTemplateRows.some((row) => row.approval_status === "approved"), false);
  assert.equal(result.reviewerDecisionTemplateRows.some((row) => row.approved_action), false);
});

test("priority assignment P1, P2, and P3 works", () => {
  const p1 = workspace();
  const p2 = workspace({ registryRows: [{ ...registryRow, bc_future_use_domain: "TRANSFER_OR_INVENTORY_MOVEMENT", p10_inclusion_status: "P10_EXCLUDED_FUTURE_USE" }] });
  const p3 = workspace({
    seedReviewQueueRows: [],
    registryReviewQueueRows: [],
    registryRows: [{ ...registryRow, bc_future_use_domain: "SALES_REPORT", p10_inclusion_status: "P10_EXCLUDED_FUTURE_USE", authoritative_entity_status: "DRAFT_ENTITY_CANDIDATE", review_required: "false", review_reason: "" }]
  });

  assert.ok(p1.reviewPriorityBoardRows.some((row) => row.priority === "P1"));
  assert.ok(p2.reviewPriorityBoardRows.some((row) => row.priority === "P2"));
  assert.ok(p3.reviewPriorityBoardRows.some((row) => row.priority === "P3"));
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
