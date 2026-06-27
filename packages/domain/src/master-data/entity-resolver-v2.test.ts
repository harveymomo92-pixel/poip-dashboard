import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessCentralCanonicalEntityCatalog,
  classifyBusinessCentralEntityV2MismatchReview,
  classifyBusinessCentralEntityV2Review,
  inferBusinessCentralTargetBucketCandidate,
  resolveBusinessCentralEntityV2,
  type BusinessCentralCanonicalEntityInput
} from "./entity-resolver-v2.js";

const catalog = buildBusinessCentralCanonicalEntityCatalog([
  entity("OMSO-1-OZ", "OMSO 1-OZ", {
    aliases: [{ alias: "OMSO1 OZ", sourceSystem: "business-central", sourceField: "machine_center_no", isActive: false }]
  }),
  entity("OMSO-2-OZ", "OMSO 2-OZ"),
  entity("VFINE-600", "VFINE 600 ML Bottle", {
    aliases: [{ alias: "VFINE-BT400", sourceSystem: "business-central", sourceField: "machine_center_no" }]
  }),
  entity("VFINE-1500", "VFINE 1500 ML Bottle", {
    aliases: [{ alias: "VFINE-BT400", sourceSystem: "business-central", sourceField: "machine_center_no" }]
  }),
  entity("ILLIG-2", "THERMO ILLIG-2"),
  entity("REPACKING", "REPACKING")
]);

test("gProdOrRotLine_Description wins over Machine_Center_No", () => {
  const result = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "OMSO 1-OZ",
    machineCenterNo: "OMSO 2-OZ",
    itemDescription: "CUP 22 OZ PRINTING"
  }, catalog);

  assert.equal(result.resolvedEntityCode, "OMSO-1-OZ");
  assert.equal(result.sourceFieldUsed, "gProdOrRotLineDescription");
  assert.equal(result.confidence, "HIGH");
  assert.match(result.reason, /Machine_Center_No kept as routing evidence/);
});

test("Machine_Center_No fallback only when line description and line no are blank", () => {
  const result = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "",
    gProdOrRotLineNo: "",
    machineCenterNo: "REPACKING"
  }, catalog);

  assert.equal(result.resolvedEntityCode, "REPACKING");
  assert.equal(result.sourceFieldUsed, "machineCenterNo");
  assert.equal(result.confidence, "LOW");
});

test("Machine_Center_No is not used when production line description is populated but unknown", () => {
  const result = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "UNKNOWN PRODUCTION LINE",
    machineCenterNo: "REPACKING"
  }, catalog);

  assert.equal(result.resolvedEntityCode, null);
  assert.equal(result.sourceFieldUsed, "gProdOrRotLineDescription");
  assert.equal(result.confidence, "NONE");
});

test("reject rows with blank Machine_Center_No still resolve through gProdOrRotLine_Description", () => {
  const result = resolveBusinessCentralEntityV2({
    entryType: "Output",
    itemNo: "RJ-001",
    itemDescription: "REJECT CUP 12 OZ",
    gProdOrRotLineDescription: "THERMO ILLIG-2",
    machineCenterNo: ""
  }, catalog);

  assert.equal(result.resolvedEntityCode, "ILLIG-2");
  assert.equal(result.sourceFieldUsed, "gProdOrRotLineDescription");
  assert.equal(result.confidence, "HIGH");
});

test("VFINE-BT400 does not force one entity if description says different VFINE bottle sizes", () => {
  const smallBottle = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "VFINE 600 ML Bottle",
    machineCenterNo: "VFINE-BT400",
    itemDescription: "BOTOL 600 ML"
  }, catalog);
  const largeBottle = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "VFINE 1500 ML Bottle",
    machineCenterNo: "VFINE-BT400",
    itemDescription: "BOTOL 1500 ML"
  }, catalog);
  const ambiguousFallback = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "",
    gProdOrRotLineNo: "",
    machineCenterNo: "VFINE-BT400"
  }, catalog);

  assert.equal(smallBottle.resolvedEntityCode, "VFINE-600");
  assert.equal(largeBottle.resolvedEntityCode, "VFINE-1500");
  assert.equal(ambiguousFallback.resolvedEntityCode, null);
  assert.match(ambiguousFallback.reason, /Ambiguous/);
});

test("OMSO 1-OZ resolves as one entity while target bucket differs between OZ_22 and OZ_LT_20", () => {
  const oz22 = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "OMSO 1-OZ",
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP PRINTING 22 OZ"
  }, catalog);
  const oz12 = resolveBusinessCentralEntityV2({
    gProdOrRotLineDescription: "OMSO 1-OZ",
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP PRINTING 12 OZ"
  }, catalog);

  assert.equal(oz22.resolvedEntityCode, "OMSO-1-OZ");
  assert.equal(oz12.resolvedEntityCode, "OMSO-1-OZ");
  assert.equal(oz22.targetBucketCandidate, "OZ_22");
  assert.equal(oz12.targetBucketCandidate, "OZ_LT_20");
});

test("unknown bucket remains UNKNOWN instead of guessing", () => {
  const result = inferBusinessCentralTargetBucketCandidate({
    itemDescription: "CUSTOM COMPONENT",
    machineCenterNo: "MC-UNKNOWN"
  });

  assert.equal(result.targetBucketCandidate, "UNKNOWN");
});

test("22 OZ item produces OZ_22", () => {
  const result = inferBusinessCentralTargetBucketCandidate({
    itemDescription: "CUP 22OZ CLEAR"
  });

  assert.equal(result.targetBucketCandidate, "OZ_22");
});

test("10/12/14/16/18 OZ items produce OZ_LT_20", () => {
  for (const size of [10, 12, 14, 16, 18]) {
    const result = inferBusinessCentralTargetBucketCandidate({
      itemDescription: `CUP ${size} OZ PRINTING`
    });
    assert.equal(result.targetBucketCandidate, "OZ_LT_20");
  }
});

test("BOTOL 600 ML item produces BOTOL_SIZE_600_ML", () => {
  const result = inferBusinessCentralTargetBucketCandidate({
    itemDescription: "BOTOL ROUND 600 ML"
  });

  assert.equal(result.targetBucketCandidate, "BOTOL_SIZE_600_ML");
});

test("PREFORM 19 GR item produces PREFORM_WEIGHT_19_GR", () => {
  const result = inferBusinessCentralTargetBucketCandidate({
    itemDescription: "PREFORM 19 GR NATURAL"
  });

  assert.equal(result.targetBucketCandidate, "PREFORM_WEIGHT_19_GR");
});

test("CURRENT_MAPPED_V2_UNMAPPED legacy Thermoforming entity is classified as canonical catalog gap", () => {
  const review = classifyBusinessCentralEntityV2Review({
    comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "THERMO HENGFENG-2-OZ",
    currentEntityCode: "THERMO HENGFENG-2-OZ - Thermoforming",
    v2EntityCode: ""
  });

  assert.equal(review.classification, "CANONICAL_CATALOG_GAP");
  assert.equal(review.suggestedCanonicalEntityCode, "THERMO HENGFENG-2-OZ");
  assert.match(review.recommendedAction, /do not auto-migrate in P0\.7/);
});

test("OMSO printing target variants are classified as legacy target variant collapse needed", () => {
  for (const currentEntityCode of [
    "OMSO 1-OZ - Printing 22 OZ",
    "OMSO 1-OZ - Printing OZ < 20"
  ]) {
    const review = classifyBusinessCentralEntityV2Review({
      comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
      sourceFieldUsed: "gProdOrRotLineDescription",
      sourceValueUsed: "OMSO 1-OZ",
      currentEntityCode,
      v2EntityCode: ""
    });

    assert.equal(review.classification, "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED");
    assert.equal(review.suggestedCanonicalEntityCode, "OMSO 1-OZ");
  }
});

test("BOTH_UNMAPPED with blank source stays OK_BOTH_UNMAPPED", () => {
  const review = classifyBusinessCentralEntityV2Review({
    comparisonStatus: "BOTH_UNMAPPED",
    sourceFieldUsed: "UNMAPPED",
    sourceValueUsed: "",
    currentEntityCode: "",
    v2EntityCode: ""
  });

  assert.equal(review.classification, "OK_BOTH_UNMAPPED");
});

test("DIFFERENT_ENTITY unrelated current and v2 entities are classified as possible resolver mismatch", () => {
  const review = classifyBusinessCentralEntityV2Review({
    comparisonStatus: "DIFFERENT_ENTITY",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "VFINE 600 ML Bottle",
    currentEntityCode: "OMSO 1-OZ",
    v2EntityCode: "VFINE-600"
  });

  assert.equal(review.classification, "POSSIBLE_RESOLVER_MISMATCH");
});

test("POLYPRINT legacy name variants are not treated as hard resolver failures", () => {
  const review = classifyBusinessCentralEntityV2MismatchReview({
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "POLYPRINT PRINTING-OZ-2",
    currentEntityCode: "POLYPRINT PRINTING-OZ-2 - Printing 22 OZ",
    v2EntityCode: "POLYPRINT 2 PRINTING-OZ"
  });

  assert.equal(review.type, "LEGACY_NAME_VARIANT");
  assert.equal(review.riskLevel, "LOW");
});

test("same source value with multiple current entity codes is a source-value alias conflict", () => {
  const review = classifyBusinessCentralEntityV2MismatchReview({
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "SHARED SOURCE",
    currentEntityCode: "ENTITY-A",
    v2EntityCode: "ENTITY-B",
    currentEntityCodesForSourceValue: ["ENTITY-A", "ENTITY-C"],
    v2EntityCodesForSourceValue: ["ENTITY-B"]
  });

  assert.equal(review.type, "SOURCE_VALUE_ALIAS_CONFLICT");
  assert.equal(review.riskLevel, "MEDIUM");
});

test("machine center fallback conflict is classified as machine-center conflict", () => {
  const review = classifyBusinessCentralEntityV2MismatchReview({
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    sourceFieldUsed: "machineCenterNo",
    sourceValueUsed: "VFINE-BT400",
    machineCenterNo: "VFINE-BT400",
    machineCenterSourceValues: ["VFINE 600 ML Bottle", "VFINE 1500 ML Bottle"],
    currentEntityCode: "VFINE-600",
    v2EntityCode: "VFINE-1500"
  });

  assert.equal(review.type, "MACHINE_CENTER_CONFLICT");
  assert.equal(review.riskLevel, "MEDIUM");
});

test("clearly unrelated current and v2 entity is possible true resolver bug", () => {
  const review = classifyBusinessCentralEntityV2MismatchReview({
    comparisonStatus: "DIFFERENT_ENTITY",
    reviewClassification: "POSSIBLE_RESOLVER_MISMATCH",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "VFINE 600 ML Bottle",
    currentEntityCode: "OMSO 1-OZ",
    v2EntityCode: "VFINE-600"
  });

  assert.equal(review.type, "POSSIBLE_TRUE_RESOLVER_BUG");
  assert.equal(review.riskLevel, "HIGH");
});

test("unknown mismatch review falls back to unknown review type", () => {
  const review = classifyBusinessCentralEntityV2MismatchReview({
    comparisonStatus: "CURRENT_MAPPED_V2_UNMAPPED",
    reviewClassification: "UNKNOWN_REVIEW_NEEDED",
    sourceFieldUsed: "gProdOrRotLineDescription",
    sourceValueUsed: "UNKNOWN",
    currentEntityCode: "UNKNOWN-A",
    v2EntityCode: ""
  });

  assert.equal(review.type, "UNKNOWN_MISMATCH_REVIEW");
});

function entity(
  entityCode: string,
  displayName: string,
  options: Partial<BusinessCentralCanonicalEntityInput> = {}
): BusinessCentralCanonicalEntityInput {
  return {
    entityCode,
    displayName,
    isActive: true,
    ...options
  };
}
