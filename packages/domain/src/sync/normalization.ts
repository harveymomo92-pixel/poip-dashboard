import { createHash } from "node:crypto";
import { classifyOutputRow, type OutputClassification } from "../kpi/output-classification.js";

export type DataQualitySeverity = "CRITICAL" | "WARNING" | "INFO";

export interface DataQualitySignal {
  readonly code:
    | "MISSING_ENTRY_NO"
    | "DUPLICATE_ENTRY_NO"
    | "MISSING_POSTING_DATE"
    | "MISSING_DOCUMENT_NO"
    | "MISSING_ITEM_NO"
    | "UNKNOWN_MACHINE"
    | "CONDITIONAL_MAPPING_REVIEW"
    | "MISSING_TARGET"
    | "MISSING_GROSS_WEIGHT"
    | "NEGATIVE_QUANTITY"
    | "OUTPUT_CORRECTION"
    | "REJECT_UOM_MISMATCH"
    | "OK_UOM_MISMATCH"
    | "UNKNOWN_OUTPUT_CLASS"
    | "ZERO_QUANTITY"
    | "INVALID_DATE";
  readonly severity: DataQualitySeverity;
  readonly description: string;
}

export interface NormalizedODataOutputRow {
  readonly entryNo: bigint | null;
  readonly postingDate: string | null;
  readonly documentDate: string | null;
  readonly documentNo: string | null;
  readonly externalDocumentNo: string | null;
  readonly entryType: string | null;
  readonly normalizedOutputType: OutputClassification;
  readonly itemNo: string | null;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly machineDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly prodLineNo: string | null;
  readonly prodLineDescription: string | null;
  readonly shiftCode: string | null;
  readonly operatorName: string | null;
  readonly quantity: number;
  readonly uom: string | null;
  readonly grossWeightPerPcs: number | null;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly fallbackNaturalKey: string;
}

export interface NormalizationResult {
  readonly rowHash: string;
  readonly normalized: NormalizedODataOutputRow;
  readonly issues: readonly DataQualitySignal[];
  readonly canCommit: boolean;
}

export type ODataOutputRawRow = Readonly<Record<string, unknown>>;

function readField(row: ODataOutputRawRow, ...names: readonly string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  }
  return undefined;
}

function cleanString(value: unknown, uppercase = false): string | null {
  if (value === null || typeof value === "undefined") return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return uppercase ? trimmed.toUpperCase() : trimmed;
}

function parseNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseEntryNo(value: unknown): bigint | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  return BigInt(cleaned);
}

function strictDate(value: unknown): { date: string | null; invalid: boolean } {
  if (value === null || typeof value === "undefined" || value === "") {
    return { date: null, invalid: false };
  }

  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return { date: null, invalid: true };

  const dateOnly = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  const valid = !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === dateOnly;
  return { date: valid ? dateOnly : null, invalid: !valid };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createODataRowHash(row: ODataOutputRawRow): string {
  return createHash("sha256").update(stableJson(row)).digest("hex");
}

export function createOutputFallbackNaturalKey(row: {
  readonly postingDate: string | null;
  readonly documentNo: string | null;
  readonly itemNo: string | null;
  readonly machineDescription?: string | null;
  readonly machineCenterNo: string | null;
  readonly quantity: number;
  readonly entryType: string | null;
}): string {
  return [
    row.postingDate ?? "missing-date",
    row.documentNo ?? "missing-document",
    row.itemNo ?? "missing-item",
    row.machineDescription ?? row.machineCenterNo ?? "missing-machine",
    row.quantity.toFixed(4),
    row.entryType ?? "missing-entry-type"
  ]
    .map((part) => part.trim().toUpperCase())
    .join("|");
}

export function normalizeODataOutputRow(row: ODataOutputRawRow): NormalizationResult {
  const issues: DataQualitySignal[] = [];
  const entryNo = parseEntryNo(readField(row, "Entry_No", "EntryNo", "entry_no"));
  const posting = strictDate(readField(row, "Posting_Date", "PostingDate", "posting_date"));
  const document = strictDate(readField(row, "Document_Date", "DocumentDate", "document_date"));
  const quantity = parseNumber(readField(row, "Quantity", "quantity")) ?? 0;
  const sourceRejectKg = parseNumber(readField(row, "Reject_KG", "RejectKg", "reject_kg")) ?? 0;
  const grossWeightPerPcs = parseNumber(
    readField(row, "Gross_Weight", "GrossWeight", "gross_weight_per_pcs")
  );
  const itemNo = cleanString(readField(row, "Item_No", "ItemNo", "item_no"), true);
  const entryType = cleanString(readField(row, "Entry_Type", "EntryType", "entry_type"), true);
  const uom = cleanString(readField(row, "Unit_of_Measure_Code", "UOM", "uom"), true);
  const normalizedOutputType = classifyOutputRow({ entryType, itemNo, uom });
  const rejectKg = normalizedOutputType === "REJECT"
    ? Math.abs(quantity) || Math.abs(sourceRejectKg)
    : 0;
  const machineCenterNo = cleanString(
    readField(row, "Machine_Center_No", "MachineCenterNo", "machine_center_no"),
    true
  );
  const machineDescription = cleanString(
    readField(row, "Machine_Description", "MachineDescription", "Machine Description", "machine_description"),
    true
  );
  const documentNo = cleanString(readField(row, "Document_No", "DocumentNo", "document_no"));

  if (!entryNo) {
    issues.push({
      code: "MISSING_ENTRY_NO",
      severity: "CRITICAL",
      description: "Entry_No is required for source dedupe"
    });
  }
  if (!posting.date) {
    issues.push({
      code: "MISSING_POSTING_DATE",
      severity: "CRITICAL",
      description: "Posting_Date is required"
    });
  }
  if (posting.invalid || document.invalid) {
    issues.push({
      code: "INVALID_DATE",
      severity: "CRITICAL",
      description: "One or more date fields could not be parsed strictly"
    });
  }
  if (!documentNo) {
    issues.push({
      code: "MISSING_DOCUMENT_NO",
      severity: "WARNING",
      description: "Document_No is empty"
    });
  }
  if (!itemNo) {
    issues.push({
      code: "MISSING_ITEM_NO",
      severity: "CRITICAL",
      description: "Item_No is required"
    });
  }
  if (normalizedOutputType === "REJECT_UOM_MISMATCH") {
    issues.push({
      code: "REJECT_UOM_MISMATCH",
      severity: "WARNING",
      description: "Item_No starts with RJ but UOM is not KG"
    });
  } else if (normalizedOutputType === "OK_UOM_MISMATCH") {
    issues.push({
      code: "OK_UOM_MISMATCH",
      severity: "WARNING",
      description: "Non-RJ Output item has a UOM other than PCS"
    });
  } else if (normalizedOutputType === "UNKNOWN_OUTPUT_CLASS") {
    issues.push({
      code: "UNKNOWN_OUTPUT_CLASS",
      severity: "WARNING",
      description: "Output row could not be classified as OK or Reject from Item_No and UOM"
    });
  }
  if (rejectKg > 0 && (!grossWeightPerPcs || grossWeightPerPcs <= 0)) {
    issues.push({
      code: "MISSING_GROSS_WEIGHT",
      severity: "WARNING",
      description: "Reject_KG exists but Gross_Weight is empty or zero"
    });
  }
  if (quantity < 0 && normalizedOutputType === "OK") {
    issues.push({
      code: "OUTPUT_CORRECTION",
      severity: "INFO",
      description: "Output quantity is negative and is treated as a Business Central correction"
    });
  } else if (quantity < 0) {
    issues.push({
      code: "NEGATIVE_QUANTITY",
      severity: "WARNING",
      description: "Quantity is negative"
    });
  }
  if (quantity === 0) {
    issues.push({
      code: "ZERO_QUANTITY",
      severity: "INFO",
      description: "Quantity is zero"
    });
  }

  const normalized = {
    entryNo,
    postingDate: posting.date,
    documentDate: document.date,
    documentNo,
    externalDocumentNo: cleanString(
      readField(row, "External_Document_No", "ExternalDocumentNo", "external_document_no")
    ),
    entryType,
    normalizedOutputType,
    itemNo,
    itemDescription: cleanString(
      readField(row, "gItem_Description", "gItemDescription", "Description", "gSrcDesc", "GSrcDesc", "item_description")
    ),
    itemCategoryCode: cleanString(
      readField(row, "Item_Category_Code", "ItemCategoryCode", "item_category_code"),
      true
    ),
    machineDescription,
    machineCenterNo,
    prodLineNo: cleanString(
      readField(row, "gProdOrRotLine_No", "GProdOrRotLine_No", "Prod_Order_Line_No", "ProdOrderLineNo", "prod_line_no")
    ),
    prodLineDescription: cleanString(
      readField(
        row,
        "gProdOrRotLine_Description",
        "GProdOrRotLine_Description",
        "Prod_Line_Description",
        "ProdLineDescription",
        "prod_line_description"
      )
    ),
    shiftCode: cleanString(readField(row, "Shift", "shift_code"), true),
    operatorName: cleanString(readField(row, "Operator", "operator_name")),
    quantity,
    uom,
    grossWeightPerPcs,
    rejectKg,
    rejectPcsEq: rejectKg > 0 && grossWeightPerPcs && grossWeightPerPcs > 0 ? rejectKg / grossWeightPerPcs : null,
    fallbackNaturalKey: ""
  } satisfies Omit<NormalizedODataOutputRow, "fallbackNaturalKey"> & {
    readonly fallbackNaturalKey: string;
  };

  const normalizedWithKey: NormalizedODataOutputRow = {
    ...normalized,
    fallbackNaturalKey: createOutputFallbackNaturalKey(normalized)
  };

  return {
    rowHash: createODataRowHash(row),
    normalized: normalizedWithKey,
    issues,
    canCommit: !issues.some((issue) => issue.severity === "CRITICAL")
  };
}

export function createDuplicateEntryIssue(): DataQualitySignal {
  return {
    code: "DUPLICATE_ENTRY_NO",
    severity: "CRITICAL",
    description: "Entry_No already exists with a different payload"
  };
}
