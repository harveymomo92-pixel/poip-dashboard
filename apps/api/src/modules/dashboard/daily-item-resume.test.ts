import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyItemResume, type DailyItemResumeFilters, type DailyItemResumeSourceRow } from "./daily-item-resume.js";

const filters: DailyItemResumeFilters = {
  from: "2026-06-01",
  to: "2026-06-30",
  sourceSystem: "business-central",
  page: 1,
  pageSize: 20,
  sort: "postingDate.desc"
};

function row(input: Partial<DailyItemResumeSourceRow> = {}): DailyItemResumeSourceRow {
  return {
    id: input.id ?? Math.random().toString(36).slice(2),
    postingDate: input.postingDate ?? "2026-06-20",
    documentNo: input.documentNo ?? "DOC-1",
    externalDocumentNo: input.externalDocumentNo ?? null,
    normalizedOutputType: input.normalizedOutputType ?? "OK",
    itemNo: input.itemNo ?? "FG-001",
    itemDescription: input.itemDescription ?? "Cup 12 oz",
    itemCategoryCode: input.itemCategoryCode ?? "THERMO",
    machineCenterNo: input.machineCenterNo ?? "MC-1",
    prodLineNo: input.prodLineNo ?? null,
    prodLineDescription: input.prodLineDescription ?? null,
    entityId: input.entityId ?? "entity-1",
    entityCode: input.entityCode ?? "E1",
    entityDisplayName: input.entityDisplayName ?? "Illig 1",
    plannedRuntimeHours: input.plannedRuntimeHours ?? 12,
    shiftCode: input.shiftCode ?? "A",
    operatorName: input.operatorName ?? "Adi",
    quantity: input.quantity ?? 100,
    uom: input.uom ?? "PCS",
    grossWeightPerPcs: input.grossWeightPerPcs ?? 0.02,
    rejectKg: input.rejectKg ?? 0,
    rejectPcsEq: input.rejectPcsEq ?? null
  };
}

test("daily item resume groups positive and negative OK Output as net quantity without requiring quantity > 0", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-positive", quantity: 100, documentNo: "DOC-1" }),
    row({ id: "ok-negative", quantity: -25, documentNo: "DOC-2", operatorName: "Budi", shiftCode: "B" })
  ], [], filters);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.positiveOutputQty, 100);
  assert.equal(result.rows[0]?.correctionOutputQty, -25);
  assert.equal(result.rows[0]?.netOutputQty, 75);
  assert.equal(result.rows[0]?.documentCount, 2);
  assert.match(result.rows[0]?.operatorSummary ?? "", /Adi/);
  assert.match(result.rows[0]?.operatorSummary ?? "", /Budi/);
  assert.equal(result.rows[0]?.achievementStatus, "TARGET_MISSING");
  assert.equal(result.rows[0]?.dailyTarget, null);
});

test("daily item resume key uses posting date, resolved machine label, and item", () => {
  const result = buildDailyItemResume([
    row({ id: "a", postingDate: "2026-06-20", entityDisplayName: "Illig 1", machineCenterNo: "RAW-1", itemNo: "FG-001", quantity: 10 }),
    row({ id: "b", postingDate: "2026-06-20", entityDisplayName: "Illig 1", machineCenterNo: "RAW-1", itemNo: "FG-002", quantity: 20 }),
    row({ id: "c", postingDate: "2026-06-21", entityDisplayName: "Illig 1", machineCenterNo: "RAW-1", itemNo: "FG-001", quantity: 30 })
  ], [], filters);

  assert.equal(result.rows.length, 3);
  assert.deepEqual(new Set(result.rows.map((item) => item.machineLabel)), new Set(["Illig 1"]));
});

test("reject rows attach by same date, machine, and document with PCS equivalent from OK gross weight", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-1", quantity: 100, grossWeightPerPcs: 0.5 }),
    row({ id: "reject", normalizedOutputType: "REJECT", documentNo: "DOC-1", quantity: 10, rejectKg: 10, grossWeightPerPcs: null })
  ], [], filters);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.rejectKg, 10);
  assert.equal(result.rows[0]?.rejectPcsEq, 20);
  assert.equal(result.rows[0]?.rejectConversionStatus, "COMPLETE");
});

test("reject rows fallback by same date and machine, and create reject-only group when no OK group exists", () => {
  const fallback = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-1", quantity: 100, grossWeightPerPcs: 1 }),
    row({ id: "reject", normalizedOutputType: "REJECT", documentNo: "DOC-X", quantity: 5, rejectKg: 5 })
  ], [], filters);
  assert.equal(fallback.rows.length, 1);
  assert.equal(fallback.rows[0]?.rejectKg, 5);

  const rejectOnly = buildDailyItemResume([
    row({ id: "reject-only", normalizedOutputType: "REJECT", documentNo: "DOC-X", quantity: 5, rejectKg: 5 })
  ], [], filters);
  assert.equal(rejectOnly.rows.length, 1);
  assert.equal(rejectOnly.rows[0]?.netOutputQty, 0);
  assert.equal(rejectOnly.rows[0]?.rejectConversionStatus, "INCOMPLETE");
});

test("target prorata uses daily target times work hours over 24 and pagination is server result shaped", () => {
  const result = buildDailyItemResume(
    [
      row({ id: "a", itemNo: "FG-001", quantity: 100, plannedRuntimeHours: 12 }),
      row({ id: "b", itemNo: "FG-002", quantity: 50, plannedRuntimeHours: 24 })
    ],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240 }],
    { ...filters, page: 1, pageSize: 1 }
  );

  assert.equal(result.pagination.totalRows, 2);
  assert.equal(result.pagination.pageSize, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.transactionProrataTarget, 120);
  assert.equal(result.rows[0]?.achievementPct, 100 / 120 * 100);
});
