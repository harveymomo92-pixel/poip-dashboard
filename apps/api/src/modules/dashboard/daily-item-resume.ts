import { inferResumeTargetBucket, type ResumeTargetBucket } from "@poip/domain";

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
  readonly rejectConversionStatus: "COMPLETE" | "INCOMPLETE" | "NOT_APPLICABLE";
  readonly rejectPct: number | null;
  readonly achievementPct: number | null;
  readonly achievementStatus: "TARGET_MISSING" | "TARGET_ZERO" | "NO_OUTPUT" | "BELOW_TARGET" | "ON_TARGET" | "ABOVE_TARGET";
  readonly grossWeight: number | null;
  readonly inputCount: number;
  readonly externalDocumentSummary: string;
  readonly notes: readonly string[];
  readonly rejectDetails: readonly Record<string, unknown>[];
  readonly drilldown: Record<string, unknown>;
}

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

export function resolveMachineLabel(row: DailyItemResumeSourceRow): string {
  return (
    compact(row.entityDisplayName) ||
    compact(row.entityCode) ||
    compact(row.machineCenterNo) ||
    compact(row.prodLineNo) ||
    compact(row.prodLineDescription) ||
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
  return normalizeDailyItemResumeValue(row.normalizedOutputType) === "OK";
}

function isRejectOutput(row: DailyItemResumeSourceRow): boolean {
  return normalizeDailyItemResumeValue(row.normalizedOutputType) === "REJECT" || row.rejectKg > 0;
}

function chooseFallbackGroup(groups: readonly GroupState[]): GroupState | null {
  if (groups.length === 0) return null;
  return [...groups].sort((a, b) => {
    const bQty = b.okRows.reduce((total, row) => total + row.quantity, 0);
    const aQty = a.okRows.reduce((total, row) => total + row.quantity, 0);
    return b.okRows.length - a.okRows.length || bQty - aQty || a.itemNo.localeCompare(b.itemNo);
  })[0] ?? null;
}

interface TargetResolutionInput {
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly entityDisplayName: string | null;
  readonly machineLabel: string;
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

function toResumeRow(group: GroupState, targets: readonly DailyItemResumeTarget[]): DailyItemResumeRow {
  const allRows = [...group.okRows, ...group.rejectRows];
  const anchor = group.okRows[0] ?? group.rejectRows[0] ?? null;
  const positiveOutputQty = group.okRows.reduce((total, row) => total + (row.quantity > 0 ? row.quantity : 0), 0);
  const correctionOutputQty = group.okRows.reduce((total, row) => total + (row.quantity < 0 ? row.quantity : 0), 0);
  const netOutputQty = group.okRows.reduce((total, row) => total + row.quantity, 0);
  const documents = unique(allRows.map((row) => row.documentNo));
  const externalDocuments = unique(allRows.map((row) => row.externalDocumentNo));
  const operators = unique(allRows.map((row) => row.operatorName));
  const shifts = unique(allRows.map((row) => row.shiftCode));
  const uoms = unique(group.okRows.map((row) => row.uom));
  const uom = uoms.length === 0 ? "N/A" : uoms.length === 1 ? uoms[0] ?? "N/A" : "MIXED";
  const workHours = group.plannedRuntimeHours && group.plannedRuntimeHours > 0 ? group.plannedRuntimeHours : 24;
  const grossWeight = group.okRows.map((row) => row.grossWeightPerPcs).find((value) => value !== null && value > 0) ?? null;
  const targetResolution = resolveDailyItemResumeTarget({
    entityId: group.entityId,
    entityCode: group.entityCode,
    entityDisplayName: anchor?.entityDisplayName ?? null,
    machineLabel: group.machineLabel,
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
    transactionProrataTarget,
    netOutputQty,
    achievementPct,
    transactionProrataFormula: dailyTarget === null ? "N/A" : "dailyTarget * workHours / 24",
    achievementFormula: transactionProrataTarget && transactionProrataTarget > 0 ? "netOutputQty / transactionProrataTarget * 100" : "N/A"
  };
  const okGrossByDocument = new Map<string, number>();
  for (const row of group.okRows) {
    const doc = compact(row.documentNo);
    if (!doc || !row.grossWeightPerPcs || row.grossWeightPerPcs <= 0 || okGrossByDocument.has(doc)) continue;
    okGrossByDocument.set(doc, row.grossWeightPerPcs);
  }

  let rejectKg = 0;
  let rejectPcsEq = 0;
  let conversionGaps = 0;
  const rejectDetails = group.rejectRows.map((row) => {
    const kg = row.rejectKg > 0 ? row.rejectKg : Math.abs(row.quantity);
    const doc = compact(row.documentNo);
    const docGrossWeight = doc ? okGrossByDocument.get(doc) ?? grossWeight : grossWeight;
    const pcsEq = docGrossWeight && docGrossWeight > 0 ? kg / docGrossWeight : null;
    rejectKg += kg;
    if (pcsEq === null) conversionGaps += 1;
    else rejectPcsEq += pcsEq;
    return {
      documentNo: row.documentNo,
      itemNo: row.itemNo,
      quantity: row.quantity,
      rejectKg: kg,
      grossWeight: docGrossWeight ?? null,
      rejectPcsEq: pcsEq,
      conversionStatus: pcsEq === null ? "INCOMPLETE" : "COMPLETE",
      operatorName: row.operatorName,
      shiftCode: row.shiftCode
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
      rejectKg: rows.filter(isRejectOutput).reduce((total, row) => total + (row.rejectKg > 0 ? row.rejectKg : Math.abs(row.quantity)), 0),
      rows: rows.length
    };
  });
  const operatorDetails = operators.map((operatorName) => {
    const rows = allRows.filter((row) => compact(row.operatorName) === operatorName);
    return {
      operatorName,
      shiftSummary: summarize(unique(rows.map((row) => row.shiftCode)), "N/A"),
      outputQty: rows.filter(isOkOutput).reduce((total, row) => total + row.quantity, 0),
      rows: rows.length
    };
  });
  const notes: string[] = [];
  if (targetResolution.targetReason !== "TARGET_MATCHED") notes.push(targetResolution.targetReason);
  if (conversionGaps > 0) notes.push("REJECT_CONVERSION_INCOMPLETE");
  if (!group.plannedRuntimeHours || group.plannedRuntimeHours <= 0) notes.push("WORK_HOURS_DEFAULT_24");
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
    rejectPct,
    achievementPct,
    achievementStatus,
    grossWeight,
    inputCount: allRows.length,
    externalDocumentSummary: summarize(externalDocuments),
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
      rejectFormula: "rejectKg / matching OK document grossWeightPerPcs"
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
  const machineDateIndex = new Map<string, Set<string>>();

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
      rejectRows: []
    };
    group.okRows.push(row);
    groups.set(key, group);
    const dateMachineKey = [row.postingDate, normalizeDailyItemResumeValue(group.machineLabel)].join("|");
    const machineGroups = machineDateIndex.get(dateMachineKey) ?? new Set<string>();
    machineGroups.add(key);
    machineDateIndex.set(dateMachineKey, machineGroups);
    const document = normalizeDailyItemResumeValue(row.documentNo);
    if (document) {
      const documentKey = [row.postingDate, normalizeDailyItemResumeValue(group.machineLabel), document].join("|");
      const documentGroups = docIndex.get(documentKey) ?? new Set<string>();
      documentGroups.add(key);
      docIndex.set(documentKey, documentGroups);
    }
  }

  for (const row of rows) {
    if (!isRejectOutput(row)) continue;
    const machineLabel = resolveMachineLabel(row);
    const documentKey = [row.postingDate, normalizeDailyItemResumeValue(machineLabel), normalizeDailyItemResumeValue(row.documentNo)].join("|");
    const exact = normalizeDailyItemResumeValue(row.documentNo) ? docIndex.get(documentKey) : null;
    const dateMachineKey = [row.postingDate, normalizeDailyItemResumeValue(machineLabel)].join("|");
    const fallback = machineDateIndex.get(dateMachineKey);
    const candidateKeys = exact && exact.size > 0 ? exact : fallback;
    const group = candidateKeys
      ? chooseFallbackGroup([...candidateKeys].map((key) => groups.get(key)).filter((value): value is GroupState => Boolean(value)))
      : null;
    if (group) {
      group.rejectRows.push(row);
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
      rejectRows: []
    };
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
