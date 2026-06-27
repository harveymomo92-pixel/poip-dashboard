import assert from "node:assert/strict";
import test from "node:test";
import {
  BC_ENTITY_SOURCE_FIELD_FALLBACKS,
  BC_ENTITY_SOURCE_FIELD_PRIMARY,
  entitySourceCandidates,
  legacyMachineFamilyKey,
  normalizeAliasDisplay,
  normalizeAliasKey,
  preferredEntitySource,
  sourceAliasCandidates
} from "./alias.js";

test("normalizeAliasDisplay trims, uppercases, and collapses whitespace", () => {
  assert.equal(normalizeAliasDisplay("  hengfeng\u00a04   oz "), "HENGFENG 4 OZ");
});

test("normalizeAliasKey removes common separators safely", () => {
  assert.equal(normalizeAliasKey("CP1-9.7/12.5/14"), "CP19712514");
  assert.equal(normalizeAliasKey("HENGFENG\u00a04\u00a0OZ"), "HENGFENG4OZ");
  assert.equal(normalizeAliasKey("newdo_1/reg"), "NEWDO1REG");
  assert.equal(normalizeAliasKey(" Illig - 1 "), "ILLIG1");
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
      machineDescription: " Repacking ",
      machineCenterNo: " Illig 2 ",
      prodLineNo: "L-01",
      prodLineDescription: "",
      itemNo: "fg-001",
      uom: " pcs "
    }),
    [
      { sourceField: "prod_line_no", sourceValue: "L-01", normalizedValue: "L01" },
      { sourceField: "machine_center_no", sourceValue: "ILLIG 2", normalizedValue: "ILLIG2" },
      { sourceField: "machine_description", sourceValue: "REPACKING", normalizedValue: "REPACKING" },
      { sourceField: "item_no", sourceValue: "FG-001", normalizedValue: "FG001" },
      { sourceField: "uom", sourceValue: "PCS", normalizedValue: "PCS" }
    ]
  );
});

test("entity source helpers prefer production line fields before machine center and machine description fallbacks", () => {
  assert.equal(BC_ENTITY_SOURCE_FIELD_PRIMARY, "prod_line_description");
  assert.deepEqual(BC_ENTITY_SOURCE_FIELD_FALLBACKS, ["prod_line_no", "machine_center_no", "machine_description"]);
  assert.deepEqual(
    entitySourceCandidates({
      machineDescription: "GILINGAN",
      machineCenterNo: "MC-1",
      prodLineDescription: "Line desc",
      prodLineNo: "L-01"
    }).map((candidate) => candidate.sourceField),
    ["prod_line_description", "prod_line_no", "machine_center_no", "machine_description"]
  );
  assert.deepEqual(preferredEntitySource({ machineCenterNo: "MC-1", prodLineDescription: "LINE A" }), {
    sourceField: "prod_line_description",
    sourceValue: "LINE A",
    normalizedValue: "LINEA"
  });
  assert.equal(preferredEntitySource({ machineDescription: "REPACKING", machineCenterNo: "" })?.sourceField, "machine_description");
  assert.equal(preferredEntitySource({ machineDescription: "", machineCenterNo: "MC-1" })?.sourceField, "machine_center_no");
  assert.equal(preferredEntitySource({ machineDescription: "", machineCenterNo: "", prodLineDescription: "LINE A" })?.sourceField, "prod_line_description");
});
