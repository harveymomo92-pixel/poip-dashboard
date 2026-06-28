import assert from "node:assert/strict";
import test from "node:test";
import { classifyBusinessCentralDataScope } from "./bc-data-scope.js";

test("Output and JADI classify as KPI OK scope for production dashboard", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "JADI",
    itemNo: "PF192CL12",
    itemDescription: "CUP 12 OZ PRINTING",
    itemCategoryCode: "FG",
    unitOfMeasureCode: "PCS",
    gProdOrRotLineDescription: "OMSO 1-OZ",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUTPUT_KPI_OK_SCOPE");
  assert.equal(result.bcFutureUseDomain, "PRODUCTION_OUTPUT_DASHBOARD");
  assert.equal(result.bcEntitySourceStatus, "HAS_PRIMARY_ENTITY_SOURCE");
  assert.equal(result.blocksP10AfterScope, true);
});

test("Output reject evidence classifies as reject attachment scope", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "REJECT",
    itemNo: "RJ015",
    itemDescription: "REJECT CUP 12 OZ",
    itemCategoryCode: "REJECT",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUTPUT_KPI_REJECT_SCOPE");
  assert.equal(result.bcFutureUseDomain, "REJECT_ATTACHMENT");
  assert.equal(result.blocksP10AfterScope, true);
});

test("blank entity source with sparepart evidence stays retained out of current KPI scope", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "",
    itemNo: "SP-001",
    itemDescription: "SPAREPART GEAR BOX",
    itemCategoryCode: "SPAREPART",
    documentNo: "MAT-001",
    unitOfMeasureCode: "PCS",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "DOWNTIME_SPAREPART_OR_MATERIAL");
  assert.equal(result.bcEntitySourceStatus, "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED");
  assert.equal(result.blocksP10AfterScope, false);
});

test("sales-like evidence classifies to sales report future-use domain", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "SALES",
    itemNo: "FG-001",
    itemDescription: "CUSTOMER SALES ITEM",
    itemCategoryCode: "FG-SALES",
    documentNo: "SO-2026-001",
    unitOfMeasureCode: "PCS",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "SALES_REPORT");
  assert.equal(result.blocksP10AfterScope, false);
});

test("unknown blank source with insufficient evidence stays unknown review", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "",
    itemNo: "",
    itemDescription: "",
    itemCategoryCode: "",
    documentNo: "",
    unitOfMeasureCode: "",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "UNKNOWN_SCOPE_REVIEW");
  assert.equal(result.bcFutureUseDomain, "UNKNOWN_REVIEW");
  assert.equal(result.bcEntitySourceStatus, "ENTITY_SOURCE_BLANK_UNKNOWN");
  assert.equal(result.blocksP10AfterScope, true);
});

test("Transfer entry type is retained for future inventory movement and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Transfer",
    locationCode: "INTRANSIT",
    itemNo: "PALLETK-001",
    documentNo: "TR2601/0001",
    unitOfMeasureCode: "PCS",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "TRANSFER_OR_INVENTORY_MOVEMENT");
  assert.equal(result.blocksP10AfterScope, false);
});

test("Consumption entry type is retained for future material usage and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Consumption",
    locationCode: "PRODUKSI",
    itemNo: "TINTA-DA10",
    itemCategoryCode: "PBT-TINTA",
    documentNo: "SPK2601/P0001",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "CONSUMPTION_OR_MATERIAL_USAGE");
  assert.equal(result.blocksP10AfterScope, false);
});

test("Sale entry type is retained for future sales reporting and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Sale",
    locationCode: "JADI",
    itemNo: "CR16OZ8THP",
    documentNo: "SJ2601/A0005",
    unitOfMeasureCode: "PCS",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "SALES_REPORT");
  assert.equal(result.blocksP10AfterScope, false);
});

test("Purchase entry type is retained for future purchase receiving and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Purchase",
    locationCode: "BAHAN",
    itemNo: "RM-001",
    documentNo: "GR2601/0001",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "PURCHASE_OR_RECEIVING");
  assert.equal(result.blocksP10AfterScope, false);
});

test("non-output SP item prefix is retained as sparepart/material and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Negative Adjmt.",
    locationCode: "SPAREPART",
    itemNo: "SP9000000124",
    documentNo: "M2301/1015",
    unitOfMeasureCode: "PCS",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "DOWNTIME_SPAREPART_OR_MATERIAL");
  assert.equal(result.blocksP10AfterScope, false);
});

test("non-output TINTA item prefix is retained as material usage and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Negative Adjmt.",
    locationCode: "PRODUKSI",
    itemNo: "TINTA-UV-001",
    documentNo: "M2301/1014",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "CONSUMPTION_OR_MATERIAL_USAGE");
  assert.equal(result.blocksP10AfterScope, false);
});

test("non-output KONS document prefix is retained as material usage and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Positive Adjmt.",
    locationCode: "",
    itemNo: "RM-001",
    documentNo: "KONS2301/0001",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "CONSUMPTION_OR_MATERIAL_USAGE");
  assert.equal(result.blocksP10AfterScope, false);
});

test("non-output PB document prefix is retained as purchase receiving and does not block P1.0", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Positive Adjmt.",
    locationCode: "",
    itemNo: "RM-001",
    documentNo: "PB2301/0001",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "OUT_OF_CURRENT_KPI_SCOPE");
  assert.equal(result.bcFutureUseDomain, "PURCHASE_OR_RECEIVING");
  assert.equal(result.blocksP10AfterScope, false);
});

test("SPK and unreviewed SP/MOCK document prefixes are not broadly classified by material rules", () => {
  for (const documentNo of ["SPK2301/P0001", "SP2301/0001", "MOCK2301/0001"]) {
    const result = classifyBusinessCentralDataScope({
      entryType: "Positive Adjmt.",
      locationCode: "",
      itemNo: documentNo.startsWith("SPK") ? "SPK-ITEM-001" : "RM-001",
      documentNo,
      unitOfMeasureCode: "PCS",
      blocksP10BeforeScope: true
    });

    assert.equal(result.bcCurrentKpiScope, "UNKNOWN_SCOPE_REVIEW");
    assert.equal(result.bcFutureUseDomain, "UNKNOWN_REVIEW");
    assert.equal(result.blocksP10AfterScope, true);
  }
});

test("output rows are not reclassified by the non-output SP item prefix rule", () => {
  const result = classifyBusinessCentralDataScope({
    entryType: "Output",
    locationCode: "",
    itemNo: "SP9000000124",
    itemDescription: "",
    documentNo: "M2301/1015",
    unitOfMeasureCode: "KG",
    blocksP10BeforeScope: true
  });

  assert.equal(result.bcCurrentKpiScope, "UNKNOWN_SCOPE_REVIEW");
  assert.equal(result.bcFutureUseDomain, "UNKNOWN_REVIEW");
  assert.equal(result.blocksP10AfterScope, true);
});
