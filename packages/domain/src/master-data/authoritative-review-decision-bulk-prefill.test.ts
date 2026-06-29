import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthoritativeReviewDecisionBulkPrefill } from "./authoritative-review-decision-bulk-prefill.js";
import type {
  AuthoritativeMasterConflictReviewRow,
  AuthoritativeMasterEntityReviewRow,
  AuthoritativeMasterFutureUseDomainReviewRow,
  AuthoritativeMasterReviewerDecisionTemplateRow,
  AuthoritativeMasterSourceDataGapReviewRow,
  AuthoritativeMasterSourceMappingReviewRow,
  AuthoritativeMasterTargetProfileReviewRow
} from "./authoritative-master-review-workspace.js";

function build(input: {
  readonly templates?: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly entities?: readonly AuthoritativeMasterEntityReviewRow[];
  readonly sources?: readonly AuthoritativeMasterSourceMappingReviewRow[];
  readonly targets?: readonly AuthoritativeMasterTargetProfileReviewRow[];
  readonly conflicts?: readonly AuthoritativeMasterConflictReviewRow[];
  readonly gaps?: readonly AuthoritativeMasterSourceDataGapReviewRow[];
  readonly futures?: readonly AuthoritativeMasterFutureUseDomainReviewRow[];
  readonly workspaceExists?: boolean;
  readonly wroteConvenience?: boolean;
} = {}) {
  return buildAuthoritativeReviewDecisionBulkPrefill({
    templateRows: input.templates ?? [],
    entityRows: input.entities ?? [],
    sourceMappingRows: input.sources ?? [],
    targetProfileRows: input.targets ?? [],
    conflictRows: input.conflicts ?? [],
    sourceDataGapRows: input.gaps ?? [],
    futureUseDomainRows: input.futures ?? [],
    workspaceExists: input.workspaceExists ?? true,
    sourceWorkspaceFolder: ".tmp/bc-authoritative-master-review-workspace",
    outputFolder: ".tmp/bc-authoritative-review-decision-bulk-prefill",
    wroteConveniencePrefillFile: input.wroteConvenience ?? true,
    generatedAt: "2026-06-29T00:00:00.000Z"
  });
}

test("missing workspace returns BLOCKED_MISSING_WORKSPACE", () => {
  const result = build({ workspaceExists: false });

  assert.equal(result.summary.prefillStatus, "BLOCKED_MISSING_WORKSPACE");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("bulk prefill writes output-shaped rows", () => {
  const result = build({
    templates: [template("ENT00001", "ENTITY", { canonical: "OMSO 2-OZ" })],
    entities: [entity("ENT00001")]
  });

  assert.equal(result.summary.prefillStatus, "GENERATED");
  assert.equal(result.bulkPrefillRows.length, 1);
  assert.equal(result.ruleReportRows.length, 1);
  assert.equal(result.riskReportRows.length, 1);
});

test("bulk prefill does not overwrite real reviewer-decisions.csv", () => {
  const result = build({ templates: [template("GAP00001", "SOURCE_DATA_GAP")], gaps: [gap("GAP00001")] });

  assert.equal(result.summary.overwroteRealReviewerDecisionFile, false);
  assert.equal(result.importManifest.wroteRealReviewerDecisionFile, false);
});

test("low-risk entity rows become approved canonical entity decisions", () => {
  const result = build({
    templates: [template("ENT00001", "ENTITY", { canonical: "OMSO 2-OZ" })],
    entities: [entity("ENT00001")]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "approved");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "APPROVE_CANONICAL_ENTITY");
});

test("low-risk exact source mapping rows become approved source mapping decisions", () => {
  const result = build({
    templates: [template("MAP00001", "SOURCE_MAPPING")],
    sources: [source("MAP00001")]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "approved");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "APPROVE_SOURCE_MAPPING");
  assert.equal(result.bulkPrefillRows[0]?.approved_mapping_type, "EXACT_SOURCE_VALUE");
});

test("conflict rows become deferred, not approved", () => {
  const result = build({
    templates: [template("CON00001", "CONFLICT")],
    conflicts: [conflict("CON00001")]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "deferred");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "DEFER_REVIEW");
  assert.equal(result.summary.conflictDeferredRows, 1);
});

test("source data gap rows become SOURCE_DATA_BACKLOG", () => {
  const result = build({
    templates: [template("GAP00001", "SOURCE_DATA_GAP")],
    gaps: [gap("GAP00001")]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "approved");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "SOURCE_DATA_BACKLOG");
  assert.equal(result.bulkPrefillRows[0]?.approved_canonical_entity_code, "");
});

test("future-use non-production rows become FUTURE_USE_ONLY", () => {
  const result = build({
    templates: [template("DOM00001", "FUTURE_USE_DOMAIN")],
    futures: [future("DOM00001", "SALES_REPORT")]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "approved");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "FUTURE_USE_ONLY");
});

test("target profile rows missing qty unit effective_from become needs_correction", () => {
  const result = build({
    templates: [template("TGT00001", "TARGET_PROFILE", { canonical: "OMSO 2-OZ", targetBucket: "OZ_LT_20" })],
    targets: [target("TGT00001", { proposed_target_qty: "", proposed_unit: "", effective_from: "" })]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "needs_correction");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "NEEDS_CORRECTION");
  assert.equal(result.summary.targetProfileNeedsCorrectionRows, 1);
});

test("machineCenterNo fallback rows are not auto-approved", () => {
  const result = build({
    templates: [template("MAP00001", "SOURCE_MAPPING")],
    sources: [source("MAP00001", { source_field: "machineCenterNo", source_value: "MC-01" })]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "deferred");
  assert.equal(result.bulkPrefillRows[0]?.approved_action, "DEFER_REVIEW");
});

test("broad family-only source values are not auto-approved", () => {
  const result = build({
    templates: [template("MAP00001", "SOURCE_MAPPING")],
    sources: [source("MAP00001", { source_value: "OMSO" })]
  });

  assert.equal(result.bulkPrefillRows[0]?.approval_status, "deferred");
});

test("reviewer and reviewer_notes are populated", () => {
  const result = build({
    templates: [template("MAP00001", "SOURCE_MAPPING")],
    sources: [source("MAP00001")]
  });

  assert.equal(result.bulkPrefillRows[0]?.reviewer, "SYSTEM_BULK_PREFILL_REVIEW_REQUIRED");
  assert.equal(result.bulkPrefillRows[0]?.reviewer_notes.startsWith("BULK_PREFILL_REQUIRES_USER_REVIEW:"), true);
});

test("P1.0 remains blocked", () => {
  const result = build({ templates: [template("GAP00001", "SOURCE_DATA_GAP")], gaps: [gap("GAP00001")] });

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("safety flags remain false", () => {
  const result = build({ templates: [template("GAP00001", "SOURCE_DATA_GAP")], gaps: [gap("GAP00001")] });

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

function template(
  reviewId: string,
  reviewType: string,
  fields: { readonly canonical?: string; readonly targetBucket?: string } = {}
): AuthoritativeMasterReviewerDecisionTemplateRow {
  return {
    review_id: reviewId,
    review_type: reviewType,
    approval_status: "pending",
    approved_action: "",
    approved_canonical_entity_code: fields.canonical ?? "",
    approved_source_field: "",
    approved_source_value: "",
    approved_mapping_type: "",
    approved_target_bucket: fields.targetBucket ?? "",
    approved_machine_center_no: "",
    approved_target_qty: "",
    approved_unit: "",
    effective_from: "",
    effective_to: "",
    reviewer: "",
    reviewer_notes: ""
  };
}

function entity(reviewId: string, overrides: Partial<AuthoritativeMasterEntityReviewRow> = {}): AuthoritativeMasterEntityReviewRow {
  return {
    review_id: reviewId,
    priority: "P2",
    entity_family: "OMSO",
    proposed_canonical_entity_code: "OMSO 2-OZ",
    proposed_canonical_entity_display_name: "OMSO 2-OZ",
    proposed_entity_type: "LINE",
    row_coverage_count: 100,
    p10_output_rows: 10,
    reject_rows: 0,
    future_use_rows: 0,
    conflict_rows: 0,
    source_data_gap_rows: 0,
    legacy_current_entity_codes: "",
    sample_source_values: "OMSO 2-OZ",
    sample_documents: "DOC-1",
    sample_items: "ITEM-1",
    recommended_action: "APPROVE_CANONICAL_ENTITY_LOW_RISK",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: "",
    ...overrides
  };
}

function source(reviewId: string, overrides: Partial<AuthoritativeMasterSourceMappingReviewRow> = {}): AuthoritativeMasterSourceMappingReviewRow {
  return {
    review_id: reviewId,
    priority: "P2",
    source_system: "business-central",
    source_field: "gProdOrRotLineDescription",
    source_value: "OMSO 2-OZ",
    proposed_canonical_entity_code: "OMSO 2-OZ",
    mapping_type: "EXACT_SOURCE_VALUE",
    confidence: "HIGH",
    rows_covered: 100,
    bc_future_use_domains: "PRODUCTION_OUTPUT_DASHBOARD",
    p10_inclusion_statuses: "P10_INCLUDED_CANDIDATE",
    legacy_current_entity_codes: "",
    conflict_flag: "false",
    conflict_reason: "",
    recommended_action: "APPROVE_SOURCE_MAPPING",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: "",
    ...overrides
  };
}

function target(reviewId: string, overrides: Partial<AuthoritativeMasterTargetProfileReviewRow> = {}): AuthoritativeMasterTargetProfileReviewRow {
  return {
    review_id: reviewId,
    priority: "P1",
    canonical_entity_code: "OMSO 2-OZ",
    target_bucket: "OZ_LT_20",
    machine_center_no: "OMSO2 OZ",
    affected_output_rows: 10,
    affected_reject_rows: 0,
    target_profile_required: "true",
    target_profile_status: "MISSING_TARGET_PROFILE",
    proposed_target_qty: "360000",
    proposed_unit: "PCS",
    effective_from: "2026-01-01",
    effective_to: "",
    recommended_action: "APPROVE_TARGET_PROFILE",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: "",
    ...overrides
  };
}

function conflict(reviewId: string): AuthoritativeMasterConflictReviewRow {
  return {
    review_id: reviewId,
    priority: "P1",
    conflict_type: "LEGACY_CURRENT_ENTITY_DIFFERS",
    source_field: "gProdOrRotLineDescription",
    source_value: "OMSO 2-OZ",
    proposed_canonical_entity_code: "OMSO 2-OZ",
    legacy_current_entity_codes: "OMSO 1-OZ",
    v2_entity_codes: "OMSO 2-OZ",
    rows: 10,
    bc_future_use_domains: "PRODUCTION_OUTPUT_DASHBOARD",
    sample_documents: "DOC-1",
    sample_items: "ITEM-1",
    risk_level: "HIGH",
    recommended_action: "REVIEW_WITH_BUSINESS_OWNER",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: ""
  };
}

function gap(reviewId: string): AuthoritativeMasterSourceDataGapReviewRow {
  return {
    review_id: reviewId,
    priority: "P1",
    source_gap_type: "BLANK_SOURCE_VALUE",
    rows: 10,
    bc_future_use_domains: "UNKNOWN_REVIEW",
    p10_inclusion_statuses: "P10_BLOCKED_SOURCE_DATA_GAP",
    sample_documents: "DOC-1",
    sample_items: "ITEM-1",
    item_category_codes: "FG",
    machine_center_nos: "",
    recommended_action: "SOURCE_DATA_BACKLOG",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: ""
  };
}

function future(reviewId: string, domain: string): AuthoritativeMasterFutureUseDomainReviewRow {
  return {
    review_id: reviewId,
    future_use_domain: domain,
    future_module_candidate: "sales-report",
    rows: 10,
    authoritative_entity_status_counts: "",
    target_profile_required_rows: 0,
    target_profile_not_required_rows: 10,
    unknown_rows: 0,
    source_data_gap_rows: 0,
    recommended_action: "FUTURE_USE_ONLY",
    approval_status: "pending",
    reviewer: "",
    reviewer_notes: ""
  };
}
