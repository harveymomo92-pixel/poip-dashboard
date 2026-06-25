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
  machineCenterNo: "ILLIG1",
  itemNo: "FG-001",
  itemDescription: "Cup 240ml",
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
    "2026-06-25:Illig 1:FG-001",
    "2026-06-25:Illig 1:FG-002",
    "2026-06-24:Illig 1:FG-001"
  ]);
});

test("buildDailyItemResumeRows summarizes multiple documents, operators, and shifts", () => {
  const rows = buildDailyItemResumeRows([
    base,
    { ...base, documentNo: "DOC-2", operatorName: "Operator B", shiftCode: "B", quantity: 50 }
  ]);

  assert.equal(rows[0]?.documentCount, 2);
  assert.equal(rows[0]?.documentSummary, "DOC-1 | DOC-2");
  assert.equal(rows[0]?.operatorSummary, "Operator A | Operator B");
  assert.equal(rows[0]?.shiftSummary, "A | B");
});

test("buildDailyItemResumeRows attaches reject by same date machine and document", () => {
  const rows = buildDailyItemResumeRows([
    base,
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "REJ-001",
      itemDescription: "Reject cup",
      quantity: 0,
      rejectKg: 5,
      documentNo: "DOC-1",
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.rejectKg, 5);
  assert.equal(rows[0]?.rejectPcsEq, 10);
  assert.equal(rows[0]?.rejectConversionStatus, "COMPLETE");
});

test("buildDailyItemResumeRows attaches reject by same date and machine fallback", () => {
  const rows = buildDailyItemResumeRows([
    base,
    {
      ...base,
      normalizedOutputType: "REJECT",
      quantity: 0,
      rejectKg: 4,
      documentNo: "REJECT-DOC",
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.rejectKg, 4);
  assert.equal(rows[0]?.rejectPcsEq, 8);
});

test("buildDailyItemResumeRows creates reject-only groups and flags missing gross weight", () => {
  const rows = buildDailyItemResumeRows([
    {
      ...base,
      normalizedOutputType: "REJECT",
      itemNo: "REJ-ONLY",
      quantity: 0,
      rejectKg: 3,
      grossWeightPerPcs: null
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemNo, "REJ-ONLY");
  assert.equal(rows[0]?.netOutputQty, 0);
  assert.equal(rows[0]?.rejectConversionStatus, "INCOMPLETE");
  assert.equal(rows[0]?.rejectPcsEq, null);
});

test("buildDailyItemResumeRows calculates transaction prorata target and missing target status", () => {
  const [covered, missing] = buildDailyItemResumeRows([
    base,
    { ...base, entityId: null, entityCode: null, entityName: null, machineCenterNo: "UNMAPPED", itemNo: "FG-MISSING", dailyTarget: null }
  ]);

  assert.equal(covered?.dailyTarget, 240);
  assert.equal(covered?.transactionProrataTarget, 120);
  assert.equal(covered?.achievementPct, 100 / 120 * 100);
  assert.equal(covered?.achievementStatus, "COVERED");
  assert.equal(missing?.dailyTarget, null);
  assert.equal(missing?.transactionProrataTarget, null);
  assert.equal(missing?.achievementPct, null);
  assert.equal(missing?.achievementStatus, "TARGET_MISSING");
});
