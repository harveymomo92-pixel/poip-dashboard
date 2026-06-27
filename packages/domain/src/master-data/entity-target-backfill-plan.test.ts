import assert from "node:assert/strict";
import test from "node:test";
import {
  planEntityV2Backfill,
  planTargetProfileBackfill
} from "./entity-target-backfill-plan.js";

test("OMSO target-variant entity collapses to canonical OMSO 1-OZ with low risk", () => {
  const plan = planEntityV2Backfill({
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "OMSO 1-OZ",
    currentEntityCode: "OMSO 1-OZ - Printing 22 OZ",
    currentEntityDisplayName: "OMSO 1-OZ - Printing 22 OZ",
    currentEntityCodesForSourceValue: [
      "OMSO 1-OZ - Printing 22 OZ",
      "OMSO 1-OZ - Printing OZ < 20"
    ],
    proposedEntityCode: null,
    proposedEntityDisplayName: null,
    suggestedCanonicalEntityCode: "OMSO 1-OZ",
    suggestedCanonicalEntityDisplayName: "OMSO 1-OZ",
    comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
    reviewClassification: "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED"
  });

  assert.equal(plan.proposedCanonicalEntityCode, "OMSO 1-OZ");
  assert.equal(plan.riskLevel, "LOW");
  assert.equal(plan.backfillAction, "PROPOSE_CANONICAL_ENTITY_CREATION");
});

test("POLYPRINT target-variant entity collapses to canonical POLYPRINT 2 PRINTING-OZ with low risk", () => {
  const plan = planEntityV2Backfill({
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "POLYPRINT 2 PRINTING-OZ",
    currentEntityCode: "POLYPRINT 2 PRINTING-OZ - Printing OZ < 20",
    currentEntityDisplayName: "Polyprint 2 - Printing Cup OZ - Printing OZ < 20",
    currentEntityCodesForSourceValue: [
      "POLYPRINT 2 PRINTING-OZ - Printing 22 OZ",
      "POLYPRINT 2 PRINTING-OZ - Printing OZ < 20"
    ],
    suggestedCanonicalEntityCode: "POLYPRINT 2 PRINTING-OZ",
    suggestedCanonicalEntityDisplayName: "POLYPRINT 2 PRINTING-OZ",
    comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
    reviewClassification: "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED"
  });

  assert.equal(plan.proposedCanonicalEntityCode, "POLYPRINT 2 PRINTING-OZ");
  assert.equal(plan.riskLevel, "LOW");
});

test("VFINE 600 source mapped to VFINE 400 is not auto-safe", () => {
  const plan = planEntityV2Backfill({
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "VFINE BOTOL 600 ML",
    currentEntityCode: "VFINE BOTOL 400 ML",
    currentEntityDisplayName: "VFINE BOTOL 400 ML",
    currentEntityCodesForSourceValue: ["VFINE BOTOL 400 ML"],
    proposedEntityCode: "VFINE BOTOL 600 ML",
    proposedEntityDisplayName: "VFINE BOTOL 600 ML",
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    mismatchReviewType: "LEGACY_NAME_VARIANT"
  });

  assert.match(plan.riskLevel, /MEDIUM|HIGH/);
  assert.notEqual(plan.backfillAction, "PROPOSE_CANONICAL_ENTITY_COLLAPSE");
});

test("multiple unrelated current entity codes for one source value are high risk", () => {
  const plan = planEntityV2Backfill({
    sourceField: "gProdOrRotLineDescription",
    sourceValue: "THERMO 5 HENGFENG",
    currentEntityCode: "THERMO HENGFENG-3 - Thermoforming",
    currentEntityDisplayName: "THERMO HENGFENG-3 - Thermoforming",
    currentEntityCodesForSourceValue: [
      "THERMO HENGFENG-3 - Thermoforming",
      "THERMO 7 HENGFENG-OZ - Thermoforming"
    ],
    proposedEntityCode: "THERMO 7 HENGFENG-OZ - Thermoforming",
    proposedEntityDisplayName: "THERMO 7 HENGFENG-OZ - Thermoforming",
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    mismatchReviewType: "SOURCE_VALUE_ALIAS_CONFLICT"
  });

  assert.equal(plan.riskLevel, "HIGH");
  assert.equal(plan.backfillAction, "REVIEW_ALIAS_CONFLICT");
});

test("missing source value is a high-risk data source gap", () => {
  const plan = planEntityV2Backfill({
    sourceField: "UNMAPPED",
    sourceValue: "",
    currentEntityCode: "CURRENT",
    currentEntityDisplayName: "CURRENT",
    comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
    reviewClassification: "POSSIBLE_DATA_SOURCE_GAP"
  });

  assert.equal(plan.riskLevel, "HIGH");
  assert.equal(plan.backfillAction, "REVIEW_DATA_SOURCE_GAP");
});

test("target profile candidate without target qty remains draft and not approved", () => {
  const plan = planTargetProfileBackfill({
    canonicalEntityCode: "OMSO 1-OZ",
    canonicalEntityDisplayName: "OMSO 1-OZ",
    currentEntityCode: "OMSO 1-OZ - Printing 22 OZ",
    currentEntityDisplayName: "OMSO 1-OZ - Printing 22 OZ",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    proposedTargetQty: null,
    entityBackfillRiskLevel: "LOW",
    entityBackfillAction: "PROPOSE_CANONICAL_ENTITY_CREATION"
  });

  assert.equal(plan.proposedTargetQty, null);
  assert.equal(plan.approvalStatus, "draft");
  assert.notEqual(plan.riskLevel, "LOW");
  assert.equal(plan.recommendedAction, "Fill target_qty manually before migration.");
});
