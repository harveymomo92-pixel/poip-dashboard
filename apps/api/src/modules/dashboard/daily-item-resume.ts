import { classifyOutputRow, inferResumeTargetBucket, parseExternalDocument, type ParsedExternalDocument, type ResumeTargetBucket } from "@poip/domain";

export type DailyItemResumeSort = "postingDate.desc" | "postingDate.asc" | "netOutputQty.desc" | "netOutputQty.asc";

export type DailyItemResumeTargetReason =
  | "UNMAPPED_ENTITY"
  | "NO_ACTIVE_TARGET"
  | "TARGET_NOT_APPROVED"
  | "OUTSIDE_EFFECTIVE_DATE"
  | "TARGET_BUCKET_MISSING"
  | "TARGET_ZERO"
  | "TARGET_MATCHED";

export type DailyItemResumeTargetSource = "NONE" | "ENTITY_DAILY_TARGET" | "BUCKET_DAILY_TARGET";
export type DailyItemResumeWorkHoursSource = "EXTERNAL_DOCUMENT" | "FALLBACK" | "UNKNOWN";
export type DailyItemResumeRejectConversionStatus = "COMPLETE" | "INCOMPLETE";
export type DailyItemResumeRejectConversionGapReason =
  | "NO_MATCHED_OK_ROW"
  | "MISSING_OK_GROSS_WEIGHT"
  | "ZERO_OR_INVALID_OK_GROSS_WEIGHT"
  | "AMBIGUOUS_REJECT_ATTACHMENT"
  | "REJECT_ONLY"
  | "MISSING_CONVERSION_MAPPING";
export type DailyItemResumeGrossWeightSource =
  | "ROW_GROSS_WEIGHT"
  | "ITEM_CONVERSION_MAPPING"
  | "MASTER_ENTITY_CONVERSION";
export type DailyItemResumeAttachedRejectAttachmentStatus =
  | "ATTACHED_BY_DOCUMENT"
  | "ATTACHED_BY_DOCUMENT_DATE"
  | "ATTACHED_BY_DOCUMENT_DATE_MACHINE"
  | "ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR";
export type DailyItemResumeRejectAttachmentStatus =
  | "NONE"
  | DailyItemResumeAttachedRejectAttachmentStatus
  | "REJECT_ONLY"
  | "AMBIGUOUS_REJECT_ATTACHMENT";

export const DAILY_ITEM_RESUME_REJECT_ATTACHMENT_STATUSES = [
  "ATTACHED_BY_DOCUMENT",
  "ATTACHED_BY_DOCUMENT_DATE",
  "ATTACHED_BY_DOCUMENT_DATE_MACHINE",
  "ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR",
  "AMBIGUOUS_REJECT_ATTACHMENT",
  "REJECT_ONLY"
] as const satisfies readonly Exclude<DailyItemResumeRejectAttachmentStatus, "NONE">[];

export function isAttachedDailyItemResumeRejectAttachmentStatus(
  status: DailyItemResumeRejectAttachmentStatus
): status is DailyItemResumeAttachedRejectAttachmentStatus {
  return status.startsWith("ATTACHED_BY_");
}

export const DAILY_ITEM_RESUME_TARGET_REASONS: readonly DailyItemResumeTargetReason[] = [
  "TARGET_MATCHED",
  "UNMAPPED_ENTITY",
  "NO_ACTIVE_TARGET",
  "TARGET_NOT_APPROVED",
  "OUTSIDE_EFFECTIVE_DATE",
  "TARGET_BUCKET_MISSING",
  "TARGET_ZERO"
];

export interface DailyItemResumeFilters {
  readonly from: string;
  readonly to: string;
  readonly sourceSystem: string;
  readonly entityId?: string;
  readonly machine?: string;
  readonly itemNo?: string;
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: DailyItemResumeSort;
}

export interface DailyItemResumeSourceRow {
  readonly id: string;
  readonly postingDate: string;
  readonly documentNo: string | null;
  readonly externalDocumentNo: string | null;
  readonly normalizedOutputType: string;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly machineDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly prodLineNo: string | null;
  readonly prodLineDescription: string | null;
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly entityDisplayName: string | null;
  readonly plannedRuntimeHours: number | null;
  readonly shiftCode: string | null;
  readonly operatorName: string | null;
  readonly quantity: number;
  readonly uom: string | null;
  readonly grossWeightPerPcs: number | null;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly mappedGrossWeightPerPcs?: number | null;
  readonly mappedGrossWeightSource?: DailyItemResumeGrossWeightSource | null;
}

export interface DailyItemResumeTarget {
  readonly entityId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly dailyTargetQty: number;
  readonly status?: string | null;
  readonly targetBucket?: ResumeTargetBucket | null;
  readonly targetSource?: string | null;
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
  readonly documentDetails: readonly Record<string, unknown>[];
  readonly operatorSummary: string;
  readonly operatorDetails: readonly Record<string, unknown>[];
  readonly shiftSummary: string;
  readonly workHours: number;
  readonly workHoursSource: DailyItemResumeWorkHoursSource;
  readonly dailyTarget: number | null;
  readonly targetSource: DailyItemResumeTargetSource;
  readonly targetReason: DailyItemResumeTargetReason;
  readonly targetBucket: ResumeTargetBucket | null;
  readonly targetBucketLabel: string | null;
  readonly targetDetails: Record<string, unknown>;
  readonly transactionProrataTarget: number | null;
  readonly netOutputQty: number;
  readonly positiveOutputQty: number;
  readonly correctionOutputQty: number;
  readonly uom: string;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly rejectConversionStatus: DailyItemResumeRejectConversionStatus | "NOT_APPLICABLE";
  readonly rejectAttachmentStatus: DailyItemResumeRejectAttachmentStatus;
  readonly rejectPct: number | null;
  readonly achievementPct: number | null;
  readonly achievementStatus: "TARGET_MISSING" | "TARGET_ZERO" | "NO_OUTPUT" | "BELOW_TARGET" | "ON_TARGET" | "ABOVE_TARGET";
  readonly grossWeight: number | null;
  readonly inputCount: number;
  readonly externalDocumentSummary: string;
  readonly externalDocumentDetails: readonly Record<string, unknown>[];
  readonly notes: readonly string[];
  readonly rejectDetails: readonly Record<string, unknown>[];
  readonly drilldown: Record<string, unknown>;
}

export interface DailyItemResumeRejectAttachmentCandidate {
  readonly postingDate: string;
  readonly machine: string;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly netOutput: number;
  readonly operator: string;
  readonly shift: string;
  readonly workHours: number | null;
}

export const DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS = [
  "MISSING_OK_GROSS_WEIGHT",
  "ZERO_OR_INVALID_OK_GROSS_WEIGHT",
  "NO_MATCHED_OK_ROW",
  "AMBIGUOUS_REJECT_ATTACHMENT",
  "REJECT_ONLY",
  "MISSING_CONVERSION_MAPPING"
] as const satisfies readonly DailyItemResumeRejectConversionGapReason[];

interface GroupState {
  readonly key: string;
  readonly postingDate: string;
  readonly machineLabel: string;
  readonly itemNo: string;
  entityId: string | null;
  entityCode: string | null;
  itemDescription: string | null;
  itemCategoryCode: string | null;
  plannedRuntimeHours: number | null;
  okRows: DailyItemResumeSourceRow[];
  rejectRows: DailyItemResumeSourceRow[];
  rejectAttachmentStatus: DailyItemResumeRejectAttachmentStatus;
  attachmentWarnings: string[];
  rejectAttachmentStatusByRowId: Record<string, DailyItemResumeRejectAttachmentStatus>;
  rejectAttachmentCandidatesByRowId: Record<string, readonly DailyItemResumeRejectAttachmentCandidate[]>;
}

interface RejectAttachmentResolution {
  readonly group: GroupState | null;
  readonly status: DailyItemResumeRejectAttachmentStatus;
  readonly candidates: readonly GroupState[];
}

export interface DailyItemResumeResult {
  readonly rows: readonly DailyItemResumeRow[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

export interface DailyItemResumeTargetReasonSummary {
  readonly reason: DailyItemResumeTargetReason;
  readonly rowCount: number;
  readonly netOutputQty: number;
}

export interface DailyItemResumeRejectDocumentSummary {
  readonly documentNo: string;
  readonly rejectKg: number;
  readonly rows: number;
  readonly okItems: readonly string[];
  readonly rejectItems: readonly string[];
}

export interface DailyItemResumeRejectConversionSummary {
  readonly rejectPcsEquivalent: number;
  readonly completeCount: number;
  readonly incompleteCount: number;
  readonly gapBreakdown: readonly {
    readonly reason: DailyItemResumeRejectConversionGapReason;
    readonly rowCount: number;
    readonly rejectKg: number;
  }[];
}

export function summarizeDailyItemResumeTargetReasons(
  rows: readonly DailyItemResumeRow[]
): readonly DailyItemResumeTargetReasonSummary[] {
  return DAILY_ITEM_RESUME_TARGET_REASONS.map((reason) => {
    const reasonRows = rows.filter((row) => row.targetReason === reason);
    return {
      reason,
      rowCount: reasonRows.length,
      netOutputQty: reasonRows.reduce((total, row) => total + row.netOutputQty, 0)
    };
  });
}

export function summarizeDailyItemResumeRejectDocuments(
  rows: readonly DailyItemResumeRow[]
): readonly DailyItemResumeRejectDocumentSummary[] {
  const summaries = new Map<string, { rejectKg: number; rows: number; okItems: Set<string>; rejectItems: Set<string> }>();
  for (const row of rows) {
    const rowIsOk = classifyOutputRow({ entryType: "Output", itemNo: row.itemNo, uom: row.uom }) === "OK";
    for (const detail of row.rejectDetails) {
      const documentNo = String(detail.documentNo ?? "(blank)");
      const current = summaries.get(documentNo) ?? {
        rejectKg: 0,
        rows: 0,
        okItems: new Set<string>(),
        rejectItems: new Set<string>()
      };
      current.rejectKg += Number(detail.rejectKg ?? 0);
      current.rows += 1;
      if (rowIsOk) current.okItems.add(row.itemNo);
      const rejectItemNo = String(detail.itemNo ?? "");
      const rejectUom = typeof detail.uom === "string" ? detail.uom : null;
      if (classifyOutputRow({ entryType: "Output", itemNo: rejectItemNo, uom: rejectUom }) === "REJECT") {
        current.rejectItems.add(rejectItemNo);
      }
      summaries.set(documentNo, current);
    }
  }
  return [...summaries.entries()].map(([documentNo, value]) => ({
    documentNo,
    rejectKg: value.rejectKg,
    rows: value.rows,
    okItems: [...value.okItems],
    rejectItems: [...value.rejectItems]
  }));
}

function detailNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeDailyItemResumeRejectConversions(
  rows: readonly DailyItemResumeRow[]
): DailyItemResumeRejectConversionSummary {
  const gapBreakdown = new Map<DailyItemResumeRejectConversionGapReason, { rowCount: number; rejectKg: number }>();
  for (const reason of DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS) {
    gapBreakdown.set(reason, { rowCount: 0, rejectKg: 0 });
  }
  let rejectPcsEquivalent = 0;
  let completeCount = 0;
  let incompleteCount = 0;
  for (const row of rows) {
    for (const detail of row.rejectDetails) {
      if (detail.conversionStatus === "COMPLETE") {
        rejectPcsEquivalent += detailNumber(detail.rejectPcsEq);
        completeCount += 1;
        continue;
      }
      if (detail.conversionStatus !== "INCOMPLETE") continue;
      incompleteCount += 1;
      const rawReason = typeof detail.conversionGapReason === "string" ? detail.conversionGapReason : "";
      const reason = DAILY_ITEM_RESUME_REJECT_CONVERSION_GAP_REASONS.includes(rawReason as DailyItemResumeRejectConversionGapReason)
        ? rawReason as DailyItemResumeRejectConversionGapReason
        : "MISSING_OK_GROSS_WEIGHT";
      const current = gapBreakdown.get(reason);
      if (!current) continue;
      current.rowCount += 1;
      current.rejectKg += detailNumber(detail.rejectKg);
    }
  }
  return {
    rejectPcsEquivalent,
    completeCount,
    incompleteCount,
    gapBreakdown: [...gapBreakdown.entries()].map(([reason, value]) => ({ reason, ...value }))
  };
}

export function normalizeDailyItemResumeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function compact(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim();
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = compact(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function resolveOperatorName(row: DailyItemResumeSourceRow): string | null {
  const parsed = parseExternalDocument(row.externalDocumentNo).operatorName;
  return parsed ?? (compact(row.operatorName) || null);
}

function resolveShiftCode(row: DailyItemResumeSourceRow): string | null {
  const parsed = parseExternalDocument(row.externalDocumentNo).shiftCode;
  return parsed ?? (compact(row.shiftCode) || null);
}

function resolveRowWorkHours(row: DailyItemResumeSourceRow): number | null {
  const parsed = parseExternalDocument(row.externalDocumentNo).workHours;
  return parsed ?? (row.plannedRuntimeHours && row.plannedRuntimeHours > 0 ? row.plannedRuntimeHours : null);
}

function parsedExternalDocuments(rows: readonly DailyItemResumeSourceRow[]): ParsedExternalDocument[] {
  return rows.map((row) => parseExternalDocument(row.externalDocumentNo));
}

function resolveGroupWorkHours(
  rows: readonly DailyItemResumeSourceRow[],
  fallbackWorkHours: number
): { readonly workHours: number; readonly source: DailyItemResumeWorkHoursSource } {
  const parsedHours = new Map<string, number>();
  for (const row of rows) {
    const parsed = parseExternalDocument(row.externalDocumentNo);
    if (parsed.parseStatus !== "PARSED" || parsed.workHours === null) continue;
    const key = [parsed.shiftCode, parsed.operatorName, parsed.workHours].join("|");
    parsedHours.set(key, parsed.workHours);
  }
  if (parsedHours.size > 0) {
    return {
      workHours: [...parsedHours.values()].reduce((total, value) => total + value, 0),
      source: "EXTERNAL_DOCUMENT"
    };
  }
  if (fallbackWorkHours > 0) return { workHours: fallbackWorkHours, source: "FALLBACK" };
  return { workHours: 0, source: "UNKNOWN" };
}

export function resolveMachineLabel(row: DailyItemResumeSourceRow): string {
  return (
    compact(row.entityDisplayName) ||
    compact(row.entityCode) ||
    compact(row.machineDescription) ||
    compact(row.machineCenterNo) ||
    compact(row.prodLineDescription) ||
    compact(row.prodLineNo) ||
    "Unmapped"
  );
}

function groupKey(row: DailyItemResumeSourceRow, rejectOnly = false): string {
  return dailyItemResumeGroupKey({
    postingDate: row.postingDate,
    machineLabel: resolveMachineLabel(row),
    itemNo: row.itemNo,
    rejectOnly
  });
}

export function dailyItemResumeGroupKey(input: {
  readonly postingDate: string;
  readonly machineLabel: string;
  readonly itemNo: string;
  readonly rejectOnly?: boolean;
}): string {
  return [
    input.postingDate,
    normalizeDailyItemResumeValue(input.machineLabel),
    normalizeDailyItemResumeValue(input.itemNo),
    input.rejectOnly ? "REJECT_ONLY" : "OK"
  ].join("|");
}

function isOkOutput(row: DailyItemResumeSourceRow): boolean {
  return classifyOutputRow({ entryType: "Output", itemNo: row.itemNo, uom: row.uom }) === "OK";
}

function isRejectOutput(row: DailyItemResumeSourceRow): boolean {
  return classifyOutputRow({ entryType: "Output", itemNo: row.itemNo, uom: row.uom }) === "REJECT";
}

function rejectKgForRow(row: DailyItemResumeSourceRow): number {
  return row.quantity !== 0 ? Math.abs(row.quantity) : Math.max(row.rejectKg, 0);
}

function normalizedValues(...values: readonly (string | null | undefined)[]): readonly string[] {
  return [...new Set(values.map((value) => normalizeDailyItemResumeValue(value)).filter(Boolean))];
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
  return normalizedValues(row.entityId, row.entityCode, row.entityDisplayName);
}

function groupMatchesRowValues(
  row: DailyItemResumeSourceRow,
  group: GroupState,
  valuesForRow: (value: DailyItemResumeSourceRow) => readonly string[]
): boolean {
  const rowValues = new Set(valuesForRow(row));
  if (rowValues.size === 0) return false;
  return group.okRows.some((okRow) => valuesForRow(okRow).some((value) => rowValues.has(value)));
}

function narrowByMachine(row: DailyItemResumeSourceRow, candidates: readonly GroupState[]): readonly GroupState[] {
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

function narrowByExternalContext(row: DailyItemResumeSourceRow, candidates: readonly GroupState[]): readonly GroupState[] {
  const rejectShift = normalizeDailyItemResumeValue(resolveShiftCode(row));
  const rejectOperator = normalizeDailyItemResumeValue(resolveOperatorName(row));
  const rejectWorkHours = workHoursKey(resolveRowWorkHours(row));
  const fields = [
    {
      rejectValue: rejectShift,
      candidateValue: (candidate: DailyItemResumeSourceRow) => normalizeDailyItemResumeValue(resolveShiftCode(candidate))
    },
    {
      rejectValue: rejectOperator,
      candidateValue: (candidate: DailyItemResumeSourceRow) => normalizeDailyItemResumeValue(resolveOperatorName(candidate))
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
  documentCandidates: readonly GroupState[]
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

function attachmentCandidateSummary(group: GroupState): DailyItemResumeRejectAttachmentCandidate {
  return {
    postingDate: group.postingDate,
    machine: group.machineLabel,
    itemNo: group.itemNo,
    itemDescription: group.itemDescription,
    netOutput: group.okRows.reduce((total, row) => total + row.quantity, 0),
    operator: summarize(unique(group.okRows.map((row) => resolveOperatorName(row))), "N/A"),
    shift: summarize(unique(group.okRows.map((row) => resolveShiftCode(row))), "N/A"),
    workHours: resolveGroupWorkHours(group.okRows, group.plannedRuntimeHours && group.plannedRuntimeHours > 0 ? group.plannedRuntimeHours : 0).workHours || null
  };
}

interface TargetResolutionInput {
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly entityDisplayName: string | null;
  readonly machineLabel: string;
  readonly machineDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly prodLineNo: string | null;
  readonly prodLineDescription: string | null;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly itemCategoryCode: string | null;
  readonly grossWeightPerPcs: number | null;
  readonly postingDate: string;
}

interface TargetResolution {
  readonly target: DailyItemResumeTarget | null;
  readonly dailyTarget: number | null;
  readonly targetSource: DailyItemResumeTargetSource;
  readonly targetReason: DailyItemResumeTargetReason;
  readonly targetBucket: ResumeTargetBucket | null;
  readonly targetBucketLabel: string | null;
  readonly details: Record<string, unknown>;
}

function isApprovedTarget(target: DailyItemResumeTarget): boolean {
  const status = normalizeDailyItemResumeValue(target.status);
  return !status || status === "APPROVED" || status === "ACTIVE";
}

function isEffectiveOn(target: DailyItemResumeTarget, postingDate: string): boolean {
  if (target.effectiveFrom > postingDate) return false;
  if (target.effectiveTo && target.effectiveTo < postingDate) return false;
  return true;
}

function sortTargets(targets: readonly DailyItemResumeTarget[]): DailyItemResumeTarget[] {
  return [...targets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.dailyTargetQty - a.dailyTargetQty);
}

function resolveDailyItemResumeTarget(
  input: TargetResolutionInput,
  targets: readonly DailyItemResumeTarget[]
): TargetResolution {
  const bucket = inferResumeTargetBucket({
    entityCode: input.entityCode,
    entityDisplayName: input.entityDisplayName,
    machineLabel: input.machineLabel,
    machineDescription: input.machineDescription,
    machineCenterNo: input.machineCenterNo,
    prodLineNo: input.prodLineNo,
    prodLineDescription: input.prodLineDescription,
    itemNo: input.itemNo,
    itemDescription: input.itemDescription,
    itemCategoryCode: input.itemCategoryCode,
    grossWeightPerPcs: input.grossWeightPerPcs
  });
  const baseDetails = {
    targetBucket: bucket.bucket,
    targetBucketLabel: bucket.bucketLabel,
    targetBucketReason: bucket.reason,
    targetBucketCandidates: bucket.candidates,
    targetBucketEvidence: bucket.evidence
  };

  if (!input.entityId) {
    return {
      target: null,
      dailyTarget: null,
      targetSource: "NONE",
      targetReason: "UNMAPPED_ENTITY",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: {
        ...baseDetails,
        message: "No resolved master entity is attached to this production output group."
      }
    };
  }

  const entityTargets = targets.filter((target) => target.entityId === input.entityId);
  if (entityTargets.length === 0) {
    return {
      target: null,
      dailyTarget: null,
      targetSource: "NONE",
      targetReason: "NO_ACTIVE_TARGET",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: {
        ...baseDetails,
        entityId: input.entityId,
        candidateTargetCount: 0,
        message: "No production target exists for this resolved entity."
      }
    };
  }

  const effectiveTargets = entityTargets.filter((target) => isEffectiveOn(target, input.postingDate));
  const approvedEffectiveTargets = effectiveTargets.filter(isApprovedTarget);
  if (effectiveTargets.length > 0 && approvedEffectiveTargets.length === 0) {
    return {
      target: null,
      dailyTarget: null,
      targetSource: "NONE",
      targetReason: "TARGET_NOT_APPROVED",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: {
        ...baseDetails,
        entityId: input.entityId,
        candidateTargetCount: entityTargets.length,
        effectiveTargetCount: effectiveTargets.length,
        statuses: [...new Set(effectiveTargets.map((target) => normalizeDailyItemResumeValue(target.status) || "APPROVED"))],
        message: "A target exists for this date, but it is not APPROVED or ACTIVE."
      }
    };
  }

  if (approvedEffectiveTargets.length === 0) {
    const approvedTargets = entityTargets.filter(isApprovedTarget);
    return {
      target: null,
      dailyTarget: null,
      targetSource: "NONE",
      targetReason: approvedTargets.length > 0 ? "OUTSIDE_EFFECTIVE_DATE" : "NO_ACTIVE_TARGET",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: {
        ...baseDetails,
        entityId: input.entityId,
        candidateTargetCount: entityTargets.length,
        approvedTargetCount: approvedTargets.length,
        postingDate: input.postingDate,
        effectiveRanges: approvedTargets.map((target) => ({
          from: target.effectiveFrom,
          to: target.effectiveTo
        })),
        message: approvedTargets.length > 0
          ? "Approved/active targets exist, but none cover this posting date."
          : "Targets exist for this entity, but none are APPROVED or ACTIVE."
      }
    };
  }

  const bucketAwareTargets = approvedEffectiveTargets.filter((target) => target.targetBucket);
  let matchableTargets = approvedEffectiveTargets;
  let targetSource: DailyItemResumeTargetSource = "ENTITY_DAILY_TARGET";
  if (bucketAwareTargets.length > 0) {
    if (bucket.reason !== "INFERRED" || !bucket.bucket) {
      return {
        target: null,
        dailyTarget: null,
        targetSource: "NONE",
        targetReason: "TARGET_BUCKET_MISSING",
        targetBucket: bucket.bucket,
        targetBucketLabel: bucket.bucketLabel,
        details: {
          ...baseDetails,
          entityId: input.entityId,
          candidateTargetCount: entityTargets.length,
          approvedEffectiveTargetCount: approvedEffectiveTargets.length,
          message: "Bucket-specific targets are available, but this row has no reliable target bucket."
        }
      };
    }
    matchableTargets = bucketAwareTargets.filter((target) => target.targetBucket === bucket.bucket);
    targetSource = "BUCKET_DAILY_TARGET";
    if (matchableTargets.length === 0) {
      return {
        target: null,
        dailyTarget: null,
        targetSource: "NONE",
        targetReason: "TARGET_BUCKET_MISSING",
        targetBucket: bucket.bucket,
        targetBucketLabel: bucket.bucketLabel,
        details: {
          ...baseDetails,
          entityId: input.entityId,
          candidateTargetCount: entityTargets.length,
          approvedEffectiveTargetCount: approvedEffectiveTargets.length,
          availableTargetBuckets: [...new Set(bucketAwareTargets.map((target) => target.targetBucket))],
          message: "No approved effective target matches the inferred bucket."
        }
      };
    }
  }

  const target = sortTargets(matchableTargets)[0] ?? null;
  if (!target) {
    return {
      target: null,
      dailyTarget: null,
      targetSource: "NONE",
      targetReason: "NO_ACTIVE_TARGET",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: baseDetails
    };
  }

  if (target.dailyTargetQty <= 0) {
    return {
      target,
      dailyTarget: target.dailyTargetQty,
      targetSource,
      targetReason: "TARGET_ZERO",
      targetBucket: bucket.bucket,
      targetBucketLabel: bucket.bucketLabel,
      details: {
        ...baseDetails,
        entityId: input.entityId,
        effectiveFrom: target.effectiveFrom,
        effectiveTo: target.effectiveTo,
        dailyTarget: target.dailyTargetQty,
        message: "The matched target is zero, so achievement is not calculated."
      }
    };
  }

  return {
    target,
    dailyTarget: target.dailyTargetQty,
    targetSource,
    targetReason: "TARGET_MATCHED",
    targetBucket: bucket.bucket,
    targetBucketLabel: bucket.bucketLabel,
    details: {
      ...baseDetails,
      entityId: input.entityId,
      effectiveFrom: target.effectiveFrom,
      effectiveTo: target.effectiveTo,
      dailyTarget: target.dailyTargetQty,
      message: "Approved effective target matched."
    }
  };
}

function summarize(values: readonly string[], fallback = "N/A"): string {
  if (values.length === 0) return fallback;
  if (values.length <= 2) return values.join(" | ");
  return `${values.slice(0, 2).join(" | ")} +${values.length - 2}`;
}

function matchesSearch(row: DailyItemResumeRow, search: string | undefined): boolean {
  const needle = normalizeDailyItemResumeValue(search);
  if (!needle) return true;
  const haystack = [
    row.machineLabel,
    row.itemNo,
    row.itemDescription,
    row.documentSummary,
    row.operatorSummary,
    row.shiftSummary,
    row.externalDocumentSummary,
    ...row.documentDetails.map((detail) => String(detail.documentNo ?? "")),
    ...row.operatorDetails.map((detail) => String(detail.operatorName ?? ""))
  ].join(" ");
  return normalizeDailyItemResumeValue(haystack).includes(needle);
}

interface GrossWeightResolution {
  readonly grossWeight: number | null;
  readonly source: DailyItemResumeGrossWeightSource | null;
  readonly gapReason: DailyItemResumeRejectConversionGapReason | null;
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

  const mappedRow = rows.find((row) => isValidGrossWeight(row.mappedGrossWeightPerPcs));
  if (mappedRow?.mappedGrossWeightPerPcs) {
    return {
      grossWeight: mappedRow.mappedGrossWeightPerPcs,
      source: mappedRow.mappedGrossWeightSource ?? "ITEM_CONVERSION_MAPPING",
      gapReason: null
    };
  }

  if (rows.some((row) => hasInvalidGrossWeight(row.mappedGrossWeightPerPcs))) {
    return { grossWeight: null, source: null, gapReason: "ZERO_OR_INVALID_OK_GROSS_WEIGHT" };
  }

  return { grossWeight: null, source: null, gapReason: "MISSING_OK_GROSS_WEIGHT" };
}

function rejectConversionGapReason(
  attachmentStatus: DailyItemResumeRejectAttachmentStatus,
  grossWeightResolution: GrossWeightResolution
): DailyItemResumeRejectConversionGapReason {
  if (attachmentStatus === "REJECT_ONLY") return "REJECT_ONLY";
  if (attachmentStatus === "AMBIGUOUS_REJECT_ATTACHMENT") return "AMBIGUOUS_REJECT_ATTACHMENT";
  return grossWeightResolution.gapReason ?? "MISSING_OK_GROSS_WEIGHT";
}

function toResumeRow(group: GroupState, targets: readonly DailyItemResumeTarget[]): DailyItemResumeRow {
  const allRows = [...group.okRows, ...group.rejectRows];
  const anchor = group.okRows[0] ?? group.rejectRows[0] ?? null;
  const positiveOutputQty = group.okRows.reduce((total, row) => total + (row.quantity > 0 ? row.quantity : 0), 0);
  const correctionOutputQty = group.okRows.reduce((total, row) => total + (row.quantity < 0 ? row.quantity : 0), 0);
  const netOutputQty = group.okRows.reduce((total, row) => total + row.quantity, 0);
  const documents = unique(allRows.map((row) => row.documentNo));
  const externalDocuments = unique(allRows.map((row) => row.externalDocumentNo));
  const operators = unique(allRows.map((row) => resolveOperatorName(row)));
  const shifts = unique(allRows.map((row) => resolveShiftCode(row)));
  const uoms = unique(group.okRows.map((row) => row.uom));
  const uom = uoms.length === 0 ? "N/A" : uoms.length === 1 ? uoms[0] ?? "N/A" : "MIXED";
  const workHoursResolution = resolveGroupWorkHours(group.okRows.length ? group.okRows : allRows, group.plannedRuntimeHours && group.plannedRuntimeHours > 0 ? group.plannedRuntimeHours : 24);
  const workHours = workHoursResolution.workHours;
  const grossWeightResolution = resolveGrossWeight(group.okRows);
  const grossWeight = grossWeightResolution.grossWeight;
  const targetResolution = resolveDailyItemResumeTarget({
    entityId: group.entityId,
    entityCode: group.entityCode,
    entityDisplayName: anchor?.entityDisplayName ?? null,
    machineLabel: group.machineLabel,
    machineDescription: anchor?.machineDescription ?? null,
    machineCenterNo: anchor?.machineCenterNo ?? null,
    prodLineNo: anchor?.prodLineNo ?? null,
    prodLineDescription: anchor?.prodLineDescription ?? null,
    itemNo: group.itemNo,
    itemDescription: group.itemDescription,
    itemCategoryCode: group.itemCategoryCode,
    grossWeightPerPcs: grossWeight,
    postingDate: group.postingDate
  }, targets);
  const dailyTarget = targetResolution.dailyTarget;
  const transactionProrataTarget = dailyTarget === null ? null : dailyTarget * (workHours / 24);
  const achievementPct =
    transactionProrataTarget && transactionProrataTarget > 0 ? (netOutputQty / transactionProrataTarget) * 100 : null;
  const achievementStatus =
    dailyTarget === null
      ? "TARGET_MISSING"
      : targetResolution.targetReason === "TARGET_ZERO"
        ? "TARGET_ZERO"
        : netOutputQty === 0
          ? "NO_OUTPUT"
          : achievementPct === null
            ? "TARGET_MISSING"
            : achievementPct >= 100
              ? "ABOVE_TARGET"
              : achievementPct >= 95
                ? "ON_TARGET"
                : "BELOW_TARGET";
  const targetDetails = {
    ...targetResolution.details,
    targetSource: targetResolution.targetSource,
    targetReason: targetResolution.targetReason,
    dailyTarget,
    workHours,
    workHoursSource: workHoursResolution.source,
    transactionProrataTarget,
    netOutputQty,
    achievementPct,
    transactionProrataFormula: dailyTarget === null ? "N/A" : "dailyTarget * workHours / 24",
    achievementFormula: transactionProrataTarget && transactionProrataTarget > 0 ? "netOutputQty / transactionProrataTarget * 100" : "N/A"
  };
  const okGrossByDocument = new Map<string, GrossWeightResolution>();
  for (const row of group.okRows) {
    const doc = compact(row.documentNo);
    if (!doc || okGrossByDocument.has(doc)) continue;
    const resolution = resolveGrossWeight([row]);
    if (resolution.grossWeight !== null) okGrossByDocument.set(doc, resolution);
  }

  let rejectKg = 0;
  let rejectPcsEq = 0;
  let conversionGaps = 0;
  const rejectDetails = group.rejectRows.map((row) => {
    const kg = rejectKgForRow(row);
    const doc = compact(row.documentNo);
    const attachmentStatus = group.rejectAttachmentStatusByRowId[row.id] ?? group.rejectAttachmentStatus;
    const docGrossWeight = doc ? okGrossByDocument.get(doc) ?? grossWeightResolution : grossWeightResolution;
    const pcsEq = docGrossWeight.grossWeight && docGrossWeight.grossWeight > 0 ? kg / docGrossWeight.grossWeight : null;
    const conversionStatus: DailyItemResumeRejectConversionStatus = pcsEq === null ? "INCOMPLETE" : "COMPLETE";
    rejectKg += kg;
    if (pcsEq === null) conversionGaps += 1;
    else rejectPcsEq += pcsEq;
    return {
      documentNo: row.documentNo,
      itemNo: row.itemNo,
      itemDescription: row.itemDescription,
      quantity: row.quantity,
      rejectKg: kg,
      uom: row.uom,
      postingDate: row.postingDate,
      attachmentStatus,
      grossWeight: docGrossWeight.grossWeight,
      grossWeightSource: pcsEq === null ? null : docGrossWeight.source,
      rejectPcsEq: pcsEq,
      conversionStatus,
      conversionGapReason: conversionStatus === "INCOMPLETE"
        ? rejectConversionGapReason(attachmentStatus, docGrossWeight)
        : null,
      rawExternalDocument: row.externalDocumentNo,
      parsedExternalDocument: parseExternalDocument(row.externalDocumentNo),
      operatorName: resolveOperatorName(row),
      shiftCode: resolveShiftCode(row),
      workHours: resolveRowWorkHours(row),
      attachmentCandidates: group.rejectAttachmentCandidatesByRowId[row.id] ?? []
    };
  });
  const rejectConversionStatus =
    group.rejectRows.length === 0 ? "NOT_APPLICABLE" : conversionGaps > 0 ? "INCOMPLETE" : "COMPLETE";
  const rejectPcsEqValue = group.rejectRows.length === 0 ? null : conversionGaps > 0 ? null : rejectPcsEq;
  const rejectPct = rejectPcsEqValue !== null && netOutputQty + rejectPcsEqValue > 0
    ? (rejectPcsEqValue / (netOutputQty + rejectPcsEqValue)) * 100
    : null;
  const documentDetails = documents.map((documentNo) => {
    const rows = allRows.filter((row) => compact(row.documentNo) === documentNo);
    return {
      documentNo,
      outputQty: rows.filter(isOkOutput).reduce((total, row) => total + row.quantity, 0),
      rejectKg: rows.filter(isRejectOutput).reduce((total, row) => total + rejectKgForRow(row), 0),
      rows: rows.length
    };
  });
  const operatorDetails = operators.map((operatorName) => {
    const rows = allRows.filter((row) => compact(resolveOperatorName(row)) === operatorName);
    return {
      operatorName,
      shiftSummary: summarize(unique(rows.map((row) => resolveShiftCode(row))), "N/A"),
      workHours: resolveGroupWorkHours(rows, 0).workHours || null,
      rawExternalDocuments: unique(rows.map((row) => row.externalDocumentNo)),
      outputQty: rows.filter(isOkOutput).reduce((total, row) => total + row.quantity, 0),
      rows: rows.length
    };
  });
  const externalDocumentDetails = [...new Map(allRows.map((row) => {
    const parsed = parseExternalDocument(row.externalDocumentNo);
    const key = [
      row.externalDocumentNo ?? "",
      row.documentNo ?? "",
      parsed.shiftCode ?? "",
      parsed.operatorName ?? "",
      parsed.workHours ?? ""
    ].join("|");
    return [key, {
      rawExternalDocument: row.externalDocumentNo,
      parseStatus: parsed.parseStatus,
      parsedShift: parsed.shiftCode,
      parsedWorkHours: parsed.workHours,
      parsedOperator: parsed.operatorName,
      documentNo: row.documentNo,
      postingDate: row.postingDate,
      quantity: row.quantity
    }];
  })).values()];
  const notes: string[] = [];
  if (targetResolution.targetReason !== "TARGET_MATCHED") notes.push(targetResolution.targetReason);
  if (conversionGaps > 0) notes.push("REJECT_CONVERSION_INCOMPLETE");
  notes.push(...group.attachmentWarnings);
  if (group.rejectAttachmentStatus === "REJECT_ONLY") notes.push("NO_MATCHING_OK_ROW_FOR_REJECT_DOCUMENT");
  if (workHoursResolution.source !== "EXTERNAL_DOCUMENT" && (!group.plannedRuntimeHours || group.plannedRuntimeHours <= 0) && workHours === 24) notes.push("WORK_HOURS_DEFAULT_24");
  if (parsedExternalDocuments(allRows).some((parsed) => parsed.rawExternalDocument && parsed.parseStatus === "UNPARSED")) notes.push("EXTERNAL_DOCUMENT_UNPARSED");
  if (correctionOutputQty < 0) notes.push("HAS_NEGATIVE_OUTPUT_CORRECTION");

  return {
    postingDate: group.postingDate,
    entityId: group.entityId,
    entityCode: group.entityCode,
    machineLabel: group.machineLabel,
    itemNo: group.itemNo,
    itemDescription: group.itemDescription,
    itemCategoryCode: group.itemCategoryCode,
    documentSummary: summarize(documents),
    documentCount: documents.length,
    documentDetails,
    operatorSummary: summarize(operators),
    operatorDetails,
    shiftSummary: summarize(shifts),
    workHours,
    workHoursSource: workHoursResolution.source,
    dailyTarget,
    targetSource: targetResolution.targetSource,
    targetReason: targetResolution.targetReason,
    targetBucket: targetResolution.targetBucket,
    targetBucketLabel: targetResolution.targetBucketLabel,
    targetDetails,
    transactionProrataTarget,
    netOutputQty,
    positiveOutputQty,
    correctionOutputQty,
    uom,
    rejectKg,
    rejectPcsEq: rejectPcsEqValue,
    rejectConversionStatus,
    rejectAttachmentStatus: group.rejectAttachmentStatus,
    rejectPct,
    achievementPct,
    achievementStatus,
    grossWeight,
    inputCount: allRows.length,
    externalDocumentSummary: summarize(externalDocuments),
    externalDocumentDetails,
    notes,
    rejectDetails,
    drilldown: {
      groupKey: group.key,
      grouping: "postingDate + resolved machine/entity label + itemNo",
      targetReason: targetResolution.targetReason,
      targetSource: targetResolution.targetSource,
      targetBucket: targetResolution.targetBucket,
      targetBucketLabel: targetResolution.targetBucketLabel,
      targetFormula: dailyTarget === null ? targetResolution.targetReason : "dailyTarget * workHours / 24",
      achievementFormula: transactionProrataTarget ? "netOutputQty / transactionProrataTarget * 100" : "N/A",
      targetDetails,
      rejectFormula: "rejectKg / matching OK document grossWeightPerPcs",
      rejectAttachmentStatus: group.rejectAttachmentStatus
    }
  };
}

export function buildDailyItemResume(
  rows: readonly DailyItemResumeSourceRow[],
  targets: readonly DailyItemResumeTarget[],
  filters: DailyItemResumeFilters
): DailyItemResumeResult {
  const groups = new Map<string, GroupState>();
  const docIndex = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!isOkOutput(row)) continue;
    const key = groupKey(row);
    const group = groups.get(key) ?? {
      key,
      postingDate: row.postingDate,
      machineLabel: resolveMachineLabel(row),
      itemNo: row.itemNo,
      entityId: row.entityId,
      entityCode: row.entityCode,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      plannedRuntimeHours: row.plannedRuntimeHours,
      okRows: [],
      rejectRows: [],
      rejectAttachmentStatus: "NONE",
      attachmentWarnings: [],
      rejectAttachmentStatusByRowId: {},
      rejectAttachmentCandidatesByRowId: {}
    };
    group.okRows.push(row);
    groups.set(key, group);
    const document = normalizeDailyItemResumeValue(row.documentNo);
    if (document) {
      const documentGroups = docIndex.get(document) ?? new Set<string>();
      documentGroups.add(key);
      docIndex.set(document, documentGroups);
    }
  }

  for (const row of rows) {
    if (!isRejectOutput(row)) continue;
    const machineLabel = resolveMachineLabel(row);
    const document = normalizeDailyItemResumeValue(row.documentNo);
    const candidateKeys = document ? docIndex.get(document) : null;
    const candidateGroups = candidateKeys
      ? [...candidateKeys].map((key) => groups.get(key)).filter((value): value is GroupState => Boolean(value))
      : [];
    const resolution = resolveRejectAttachment(row, candidateGroups);
    if (resolution.group) {
      const group = resolution.group;
      group.rejectRows.push(row);
      group.rejectAttachmentStatus = resolution.status;
      group.rejectAttachmentStatusByRowId[row.id] = resolution.status;
      continue;
    }
    const key = groupKey(row, true);
    const rejectOnly = groups.get(key) ?? {
      key,
      postingDate: row.postingDate,
      machineLabel,
      itemNo: row.itemNo,
      entityId: row.entityId,
      entityCode: row.entityCode,
      itemDescription: row.itemDescription,
      itemCategoryCode: row.itemCategoryCode,
      plannedRuntimeHours: row.plannedRuntimeHours,
      okRows: [],
      rejectRows: [],
      rejectAttachmentStatus: resolution.status,
      attachmentWarnings: [],
      rejectAttachmentStatusByRowId: {},
      rejectAttachmentCandidatesByRowId: {}
    };
    rejectOnly.rejectAttachmentStatusByRowId[row.id] = resolution.status;
    if (resolution.status === "AMBIGUOUS_REJECT_ATTACHMENT") {
      rejectOnly.attachmentWarnings.push("AMBIGUOUS_REJECT_ATTACHMENT");
      rejectOnly.rejectAttachmentCandidatesByRowId[row.id] = resolution.candidates.map(attachmentCandidateSummary);
    }
    rejectOnly.rejectRows.push(row);
    groups.set(key, rejectOnly);
  }

  const sorted = [...groups.values()]
    .map((group) => toResumeRow(group, targets))
    .filter((row) => matchesSearch(row, filters.search))
    .sort((a, b) => {
      if (filters.sort === "postingDate.asc") return a.postingDate.localeCompare(b.postingDate) || a.machineLabel.localeCompare(b.machineLabel);
      if (filters.sort === "netOutputQty.desc") return b.netOutputQty - a.netOutputQty || b.postingDate.localeCompare(a.postingDate);
      if (filters.sort === "netOutputQty.asc") return a.netOutputQty - b.netOutputQty || b.postingDate.localeCompare(a.postingDate);
      return b.postingDate.localeCompare(a.postingDate) || a.machineLabel.localeCompare(b.machineLabel) || a.itemNo.localeCompare(b.itemNo);
    });
  const offset = (filters.page - 1) * filters.pageSize;
  const paged = sorted.slice(offset, offset + filters.pageSize);
  return {
    rows: paged,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalRows: sorted.length,
      totalPages: Math.ceil(sorted.length / filters.pageSize)
    }
  };
}
