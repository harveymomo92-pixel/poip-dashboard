import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE,
  createSourceFieldsBackfillPlan,
  detectBusinessCentralSourceFieldExposure,
  type LocalSourceFieldsRow
} from "./source-fields-backfill.js";

const local = (input: Partial<LocalSourceFieldsRow> = {}): LocalSourceFieldsRow => ({
  entryNo: input.entryNo ?? "1001",
  postingDate: input.postingDate ?? "2026-06-22",
  machineCenterNo: input.machineCenterNo ?? "MC-1",
  machineDescription: "machineDescription" in input ? input.machineDescription ?? null : null,
  prodLineNo: "prodLineNo" in input ? input.prodLineNo ?? null : null,
  prodLineDescription: "prodLineDescription" in input ? input.prodLineDescription ?? null : null
});

test("createSourceFieldsBackfillPlan matches by Entry_No and prepares blank production line fields", () => {
  const plan = createSourceFieldsBackfillPlan(
    [local({ entryNo: "1001", prodLineNo: null, prodLineDescription: null })],
    [{
      Entry_No: "1001",
      gProdOrRotLine_No: "OMSO-1-OZ",
      gProdOrRotLine_Description: "OMSO 1-OZ",
      gSrcDesc: "REJECT CUP PRINTING (PP)"
    }]
  );

  assert.equal(plan.missingRows, 1);
  assert.equal(plan.matchedRows, 1);
  assert.equal(plan.updateableProdLineNoRows, 1);
  assert.equal(plan.updateableProdLineDescriptionRows, 1);
  assert.equal(plan.updateableMachineDescriptionRows, 0);
  assert.deepEqual(plan.updates, [
    {
      entryNo: "1001",
      oldProdLineNo: null,
      newProdLineNo: "OMSO-1-OZ",
      oldProdLineDescription: null,
      newProdLineDescription: "OMSO 1-OZ"
    }
  ]);
});

test("createSourceFieldsBackfillPlan does not overwrite non-blank production line fields", () => {
  const plan = createSourceFieldsBackfillPlan(
    [local({ entryNo: "1001", prodLineNo: "EXISTING-NO", prodLineDescription: "EXISTING DESC" })],
    [{ Entry_No: "1001", gProdOrRotLine_No: "OMSO-1-OZ", gProdOrRotLine_Description: "OMSO 1-OZ" }]
  );

  assert.equal(plan.updateableProdLineNoRows, 0);
  assert.equal(plan.updateableProdLineDescriptionRows, 0);
  assert.equal(plan.unchangedRows, 1);
});

test("createSourceFieldsBackfillPlan skips blank source values and missing BC rows", () => {
  const plan = createSourceFieldsBackfillPlan(
    [
      local({ entryNo: "1001" }),
      local({ entryNo: "1002" })
    ],
    [{ Entry_No: "1001", gProdOrRotLine_No: " ", gProdOrRotLine_Description: "" }]
  );

  assert.equal(plan.matchedRows, 1);
  assert.equal(plan.withoutSourceValueRows, 1);
  assert.equal(plan.notFoundRows, 1);
  assert.equal(plan.updateableProdLineNoRows, 0);
  assert.equal(plan.updateableProdLineDescriptionRows, 0);
});

test("createSourceFieldsBackfillPlan never populates machine_description from production line or gSrcDesc", () => {
  const plan = createSourceFieldsBackfillPlan(
    [local({ entryNo: "1001", machineDescription: null })],
    [{
      Entry_No: "1001",
      gProdOrRotLine_No: "THERMO HENGFENG-2-OZ",
      gProdOrRotLine_Description: "THERMO HENGFENG-2-OZ",
      gSrcDesc: "CUP 22 OZ OVAL 11G-1000 FM (JT)"
    }]
  );

  assert.equal(plan.updateableMachineDescriptionRows, 0);
  assert.ok(!("newMachineDescription" in (plan.updates[0] ?? {})));
});

test("detectBusinessCentralSourceFieldExposure reports machine description as not exposed for profiled rows", () => {
  const exposure = detectBusinessCentralSourceFieldExposure([
    {
      Entry_No: "1001",
      Machine_Center_No: "HENGFENG 2 22OZ-12GR",
      gProdOrRotLine_No: "THERMO HENGFENG-2-OZ",
      gProdOrRotLine_Description: "THERMO HENGFENG-2-OZ",
      gSrcDesc: "CUP 22 OZ OVAL 11G-1000 FM (JT)"
    }
  ]);

  assert.equal(BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.machineDescription, null);
  assert.deepEqual(exposure, {
    machineDescriptionExposed: false,
    prodLineNoExposed: true,
    prodLineDescriptionExposed: true
  });
});
