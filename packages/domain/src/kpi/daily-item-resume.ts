import { isProductionEntryType } from "../constants/business-central.js";
import { classifyOutputRow } from "./output-classification.js";
import { parseExternalDocument, type ParsedExternalDocument } from "../sync/external-document.js";

export type ResumeRejectConversionStatus = "COMPLETE" | "INCOMPLETE";
export type ResumeRejectConversionGapReason =
  | "NO_MATCHED_OK_ROW"
  | "MISSING_OK_GROSS_WEIGHT"
  | "ZERO_OR_INVALID_OK_GROSS_WEIGHT"
  | "AMBIGUOUS_REJECT_ATTACHMENT"
  | "REJECT_ONLY"
  | "MISSING_CONVERSION_MAPPING";
export type ResumeGrossWeightSource =
  | "ROW_GROSS_WEIGHT"
  | "ITEM_CONVERSION_MAPPING"
  | "MASTER_ENTITY_CONVERSION";
export type ResumeAchievementStatus = "COVERED" | "TARGET_MISSING" | "NO_OUTPUT" | "TARGET_ZERO";
export type ResumeWorkHoursSource = "EXTERNAL_DOCUMENT" | "FALLBACK" | "UNKNOWN";
export type ResumeAttachedRejectAttachmentStatus =
  | "ATTACHED_BY_DOCUMENT"
  | "ATTACHED_BY_DOCUMENT_DATE"
  | "ATTACHED_BY_DOCUMENT_DATE_MACHINE"
  | "ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR";
export type ResumeRejectAttachmentStatus =
  | "NONE"
  | ResumeAttachedRejectAttachmentStatus
  | "REJECT_ONLY"
  | "AMBIGUOUS_REJECT_ATTACHMENT";

export interface DailyItemResumeSourceRow {
  readonly sourceSystem?: string | null;
  readonly entryType?: string | null;
  readonly normalizedOutputType: string;
  readonly postingDate: string;
  readonly entityId?: string | null;
  readonly entityCode?: string | null;
  readonly entityName?: string | null;
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo: string;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly documentNo?: string | null;
  readonly externalDocumentNo?: string | null;
  readonly operatorName?: string | null;
  readonly shiftCode?: string | null;
  readonly quantity: number;
  readonly uom?: string | null;
  readonly rejectKg?: number | null;
  readonly grossWeightPerPcs?: number | null;
  readonly mappedGrossWeightPerPcs?: number | null;
  readonly mappedGrossWeightSource?: ResumeGrossWeightSource | null;
  readonly workHours?: number | null;
  readonly dailyTarget?: number | null;
}

export interface DailyItemResumeRow {
  readonly postingDate: string;
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly machineLabel: string;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly documentSummary: string;
  readonly documentCount: number;
  readonly documentDetails: readonly { readonly documentNo: string; readonly quantity: number; readonly rejectKg: number; readonly type: "OK" | "REJECT" | "MIXED" }[];
  readonly operatorSummary: string;
  readonly operatorDetails: readonly { readonly operatorName: string; readonly shiftCode: string; readonly documentNo: string; readonly quantity: number }[];
  readonly shiftSummary: string;
  readonly workHours: number;
  readonly workHoursSource: ResumeWorkHoursSource;
  readonly dailyTarget: number | null;
  readonly transactionProrataTarget: number | null;
  readonly netOutputQty: number;
  readonly positiveOutputQty: number;
  readonly correctionOutputQty: number;
  readonly uom: string;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly rejectConversionStatus: ResumeRejectConversionStatus;
  readonly rejectAttachmentStatus: ResumeRejectAttachmentStatus;
  readonly rejectPct: number | null;
  readonly achievementPct: number | null;
  readonly achievementStatus: ResumeAchievementStatus;
  readonly grossWeight: number | null;
  readonly inputCount: number;
  readonly externalDocumentSummary: string;
  readonly externalDocumentDetails: readonly {
    readonly rawExternalDocument: string | null;
    readonly parseStatus: ParsedExternalDocument["parseStatus"];
    readonly parsedShift: string | null;
    readonly parsedWorkHours: number | null;
    readonly parsedOperator: string | null;
    readonly documentNo: string;
    readonly postingDate: string;
    readonly quantity: number;
  }[];
  readonly notes: readonly string[];
  readonly rejectDetails: readonly {
    readonly documentNo: string;
    readonly itemNo: string;
    readonly itemDescription: string | null;
    readonly rejectKg: number;
    readonly uom: string | null;
    readonly postingDate: string;
    readonly attachmentStatus: ResumeRejectAttachmentStatus;
    readonly grossWeight: number | null;
    readonly grossWeightSource: ResumeGrossWeightSource | null;
    readonly rejectPcsEq: number | null;
    readonly conversionStatus: ResumeRejectConversionStatus;
    readonly conversionGapReason: ResumeRejectConversionGapReason | null;
    readonly rawExternalDocument: string | null;
    readonly operatorName: string | null;
    readonly shiftCode: string | null;
  }[];
}

interface Group {
  readonly key: string;
  readonly postingDate: string;
  readonly machineLabel: string;
  readonly itemNo: string;
  readonly okRows: DailyItemResumeSourceRow[];
  readonly rejectRows: DailyItemResumeSourceRow[];
  rejectAttachmentStatus: ResumeRejectAttachmentStatus;
  attachmentWarnings: string[];
  rejectAttachmentStatusByRow: Map<DailyItemResumeSourceRow, ResumeRejectAttachmentStatus>;
}

interface RejectAttachmentResolution {
  readonly group: Group | null;
  readonly status: ResumeRejectAttachmentStatus;
  readonly candidates: readonly Group[];
}

function clean(value: string | null | undefined, fallback = ""): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim() || fallback;
}

function normalized(value: string | null | undefined): string {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function machineLabel(row: DailyItemResumeSourceRow): string {
  return clean(row.entityName)
    || clean(row.entityCode)
    || clean(row.machineDescription)
    || clean(row.machineCenterNo)
    || clean(row.prodLineDescription)
    || clean(row.prodLineNo)
    || "Unmapped";
}

function groupKey(row: DailyItemResumeSourceRow, label = machineLabel(row), suffix = ""): string {
  return [
    row.postingDate,
    normalized(label),
    normalized(row.itemNo),
    suffix
  ].join("|");
}

function rowClass(row: DailyItemResumeSourceRow): string {
  return classifyOutputRow({
    entryType: row.entryType ?? "Output",
    itemNo: row.itemNo,
    uom: row.uom ?? null
  });
}

function isOkOutput(row: DailyItemResumeSourceRow): boolean {
  return rowClass(row) === "OK";
}

function isRejectOutput(row: DailyItemResumeSourceRow): boolean {
  return rowClass(row) === "REJECT";
}

function rejectKgForRow(row: DailyItemResumeSourceRow): number {
  return row.quantity !== 0 ? Math.abs(row.quantity) : Math.max(row.rejectKg ?? 0, 0);
}

function uniqueSummary(values: readonly (string | null | undefined)[], fallback = "-"): string {
  const unique = [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  return unique.length ? unique.join(" | ") : fallback;
}

function resolveOperatorName(row: DailyItemResumeSourceRow): string | null {
  return parseExternalDocument(row.externalDocumentNo).operatorName ?? (clean(row.operatorName) || null);
}

function resolveShiftCode(row: DailyItemResumeSourceRow): string | null {
  return parseExternalDocument(row.externalDocumentNo).shiftCode ?? (clean(row.shiftCode) || null);
}

function resolveRowWorkHours(row: DailyItemResumeSourceRow): number | null {
  const parsed = parseExternalDocument(row.externalDocumentNo).workHours;
  return parsed ?? (row.workHours && row.workHours > 0 ? row.workHours : null);
}

function normalizedValues(...values: readonly (string | null | undefined)[]): readonly string[] {
  return [...new Set(values.map((value) => normalized(value)).filter(Boolean))];
}

function machineDescriptionValues(row: DailyItemResumeSourceRow): readonly string[] {
  return normalizedValues(row.machineDescription);
}

function machineCenterValues(row: DailyItemResumeSourceRow): readonly string[] {
  return normalizedValues(row.machineCenterNo);
}

function prodLineDescriptionValues(row: DailyItemResumeSourceRow): readonly string[] {
  return normalizedValues(row.prodLineDescription);
}

function prodLineNoValues(row: DailyItemResumeSourceRow): readonly string[] {
  return normalizedValues(row.prodLineNo);
}

function mappedEntityValues(row: DailyItemResumeSourceRow): readonly string[] {
  return normalizedValues(row.entityId, row.entityCode, row.entityName);
}

function groupMatchesRowValues(
  row: DailyItemResumeSourceRow,
  group: Group,
  valuesForRow: (value: DailyItemResumeSourceRow) => readonly string[]
): boolean {
  const rowValues = new Set(valuesForRow(row));
  if (rowValues.size === 0) return false;
  return group.okRows.some((okRow) => valuesForRow(okRow).some((value) => rowValues.has(value)));
}

function narrowByMachine(row: DailyItemResumeSourceRow, candidates: readonly Group[]): readonly Group[] {
  let narrowed = candidates;
  const valueSources = [
    machineDescriptionValues,
    machineCenterValues,
    prodLineDescriptionValues,
    prodLineNoValues,
    mappedEntityValues
  ] as const;
  for (const valueSource of valueSources) {
    if (valueSource(row).length === 0) continue;
    const matches = narrowed.filter((group) => groupMatchesRowValues(row, group, valueSource));
    if (matches.length === 0) continue;
    narrowed = matches;
    if (narrowed.length <= 1) break;
  }
  return narrowed;
}

function workHoursKey(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

function narrowByExternalContext(row: DailyItemResumeSourceRow, candidates: readonly Group[]): readonly Group[] {
  const rejectShift = normalized(resolveShiftCode(row));
  const rejectOperator = normalized(resolveOperatorName(row));
  const rejectWorkHours = workHoursKey(resolveRowWorkHours(row));
  const fields = [
    {
      rejectValue: rejectShift,
      candidateValue: (candidate: DailyItemResumeSourceRow) => normalized(resolveShiftCode(candidate))
    },
    {
      rejectValue: rejectOperator,
      candidateValue: (candidate: DailyItemResumeSourceRow) => normalized(resolveOperatorName(candidate))
    },
    {
      rejectValue: rejectWorkHours,
      candidateValue: (candidate: DailyItemResumeSourceRow) => workHoursKey(resolveRowWorkHours(candidate))
    }
  ].filter((field) => field.rejectValue);
  if (fields.length < 2) return candidates;
  const matches = candidates.filter((group) =>
    group.okRows.some((okRow) => fields.every((field) => field.candidateValue(okRow) === field.rejectValue))
  );
  return matches.length > 0 ? matches : candidates;
}

function resolveRejectAttachment(
  row: DailyItemResumeSourceRow,
  documentCandidates: readonly Group[]
): RejectAttachmentResolution {
  if (documentCandidates.length === 0) {
    return { group: null, status: "REJECT_ONLY", candidates: [] };
  }
  if (documentCandidates.length === 1) {
    return { group: documentCandidates[0] ?? null, status: "ATTACHED_BY_DOCUMENT", candidates: documentCandidates };
  }

  const dateCandidates = documentCandidates.filter((group) => group.postingDate === row.postingDate);
  if (dateCandidates.length === 0) {
    return { group: null, status: "AMBIGUOUS_REJECT_ATTACHMENT", candidates: documentCandidates };
  }
  if (dateCandidates.length === 1) {
    return { group: dateCandidates[0] ?? null, status: "ATTACHED_BY_DOCUMENT_DATE", candidates: dateCandidates };
  }

  const machineCandidates = narrowByMachine(row, dateCandidates);
  if (machineCandidates.length === 1) {
    return {
      group: machineCandidates[0] ?? null,
      status: "ATTACHED_BY_DOCUMENT_DATE_MACHINE",
      candidates: machineCandidates
    };
  }

  const contextCandidates = narrowByExternalContext(row, machineCandidates);
  if (contextCandidates.length === 1) {
    return {
      group: contextCandidates[0] ?? null,
      status: "ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR",
      candidates: contextCandidates
    };
  }

  return { group: null, status: "AMBIGUOUS_REJECT_ATTACHMENT", candidates: contextCandidates };
}

function resolveGroupWorkHours(
  rows: readonly DailyItemResumeSourceRow[],
  fallbackWorkHours: number
): { readonly workHours: number; readonly source: ResumeWorkHoursSource } {
  const parsedHours = new Map<string, number>();
  for (const row of rows) {
    const parsed = parseExternalDocument(row.externalDocumentNo);
    if (parsed.parseStatus !== "PARSED" || parsed.workHours === null) continue;
    parsedHours.set([parsed.shiftCode, parsed.operatorName, parsed.workHours].join("|"), parsed.workHours);
  }
  if (parsedHours.size > 0) {
    return {
      workHours: [...parsedHours.values()].reduce((sum, value) => sum + value, 0),
      source: "EXTERNAL_DOCUMENT"
    };
  }
  const rowHours = new Map<string, number>();
  for (const row of rows) {
    if (!row.workHours || row.workHours <= 0) continue;
    rowHours.set([resolveShiftCode(row), resolveOperatorName(row), row.workHours].join("|"), row.workHours);
  }
  if (rowHours.size > 0) {
    return {
      workHours: [...rowHours.values()].reduce((sum, value) => sum + value, 0),
      source: "FALLBACK"
    };
  }
  if (fallbackWorkHours > 0) return { workHours: fallbackWorkHours, source: "FALLBACK" };
  return { workHours: 0, source: "UNKNOWN" };
}

interface GrossWeightResolution {
  readonly grossWeight: number | null;
  readonly source: ResumeGrossWeightSource | null;
  readonly gapReason: ResumeRejectConversionGapReason | null;
}

function isValidGrossWeight(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasInvalidGrossWeight(value: number | null | undefined): boolean {
  return typeof value === "number" && (!Number.isFinite(value) || value <= 0);
}

function resolveGrossWeight(rows: readonly DailyItemResumeSourceRow[]): GrossWeightResolution {
  if (rows.length === 0) {
    return { grossWeight: null, source: null, gapReason: "NO_MATCHED_OK_ROW" };
  }

  const rowGrossWeight = rows.find((row) => isValidGrossWeight(row.grossWeightPerPcs))?.grossWeightPerPcs ?? null;
  if (rowGrossWeight !== null) {
    return { grossWeight: rowGrossWeight, source: "ROW_GROSS_WEIGHT", gapReason: null };
  }

  if (rows.some((row) => hasInvalidGrossWeight(row.grossWeightPerPcs))) {
    return { grossWeight: null, source: null, gapReason: "ZERO_OR_INVALID_OK_GROSS_WEIGHT" };
  }

  const mappedGrossWeight = rows.find((row) => isValidGrossWeight(row.mappedGrossWeightPerPcs))?.mappedGrossWeightPerPcs ?? null;
  if (mappedGrossWeight !== null) {
    return {
      grossWeight: mappedGrossWeight,
      source: rows.find((row) => isValidGrossWeight(row.mappedGrossWeightPerPcs))?.mappedGrossWeightSource ?? "ITEM_CONVERSION_MAPPING",
      gapReason: null
    };
  }

  if (rows.some((row) => hasInvalidGrossWeight(row.mappedGrossWeightPerPcs))) {
    return { grossWeight: null, source: null, gapReason: "ZERO_OR_INVALID_OK_GROSS_WEIGHT" };
  }

  return { grossWeight: null, source: null, gapReason: "MISSING_OK_GROSS_WEIGHT" };
}

function rejectConversionGapReason(
  attachmentStatus: ResumeRejectAttachmentStatus,
  grossWeightResolution: GrossWeightResolution
): ResumeRejectConversionGapReason {
  if (attachmentStatus === "REJECT_ONLY") return "REJECT_ONLY";
  if (attachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT") return "AMBIGUOUS_REJECT_ATTACHMENT";
  return grossWeightResolution.gapReason ?? "MISSING_OK_GROSS_WEIGHT";
}

function uomSummary(rows: readonly DailyItemResumeSourceRow[]): string {
  const values = [...new Set(rows.map((row) => clean(row.uom)).filter(Boolean))];
  if (values.length === 0) return "-";
  return values.length === 1 ? values[0] ?? "-" : "MIXED";
}

export function buildDailyItemResumeRows(
  inputRows: readonly DailyItemResumeSourceRow[],
  options: { readonly fallbackWorkHours?: number } = {}
): readonly DailyItemResumeRow[] {
  const fallbackWorkHours = options.fallbackWorkHours ?? 24;
  const groups = new Map<string, Group>();
  const docToGroups = new Map<string, Set<string>>();
  const rows = inputRows.filter((row) => isProductionEntryType(row.entryType));
  const okRows = rows.filter(isOkOutput);
  const rejectRows = rows.filter(isRejectOutput);

  for (const row of okRows) {
    const label = machineLabel(row);
    const key = groupKey(row, label);
    const group = groups.get(key) ?? {
      key,
      postingDate: row.postingDate,
      machineLabel: label,
      itemNo: row.itemNo,
      okRows: [],
      rejectRows: [],
      rejectAttachmentStatus: "NONE",
      attachmentWarnings: [],
      rejectAttachmentStatusByRow: new Map<DailyItemResumeSourceRow, ResumeRejectAttachmentStatus>()
    };
    group.okRows.push(row);
    groups.set(key, group);
    if (normalized(row.documentNo)) {
      const docKey = normalized(row.documentNo);
      const docSet = docToGroups.get(docKey) ?? new Set<string>();
      docSet.add(key);
      docToGroups.set(docKey, docSet);
    }
  }

  for (const row of rejectRows) {
    const label = machineLabel(row);
    const docKey = normalized(row.documentNo);
    const candidateKeys = docKey ? docToGroups.get(docKey) : null;
    const candidateGroups = candidateKeys
      ? [...candidateKeys].map((key) => groups.get(key)).filter((value): value is Group => Boolean(value))
      : [];
    const resolution = resolveRejectAttachment(row, candidateGroups);
    if (resolution.group) {
      const group = resolution.group;
      group.rejectRows.push(row);
      group.rejectAttachmentStatus = resolution.status;
      group.rejectAttachmentStatusByRow.set(row, resolution.status);
      continue;
    }
    {
      const key = groupKey(row, label, "REJECT");
      const rejectOnly = groups.get(key) ?? {
        key,
        postingDate: row.postingDate,
        machineLabel: label,
        itemNo: row.itemNo,
        okRows: [],
        rejectRows: [],
        rejectAttachmentStatus: resolution.status,
        attachmentWarnings: [],
        rejectAttachmentStatusByRow: new Map<DailyItemResumeSourceRow, ResumeRejectAttachmentStatus>()
      };
      rejectOnly.rejectAttachmentStatusByRow.set(row, resolution.status);
      if (resolution.status === "AMBIGUOUS_REJECT_ATTACHMENT") rejectOnly.attachmentWarnings.push("AMBIGUOUS_REJECT_ATTACHMENT");
      groups.set(key, rejectOnly);
      rejectOnly.rejectRows.push(row);
    }
  }

  return [...groups.values()]
    .map((group): DailyItemResumeRow => {
      const allRows = [...group.okRows, ...group.rejectRows];
      const anchor = group.okRows[0] ?? group.rejectRows[0];
      const positiveOutputQty = group.okRows.reduce((sum, row) => sum + (row.quantity > 0 ? row.quantity : 0), 0);
      const correctionOutputQty = group.okRows.reduce((sum, row) => sum + (row.quantity < 0 ? row.quantity : 0), 0);
      const netOutputQty = group.okRows.reduce((sum, row) => sum + row.quantity, 0);
      const grossWeightResolution = resolveGrossWeight(group.okRows);
      const grossWeight = grossWeightResolution.grossWeight;
      let rejectPcsEq = 0;
      let incompleteRejectConversion = false;
      const rejectDetails = group.rejectRows.map((row) => {
        const rejectKg = rejectKgForRow(row);
        const attachmentStatus = group.rejectAttachmentStatusByRow.get(row) ?? group.rejectAttachmentStatus;
        const rowGrossWeight = grossWeight;
        const rowRejectPcsEq = rowGrossWeight && rowGrossWeight > 0 ? rejectKg / rowGrossWeight : null;
        if (rowRejectPcsEq === null && rejectKg > 0) incompleteRejectConversion = true;
        else rejectPcsEq += rowRejectPcsEq ?? 0;
        const conversionStatus: ResumeRejectConversionStatus = rowRejectPcsEq === null ? "INCOMPLETE" : "COMPLETE";
        return {
          documentNo: clean(row.documentNo, "-"),
          itemNo: row.itemNo,
          itemDescription: row.itemDescription ?? null,
          rejectKg,
          uom: row.uom ?? null,
          postingDate: row.postingDate,
          attachmentStatus,
          grossWeight: rowGrossWeight ?? null,
          grossWeightSource: rowRejectPcsEq === null ? null : grossWeightResolution.source,
          rejectPcsEq: rowRejectPcsEq,
          conversionStatus,
          conversionGapReason: conversionStatus === "INCOMPLETE"
            ? rejectConversionGapReason(attachmentStatus, grossWeightResolution)
            : null,
          rawExternalDocument: row.externalDocumentNo ?? null,
          operatorName: resolveOperatorName(row),
          shiftCode: resolveShiftCode(row)
        };
      });
      const totalForRejectRate = netOutputQty + rejectPcsEq;
      const workHoursResolution = resolveGroupWorkHours(group.okRows.length ? group.okRows : allRows, fallbackWorkHours);
      const workHours = workHoursResolution.workHours;
      const dailyTarget = anchor?.dailyTarget ?? null;
      const transactionProrataTarget = dailyTarget === null ? null : dailyTarget * (workHours / 24);
      const achievementPct = transactionProrataTarget && transactionProrataTarget > 0 ? (netOutputQty / transactionProrataTarget) * 100 : null;
      const achievementStatus: ResumeAchievementStatus = dailyTarget === null
        ? "TARGET_MISSING"
        : transactionProrataTarget === 0
          ? "TARGET_ZERO"
          : netOutputQty === 0
            ? "NO_OUTPUT"
            : "COVERED";
      const documentDetails = [...new Map(allRows.map((row) => {
        const key = clean(row.documentNo, "-");
        return [key, {
          documentNo: key,
          quantity: allRows.filter((candidate) => clean(candidate.documentNo, "-") === key && isOkOutput(candidate)).reduce((sum, candidate) => sum + candidate.quantity, 0),
          rejectKg: allRows.filter((candidate) => clean(candidate.documentNo, "-") === key && isRejectOutput(candidate)).reduce((sum, candidate) => sum + rejectKgForRow(candidate), 0),
          type: allRows.some((candidate) => clean(candidate.documentNo, "-") === key && isOkOutput(candidate))
            && allRows.some((candidate) => clean(candidate.documentNo, "-") === key && isRejectOutput(candidate))
            ? "MIXED" as const
            : isOkOutput(row) ? "OK" as const : "REJECT" as const
        }];
      })).values()];
      const operatorDetails = [...new Map(allRows.map((row) => {
        const operatorName = resolveOperatorName(row);
        const shiftCode = resolveShiftCode(row);
        const key = `${clean(operatorName, "-")}|${clean(shiftCode, "-")}|${clean(row.documentNo, "-")}`;
        return [key, {
          operatorName: clean(operatorName, "-"),
          shiftCode: clean(shiftCode, "-"),
          documentNo: clean(row.documentNo, "-"),
          quantity: allRows
            .filter((candidate) => {
              const candidateOperatorName = resolveOperatorName(candidate);
              const candidateShiftCode = resolveShiftCode(candidate);
              return `${clean(candidateOperatorName, "-")}|${clean(candidateShiftCode, "-")}|${clean(candidate.documentNo, "-")}` === key;
            })
            .reduce((sum, candidate) => sum + candidate.quantity, 0)
        }];
      })).values()];
      const externalDocumentDetails = [...new Map(allRows.map((row) => {
        const parsed = parseExternalDocument(row.externalDocumentNo);
        const key = [
          row.externalDocumentNo ?? "",
          clean(row.documentNo, "-"),
          parsed.shiftCode ?? "",
          parsed.operatorName ?? "",
          parsed.workHours ?? ""
        ].join("|");
        return [key, {
          rawExternalDocument: row.externalDocumentNo ?? null,
          parseStatus: parsed.parseStatus,
          parsedShift: parsed.shiftCode,
          parsedWorkHours: parsed.workHours,
          parsedOperator: parsed.operatorName,
          documentNo: clean(row.documentNo, "-"),
          postingDate: row.postingDate,
          quantity: row.quantity
        }];
      })).values()];

      return {
        postingDate: group.postingDate,
        entityId: anchor?.entityId ?? null,
        entityCode: anchor?.entityCode ?? null,
        machineLabel: group.machineLabel,
        itemNo: anchor?.itemNo ?? group.itemNo,
        itemDescription: anchor?.itemDescription ?? null,
        itemCategoryCode: anchor?.itemCategoryCode ?? null,
        documentSummary: uniqueSummary(allRows.map((row) => row.documentNo)),
        documentCount: documentDetails.length,
        documentDetails,
        operatorSummary: uniqueSummary(allRows.map((row) => resolveOperatorName(row))),
        operatorDetails,
        shiftSummary: uniqueSummary(allRows.map((row) => resolveShiftCode(row))),
        workHours,
        workHoursSource: workHoursResolution.source,
        dailyTarget,
        transactionProrataTarget,
        netOutputQty,
        positiveOutputQty,
        correctionOutputQty,
        uom: uomSummary(group.okRows.length ? group.okRows : allRows),
        rejectKg: rejectDetails.reduce((sum, detail) => sum + detail.rejectKg, 0),
        rejectPcsEq: incompleteRejectConversion ? null : rejectPcsEq,
        rejectConversionStatus: incompleteRejectConversion ? "INCOMPLETE" : "COMPLETE",
        rejectAttachmentStatus: group.rejectAttachmentStatus,
        rejectPct: totalForRejectRate > 0 && !incompleteRejectConversion ? (rejectPcsEq / totalForRejectRate) * 100 : null,
        achievementPct,
        achievementStatus,
        grossWeight,
        inputCount: allRows.length,
        externalDocumentSummary: uniqueSummary(allRows.map((row) => row.externalDocumentNo)),
        externalDocumentDetails,
        notes: [
          ...(correctionOutputQty < 0 ? ["Contains negative Output correction"] : []),
          ...(incompleteRejectConversion ? ["Reject conversion incomplete"] : []),
          ...group.attachmentWarnings,
          ...(group.rejectAttachmentStatus === "REJECT_ONLY" ? ["No matching OK row for reject document"] : []),
          ...(achievementStatus === "TARGET_MISSING" ? ["Target missing"] : []),
          ...(allRows.some((row) => {
            const parsed = parseExternalDocument(row.externalDocumentNo);
            return parsed.rawExternalDocument && parsed.parseStatus === "UNPARSED";
          }) ? ["External document unparsed"] : [])
        ],
        rejectDetails
      };
    })
    .sort((a, b) => b.postingDate.localeCompare(a.postingDate) || a.machineLabel.localeCompare(b.machineLabel) || a.itemNo.localeCompare(b.itemNo));
}
