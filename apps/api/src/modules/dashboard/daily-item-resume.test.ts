import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyItemResume,
  summarizeDailyItemResumeRejectConversions,
  summarizeDailyItemResumeRejectDocuments,
  summarizeDailyItemResumeTargetReasons,
  type DailyItemResumeFilters,
  type DailyItemResumeSourceRow
} from "./daily-item-resume.js";

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
    itemNo: input.itemNo ?? "PF192CL12",
    itemDescription: input.itemDescription ?? "PREFORM 19.2 GR CLEAR JB - 12000",
    itemCategoryCode: input.itemCategoryCode ?? "THERMO",
    machineDescription: input.machineDescription ?? null,
    machineCenterNo: input.machineCenterNo ?? "MC-1",
    prodLineNo: input.prodLineNo ?? null,
    prodLineDescription: input.prodLineDescription ?? null,
    entityId: "entityId" in input ? input.entityId ?? null : "entity-1",
    entityCode: "entityCode" in input ? input.entityCode ?? null : "E1",
    entityDisplayName: "entityDisplayName" in input ? input.entityDisplayName ?? null : "Illig 1",
    plannedRuntimeHours: input.plannedRuntimeHours ?? 12,
    shiftCode: input.shiftCode ?? "A",
    operatorName: input.operatorName ?? "Adi",
    quantity: input.quantity ?? 100,
    uom: input.uom ?? "PCS",
    grossWeightPerPcs: "grossWeightPerPcs" in input ? input.grossWeightPerPcs ?? null : 0.02,
    mappedGrossWeightPerPcs: input.mappedGrossWeightPerPcs ?? null,
    mappedGrossWeightSource: input.mappedGrossWeightSource ?? null,
    rejectKg: input.rejectKg ?? 0,
    rejectPcsEq: input.rejectPcsEq ?? null
  };
}

test("daily item resume parses operator, shift, and work hours from external document", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-positive", quantity: 100, documentNo: "DOC-1", externalDocumentNo: "S1/8/RAHMAT" }),
    row({ id: "ok-negative", quantity: -25, documentNo: "DOC-2", externalDocumentNo: "S2/12/ANDI" })
  ], [], filters);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.operatorSummary, "RAHMAT | ANDI");
  assert.equal(result.rows[0]?.shiftSummary, "S1 | S2");
  assert.equal(result.rows[0]?.workHours, 20);
  assert.equal(result.rows[0]?.workHoursSource, "EXTERNAL_DOCUMENT");
  assert.deepEqual(result.rows[0]?.externalDocumentDetails.map((detail) => detail.parsedOperator), ["RAHMAT", "ANDI"]);
});

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
  assert.equal(result.rows[0]?.targetReason, "NO_ACTIVE_TARGET");
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

test("daily item resume returns short machineDisplay while preserving canonical machineLabel", () => {
  const result = buildDailyItemResume([
    row({
      entityDisplayName: "Borche 1 - Preform 19.0 / 19.1 gram",
      machineCenterNo: "BORCH 1 PREFORM 19 GR",
      prodLineNo: "BORCH-1",
      prodLineDescription: "BORCH 1 PREFORM 19 GR"
    })
  ], [], filters);

  assert.equal(result.rows[0]?.machineLabel, "Borche 1 - Preform 19.0 / 19.1 gram");
  assert.equal(result.rows[0]?.machineDisplay, "Borch 1");
  assert.equal(result.rows[0]?.machineAreaLine, "INJECTION");
  assert.equal(result.rows[0]?.machineDescriptionLabel, "BORCH 1 PREFORM 19 GR");
});

test("daily item resume uses machine description label when no mapped entity exists", () => {
  const result = buildDailyItemResume([
    row({
      entityId: null,
      entityCode: null,
      entityDisplayName: null,
      machineDescription: "REPACKING",
      machineCenterNo: null
    })
  ], [], filters);

  assert.equal(result.rows[0]?.machineLabel, "REPACKING");
  assert.equal(result.rows[0]?.targetReason, "UNMAPPED_ENTITY");
});

test("RJ KG reject rows attach by same document with PCS equivalent from OK gross weight", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "SPK2606/F0012", itemNo: "PF192CL12", quantity: 100, grossWeightPerPcs: 0.5 }),
    row({
      id: "reject",
      normalizedOutputType: "REJECT",
      documentNo: "SPK2606/F0012",
      itemNo: "RJ015",
      itemDescription: "REJECT GUMPALAN PET",
      quantity: 10,
      uom: "KG",
      rejectKg: 0,
      grossWeightPerPcs: null
    })
  ], [], filters);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.itemNo, "PF192CL12");
  assert.equal(result.rows[0]?.rejectKg, 10);
  assert.equal(result.rows[0]?.rejectPcsEq, 20);
  assert.equal(result.rows[0]?.rejectConversionStatus, "COMPLETE");
  assert.equal(result.rows[0]?.rejectAttachmentStatus, "ATTACHED_BY_DOCUMENT");
  assert.equal(result.rows[0]?.rejectDetails[0]?.itemNo, "RJ015");
  assert.equal(result.rows[0]?.rejectDetails[0]?.conversionStatus, "COMPLETE");
  assert.equal(result.rows[0]?.rejectDetails[0]?.grossWeightSource, "ROW_GROSS_WEIGHT");
});

test("RJ KG reject rows stay incomplete when matched OK item has missing gross weight", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-MISSING-GW", grossWeightPerPcs: null }),
    row({
      id: "reject",
      normalizedOutputType: "REJECT",
      documentNo: "DOC-MISSING-GW",
      itemNo: "RJ015",
      quantity: 10,
      uom: "KG",
      rejectKg: 0,
      grossWeightPerPcs: 99
    })
  ], [], filters);

  assert.equal(result.rows[0]?.rejectPcsEq, null);
  assert.equal(result.rows[0]?.rejectConversionStatus, "INCOMPLETE");
  assert.equal(result.rows[0]?.rejectDetails[0]?.rejectPcsEq, null);
  assert.equal(result.rows[0]?.rejectDetails[0]?.conversionGapReason, "MISSING_OK_GROSS_WEIGHT");
  assert.equal(result.rows[0]?.rejectDetails[0]?.grossWeight, null);
  assert.equal(result.rows[0]?.rejectDetails[0]?.grossWeightSource, null);
});

test("RJ KG reject rows stay incomplete when matched OK item has zero gross weight", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-ZERO-GW", grossWeightPerPcs: 0 }),
    row({
      id: "reject",
      normalizedOutputType: "REJECT",
      documentNo: "DOC-ZERO-GW",
      itemNo: "RJ015",
      quantity: 10,
      uom: "KG",
      rejectKg: 0,
      grossWeightPerPcs: null
    })
  ], [], filters);

  assert.equal(result.rows[0]?.rejectPcsEq, null);
  assert.equal(result.rows[0]?.rejectDetails[0]?.conversionGapReason, "ZERO_OR_INVALID_OK_GROSS_WEIGHT");
});

test("RJ KG reject rows use OK item conversion mapping when row gross weight is missing", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-MAPPED-GW", grossWeightPerPcs: null, mappedGrossWeightPerPcs: 0.25, mappedGrossWeightSource: "ITEM_CONVERSION_MAPPING" }),
    row({
      id: "reject",
      normalizedOutputType: "REJECT",
      documentNo: "DOC-MAPPED-GW",
      itemNo: "RJ015",
      quantity: 10,
      uom: "KG",
      rejectKg: 0,
      grossWeightPerPcs: 99,
      mappedGrossWeightPerPcs: null
    })
  ], [], filters);

  assert.equal(result.rows[0]?.rejectPcsEq, 40);
  assert.equal(result.rows[0]?.rejectConversionStatus, "COMPLETE");
  assert.equal(result.rows[0]?.rejectDetails[0]?.grossWeight, 0.25);
  assert.equal(result.rows[0]?.rejectDetails[0]?.grossWeightSource, "ITEM_CONVERSION_MAPPING");
});

test("reject conversion summary sums only complete PCS equivalent and counts incomplete details", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-complete", documentNo: "DOC-COMPLETE", itemNo: "PF192CL12", quantity: 100, grossWeightPerPcs: 0.5 }),
    row({ id: "reject-complete", normalizedOutputType: "REJECT", documentNo: "DOC-COMPLETE", itemNo: "RJ015", uom: "KG", quantity: 5, grossWeightPerPcs: null }),
    row({ id: "ok-incomplete", documentNo: "DOC-INCOMPLETE", itemNo: "PF27CLJB82", quantity: 100, grossWeightPerPcs: null }),
    row({ id: "reject-incomplete", normalizedOutputType: "REJECT", documentNo: "DOC-INCOMPLETE", itemNo: "RJ016", uom: "KG", quantity: 7, grossWeightPerPcs: null })
  ], [], filters);

  const summary = summarizeDailyItemResumeRejectConversions(result.rows);
  assert.equal(summary.rejectPcsEquivalent, 10);
  assert.equal(summary.completeCount, 1);
  assert.equal(summary.incompleteCount, 1);
  assert.equal(summary.gapBreakdown.find((item) => item.reason === "MISSING_OK_GROSS_WEIGHT")?.rowCount, 1);
});

test("RJ KG reject rows attach by document and posting date when document has multiple OK candidates", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-a", postingDate: "2026-06-20", documentNo: "DOC-DATE", itemNo: "PF192CL12", quantity: 100 }),
    row({ id: "ok-b", postingDate: "2026-06-21", documentNo: "DOC-DATE", itemNo: "PF27CLJB82", quantity: 50 }),
    row({ id: "reject", postingDate: "2026-06-21", normalizedOutputType: "REJECT", documentNo: "DOC-DATE", itemNo: "RJ015", uom: "KG", quantity: 4, grossWeightPerPcs: null })
  ], [], filters);

  const attached = result.rows.find((item) => item.itemNo === "PF27CLJB82");
  assert.equal(attached?.rejectKg, 4);
  assert.equal(attached?.rejectAttachmentStatus, "ATTACHED_BY_DOCUMENT_DATE");
  assert.equal(result.rows.find((item) => item.itemNo === "PF192CL12")?.rejectKg, 0);
});

test("RJ KG reject rows attach by document date and machine source", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-a", documentNo: "DOC-MACHINE", itemNo: "PF192CL12", quantity: 100, machineCenterNo: "MC-1" }),
    row({ id: "ok-b", documentNo: "DOC-MACHINE", itemNo: "PF27CLJB82", quantity: 50, machineCenterNo: "MC-2" }),
    row({ id: "reject", normalizedOutputType: "REJECT", documentNo: "DOC-MACHINE", itemNo: "RJ015", uom: "KG", quantity: 4, machineCenterNo: "MC-2", grossWeightPerPcs: null })
  ], [], filters);

  const attached = result.rows.find((item) => item.itemNo === "PF27CLJB82");
  assert.equal(attached?.rejectKg, 4);
  assert.equal(attached?.rejectAttachmentStatus, "ATTACHED_BY_DOCUMENT_DATE_MACHINE");
  assert.equal(result.rows.find((item) => item.itemNo === "PF192CL12")?.rejectKg, 0);
});

test("RJ KG reject rows attach by parsed shift operator context after document date machine", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-a", documentNo: "DOC-CONTEXT", itemNo: "PF192CL12", quantity: 100, externalDocumentNo: "S1/8/ADI", operatorName: null, shiftCode: null }),
    row({ id: "ok-b", documentNo: "DOC-CONTEXT", itemNo: "PF27CLJB82", quantity: 50, externalDocumentNo: "S2/12/BUDI", operatorName: null, shiftCode: null }),
    row({ id: "reject", normalizedOutputType: "REJECT", documentNo: "DOC-CONTEXT", itemNo: "RJ015", uom: "KG", quantity: 4, externalDocumentNo: "S2/12/BUDI", operatorName: null, shiftCode: null, grossWeightPerPcs: null })
  ], [], filters);

  const attached = result.rows.find((item) => item.itemNo === "PF27CLJB82");
  assert.equal(attached?.rejectKg, 4);
  assert.equal(attached?.rejectAttachmentStatus, "ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR");
  assert.equal(result.rows.find((item) => item.itemNo === "PF192CL12")?.rejectKg, 0);
});

test("RJ KG reject rows with unmatched document become reject-only groups", () => {
  const fallback = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-1", quantity: 100, grossWeightPerPcs: 1 }),
    row({ id: "reject", normalizedOutputType: "REJECT", itemNo: "RJ015", uom: "KG", documentNo: "DOC-X", quantity: 5, rejectKg: 0 })
  ], [], filters);
  assert.equal(fallback.rows.length, 2);
  assert.equal(fallback.rows.find((item) => item.itemNo === "RJ015")?.rejectAttachmentStatus, "REJECT_ONLY");
  assert.equal(fallback.rows.find((item) => item.itemNo === "RJ015")?.rejectKg, 5);

  const rejectOnly = buildDailyItemResume([
    row({ id: "reject-only", normalizedOutputType: "REJECT", itemNo: "RJ015", uom: "KG", documentNo: "DOC-X", quantity: 5, rejectKg: 0 })
  ], [], filters);
  assert.equal(rejectOnly.rows.length, 1);
  assert.equal(rejectOnly.rows[0]?.netOutputQty, 0);
  assert.equal(rejectOnly.rows[0]?.rejectAttachmentStatus, "REJECT_ONLY");
  assert.equal(rejectOnly.rows[0]?.rejectConversionStatus, "INCOMPLETE");
  assert.equal(rejectOnly.rows[0]?.rejectDetails[0]?.conversionGapReason, "REJECT_ONLY");
});

test("multiple RJ KG reject rows attach to one OK document", () => {
  const result = buildDailyItemResume([
    row({ id: "ok", documentNo: "DOC-MULTI", quantity: 100, grossWeightPerPcs: 0.5 }),
    row({ id: "reject-a", normalizedOutputType: "REJECT", itemNo: "RJ015", uom: "KG", documentNo: "DOC-MULTI", quantity: 3, rejectKg: 0 }),
    row({ id: "reject-b", normalizedOutputType: "REJECT", itemNo: "RJ016", uom: "KG", documentNo: "DOC-MULTI", quantity: 2, rejectKg: 0 })
  ], [], filters);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.rejectKg, 5);
  assert.equal(result.rows[0]?.rejectPcsEq, 10);
  assert.equal(result.rows[0]?.rejectDetails.length, 2);
});

test("multiple OK items with same document do not double count reject kg", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-a", documentNo: "DOC-AMB", itemNo: "PF192CL12", quantity: 100, grossWeightPerPcs: 0.5 }),
    row({ id: "ok-b", documentNo: "DOC-AMB", itemNo: "PF27CLJB82", quantity: 50, grossWeightPerPcs: 0.25 }),
    row({ id: "reject", normalizedOutputType: "REJECT", itemNo: "RJ015", uom: "KG", documentNo: "DOC-AMB", quantity: 4, rejectKg: 0 })
  ], [], filters);

  const rejectOnly = result.rows.find((item) => item.itemNo === "RJ015");
  assert.equal(result.rows.length, 3);
  assert.equal(rejectOnly?.rejectAttachmentStatus, "AMBIGUOUS_REJECT_ATTACHMENT");
  assert.equal(rejectOnly?.rejectKg, 4);
  assert.equal(rejectOnly?.rejectDetails[0]?.conversionGapReason, "AMBIGUOUS_REJECT_ATTACHMENT");
  assert.equal((rejectOnly?.rejectDetails[0]?.attachmentCandidates as readonly unknown[] | undefined)?.length, 2);
  assert.equal(result.rows.filter((item) => item.itemNo !== "RJ015").reduce((sum, item) => sum + item.rejectKg, 0), 0);
});

test("daily item resume reject document diagnostics keep OK and reject items separated", () => {
  const result = buildDailyItemResume([
    row({ id: "ok-a", documentNo: "DOC-DIAG", itemNo: "PF192CL12", quantity: 100 }),
    row({ id: "ok-b", documentNo: "DOC-AMB", itemNo: "PF27CLJB82", quantity: 50 }),
    row({ id: "ok-c", documentNo: "DOC-AMB", itemNo: "PF30CL", quantity: 25 }),
    row({ id: "reject-attached", normalizedOutputType: "REJECT", documentNo: "DOC-DIAG", itemNo: "RJ015", uom: "KG", quantity: 4, grossWeightPerPcs: null }),
    row({ id: "reject-ambiguous", normalizedOutputType: "REJECT", documentNo: "DOC-AMB", itemNo: "RJ009", uom: "KG", quantity: 3, grossWeightPerPcs: null })
  ], [], filters);

  const summaries = summarizeDailyItemResumeRejectDocuments(result.rows);
  const attached = summaries.find((item) => item.documentNo === "DOC-DIAG");
  const ambiguous = summaries.find((item) => item.documentNo === "DOC-AMB");
  assert.deepEqual(attached?.okItems, ["PF192CL12"]);
  assert.deepEqual(attached?.rejectItems, ["RJ015"]);
  assert.deepEqual(ambiguous?.okItems, []);
  assert.deepEqual(ambiguous?.rejectItems, ["RJ009"]);
});

test("non-RJ KG rows are excluded from OK output instead of becoming resume rows", () => {
  const result = buildDailyItemResume([
    row({ id: "bad-uom", itemNo: "PF192CL12", uom: "KG", quantity: 100 })
  ], [], filters);

  assert.equal(result.rows.length, 0);
});

test("target prorata uses daily target times work hours over 24 and pagination is server result shaped", () => {
  const result = buildDailyItemResume(
    [
      row({ id: "a", itemNo: "FG-001", quantity: 100, plannedRuntimeHours: 12, externalDocumentNo: "S1/8/RAHMAT" }),
      row({ id: "b", itemNo: "FG-002", quantity: 50, plannedRuntimeHours: 24 })
    ],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240 }],
    { ...filters, page: 1, pageSize: 1 }
  );

  assert.equal(result.pagination.totalRows, 2);
  assert.equal(result.pagination.pageSize, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.workHours, 8);
  assert.equal(result.rows[0]?.workHoursSource, "EXTERNAL_DOCUMENT");
  assert.equal(result.rows[0]?.transactionProrataTarget, 80);
  assert.equal(result.rows[0]?.achievementPct, 100 / 80 * 100);
  assert.equal(result.rows[0]?.targetReason, "TARGET_MATCHED");
  assert.equal(result.rows[0]?.targetSource, "ENTITY_DAILY_TARGET");
});

test("target reason is UNMAPPED_ENTITY when no entity is resolved", () => {
  const result = buildDailyItemResume([
    row({ entityId: null, entityCode: null, entityDisplayName: null, machineCenterNo: "UNMAPPED" })
  ], [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240, status: "APPROVED" }], filters);

  assert.equal(result.rows[0]?.dailyTarget, null);
  assert.equal(result.rows[0]?.transactionProrataTarget, null);
  assert.equal(result.rows[0]?.achievementPct, null);
  assert.equal(result.rows[0]?.targetReason, "UNMAPPED_ENTITY");
});

test("target reason distinguishes no active target, not approved, outside effective date, and zero target", () => {
  const noTarget = buildDailyItemResume([row()], [], filters).rows[0];
  const notApproved = buildDailyItemResume(
    [row()],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240, status: "DRAFT" }],
    filters
  ).rows[0];
  const outsideDate = buildDailyItemResume(
    [row()],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: "2026-01-31", dailyTargetQty: 240, status: "APPROVED" }],
    filters
  ).rows[0];
  const zeroTarget = buildDailyItemResume(
    [row()],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 0, status: "APPROVED" }],
    filters
  ).rows[0];

  assert.equal(noTarget?.targetReason, "NO_ACTIVE_TARGET");
  assert.equal(noTarget?.dailyTarget, null);
  assert.equal(notApproved?.targetReason, "TARGET_NOT_APPROVED");
  assert.equal(outsideDate?.targetReason, "OUTSIDE_EFFECTIVE_DATE");
  assert.equal(zeroTarget?.targetReason, "TARGET_ZERO");
  assert.equal(zeroTarget?.dailyTarget, 0);
  assert.equal(zeroTarget?.achievementPct, null);
  assert.equal(zeroTarget?.achievementStatus, "TARGET_ZERO");
});

test("negative OK Output corrections reduce target achievement", () => {
  const result = buildDailyItemResume(
    [
      row({ id: "positive", quantity: 100, plannedRuntimeHours: 24 }),
      row({ id: "negative", quantity: -20, plannedRuntimeHours: 24, documentNo: "DOC-2" })
    ],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240, status: "APPROVED" }],
    filters
  );

  assert.equal(result.rows[0]?.netOutputQty, 80);
  assert.equal(result.rows[0]?.achievementPct, 80 / 240 * 100);
});

test("bucket-aware targets match inferred printing buckets", () => {
  const printing22 = buildDailyItemResume(
    [row({ entityCode: "OMSO2", entityDisplayName: "OMSO 2", machineCenterNo: "OMSO-2-OZ", itemCategoryCode: "JADI-PRINTING", itemDescription: "CUP 22 OZ KOPI", grossWeightPerPcs: 0.012 })],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 360, status: "APPROVED", targetBucket: "target_printing_22_oz" }],
    filters
  ).rows[0];
  const printingNonOz = buildDailyItemResume(
    [row({ entityCode: "POLY1", entityDisplayName: "Polyprint 1", machineCenterNo: "POLYPRINT-1", itemCategoryCode: "JADI-PRINTING", itemDescription: "CUP SABLON LOGO" })],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 648, status: "APPROVED", targetBucket: "target_printing_non_oz" }],
    filters
  ).rows[0];

  assert.equal(printing22?.targetReason, "TARGET_MATCHED");
  assert.equal(printing22?.targetSource, "BUCKET_DAILY_TARGET");
  assert.equal(printing22?.targetBucket, "target_printing_22_oz");
  assert.equal(printingNonOz?.targetReason, "TARGET_MATCHED");
  assert.equal(printingNonOz?.targetBucket, "target_printing_non_oz");
});

test("bucket-aware targets do not fake-match missing or ambiguous buckets", () => {
  const missing = buildDailyItemResume(
    [row({ machineCenterNo: "MC-UNKNOWN", itemCategoryCode: "JADI", itemDescription: "Finished good" })],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 360, status: "APPROVED", targetBucket: "target_printing_22_oz" }],
    filters
  ).rows[0];
  const ambiguous = buildDailyItemResume(
    [row({ machineCenterNo: "OMSO PRINT", itemCategoryCode: "JADI-PRINTING", itemDescription: "THERMO PREFORM CUP 22 OZ" })],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 360, status: "APPROVED", targetBucket: "target_printing_22_oz" }],
    filters
  ).rows[0];

  assert.equal(missing?.dailyTarget, null);
  assert.equal(missing?.targetReason, "TARGET_BUCKET_MISSING");
  assert.equal(ambiguous?.dailyTarget, null);
  assert.equal(ambiguous?.targetReason, "TARGET_BUCKET_MISSING");
});

test("target reason summary reports count and net output for diagnostics", () => {
  const resume = buildDailyItemResume(
    [
      row({ id: "matched", quantity: 100 }),
      row({ id: "unmapped", entityId: null, entityCode: null, entityDisplayName: null, machineCenterNo: "UNMAPPED", quantity: 25, itemNo: "FG-002" })
    ],
    [{ entityId: "entity-1", effectiveFrom: "2026-01-01", effectiveTo: null, dailyTargetQty: 240, status: "APPROVED" }],
    filters
  );
  const summary = summarizeDailyItemResumeTargetReasons(resume.rows);

  assert.deepEqual(
    summary.filter((item) => item.rowCount > 0).map((item) => [item.reason, item.rowCount, item.netOutputQty]),
    [
      ["TARGET_MATCHED", 1, 100],
      ["UNMAPPED_ENTITY", 1, 25]
    ]
  );
});
