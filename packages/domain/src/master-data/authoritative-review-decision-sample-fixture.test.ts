import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthoritativeReviewDecisionSampleFixture
} from "./authoritative-review-decision-sample-fixture.js";
import type { AuthoritativeMasterReviewerDecisionTemplateRow } from "./authoritative-master-review-workspace.js";

const workspaceRows: AuthoritativeMasterReviewerDecisionTemplateRow[] = [
  template("ENT00001", "ENTITY", { canonical: "OMSO 2-OZ" }),
  template("MAP00001", "SOURCE_MAPPING", {
    canonical: "OMSO 2-OZ",
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "OMSO 2-OZ",
    mappingType: "EXACT_SOURCE_VALUE"
  }),
  template("TPR00001", "TARGET_PROFILE", {
    canonical: "OMSO 2-OZ",
    targetBucket: "OZ_LT_20",
    machineCenter: "OMSO2 OZ",
    targetQty: "360000",
    unit: "PCS",
    effectiveFrom: "2026-01-01"
  }),
  template("CON00001", "CONFLICT", {
    canonical: "OMSO 2-OZ",
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "OMSO 2-OZ"
  }),
  template("GAP00001", "SOURCE_DATA_GAP"),
  template("DOM00001", "FUTURE_USE_DOMAIN")
];

test("missing workspace returns BLOCKED_MISSING_WORKSPACE", () => {
  const result = buildAuthoritativeReviewDecisionSampleFixture({
    workspaceRows: [],
    sourceWorkspaceFolder: "missing",
    outputFolder: "out",
    generatedAt: "2026-06-29T00:00:00.000Z"
  });

  assert.equal(result.summary.fixtureStatus, "BLOCKED_MISSING_WORKSPACE");
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("fixture writes representative sample files", () => {
  const result = buildFixture();

  assert.equal(result.summary.fixtureStatus, "GENERATED");
  assert.ok(result.sampleRows.length >= 5);
  assert.ok(result.safeDeferRows.length >= 3);
  assert.ok(result.mixedSimulationRows.length >= 6);
  assert.deepEqual(
    result.importManifest.fixtureFiles,
    ["reviewer-decisions.sample.csv", "reviewer-decisions.safe-defer-all.csv", "reviewer-decisions.mixed-simulation.csv"]
  );
});

test("fixture does not write or overwrite reviewer-decisions.csv", () => {
  const result = buildFixture();

  assert.equal(result.summary.overwroteRealReviewerDecisionFile, false);
  assert.equal(result.importManifest.realReviewerDecisionFileWritten, false);
});

test("sample rows use real review_id values", () => {
  const result = buildFixture();
  const realIds = new Set(workspaceRows.map((row) => row.review_id));

  for (const row of result.sampleRows) {
    assert.ok(realIds.has(row.review_id), `${row.review_id} should come from workspace`);
  }
});

test("sample approved rows include reviewer and reviewer_notes", () => {
  const result = buildFixture();
  const approvedRows = result.sampleRows.filter((row) => row.approval_status === "approved");

  assert.ok(approvedRows.length > 0);
  for (const row of approvedRows) {
    assert.equal(row.reviewer, "TEST_REVIEWER");
    assert.match(row.reviewer_notes, /TEST_FIXTURE_DRY_RUN_ONLY/);
  }
});

test("safe defer file has acceptedRows expectation 0", () => {
  const result = buildFixture();
  const expectation = result.sampleValidationExpectations.find((row) => row.fixture_file === "reviewer-decisions.safe-defer-all.csv");

  assert.equal(expectation?.expected_accepted_min, 0);
  assert.equal(expectation?.expected_deferred_min, result.safeDeferRows.length);
});

test("mixed simulation includes invalid, duplicate, and unknown example rows", () => {
  const result = buildFixture();
  const ids = result.mixedSimulationRows.map((row) => row.review_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  assert.ok(result.mixedSimulationRows.some((row) => row.review_id === "UNKNOWN_REVIEW_ID_FOR_TEST_FIXTURE"));
  assert.ok(duplicateIds.length > 0);
  assert.ok(result.mixedSimulationRows.some((row) => row.approval_status === "approved" && row.reviewer_notes === ""));
});

test("convenience sample flag is reported", () => {
  const result = buildFixture({ wroteConvenienceSampleFile: true });

  assert.equal(result.summary.wroteConvenienceSampleFile, true);
});

test("safety flags remain false", () => {
  const result = buildFixture();

  assert.deepEqual(Object.values(result.summary.safety), [false, false, false, false, false, false, false, false]);
});

test("P1.0 remains blocked", () => {
  const result = buildFixture();

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

function buildFixture(input?: { readonly wroteConvenienceSampleFile?: boolean }) {
  return buildAuthoritativeReviewDecisionSampleFixture({
    workspaceRows,
    sourceWorkspaceFolder: ".tmp/bc-authoritative-master-review-workspace",
    outputFolder: ".tmp/bc-authoritative-review-decision-sample-fixture",
    ...(input?.wroteConvenienceSampleFile === undefined ? {} : { wroteConvenienceSampleFile: input.wroteConvenienceSampleFile }),
    generatedAt: "2026-06-29T00:00:00.000Z"
  });
}

function template(
  reviewId: string,
  reviewType: string,
  values: Partial<{
    readonly canonical: string;
    readonly sourceField: string;
    readonly sourceValue: string;
    readonly mappingType: string;
    readonly targetBucket: string;
    readonly machineCenter: string;
    readonly targetQty: string;
    readonly unit: string;
    readonly effectiveFrom: string;
    readonly effectiveTo: string;
  }> = {}
): AuthoritativeMasterReviewerDecisionTemplateRow {
  return {
    review_id: reviewId,
    review_type: reviewType,
    approval_status: "pending",
    approved_action: "",
    approved_canonical_entity_code: values.canonical ?? "",
    approved_source_field: values.sourceField ?? "",
    approved_source_value: values.sourceValue ?? "",
    approved_mapping_type: values.mappingType ?? "",
    approved_target_bucket: values.targetBucket ?? "",
    approved_machine_center_no: values.machineCenter ?? "",
    approved_target_qty: values.targetQty ?? "",
    approved_unit: values.unit ?? "",
    effective_from: values.effectiveFrom ?? "",
    effective_to: values.effectiveTo ?? "",
    reviewer: "",
    reviewer_notes: ""
  };
}
