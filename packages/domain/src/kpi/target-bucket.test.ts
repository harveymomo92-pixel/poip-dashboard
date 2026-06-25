import assert from "node:assert/strict";
import test from "node:test";
import { inferResumeTargetBucket } from "./target-bucket.js";

test("inferResumeTargetBucket maps printing 22 OZ items", () => {
  const result = inferResumeTargetBucket({
    machineCenterNo: "OMSO-2-OZ",
    itemDescription: "CUP 22 OZ KOPI KENANGAN",
    itemCategoryCode: "JADI-PRINTING"
  });

  assert.equal(result.reason, "INFERRED");
  assert.equal(result.bucket, "target_printing_22_oz");
});

test("inferResumeTargetBucket maps printing non-OZ items", () => {
  const result = inferResumeTargetBucket({
    machineCenterNo: "POLYPRINT-1",
    itemDescription: "CUP SABLON LOGO",
    itemCategoryCode: "JADI-PRINTING"
  });

  assert.equal(result.reason, "INFERRED");
  assert.equal(result.bucket, "target_printing_non_oz");
});

test("inferResumeTargetBucket maps thermoforming by gross weight threshold", () => {
  const regular = inferResumeTargetBucket({
    machineCenterNo: "THERMO HENGFENG-2-OZ",
    itemDescription: "CUP 12 OZ",
    grossWeightPerPcs: 0.011
  });
  const heavy = inferResumeTargetBucket({
    machineCenterNo: "THERMO HENGFENG-2-OZ",
    itemDescription: "CUP 22 OZ",
    grossWeightPerPcs: 0.012
  });

  assert.equal(regular.bucket, "target_thermoforming");
  assert.equal(heavy.bucket, "target_thermoforming_gw_gt_12");
});

test("inferResumeTargetBucket reads machine description signals", () => {
  const result = inferResumeTargetBucket({
    machineDescription: "HENGFENG 4 OZ",
    itemDescription: "CUP 12 OZ"
  });

  assert.equal(result.reason, "INFERRED");
  assert.equal(result.bucket, "target_thermoforming");
});

test("inferResumeTargetBucket maps bottle and preform family", () => {
  const result = inferResumeTargetBucket({
    machineCenterNo: "BORCH 1 PREFORM 19 GR",
    itemDescription: "PREFORM 19 gram"
  });

  assert.equal(result.reason, "INFERRED");
  assert.equal(result.bucket, "target_botol_preform");
});

test("inferResumeTargetBucket returns missing when no reliable bucket exists", () => {
  const result = inferResumeTargetBucket({
    machineCenterNo: "MC-UNKNOWN",
    itemDescription: "Finished good"
  });

  assert.equal(result.reason, "TARGET_BUCKET_MISSING");
  assert.equal(result.bucket, null);
});

test("inferResumeTargetBucket marks conflicting family signals ambiguous", () => {
  const result = inferResumeTargetBucket({
    machineCenterNo: "OMSO PRINT",
    itemDescription: "THERMO PREFORM CUP 22 OZ",
    itemCategoryCode: "JADI-PRINTING"
  });

  assert.equal(result.reason, "TARGET_BUCKET_AMBIGUOUS");
  assert.equal(result.bucket, null);
});
