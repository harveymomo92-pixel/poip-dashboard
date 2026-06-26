import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyItemResumeRows, type DailyItemResumeSourceRow } from "./daily-item-resume.js";

const base: DailyItemResumeSourceRow = {
  sourceSystem: "business-central",
  entryType: "Output",
  normalizedOutputType: "OK",
  postingDate: "2026-06-25",
  entityId: "11111111-1111-4111-8111-111111111111",
  entityCode: "ILLIG-1",
  entityName: "Illig 1",
  machineDescription: null,
  machineCenterNo: "ILLIG1",
  itemNo: "PF192CL12",
  itemDescription: "PREFORM 19.2 GR CLEAR JB - 12000",
  itemCategoryCode: "JADI",
  documentNo: "DOC-1",
  operatorName: "Operator A",
  shiftCode: "A",
  quantity: 100,
  uom: "PCS",
  grossWeightPerPcs: 0.5,
  workHours: 12,
  dailyTarget: 240
};

test("buildDailyItemResumeRows excludes non-output entry types and uses net OK quantity", () => {
  const rows = buildDailyItemResumeRows([
    base,
    { ...base, documentNo: "DOC-2", quantity: -20 },
    { ...base, entryType: "Sale", documentNo: "DOC-SALE", quantity: 999 }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.positiveOutputQty, 100);
  assert.equal(rows[0]?.correctionOutputQty, -20);
  assert.equal(rows[0]?.netOutputQty, 80);
  assert.equal(rows[0]?.inputCount, 2);
});

test("buildDailyItemResumeRows groups by date, resolved machine, and item", () => {
  const rows = buildDailyItemResumeRows([
    base,
    { ...base, itemNo: "FG-002", quantity: 25 },
    { ...base, postingDate: "2026-06-24", quantity: 30 }
  ]);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => `${row.postingDate}:${row.machineLabel}:${row.itemNo}`), [
    "2026-06-25:Illig 1:FG-002",
    "2026-06-25:Illig 1:PF192CL12",
    "2026-06-24:Illig 1:PF192CL12"
  ]);
});

test("buildDailyItemResumeRows parses operator, shift, and work hours from external document when available", () => {
  const rows = buildDailyItemResumeRows([
    { ...base, externalDocumentNo: "S1/8/RAHMAT", operatorName: "Fallback A", shiftCode: "Z", workHours: 4 },
    { ...base, documentNo: "DOC-2", externalDocumentNo: "S2/12/ANDI", operatorName: "Fallback B", shiftCode: "Y", quantity: 50, workHours: 6 }
  ]);

  assert.equal(rows[0]?.documentCount, 2);
  assert.equal(rows[0]?.documentSummary, "DOC-1 | DOC-2");
  assert.equal(rows[0]?.operatorSummary, "RAHMAT | ANDI");
  assert.equal(rows[0]?.shiftSummary, "S1 | S2");
  assert.equal(rows[0]?.workHours, 20);
  assert.equal(rows[0]?.workHoursSource, "EXTERNAL_DOCUMENT");
  assert.deepEqual(rows[0]?.externalDocumentDetails.map((detail) => detail.parsedOperator), ["RAHMAT", "ANDI"]);
});

test("buildDailyItemResumeRows uses machine description before machine center when unresolved", () => {
  const rows = buildDailyItemResumeRows([
    {
      ...base,
      entityId: null,
      entityCode: null,
      entityName: null,
      machineDescription: "GILINGAN",
      machineCenterNo: null,
      dailyTarget: null
    }
  ]);

  assert.equal(rows[0]?.machineLabel, "GILINGAN");
  assert.equal(rows[0]?.achievementStatus, "TARGET_MISSING");
});

test("buildDailyItemResumeRows attaches RJ KG reject by same document", () => {
  const rows = buildDailyItemResumeRows([
    base,
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "RJ015",
      itemDescription: "REJECT GUMPALAN PET",
      quantity: 5,
      uom: "KG",
      rejectKg: 0,
      documentNo: "DOC-1",
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemNo, "PF192CL12");
  assert.equal(rows[0]?.rejectKg, 5);
  assert.equal(rows[0]?.rejectPcsEq, 10);
  assert.equal(rows[0]?.rejectConversionStatus, "COMPLETE");
  assert.equal(rows[0]?.rejectAttachmentStatus, "ATTACHED");
  assert.equal(rows[0]?.rejectDetails[0]?.itemNo, "RJ015");
});

test("buildDailyItemResumeRows creates reject-only when document does not match an OK group", () => {
  const rows = buildDailyItemResumeRows([
    base,
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "RJ015",
      quantity: 4,
      uom: "KG",
      rejectKg: 0,
      documentNo: "REJECT-DOC",
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 2);
  const rejectOnly = rows.find((row) => row.itemNo === "RJ015");
  assert.equal(rejectOnly?.rejectAttachmentStatus, "REJECT_ONLY");
  assert.equal(rejectOnly?.rejectKg, 4);
  assert.equal(rejectOnly?.rejectPcsEq, null);
});

test("buildDailyItemResumeRows creates reject-only groups and flags missing gross weight", () => {
  const rows = buildDailyItemResumeRows([
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "RJ015",
      uom: "KG",
      quantity: 3,
      rejectKg: 0,
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemNo, "RJ015");
  assert.equal(rows[0]?.netOutputQty, 0);
  assert.equal(rows[0]?.rejectAttachmentStatus, "REJECT_ONLY");
  assert.equal(rows[0]?.rejectConversionStatus, "INCOMPLETE");
  assert.equal(rows[0]?.rejectPcsEq, null);
});

test("buildDailyItemResumeRows does not double count ambiguous reject attachment", () => {
  const rows = buildDailyItemResumeRows([
    base,
    { ...base, itemNo: "PF27CLJB82", itemDescription: "PREFORM 27.5 GR", quantity: 40 },
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "RJ015",
      uom: "KG",
      quantity: 2,
      rejectKg: 0,
      grossWeightPerPcs: null
    }
  ]);

  const rejectOnly = rows.find((row) => row.itemNo === "RJ015");
  assert.equal(rows.length, 3);
  assert.equal(rejectOnly?.rejectAttachmentStatus, "AMBIGUOUS_REJECT_ATTACHMENT");
  assert.equal(rejectOnly?.rejectKg, 2);
  assert.equal(rows.filter((row) => row.itemNo !== "RJ015").reduce((sum, row) => sum + row.rejectKg, 0), 0);
});

test("buildDailyItemResumeRows calculates transaction prorata target and missing target status", () => {
  const [covered, missing] = buildDailyItemResumeRows([
    base,
    { ...base, entityId: null, entityCode: null, entityName: null, machineCenterNo: "UNMAPPED", itemNo: "FG-MISSING", dailyTarget: null }
  ]);

  assert.equal(covered?.dailyTarget, 240);
  assert.equal(covered?.transactionProrataTarget, 120);
  assert.equal(covered?.workHoursSource, "FALLBACK");
  assert.equal(covered?.achievementPct, 100 / 120 * 100);
  assert.equal(covered?.achievementStatus, "COVERED");
  assert.equal(missing?.dailyTarget, null);
  assert.equal(missing?.transactionProrataTarget, null);
  assert.equal(missing?.achievementPct, null);
  assert.equal(missing?.achievementStatus, "TARGET_MISSING");
});
