import { classifyOutputRow, normalizeOutputToken } from "../kpi/output-classification.js";

export type BusinessCentralCurrentKpiScope =
  | "OUTPUT_KPI_OK_SCOPE"
  | "OUTPUT_KPI_REJECT_SCOPE"
  | "OUT_OF_CURRENT_KPI_SCOPE"
  | "UNKNOWN_SCOPE_REVIEW";

export type BusinessCentralFutureUseDomain =
  | "PRODUCTION_OUTPUT_DASHBOARD"
  | "REJECT_ATTACHMENT"
  | "DOWNTIME_SPAREPART_OR_MATERIAL"
  | "SALES_REPORT"
  | "PURCHASE_OR_RECEIVING"
  | "TRANSFER_OR_INVENTORY_MOVEMENT"
  | "CONSUMPTION_OR_MATERIAL_USAGE"
  | "SCRAP_WASTE_OR_AVALAN"
  | "MASTER_DATA_QUALITY_REVIEW"
  | "UNKNOWN_REVIEW";

export type BusinessCentralEntitySourceStatus =
  | "HAS_PRIMARY_ENTITY_SOURCE"
  | "HAS_FALLBACK_ENTITY_SOURCE"
  | "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED"
  | "ENTITY_SOURCE_BLANK_UNKNOWN";

export interface BusinessCentralDataScopeInput {
  readonly entryType?: string | null;
  readonly locationCode?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly documentNo?: string | null;
  readonly quantity?: number | null;
  readonly unitOfMeasureCode?: string | null;
  readonly grossWeight?: number | null;
  readonly gProdOrRotLineDescription?: string | null;
  readonly gProdOrRotLineNo?: string | null;
  readonly machineCenterNo?: string | null;
  readonly blocksP10BeforeScope?: boolean | null;
}

export interface BusinessCentralDataScopeClassification {
  readonly bcCurrentKpiScope: BusinessCentralCurrentKpiScope;
  readonly bcFutureUseDomain: BusinessCentralFutureUseDomain;
  readonly bcScopeReason: string;
  readonly bcScopeEvidenceFields: readonly string[];
  readonly bcEntitySourceStatus: BusinessCentralEntitySourceStatus;
  readonly blocksP10AfterScope: boolean;
}

export function classifyBusinessCentralDataScope(
  input: BusinessCentralDataScopeInput
): BusinessCentralDataScopeClassification {
  const entryType = normalize(input.entryType);
  const locationCode = normalize(input.locationCode);
  const itemNo = normalize(input.itemNo);
  const itemDescription = normalize(input.itemDescription);
  const itemCategoryCode = normalize(input.itemCategoryCode);
  const documentNo = normalize(input.documentNo);
  const unitOfMeasureCode = normalize(input.unitOfMeasureCode);
  const machineCenterNo = normalize(input.machineCenterNo);
  const prodLineDescription = normalize(input.gProdOrRotLineDescription);
  const prodLineNo = normalize(input.gProdOrRotLineNo);
  const outputClass = classifyOutputRow({
    entryType: input.entryType ?? null,
    itemNo: input.itemNo ?? null,
    uom: input.unitOfMeasureCode ?? null
  });
  const beforeScope = Boolean(input.blocksP10BeforeScope);
  const quantity = Math.abs(input.quantity ?? 0);
  const hasPrimaryEntitySource = Boolean(prodLineDescription);
  const hasFallbackEntitySource = !hasPrimaryEntitySource && Boolean(prodLineNo || machineCenterNo);

  if (isRejectLike(locationCode, itemNo, itemDescription, itemCategoryCode, outputClass)) {
    const scrapLike = isScrapLike(itemDescription, itemCategoryCode, itemNo);
    const evidenceFields = uniqueFields([
      "entryType",
      locationCode ? "locationCode" : "",
      itemNo ? "itemNo" : "",
      itemDescription ? "itemDescription" : "",
      itemCategoryCode ? "itemCategoryCode" : "",
      unitOfMeasureCode ? "unitOfMeasureCode" : ""
    ]);
    return finalizeScope({
      scope: "OUTPUT_KPI_REJECT_SCOPE",
      futureUseDomain: scrapLike ? "SCRAP_WASTE_OR_AVALAN" : "REJECT_ATTACHMENT",
      reason: scrapLike
        ? "Reject/scrap evidence indicates Output reject scope for waste or avalan review."
        : "Reject evidence indicates Output reject scope for reject attachment review.",
      evidenceFields,
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (isMaterialLike(itemDescription, itemCategoryCode, itemNo, documentNo)) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "DOWNTIME_SPAREPART_OR_MATERIAL",
      reason: "Material/sparepart evidence indicates a future downtime/material domain, not the current output KPI dashboard.",
      evidenceFields: uniqueFields([
        "entryType",
        itemNo ? "itemNo" : "",
        itemDescription ? "itemDescription" : "",
        itemCategoryCode ? "itemCategoryCode" : "",
        documentNo ? "documentNo" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (isSalesLike(documentNo, itemDescription, itemCategoryCode, locationCode)) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "SALES_REPORT",
      reason: "Sales-like document or item evidence indicates a future sales reporting domain.",
      evidenceFields: uniqueFields([
        "entryType",
        documentNo ? "documentNo" : "",
        itemDescription ? "itemDescription" : "",
        itemCategoryCode ? "itemCategoryCode" : "",
        locationCode ? "locationCode" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (isPurchaseLike(documentNo, itemDescription, itemCategoryCode, locationCode)) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "PURCHASE_OR_RECEIVING",
      reason: "Purchase/receiving evidence indicates a future receiving domain.",
      evidenceFields: uniqueFields([
        "entryType",
        documentNo ? "documentNo" : "",
        itemDescription ? "itemDescription" : "",
        itemCategoryCode ? "itemCategoryCode" : "",
        locationCode ? "locationCode" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (isTransferLike(documentNo, itemDescription, itemCategoryCode, locationCode)) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "TRANSFER_OR_INVENTORY_MOVEMENT",
      reason: "Transfer/inventory movement evidence indicates a future inventory movement domain.",
      evidenceFields: uniqueFields([
        "entryType",
        documentNo ? "documentNo" : "",
        itemDescription ? "itemDescription" : "",
        itemCategoryCode ? "itemCategoryCode" : "",
        locationCode ? "locationCode" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (isConsumptionLike(documentNo, itemDescription, itemCategoryCode)) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "CONSUMPTION_OR_MATERIAL_USAGE",
      reason: "Consumption/material-usage evidence indicates a future material usage domain.",
      evidenceFields: uniqueFields([
        "entryType",
        documentNo ? "documentNo" : "",
        itemDescription ? "itemDescription" : "",
        itemCategoryCode ? "itemCategoryCode" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (entryType === "OUTPUT" && (
    locationCode === "JADI"
    || outputClass === "OK"
    || (
      hasAnyEntitySource(hasPrimaryEntitySource, hasFallbackEntitySource)
      && unitOfMeasureCode === "PCS"
      && quantity > 0
    )
  )) {
    return finalizeScope({
      scope: "OUTPUT_KPI_OK_SCOPE",
      futureUseDomain: "PRODUCTION_OUTPUT_DASHBOARD",
      reason: "Output row has finished-goods or OK-output evidence for the production output dashboard.",
      evidenceFields: uniqueFields([
        "entryType",
        locationCode ? "locationCode" : "",
        itemNo ? "itemNo" : "",
        unitOfMeasureCode ? "unitOfMeasureCode" : "",
        prodLineDescription ? "gProdOrRotLineDescription" : "",
        prodLineNo ? "gProdOrRotLineNo" : "",
        machineCenterNo ? "machineCenterNo" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  if (entryType === "OUTPUT" && itemNo && itemDescription) {
    return finalizeScope({
      scope: "OUT_OF_CURRENT_KPI_SCOPE",
      futureUseDomain: "MASTER_DATA_QUALITY_REVIEW",
      reason: "Output row is retained for future review, but current evidence does not place it in the dashboard KPI scope.",
      evidenceFields: uniqueFields([
        "entryType",
        "itemNo",
        "itemDescription",
        itemCategoryCode ? "itemCategoryCode" : "",
        documentNo ? "documentNo" : ""
      ]),
      hasPrimaryEntitySource,
      hasFallbackEntitySource,
      blocksP10BeforeScope: beforeScope
    });
  }

  return finalizeScope({
    scope: "UNKNOWN_SCOPE_REVIEW",
    futureUseDomain: "UNKNOWN_REVIEW",
    reason: "Insufficient evidence to classify the row into current KPI scope or a future-use domain safely.",
    evidenceFields: uniqueFields([
      entryType ? "entryType" : "",
      locationCode ? "locationCode" : "",
      itemNo ? "itemNo" : "",
      itemDescription ? "itemDescription" : "",
      itemCategoryCode ? "itemCategoryCode" : "",
      documentNo ? "documentNo" : "",
      unitOfMeasureCode ? "unitOfMeasureCode" : "",
      input.grossWeight != null ? "grossWeight" : ""
    ]),
    hasPrimaryEntitySource,
    hasFallbackEntitySource,
    blocksP10BeforeScope: beforeScope
  });
}

function finalizeScope(input: {
  readonly scope: BusinessCentralCurrentKpiScope;
  readonly futureUseDomain: BusinessCentralFutureUseDomain;
  readonly reason: string;
  readonly evidenceFields: readonly string[];
  readonly hasPrimaryEntitySource: boolean;
  readonly hasFallbackEntitySource: boolean;
  readonly blocksP10BeforeScope: boolean;
}): BusinessCentralDataScopeClassification {
  const bcEntitySourceStatus = input.hasPrimaryEntitySource
    ? "HAS_PRIMARY_ENTITY_SOURCE"
    : input.hasFallbackEntitySource
      ? "HAS_FALLBACK_ENTITY_SOURCE"
      : input.scope === "UNKNOWN_SCOPE_REVIEW"
        ? "ENTITY_SOURCE_BLANK_UNKNOWN"
        : "ENTITY_SOURCE_BLANK_BUT_CLASSIFIED";

  return {
    bcCurrentKpiScope: input.scope,
    bcFutureUseDomain: input.futureUseDomain,
    bcScopeReason: input.reason,
    bcScopeEvidenceFields: input.evidenceFields,
    bcEntitySourceStatus,
    blocksP10AfterScope: businessCentralBlocksP10AfterScope(input.blocksP10BeforeScope, input.scope)
  };
}

export function businessCentralBlocksP10AfterScope(
  blocksP10BeforeScope: boolean,
  scope: BusinessCentralCurrentKpiScope
): boolean {
  if (!blocksP10BeforeScope) return false;
  if (scope === "OUT_OF_CURRENT_KPI_SCOPE") return false;
  return true;
}

function isRejectLike(
  locationCode: string,
  itemNo: string,
  itemDescription: string,
  itemCategoryCode: string,
  outputClass: string
): boolean {
  return locationCode === "REJECT"
    || itemNo.startsWith("RJ")
    || outputClass === "REJECT"
    || outputClass === "REJECT_UOM_MISMATCH"
    || containsAny(itemDescription, rejectKeywords)
    || containsAny(itemCategoryCode, rejectKeywords);
}

function isScrapLike(itemDescription: string, itemCategoryCode: string, itemNo: string): boolean {
  return containsAny(itemDescription, scrapKeywords)
    || containsAny(itemCategoryCode, scrapKeywords)
    || containsAny(itemNo, scrapKeywords);
}

function isMaterialLike(itemDescription: string, itemCategoryCode: string, itemNo: string, documentNo: string): boolean {
  return containsAny(itemDescription, materialKeywords)
    || containsAny(itemCategoryCode, materialKeywords)
    || containsAny(itemNo, materialKeywords)
    || containsAny(documentNo, ["SPAREPART", "MATERIAL", "BAHAN"]);
}

function isSalesLike(documentNo: string, itemDescription: string, itemCategoryCode: string, locationCode: string): boolean {
  return containsAny(documentNo, salesKeywords)
    || containsAny(itemDescription, ["SALES", "PENJUALAN"])
    || containsAny(itemCategoryCode, ["SALES", "FG-SALES"])
    || locationCode === "SALES";
}

function isPurchaseLike(documentNo: string, itemDescription: string, itemCategoryCode: string, locationCode: string): boolean {
  return containsAny(documentNo, purchaseKeywords)
    || containsAny(itemDescription, ["PURCHASE", "RECEIPT", "PENERIMAAN"])
    || containsAny(itemCategoryCode, ["PURCHASE", "RECEIVING"])
    || locationCode === "RECEIVING";
}

function isTransferLike(documentNo: string, itemDescription: string, itemCategoryCode: string, locationCode: string): boolean {
  return containsAny(documentNo, transferKeywords)
    || containsAny(itemDescription, ["TRANSFER", "MUTASI", "STOCK MOVE", "ADJUST"])
    || containsAny(itemCategoryCode, ["TRANSFER", "MOVEMENT", "INVENTORY"])
    || locationCode === "TRANSIT";
}

function isConsumptionLike(documentNo: string, itemDescription: string, itemCategoryCode: string): boolean {
  return containsAny(documentNo, consumptionKeywords)
    || containsAny(itemDescription, consumptionKeywords)
    || containsAny(itemCategoryCode, consumptionKeywords);
}

function hasAnyEntitySource(hasPrimaryEntitySource: boolean, hasFallbackEntitySource: boolean): boolean {
  return hasPrimaryEntitySource || hasFallbackEntitySource;
}

function containsAny(value: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function normalize(value: string | null | undefined): string {
  return normalizeOutputToken(value);
}

function uniqueFields(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

const rejectKeywords = ["REJECT", "SCRAP", "AFALAN", "AVALAN", "GUMPALAN", "RUSAK", "REWORK"] as const;
const scrapKeywords = ["SCRAP", "AFALAN", "AVALAN", "GUMPALAN", "WASTE"] as const;
const materialKeywords = [
  "SPAREPART",
  "SPARE PART",
  "MATERIAL",
  "BAHAN",
  "RESIN",
  "MASTERBATCH",
  "ADDITIVE",
  "PELLET",
  "INK",
  "OLI",
  "GREASE",
  "BEARING",
  "GEAR"
] as const;
const salesKeywords = ["SALES", "SALE", "PENJUALAN", "SO-", "SO/", "DO-", "DO/", "INV-S", "SJ-"] as const;
const purchaseKeywords = ["PURCHASE", "RECEIPT", "PENERIMAAN", "PO-", "PO/", "GRN", "RR-"] as const;
const transferKeywords = ["TRANSFER", "TRF", "MUTASI", "MOVE", "ADJ", "ADJUST", "OPNAME"] as const;
const consumptionKeywords = ["CONSUMPTION", "CONSUME", "USAGE", "PEMAKAIAN"] as const;
