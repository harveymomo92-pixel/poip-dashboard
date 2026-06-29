export const BC_DOMAINS = [
  "PRODUCTION_OUTPUT",
  "REJECT_ATTACHMENT",
  "TRANSFER_OR_INVENTORY",
  "CONSUMPTION_OR_MATERIAL_USAGE",
  "SALES",
  "PURCHASE_OR_RECEIVING",
  "SPAREPART_OR_MATERIAL",
  "SCRAP_OR_WASTE",
  "SOURCE_DATA_GAP",
  "UNKNOWN_REVIEW"
] as const;

export const MOVEMENT_STATUSES = ["CLASSIFIED", "UNCLASSIFIED", "NEEDS_REVIEW", "BLOCKED_UNSAFE"] as const;

export const MAPPING_STATUSES = [
  "MAPPED_READY",
  "MAPPED_FALLBACK_REVIEW",
  "UNMAPPED_SOURCE_GAP",
  "UNMAPPED_NEEDS_REVIEW",
  "FUTURE_USE_ONLY",
  "BLOCKED_UNSAFE"
] as const;

export type BcDomain = (typeof BC_DOMAINS)[number];
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];
export type MappingStatus = (typeof MAPPING_STATUSES)[number];
export type SourceIdentityField = "prod_line_description" | "prod_line_no" | "machine_center_no" | null;

export interface BcLedgerClassificationInput {
  readonly entryType?: string | null;
  readonly normalizedOutputType?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly uom?: string | null;
  readonly documentNo?: string | null;
  readonly quantity?: number | string | null;
  readonly locationCode?: string | null;
  readonly rawPayload?: Readonly<Record<string, unknown>> | null;
}

export interface BcLedgerIdentityInput {
  readonly prodLineDescription?: string | null;
  readonly prodLineNo?: string | null;
  readonly machineCenterNo?: string | null;
}

export interface BcLedgerClassification {
  readonly bcDomain: BcDomain;
  readonly movementDomain: BcDomain;
  readonly movementStatus: MovementStatus;
  readonly futureUseReady: boolean;
  readonly classificationReason: string;
}

export interface BcLedgerIdentity {
  readonly sourceIdentityField: SourceIdentityField;
  readonly sourceIdentityValue: string | null;
}

export interface BcLedgerMappingInput extends BcLedgerClassification, BcLedgerIdentity {
  readonly resolvedEntityId?: string | null;
}

export interface BcLedgerMapping {
  readonly entityId: string | null;
  readonly mappingStatus: MappingStatus;
  readonly dashboardReady: boolean;
  readonly mappingReason: string;
}

function clean(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  const text = String(value).trim();
  return text ? text : null;
}

function upper(value: unknown): string {
  return clean(value)?.toUpperCase() ?? "";
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function rawString(rawPayload: Readonly<Record<string, unknown>> | null | undefined, ...keys: readonly string[]) {
  if (!rawPayload) return null;
  for (const key of keys) {
    const value = clean(rawPayload[key]);
    if (value) return value;
  }
  return null;
}

export function normalizeLedgerLookupKey(value: string | null | undefined): string | null {
  const normalized = value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return normalized || null;
}

export function determineBcLedgerIdentity(input: BcLedgerIdentityInput): BcLedgerIdentity {
  const prodLineDescription = clean(input.prodLineDescription);
  if (prodLineDescription) {
    return {
      sourceIdentityField: "prod_line_description",
      sourceIdentityValue: prodLineDescription
    };
  }
  const prodLineNo = clean(input.prodLineNo);
  if (prodLineNo) {
    return {
      sourceIdentityField: "prod_line_no",
      sourceIdentityValue: prodLineNo
    };
  }
  const machineCenterNo = clean(input.machineCenterNo);
  if (machineCenterNo) {
    return {
      sourceIdentityField: "machine_center_no",
      sourceIdentityValue: machineCenterNo
    };
  }
  return {
    sourceIdentityField: null,
    sourceIdentityValue: null
  };
}

export function classifyBcLedgerEntry(input: BcLedgerClassificationInput): BcLedgerClassification {
  const rawLocation = rawString(
    input.rawPayload,
    "Location_Code",
    "LocationCode",
    "location_code",
    "locationCode"
  );
  const entryType = upper(input.entryType);
  const normalizedOutputType = upper(input.normalizedOutputType);
  const itemNo = upper(input.itemNo);
  const itemDescription = upper(input.itemDescription);
  const itemCategory = upper(input.itemCategoryCode);
  const uom = upper(input.uom);
  const documentNo = upper(input.documentNo);
  const location = upper(input.locationCode ?? rawLocation);
  const evidence = [entryType, normalizedOutputType, itemNo, itemDescription, itemCategory, uom, documentNo, location].join(" ");

  if (entryType === "TRANSFER" || includesAny(evidence, ["TRANSFER", "PINDAH GUDANG"])) {
    return classified("TRANSFER_OR_INVENTORY", true, "Entry type or evidence indicates inventory transfer.");
  }
  if (entryType === "CONSUMPTION" || includesAny(evidence, ["CONSUMPTION", "KONSUMSI", "MATERIAL USAGE"])) {
    return classified("CONSUMPTION_OR_MATERIAL_USAGE", true, "Entry type or evidence indicates material consumption.");
  }
  if (entryType === "SALE" || includesAny(evidence, ["SALE", "SALES", "PENJUALAN"])) {
    return classified("SALES", true, "Entry type or evidence indicates sales movement.");
  }
  if (entryType === "PURCHASE" || includesAny(evidence, ["PURCHASE", "RECEIVING", "PEMBELIAN"])) {
    return classified("PURCHASE_OR_RECEIVING", true, "Entry type or evidence indicates purchase or receiving movement.");
  }
  if (includesAny(evidence, ["SPAREPART", "SPARE PART", "MATERIAL", "BAHAN BAKU", "BIJI PLASTIK"])) {
    return classified("SPAREPART_OR_MATERIAL", true, "Evidence indicates sparepart or material movement.");
  }
  if (includesAny(evidence, ["RJ", "REJECT"]) || itemNo.startsWith("RJ") || location === "REJECT") {
    return classified("REJECT_ATTACHMENT", true, "Evidence indicates reject attachment rows.");
  }
  if (includesAny(evidence, ["SCRAP", "AVALAN", "GUMPALAN", "SAPUAN", "WASTE", "AFVAL"])) {
    return classified("SCRAP_OR_WASTE", true, "Evidence indicates scrap or waste movement.");
  }
  if (
    normalizedOutputType === "OK" &&
    (entryType === "OUTPUT" || includesAny(evidence, [" JADI ", "JADI", "FINISHED", "OK"]))
  ) {
    return classified("PRODUCTION_OUTPUT", false, "Evidence indicates finished goods production output.");
  }
  if (entryType === "OUTPUT" && normalizedOutputType === "OK") {
    return classified("PRODUCTION_OUTPUT", false, "Output entry with OK normalized output type.");
  }
  if (!entryType && !itemNo && !itemDescription && !itemCategory && !documentNo) {
    return {
      bcDomain: "SOURCE_DATA_GAP",
      movementDomain: "SOURCE_DATA_GAP",
      movementStatus: "BLOCKED_UNSAFE",
      futureUseReady: false,
      classificationReason: "Insufficient Business Central source evidence."
    };
  }
  return {
    bcDomain: "UNKNOWN_REVIEW",
    movementDomain: "UNKNOWN_REVIEW",
    movementStatus: "NEEDS_REVIEW",
    futureUseReady: false,
    classificationReason: "No deterministic ledger domain rule matched."
  };
}

function classified(domain: BcDomain, futureUseReady: boolean, reason: string): BcLedgerClassification {
  return {
    bcDomain: domain,
    movementDomain: domain,
    movementStatus: "CLASSIFIED",
    futureUseReady,
    classificationReason: reason
  };
}

export function determineBcLedgerMapping(input: BcLedgerMappingInput): BcLedgerMapping {
  if (input.bcDomain === "SOURCE_DATA_GAP") {
    return {
      entityId: null,
      mappingStatus: "UNMAPPED_SOURCE_GAP",
      dashboardReady: false,
      mappingReason: "No safe OData identity source is available."
    };
  }
  if (input.bcDomain !== "PRODUCTION_OUTPUT") {
    return {
      entityId: null,
      mappingStatus: "FUTURE_USE_ONLY",
      dashboardReady: false,
      mappingReason: "Ledger row is retained for a future-use domain, not production output KPI."
    };
  }
  if (!input.sourceIdentityField || !input.sourceIdentityValue) {
    return {
      entityId: null,
      mappingStatus: "UNMAPPED_SOURCE_GAP",
      dashboardReady: false,
      mappingReason: "Production output row has no OData identity source."
    };
  }
  if (input.sourceIdentityField === "machine_center_no") {
    return {
      entityId: input.resolvedEntityId ?? null,
      mappingStatus: "MAPPED_FALLBACK_REVIEW",
      dashboardReady: false,
      mappingReason: "Machine_Center_No is fallback evidence only and requires explicit review."
    };
  }
  if (input.resolvedEntityId) {
    return {
      entityId: input.resolvedEntityId,
      mappingStatus: "MAPPED_READY",
      dashboardReady: true,
      mappingReason: "Exact OData production line identity matched an active master entity or alias."
    };
  }
  return {
    entityId: null,
    mappingStatus: "UNMAPPED_NEEDS_REVIEW",
    dashboardReady: false,
    mappingReason: "No exact active master entity or alias matched the OData production line identity."
  };
}
