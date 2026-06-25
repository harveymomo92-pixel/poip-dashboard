import assert from "node:assert/strict";
import test from "node:test";
import { classifyOutputRow } from "./output-classification.js";

test("classifyOutputRow treats RJ item with KG as reject", () => {
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "RJ015", uom: "KG" }), "REJECT");
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "rj015", uom: "kg" }), "REJECT");
});

test("classifyOutputRow treats non-RJ PCS item as OK", () => {
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "PF192CL12", uom: "PCS" }), "OK");
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "pf192cl12", uom: "pcs" }), "OK");
});

test("classifyOutputRow exposes UOM mismatches instead of coercing to OK or reject", () => {
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "RJ015", uom: "PCS" }), "REJECT_UOM_MISMATCH");
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "PF192CL12", uom: "KG" }), "OK_UOM_MISMATCH");
});

test("classifyOutputRow handles missing data and non-output rows explicitly", () => {
  assert.equal(classifyOutputRow({ entryType: "Output", itemNo: "", uom: "PCS" }), "UNKNOWN_OUTPUT_CLASS");
  assert.equal(classifyOutputRow({ entryType: "Sale", itemNo: "PF192CL12", uom: "PCS" }), "OTHER");
});
