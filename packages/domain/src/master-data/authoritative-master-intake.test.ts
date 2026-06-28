import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthoritativeMasterIntake,
  type AuthoritativeCanonicalEntityInputRow,
  type AuthoritativeSourceToEntityMapInputRow,
  type AuthoritativeTargetProfileInputRow
} from "./authoritative-master-intake.js";

const approvedEntity: AuthoritativeCanonicalEntityInputRow = {
  canonical_entity_code: "OMSO 2-OZ",
  canonical_entity_display_name: "OMSO 2 OZ",
  entity_family: "OMSO",
  entity_type: "MACHINE",
  production_area: "Printing",
  is_active: "true",
  source_of_truth_status: "approved",
  reviewer: "qa",
  reviewer_notes: "Reviewed as authoritative entity.",
  effective_from: "2026-01-01",
  effective_to: ""
};

const activeMapping: AuthoritativeSourceToEntityMapInputRow = {
  source_system: "business-central",
  source_field: "gProdOrRotLineDescription",
  source_value: "OMSO 2-OZ",
  canonical_entity_code: "OMSO 2-OZ",
  mapping_type: "EXACT_SOURCE_VALUE",
  confidence: "HIGH",
  is_active: "true",
  reviewer: "qa",
  reviewer_notes: "Exact reviewed source value.",
  effective_from: "2026-01-01",
  effective_to: ""
};

const approvedTarget: AuthoritativeTargetProfileInputRow = {
  canonical_entity_code: "OMSO 2-OZ",
  target_bucket: "OZ_LT_20",
  machine_center_no: "OMSO2 OZ",
  target_qty: "360000",
  unit: "PCS",
  effective_from: "2026-01-01",
  effective_to: "",
  is_active: "true",
  approval_status: "approved",
  reviewer: "qa",
  reviewer_notes: "Reviewed target profile."
};

function intake(input: {
  canonical?: readonly AuthoritativeCanonicalEntityInputRow[];
  mappings?: readonly AuthoritativeSourceToEntityMapInputRow[];
  targets?: readonly AuthoritativeTargetProfileInputRow[];
  inputFilesExist?: boolean;
} = {}) {
  return buildAuthoritativeMasterIntake({
    canonicalEntityRows: input.canonical ?? [approvedEntity],
    sourceMappingRows: input.mappings ?? [activeMapping],
    targetProfileRows: input.targets ?? [approvedTarget],
    inputFilesExist: input.inputFilesExist ?? true,
    inputFolder: ".tmp/bc-authoritative-master-input",
    outputFolder: ".tmp/bc-authoritative-master-intake",
    generatedAt: "2026-06-28T00:00:00.000Z"
  });
}

test("missing input creates templates and returns AWAITING_MASTER_INPUT", () => {
  const result = intake({ canonical: [], mappings: [], targets: [], inputFilesExist: false });

  assert.equal(result.summary.intakeStatus, "AWAITING_MASTER_INPUT");
  assert.equal(result.summary.validationErrorRows, 0);
  assert.equal(result.templatesManifest.templates.length, 3);
  assert.equal(result.summary.p10Gate.status, "BLOCKED");
});

test("approved canonical entity requires code, display name, and reviewer", () => {
  const result = intake({
    canonical: [{
      ...approvedEntity,
      canonical_entity_code: "",
      canonical_entity_display_name: "",
      reviewer: ""
    }],
    mappings: [],
    targets: []
  });

  const codes = result.validationErrorRows.map((row) => row.issue_code);
  assert.ok(codes.includes("CANONICAL_CODE_REQUIRED"));
  assert.ok(codes.includes("APPROVED_ENTITY_REQUIRES_DISPLAY_NAME"));
  assert.ok(codes.includes("APPROVED_ENTITY_REQUIRES_REVIEWER"));
  assert.equal(result.summary.intakeStatus, "INVALID");
});

test("duplicate active canonical entity is invalid", () => {
  const result = intake({ canonical: [approvedEntity, { ...approvedEntity, canonical_entity_display_name: "Duplicate" }], mappings: [], targets: [] });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "DUPLICATE_ACTIVE_CANONICAL_ENTITY"));
});

test("source mapping to missing canonical entity is invalid", () => {
  const result = intake({ canonical: [approvedEntity], mappings: [{ ...activeMapping, canonical_entity_code: "MISSING" }], targets: [] });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "MAPPING_CANONICAL_ENTITY_MISSING"));
});

test("blank or UNMAPPED source value is invalid", () => {
  const blank = intake({ mappings: [{ ...activeMapping, source_value: "(blank)" }], targets: [] });
  const unmapped = intake({ mappings: [{ ...activeMapping, source_value: "UNMAPPED" }], targets: [] });

  assert.ok(blank.validationErrorRows.some((row) => row.issue_code === "SOURCE_VALUE_REQUIRED"));
  assert.ok(unmapped.validationErrorRows.some((row) => row.issue_code === "SOURCE_VALUE_REQUIRED"));
});

test("duplicate active source mapping is invalid", () => {
  const result = intake({ mappings: [activeMapping, { ...activeMapping }], targets: [] });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "DUPLICATE_ACTIVE_SOURCE_MAPPING"));
});

test("conflicting active source mapping is invalid", () => {
  const result = intake({
    canonical: [approvedEntity, { ...approvedEntity, canonical_entity_code: "OMSO 1-OZ", canonical_entity_display_name: "OMSO 1 OZ" }],
    mappings: [activeMapping, { ...activeMapping, canonical_entity_code: "OMSO 1-OZ" }],
    targets: []
  });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "CONFLICTING_ACTIVE_SOURCE_MAPPING"));
});

test("broad family-only source mapping is invalid for protected families", () => {
  for (const sourceValue of ["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"]) {
    const result = intake({ mappings: [{ ...activeMapping, source_value: sourceValue }], targets: [] });
    assert.ok(result.validationErrorRows.some((row) => row.issue_code === "BROAD_FAMILY_SOURCE_VALUE_INVALID"), sourceValue);
  }
});

test("machineCenterNo mapping requires fallback mapping type", () => {
  const result = intake({
    mappings: [{
      ...activeMapping,
      source_field: "machineCenterNo",
      source_value: "OMSO2 OZ",
      mapping_type: "EXACT_SOURCE_VALUE"
    }],
    targets: []
  });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "MACHINE_CENTER_REQUIRES_FALLBACK_MAPPING"));
});

test("target profile to missing or inactive canonical entity is invalid", () => {
  const missing = intake({ targets: [{ ...approvedTarget, canonical_entity_code: "MISSING" }] });
  const inactive = intake({ canonical: [{ ...approvedEntity, is_active: "false" }], mappings: [], targets: [approvedTarget] });

  assert.ok(missing.validationErrorRows.some((row) => row.issue_code === "TARGET_PROFILE_CANONICAL_ENTITY_MISSING"));
  assert.ok(inactive.validationErrorRows.some((row) => row.issue_code === "TARGET_PROFILE_REQUIRES_APPROVED_ACTIVE_ENTITY"));
});

test("approved active target profile requires bucket, qty, unit, effective_from, and reviewer", () => {
  const result = intake({
    targets: [{
      ...approvedTarget,
      target_bucket: "",
      target_qty: "",
      unit: "",
      effective_from: "",
      reviewer: ""
    }]
  });

  const codes = result.validationErrorRows.map((row) => row.issue_code);
  assert.ok(codes.includes("APPROVED_TARGET_REQUIRES_BUCKET"));
  assert.ok(codes.includes("APPROVED_TARGET_REQUIRES_QTY"));
  assert.ok(codes.includes("APPROVED_TARGET_REQUIRES_UNIT"));
  assert.ok(codes.includes("APPROVED_TARGET_REQUIRES_EFFECTIVE_FROM"));
  assert.ok(codes.includes("APPROVED_TARGET_REQUIRES_REVIEWER"));
});

test("target qty must be positive numeric", () => {
  const zero = intake({ targets: [{ ...approvedTarget, target_qty: "0" }] });
  const text = intake({ targets: [{ ...approvedTarget, target_qty: "abc" }] });

  assert.ok(zero.validationErrorRows.some((row) => row.issue_code === "TARGET_QTY_MUST_BE_POSITIVE_NUMERIC"));
  assert.ok(text.validationErrorRows.some((row) => row.issue_code === "TARGET_QTY_MUST_BE_POSITIVE_NUMERIC"));
});

test("current entity is treated as legacy evidence, not source of truth", () => {
  const result = intake({
    mappings: [{
      ...activeMapping,
      source_field: "current_entity_code"
    }]
  });

  assert.ok(result.validationErrorRows.some((row) => row.issue_code === "CURRENT_ENTITY_NOT_SOURCE_OF_TRUTH"));
});

test("templates do not approve anything automatically", () => {
  const result = intake({ canonical: [], mappings: [], targets: [], inputFilesExist: false });

  assert.equal(result.templateRows.canonicalEntities.length, 0);
  assert.equal(result.templateRows.sourceToEntityMap.length, 0);
  assert.equal(result.templateRows.targetProfiles.length, 0);
  assert.equal(result.summary.approvedCanonicalEntityRows, 0);
});

test("safety flags remain false", () => {
  const result = intake();

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

test("P1.0 remains blocked", () => {
  const result = intake();

  assert.equal(result.summary.p10Gate.status, "BLOCKED");
  assert.match(result.summary.p10Gate.reason, /P1\.0 remains blocked/);
});
