import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessCentralCanonicalEntityCatalog,
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
