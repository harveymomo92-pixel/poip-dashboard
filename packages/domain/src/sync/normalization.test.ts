import assert from "node:assert/strict";
import test from "node:test";
import {
  createODataRowHash,
  createOutputFallbackNaturalKey,
  normalizeODataOutputRow
} from "./normalization.js";

test("normalizeODataOutputRow trims strings and maps OData fields", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "42",
    Posting_Date: "2026-06-22",
    Document_No: "  prod-1 ",
    Entry_Type: " output ",
    Item_No: " fg-001 ",
    Machine_Description: " repacking ",
    Machine_Center_No: " mc-01 ",
    Quantity: "12.5",
    Unit_of_Measure_Code: " pcs ",
    Gross_Weight: "0.25",
    Reject_KG: "0"
  });

  assert.equal(result.canCommit, true);
  assert.equal(result.normalized.entryNo, 42n);
  assert.equal(result.normalized.itemNo, "FG-001");
  assert.equal(result.normalized.machineDescription, "REPACKING");
  assert.equal(result.normalized.machineCenterNo, "MC-01");
  assert.equal(result.normalized.normalizedOutputType, "OK");
});

test("normalizeODataOutputRow reports critical and warning quality issues", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "",
    Posting_Date: "2026-22-99",
    Item_No: "",
    Quantity: "-1",
    Reject_KG: "2"
  });

  assert.equal(result.canCommit, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    [
      "MISSING_ENTRY_NO",
      "MISSING_POSTING_DATE",
      "INVALID_DATE",
      "MISSING_DOCUMENT_NO",
      "MISSING_ITEM_NO",
      "MISSING_GROSS_WEIGHT",
      "NEGATIVE_QUANTITY"
    ]
  );
});

test("normalizeODataOutputRow treats negative Output quantity as an informational correction", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "43",
    Posting_Date: "2026-06-22",
    Document_No: "PROD-CORR",
    Entry_Type: "Output",
    Item_No: "FG-001",
    Quantity: "-2",
    Reject_KG: "0"
  });

  assert.equal(result.canCommit, true);
  assert.equal(result.normalized.normalizedOutputType, "OK");
  assert.deepEqual(result.issues.map((issue) => `${issue.code}:${issue.severity}`), [
    "OUTPUT_CORRECTION:INFO"
  ]);
});

test("createODataRowHash is stable across object key order", () => {
  assert.equal(createODataRowHash({ b: 2, a: 1 }), createODataRowHash({ a: 1, b: 2 }));
});

test("createOutputFallbackNaturalKey is stable and normalized", () => {
  assert.equal(
    createOutputFallbackNaturalKey({
      postingDate: "2026-06-22",
      documentNo: " prod-1 ",
      itemNo: "fg-001",
      machineDescription: "repacking",
      machineCenterNo: "mc-01",
      quantity: 10,
      entryType: "output"
    }),
    "2026-06-22|PROD-1|FG-001|REPACKING|10.0000|OUTPUT"
  );
});
