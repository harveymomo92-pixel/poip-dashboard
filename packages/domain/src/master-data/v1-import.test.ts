import assert from "node:assert/strict";
import test from "node:test";
import {
  buildV1ImportPlan,
  containsSecretLikeText,
  estimateV1Reconcile,
  parseCsv
} from "./v1-import.js";

const masterCsv = `area_kerja_line,kode_asli_sistem,kode_asli_normalized,display_laporan,deskripsi_produk,target_botol_preform,target_thermoforming,target_thermoforming_gw_gt_12,target_printing_non_oz,target_printing_oz_lt_20,target_printing_22_oz,active_target_type,active_target,target_achievement_rate,target_reject_rate
THERMOFORMING,THERMO ILLIG-2,THERMO ILLIG-2,Illig 2,Thermoforming Cup,,1620000,,,,,target_thermoforming,1620000,0.8,0.03
THERMOFORMING,THERMO 2 ILLIG,THERMO 2 ILLIG,Illig 2,Thermoforming Cup (Duplikasi Nama Sistem),,1620000,,,,,target_thermoforming,1620000,0.8,0.03
PRINTING,OMSO 1-OZ,OMSO 1-OZ,OMSO 1,Printing Cup OZ,,,,648000,432000,360000,target_printing_non_oz,648000,0.85,0.017
PRINTING,OMSO 1-OZ,OMSO 1-OZ,OMSO 1,Printing Cup OZ,,,,648000,432000,360000,target_printing_22_oz,360000,0.85,0.017
INJECTION,BORCH 1 PREFORM 19 GR,BORCH 1 PREFORM 19 GR,Borche 1,Preform 19 gram,218274,,,,,,target_botol_preform,218274,0.9,0.03
`;

const itemLedgerCsv = `Item_No,Unit_of_Measure_Code,Gross_Weight,Machine_Center_No,gProdOrRotLine_No,gProdOrRotLine_Description,Quantity
FG-THERMO,PCS,0.012,ILLIG2,THERMO-2,THERMO ILLIG-2,100
FG-THERMO,PCS,0.012,ILLIG2,THERMO-2,THERMO 2 ILLIG,120
FG-BORCH,PCS,0.019,BORCHE1PF19,BRH1-PF19,BORCH 1 PREFORM 19 GR,80
FG-BORCH,PCS,0.019,"BRH2-11,5",BRH1-PF19,BORCH 1 PREFORM 19 GR,10
FG-CONFLICT,PCS,0.010,CONFLICT-MACHINE,THERMO-2,THERMO ILLIG-2,10
FG-CONFLICT,PCS,0.011,CONFLICT-MACHINE,BRH1-PF19,BORCH 1 PREFORM 19 GR,20
`;

test("parseCsv handles quoted commas from v1 machine exports", () => {
  const parsed = parseCsv(itemLedgerCsv);
  assert.equal(parsed.rows[3]?.Machine_Center_No, "BRH2-11,5");
});

test("buildV1ImportPlan folds v1 duplicate system names into canonical entities", () => {
  const plan = buildV1ImportPlan({ masterTargetCsvText: masterCsv, itemLedgerCsvText: itemLedgerCsv });
  const illigEntity = plan.entities.find((entity) => entity.lineCode === "THERMO ILLIG-2");

  assert.ok(illigEntity);
  assert.deepEqual(illigEntity.sourceCodes, ["THERMO 2 ILLIG", "THERMO ILLIG-2"]);
  assert.equal(plan.aliases.filter((alias) => alias.entityCode === illigEntity.entityCode && alias.sourceField === "prod_line_description").length, 2);
});

test("buildV1ImportPlan reports ambiguous source and machine aliases", () => {
  const plan = buildV1ImportPlan({ masterTargetCsvText: masterCsv, itemLedgerCsvText: itemLedgerCsv });

  assert.ok(plan.conflicts.some((conflict) => conflict.kind === "source-code-ambiguous" && conflict.sourceValue === "OMSO 1-OZ"));
  assert.ok(plan.conflicts.some((conflict) => conflict.kind === "machine-alias-ambiguous" && conflict.sourceValue === "CONFLICT-MACHINE"));
  assert.equal(plan.aliases.some((alias) => alias.alias === "CONFLICT-MACHINE"), false);
});

test("buildV1ImportPlan imports only stable gross-weight conversions", () => {
  const plan = buildV1ImportPlan({ masterTargetCsvText: masterCsv, itemLedgerCsvText: itemLedgerCsv });

  assert.ok(plan.conversions.some((conversion) => conversion.itemNo === "FG-THERMO" && conversion.grossWeightPerPcs === 0.012));
  assert.equal(plan.conversions.some((conversion) => conversion.itemNo === "FG-CONFLICT"), false);
  assert.ok(plan.conflicts.some((conflict) => conflict.kind === "conversion-conflict" && conflict.sourceValue === "FG-CONFLICT|PCS"));
});

test("estimateV1Reconcile estimates mapped rows without mutating input rows", () => {
  const plan = buildV1ImportPlan({ masterTargetCsvText: masterCsv, itemLedgerCsvText: itemLedgerCsv });
  const rows = [
    {
      id: "1",
      machineCenterNo: "ILLIG2",
      prodLineNo: null,
      prodLineDescription: null,
      itemNo: "FG-THERMO",
      uom: "PCS",
      normalizedOutputType: "OK",
      quantity: 100,
      entityId: null
    },
    {
      id: "2",
      machineCenterNo: "UNKNOWN",
      prodLineNo: null,
      prodLineDescription: null,
      itemNo: "FG-OTHER",
      uom: "PCS",
      normalizedOutputType: "OK",
      quantity: 50,
      entityId: null
    }
  ];
  const before = JSON.stringify(rows);
  const estimate = estimateV1Reconcile(plan, rows);

  assert.equal(JSON.stringify(rows), before);
  assert.equal(estimate.matchedRows, 1);
  assert.equal(estimate.matchedOkQty, 100);
  assert.equal(estimate.remainingUnmappedRows, 1);
});

test("containsSecretLikeText detects values that must not be printed", () => {
  assert.equal(containsSecretLikeText({ Authorization: "Bearer abc.def" }), true);
  assert.equal(containsSecretLikeText({ entityCode: "THERMO ILLIG-2", target: 1620000 }), false);
});
