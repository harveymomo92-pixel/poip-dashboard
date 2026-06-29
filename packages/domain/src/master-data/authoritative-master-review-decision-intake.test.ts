import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthoritativeMasterReviewDecisionIntake,
  type AuthoritativeReviewDecisionInputRow
} from "./authoritative-master-review-decision-intake.js";
import type { AuthoritativeMasterReviewerDecisionTemplateRow } from "./authoritative-master-review-workspace.js";

const workspaceRows: AuthoritativeMasterReviewerDecisionTemplateRow[] = [
  template("ENT00001", "ENTITY", "OMSO 2-OZ"),
  template("MAP00001", "SOURCE_MAPPING", "OMSO 2-OZ", "gProdOrRotLineDescription", "OMSO 2-OZ", "EXACT_SOURCE_VALUE"),
  template("TGT00001", "TARGET_PROFILE", "OMSO 2-OZ", "", "", "", "OZ_LT_20", "OMSO2 OZ"),
  template("CON00001", "CONFLICT", "OMSO 2-OZ", "gProdOrRotLineDescription", "OMSO 2-OZ"),
  template("GAP00001", "SOURCE_DATA_GAP"),
  template("DOM00001", "FUTURE_USE_DOMAIN")
];

function template(
  reviewId: string,
  reviewType: string,
  canonical = "",
  sourceField = "",
  sourceValue = "",
  mappingType = "",
  targetBucket = "",
  machineCenter = ""
): AuthoritativeMasterReviewerDecisionTemplateRow {
  return {
    review_id: reviewId,
    review_type: reviewType,
    approval_status: "pending",
    approved_action: "",
    approved_canonical_entity_code: canonical,
    approved_source_field: sourceField,
    approved_source_value: sourceValue,
    approved_mapping_type: mappingType,
    approved_target_bucket: targetBucket,
    approved_machine_center_no: machineCenter,
    approved_target_qty: "",
    approved_unit: "",
    effective_from: "",
    effective_to: "",
    reviewer: "",
    reviewer_notes: ""
  };
}

function intake(rows: readonly AuthoritativeReviewDecisionInputRow[], exists = true) {
  return buildAuthoritativeMasterReviewDecisionIntake({
    workspaceRows,
    reviewerRows: rows,
    reviewerInputExists: exists,
    inputFolder: ".tmp/bc-authoritative-master-review-input",
    sourceWorkspaceFolder: ".tmp/bc-authoritative-master-review-workspace",
    outputFolder: ".tmp/bc-authoritative-master-review-decision-intake",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

const reviewer = {
  reviewer: "Bima",
  reviewer_notes: "Reviewed by business owner with explicit evidence."
};

test("missing reviewer decision file returns AWAITING_REVIEWER_DECISIONS and creates template rows", () => {
  const result = intake([], false);

  assert.equal(result.summary.intakeStatus, "AWAITING_REVIEWER_DECISIONS");
  assert.equal(result.templateRows.length, workspaceRows.length);
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("unknown review_id goes to unknown output", () => {
  const result = intake([{ review_id: "UNKNOWN", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_CANONICAL_ENTITY", approved_canonical_entity_code: "X", ...reviewer }]);

  assert.equal(result.unknownRows.length, 1);
  assert.equal(result.summary.intakeStatus, "INVALID");
});

test("duplicate review_id goes to duplicate output", () => {
  const result = intake([
    { review_id: "ENT00001", review_type: "ENTITY", approval_status: "pending" },
    { review_id: "ENT00001", review_type: "ENTITY", approval_status: "pending" }
  ]);

  assert.equal(result.duplicateRows.length, 2);
});

test("pending rows are not accepted", () => {
  const result = intake([{ review_id: "ENT00001", review_type: "ENTITY", approval_status: "" }]);

  assert.equal(result.pendingRows.length, 1);
  assert.equal(result.acceptedRows.length, 0);
});

test("approved row without reviewer is blocked", () => {
  const result = intake([{ review_id: "ENT00001", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_CANONICAL_ENTITY", approved_canonical_entity_code: "OMSO 2-OZ", reviewer_notes: "Reviewed." }]);

  assert.equal(result.blockedRows[0]?.issue_code, "MISSING_REVIEWER");
});

test("approved row without reviewer_notes is blocked", () => {
  const result = intake([{ review_id: "ENT00001", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_CANONICAL_ENTITY", approved_canonical_entity_code: "OMSO 2-OZ", reviewer: "Bima" }]);

  assert.equal(result.blockedRows[0]?.issue_code, "MISSING_REVIEWER_NOTES");
});

test("invalid action for review type is blocked", () => {
  const result = intake([{ review_id: "ENT00001", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_TARGET_PROFILE", approved_canonical_entity_code: "OMSO 2-OZ", ...reviewer }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "INVALID_ACTION_FOR_REVIEW_TYPE"), true);
});

test("APPROVE_CANONICAL_ENTITY requires canonical code", () => {
  const result = intake([{ review_id: "ENT00001", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_CANONICAL_ENTITY", ...reviewer }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "MISSING_CANONICAL_ENTITY_CODE"), true);
});

test("APPROVE_SOURCE_MAPPING requires source field value mapping and canonical code", () => {
  const result = intake([{ review_id: "MAP00001", review_type: "SOURCE_MAPPING", approval_status: "approved", approved_action: "APPROVE_SOURCE_MAPPING", ...reviewer }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "MISSING_SOURCE_FIELD"), true);
  assert.equal(result.blockedRows.some((row) => row.issue_code === "MISSING_SOURCE_VALUE"), true);
});

test("APPROVE_REVIEWED_ALIAS requires alias fields and warns if broad with justification", () => {
  const result = intake([{
    review_id: "MAP00001",
    review_type: "SOURCE_MAPPING",
    approval_status: "approved",
    approved_action: "APPROVE_REVIEWED_ALIAS",
    approved_canonical_entity_code: "OMSO 2-OZ",
    approved_source_field: "gProdOrRotLineDescription",
    approved_source_value: "OMSO",
    approved_mapping_type: "REVIEWED_SOURCE_ALIAS",
    ...reviewer
  }]);

  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.warnings.some((row) => row.issue_code === "BROAD_ALIAS_ACCEPTED_WITH_JUSTIFICATION"), true);
});

test("APPROVE_TARGET_PROFILE requires target bucket qty unit and effective_from", () => {
  const result = intake([{ review_id: "TGT00001", review_type: "TARGET_PROFILE", approval_status: "approved", approved_action: "APPROVE_TARGET_PROFILE", approved_canonical_entity_code: "OMSO 2-OZ", ...reviewer }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "MISSING_TARGET_BUCKET"), true);
  assert.equal(result.blockedRows.some((row) => row.issue_code === "MISSING_UNIT"), true);
});

test("invalid target qty is blocked", () => {
  const result = intake([{
    review_id: "TGT00001",
    review_type: "TARGET_PROFILE",
    approval_status: "approved",
    approved_action: "APPROVE_TARGET_PROFILE",
    approved_canonical_entity_code: "OMSO 2-OZ",
    approved_target_bucket: "OZ_LT_20",
    approved_target_qty: "0",
    approved_unit: "PCS",
    effective_from: "2026-01-01",
    ...reviewer
  }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "INVALID_TARGET_QTY"), true);
});

test("SOURCE_DATA_BACKLOG does not require canonical entity", () => {
  const result = intake([{ review_id: "GAP00001", review_type: "SOURCE_DATA_GAP", approval_status: "approved", approved_action: "SOURCE_DATA_BACKLOG", ...reviewer }]);

  assert.equal(result.sourceDataBacklogPreviewRows.length, 1);
});

test("FUTURE_USE_ONLY does not require target profile", () => {
  const result = intake([{ review_id: "DOM00001", review_type: "FUTURE_USE_DOMAIN", approval_status: "approved", approved_action: "FUTURE_USE_ONLY", ...reviewer }]);

  assert.equal(result.futureUseOnlyPreviewRows.length, 1);
});

test("blank or UNMAPPED source value cannot be approved as source mapping", () => {
  const result = intake([{
    review_id: "MAP00001",
    review_type: "SOURCE_MAPPING",
    approval_status: "approved",
    approved_action: "APPROVE_SOURCE_MAPPING",
    approved_canonical_entity_code: "OMSO 2-OZ",
    approved_source_field: "gProdOrRotLineDescription",
    approved_source_value: "UNMAPPED",
    approved_mapping_type: "EXACT_SOURCE_VALUE",
    ...reviewer
  }]);

  assert.equal(result.blockedRows.some((row) => row.issue_code === "UNMAPPED_SOURCE_MAPPING"), true);
});

test("accepted previews are written", () => {
  const result = intake([
    { review_id: "ENT00001", review_type: "ENTITY", approval_status: "approved", approved_action: "APPROVE_CANONICAL_ENTITY", approved_canonical_entity_code: "OMSO 2-OZ", ...reviewer },
    {
      review_id: "MAP00001",
      review_type: "SOURCE_MAPPING",
      approval_status: "approved",
      approved_action: "APPROVE_SOURCE_MAPPING",
      approved_canonical_entity_code: "OMSO 2-OZ",
      approved_source_field: "gProdOrRotLineDescription",
      approved_source_value: "OMSO 2-OZ",
      approved_mapping_type: "EXACT_SOURCE_VALUE",
      ...reviewer
    },
    {
      review_id: "TGT00001",
      review_type: "TARGET_PROFILE",
      approval_status: "approved",
      approved_action: "APPROVE_TARGET_PROFILE",
      approved_canonical_entity_code: "OMSO 2-OZ",
      approved_target_bucket: "OZ_LT_20",
      approved_target_qty: "360000",
      approved_unit: "PCS",
      effective_from: "2026-01-01",
      ...reviewer
    }
  ]);

  assert.equal(result.canonicalEntityPreviewRows.length, 1);
  assert.equal(result.sourceMappingPreviewRows.length, 1);
  assert.equal(result.targetProfilePreviewRows.length, 1);
});

test("safety flags remain false", () => {
  const result = intake([]);

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
  const result = intake([{ review_id: "DOM00001", review_type: "FUTURE_USE_DOMAIN", approval_status: "approved", approved_action: "FUTURE_USE_ONLY", ...reviewer }]);

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});
