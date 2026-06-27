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
    gItem_Description: " finished item ",
    Machine_Description: " repacking ",
    Machine_Center_No: " mc-01 ",
    gProdOrRotLine_No: "OMSO-1-OZ",
    gProdOrRotLine_Description: "OMSO 1-OZ",
    Quantity: "12.5",
    Unit_of_Measure_Code: " pcs ",
    Gross_Weight: "0.25",
    Reject_KG: "0"
  });

  assert.equal(result.canCommit, true);
  assert.equal(result.normalized.entryNo, 42n);
  assert.equal(result.normalized.itemNo, "FG-001");
  assert.equal(result.normalized.itemDescription, "finished item");
  assert.equal(result.normalized.machineDescription, "REPACKING");
  assert.equal(result.normalized.machineCenterNo, "MC-01");
  assert.equal(result.normalized.prodLineNo, "OMSO-1-OZ");
  assert.equal(result.normalized.prodLineDescription, "OMSO 1-OZ");
  assert.equal(result.normalized.normalizedOutputType, "OK");
});

test("normalizeODataOutputRow reads machine description aliases and tolerates missing values", () => {
  const spaced = normalizeODataOutputRow({
    Entry_No: "47",
    Posting_Date: "2026-06-22",
    Document_No: "DOC-47",
    Entry_Type: "Output",
    Item_No: "FG-001",
    gItem_Description: " item from gitem ",
    "Machine Description": " illig 1 ",
    Quantity: "12",
    Unit_of_Measure_Code: "PCS"
  });
  const camel = normalizeODataOutputRow({
    Entry_No: "48",
    Posting_Date: "2026-06-22",
    Document_No: "DOC-48",
    Entry_Type: "Output",
    Item_No: "FG-001",
    gItem_Description: " item from gitem 2 ",
    MachineDescription: " cai 2 ",
    Quantity: "12",
    Unit_of_Measure_Code: "PCS"
  });
  const missing = normalizeODataOutputRow({
    Entry_No: "49",
    Posting_Date: "2026-06-22",
    Document_No: "DOC-49",
    Entry_Type: "Output",
    Item_No: "FG-001",
    Quantity: "12",
    Unit_of_Measure_Code: "PCS"
  });

  assert.equal(spaced.normalized.machineDescription, "ILLIG 1");
  assert.equal(camel.normalized.machineDescription, "CAI 2");
  assert.equal(missing.normalized.machineDescription, null);
  assert.equal(missing.canCommit, true);
});

test("normalizeODataOutputRow maps profiled Business Central line fields and does not use gSrcDesc as machine", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "50",
    Posting_Date: "2026-06-22",
    Document_No: "DOC-50",
    Entry_Type: "Output",
    Item_No: "RJ008",
    gItem_Description: "REJECT CUP PRINTING (PP)",
    Machine_Center_No: "",
    gProdOrRotLine_No: "OMSO-1-OZ",
    gProdOrRotLine_Description: "OMSO 1-OZ",
    gSrcDesc: "REJECT CUP PRINTING (PP)",
    Quantity: "12",
    Unit_of_Measure_Code: "KG"
  });

  assert.equal(result.normalized.machineDescription, null);
  assert.equal(result.normalized.prodLineNo, "OMSO-1-OZ");
  assert.equal(result.normalized.prodLineDescription, "OMSO 1-OZ");
  assert.equal(result.normalized.itemDescription, "REJECT CUP PRINTING (PP)");
});

test("normalizeODataOutputRow reports critical and warning quality issues", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "",
    Posting_Date: "2026-22-99",
    Item_No: "",
    Entry_Type: "Output",
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
      "UNKNOWN_OUTPUT_CLASS",
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
    Unit_of_Measure_Code: "PCS",
    Quantity: "-2",
    Reject_KG: "0"
  });

  assert.equal(result.canCommit, true);
  assert.equal(result.normalized.normalizedOutputType, "OK");
  assert.deepEqual(result.issues.map((issue) => `${issue.code}:${issue.severity}`), [
    "OUTPUT_CORRECTION:INFO"
  ]);
});

test("normalizeODataOutputRow classifies RJ KG rows as reject using quantity kg", () => {
  const result = normalizeODataOutputRow({
    Entry_No: "44",
    Posting_Date: "2026-06-22",
    Document_No: "SPK2606/F0012",
    Entry_Type: "Output",
    Item_No: "rj015",
    Description: "REJECT GUMPALAN PET",
    Quantity: "2.5",
    Unit_of_Measure_Code: "kg",
    Gross_Weight: "0.5"
  });

  assert.equal(result.canCommit, true);
  assert.equal(result.normalized.normalizedOutputType, "REJECT");
  assert.equal(result.normalized.itemNo, "RJ015");
  assert.equal(result.normalized.uom, "KG");
  assert.equal(result.normalized.rejectKg, 2.5);
  assert.equal(result.normalized.rejectPcsEq, 5);
});

test("normalizeODataOutputRow flags output classification mismatches", () => {
  const rejectMismatch = normalizeODataOutputRow({
    Entry_No: "45",
    Posting_Date: "2026-06-22",
    Document_No: "SPK-MISMATCH-1",
    Entry_Type: "Output",
    Item_No: "RJ015",
    Quantity: "1",
    Unit_of_Measure_Code: "PCS"
  });
  const okMismatch = normalizeODataOutputRow({
    Entry_No: "46",
    Posting_Date: "2026-06-22",
    Document_No: "SPK-MISMATCH-2",
    Entry_Type: "Output",
    Item_No: "PF192CL12",
    Quantity: "1",
    Unit_of_Measure_Code: "KG"
  });

  assert.equal(rejectMismatch.normalized.normalizedOutputType, "REJECT_UOM_MISMATCH");
  assert.ok(rejectMismatch.issues.some((issue) => issue.code === "REJECT_UOM_MISMATCH"));
  assert.equal(okMismatch.normalized.normalizedOutputType, "OK_UOM_MISMATCH");
  assert.ok(okMismatch.issues.some((issue) => issue.code === "OK_UOM_MISMATCH"));
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
