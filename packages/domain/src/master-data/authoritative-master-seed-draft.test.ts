import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthoritativeMasterSeedDraft,
  decideAuthoritativeSeedWriteTarget,
  type AuthoritativeSeedEvidenceRow,
  type AuthoritativeTargetProfileSeedEvidenceRow
} from "./authoritative-master-seed-draft.js";

const baseEvidence: AuthoritativeSeedEvidenceRow = {
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  current_entity_code: "OMSO 2-OZ - Printing 22 OZ",
  v2_entity_code: "OMSO 2-OZ",
  suggested_canonical_entity_code: "OMSO 2-OZ",
  suggested_canonical_entity_display_name: "OMSO 2 OZ",
  target_bucket_candidate: "OZ_LT_20",
  machine_center_no: "OMSO2 OZ",
  document_no: "SPK2601/P0001",
  item_no: "CR16OZOTPC",
  bc_current_kpi_scope: "OUTPUT_KPI_OK_SCOPE",
  review_classification: "OK_SAME_ENTITY",
  risk_level: "LOW"
};

const baseTarget: AuthoritativeTargetProfileSeedEvidenceRow = {
  canonical_entity_code: "OMSO 2-OZ",
  target_bucket: "OZ_LT_20",
  machine_center_no: "OMSO2 OZ",
  target_qty: "360000",
  unit: "PCS",
  effective_from: "2026-01-01",
  rows: 10
};

function seed(
  evidenceRows: readonly AuthoritativeSeedEvidenceRow[] = [baseEvidence],
  targetRows: readonly AuthoritativeTargetProfileSeedEvidenceRow[] = [baseTarget]
) {
  return buildAuthoritativeMasterSeedDraft({
    entityEvidenceRows: evidenceRows,
    targetProfileEvidenceRows: targetRows,
    outputFolder: ".tmp/bc-authoritative-master-seed-draft",
    inputFolder: ".tmp/bc-authoritative-master-input",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

test("seed draft does not mark any row approved", () => {
  const result = seed();

  assert.equal(result.canonicalSeedRows[0]?.source_of_truth_status, "draft");
  assert.equal(result.targetProfileSeedRows[0]?.approval_status, "draft");
  assert.equal(result.summary.safety.generatedRowsApproved, false);
});

test("seed draft does not overwrite non-empty user input files", () => {
  const decision = decideAuthoritativeSeedWriteTarget({
    canonicalInputHasData: true,
    sourceMapInputHasData: false,
    targetProfilesInputHasData: false
  });

  assert.equal(decision.writeWorkingInputFiles, false);
  assert.equal(decision.writeDraftFilesOnly, true);
});

test("blank or UNMAPPED is excluded and sent to review output", () => {
  const result = seed([{ ...baseEvidence, source_value: "(blank)", v2_entity_code: "", suggested_canonical_entity_code: "" }], []);

  assert.equal(result.canonicalSeedRows.length, 0);
  assert.ok(result.excludedSourceValueRows.some((row) => row.exclusion_reason.includes("Blank/UNMAPPED")));
  assert.ok(result.seedReviewQueueRows.some((row) => row.review_category === "SOURCE_REVIEW"));
});

test("RJ or reject item values are not generated as canonical entities", () => {
  const result = seed([{ ...baseEvidence, source_value: "RJ001", v2_entity_code: "RJ001", suggested_canonical_entity_code: "RJ001" }], []);

  assert.equal(result.canonicalSeedRows.length, 0);
  assert.ok(result.excludedSourceValueRows.some((row) => row.exclusion_reason.includes("Reject")));
});

test("SP or sparepart item values are not generated as canonical entities", () => {
  const result = seed([{ ...baseEvidence, source_value: "SP5000000012", v2_entity_code: "SP5000000012", suggested_canonical_entity_code: "SP5000000012" }], []);

  assert.equal(result.canonicalSeedRows.length, 0);
  assert.ok(result.excludedSourceValueRows.some((row) => row.exclusion_reason.includes("Sparepart")));
});

test("exact OData source values generate source mappings", () => {
  const result = seed();

  assert.equal(result.sourceMapSeedRows.length, 1);
  assert.equal(result.sourceMapSeedRows[0]?.source_field, "gProdOrRotLineDescription");
  assert.equal(result.sourceMapSeedRows[0]?.source_value, "OMSO 2-OZ");
  assert.equal(result.sourceMapSeedRows[0]?.mapping_type, "EXACT_SOURCE_VALUE");
});

test("machineCenterNo is not generated as primary mapping", () => {
  const result = seed([{ ...baseEvidence, source_field: "machineCenterNo", source_value: "OMSO2 OZ" }], []);

  assert.equal(result.sourceMapSeedRows.length, 0);
  assert.ok(result.excludedSourceValueRows.some((row) => row.exclusion_reason.includes("fallback")));
});

test("target profile seed rows are draft only", () => {
  const result = seed();

  assert.equal(result.targetProfileSeedRows.length, 1);
  assert.equal(result.targetProfileSeedRows[0]?.approval_status, "draft");
  assert.equal(result.targetProfileSeedRows[0]?.reviewer, "");
});

test("missing target_qty or unit creates warning", () => {
  const result = seed([baseEvidence], [{ ...baseTarget, target_qty: "", unit: "" }]);

  assert.ok(result.seedQualityWarningRows.some((row) => row.warning_category === "TARGET_PROFILE_MISSING_QTY_OR_UNIT"));
});

test("legacy current entity is crosswalk evidence only", () => {
  const result = seed([{ ...baseEvidence, current_entity_code: "OMSO 1-OZ - Printing 22 OZ" }], []);

  assert.equal(result.legacyEvidenceCrosswalkRows[0]?.legacy_current_entity_codes, "OMSO 1-OZ - Printing 22 OZ");
  assert.equal(result.canonicalSeedRows[0]?.canonical_entity_code, "OMSO 2-OZ");
});

test("safety flags remain false", () => {
  const result = seed();

  assert.deepEqual(result.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false,
    generatedRowsApproved: false,
    masterDataApplied: false
  });
});

test("P1.0 remains blocked", () => {
  const result = seed();

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});
