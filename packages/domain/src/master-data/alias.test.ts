import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyMachineFamilyKey,
  normalizeAliasDisplay,
  normalizeAliasKey,
  sourceAliasCandidates
} from "./alias.js";

test("normalizeAliasDisplay trims, uppercases, and collapses whitespace", () => {
  assert.equal(normalizeAliasDisplay("  hengfeng\u00a04   oz "), "HENGFENG 4 OZ");
});

test("normalizeAliasKey removes common separators safely", () => {
  assert.equal(normalizeAliasKey("CP1-9.7/12.5/14"), "CP19712514");
  assert.equal(normalizeAliasKey("HENGFENG\u00a04\u00a0OZ"), "HENGFENG4OZ");
});

test("legacyMachineFamilyKey maps v1 machine families", () => {
  assert.equal(legacyMachineFamilyKey("HF4"), "HENGFENG");
  assert.equal(legacyMachineFamilyKey("TF-2"), "ILLIG");
  assert.equal(legacyMachineFamilyKey("V-FINE BT400"), "VFINE");
  assert.equal(legacyMachineFamilyKey("CP1-9.7/12.5/14"), "CHUMPOWER");
});

test("sourceAliasCandidates emits normalized source values", () => {
  assert.deepEqual(
    sourceAliasCandidates({
      machineCenterNo: " Illig 2 ",
      prodLineNo: "L-01",
      prodLineDescription: "",
      itemNo: "fg-001",
      uom: " pcs "
    }),
    [
      { sourceField: "machine_center_no", sourceValue: "ILLIG 2", normalizedValue: "ILLIG2" },
      { sourceField: "prod_line_no", sourceValue: "L-01", normalizedValue: "L01" },
      { sourceField: "item_no", sourceValue: "FG-001", normalizedValue: "FG001" },
      { sourceField: "uom", sourceValue: "PCS", normalizedValue: "PCS" }
    ]
  );
});
