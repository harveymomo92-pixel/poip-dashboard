import { isProductionEntryType } from "../constants/business-central.js";

export type ResumeRejectConversionStatus = "COMPLETE" | "INCOMPLETE";
export type ResumeAchievementStatus = "COVERED" | "TARGET_MISSING" | "NO_OUTPUT" | "TARGET_ZERO";

export interface DailyItemResumeSourceRow {
  readonly sourceSystem?: string | null;
  readonly entryType?: string | null;
  readonly normalizedOutputType: string;
  readonly postingDate: string;
  readonly entityId?: string | null;
  readonly entityCode?: string | null;
  readonly entityName?: string | null;
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
  readonly dailyTarget: number | null;
  readonly transactionProrataTarget: number | null;
  readonly netOutputQty: number;
  readonly positiveOutputQty: number;
  readonly correctionOutputQty: number;
  readonly uom: string;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly rejectConversionStatus: ResumeRejectConversionStatus;
  readonly rejectPct: number | null;
  readonly achievementPct: number | null;
  readonly achievementStatus: ResumeAchievementStatus;
  readonly grossWeight: number | null;
  readonly inputCount: number;
  readonly externalDocumentSummary: string;
  readonly notes: readonly string[];
  readonly rejectDetails: readonly {
    readonly documentNo: string;
    readonly itemNo: string;
    readonly itemDescription: string | null;
    readonly rejectKg: number;
    readonly grossWeight: number | null;
    readonly rejectPcsEq: number | null;
  }[];
}

interface Group {
  readonly key: string;
  readonly postingDate: string;
  readonly machineLabel: string;
  readonly itemNo: string;
  readonly okRows: DailyItemResumeSourceRow[];
  readonly rejectRows: DailyItemResumeSourceRow[];
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
    || clean(row.machineCenterNo)
    || clean(row.prodLineNo)
    || clean(row.prodLineDescription)
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

function uniqueSummary(values: readonly (string | null | undefined)[], fallback = "-"): string {
  const unique = [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  return unique.length ? unique.join(" | ") : fallback;
}

function chooseGroup(groups: readonly Group[], documentNo: string | null | undefined): Group | null {
  if (groups.length === 0) return null;
  const doc = normalized(documentNo);
  if (doc) {
    const exact = groups.find((group) => group.okRows.some((row) => normalized(row.documentNo) === doc));
    if (exact) return exact;
  }
  return [...groups].sort((a, b) => {
    const qtyA = a.okRows.reduce((sum, row) => sum + row.quantity, 0);
    const qtyB = b.okRows.reduce((sum, row) => sum + row.quantity, 0);
    return b.okRows.length - a.okRows.length || qtyB - qtyA;
  })[0] ?? null;
}

function distinctWorkHours(rows: readonly DailyItemResumeSourceRow[], fallbackWorkHours: number): number {
  const values = rows.flatMap((row) => (row.workHours && row.workHours > 0 ? [row.workHours] : []));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : fallbackWorkHours;
}

function representativeGrossWeight(rows: readonly DailyItemResumeSourceRow[]): number | null {
  return rows.find((row) => row.grossWeightPerPcs && row.grossWeightPerPcs > 0)?.grossWeightPerPcs ?? null;
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
  const okRows = rows.filter((row) => row.normalizedOutputType === "OK");
  const rejectRows = rows.filter((row) => row.normalizedOutputType === "REJECT" || (row.rejectKg ?? 0) > 0);

  for (const row of okRows) {
    const label = machineLabel(row);
    const key = groupKey(row, label);
    const group = groups.get(key) ?? {
      key,
      postingDate: row.postingDate,
      machineLabel: label,
      itemNo: row.itemNo,
      okRows: [],
      rejectRows: []
    };
    group.okRows.push(row);
    groups.set(key, group);
    const docKey = `${row.postingDate}|${normalized(label)}|${normalized(row.documentNo)}`;
    if (normalized(row.documentNo)) {
      const set = docToGroups.get(docKey) ?? new Set<string>();
      set.add(key);
      docToGroups.set(docKey, set);
    }
  }

  for (const row of rejectRows) {
    const label = machineLabel(row);
    const docKey = `${row.postingDate}|${normalized(label)}|${normalized(row.documentNo)}`;
    const linked = docToGroups.get(docKey);
    const linkedGroups = linked
      ? [...linked].map((key) => groups.get(key)).filter((value): value is Group => Boolean(value))
      : [];
    let group = linkedGroups.length ? chooseGroup(linkedGroups, row.documentNo) : null;
    if (!group) {
      group = chooseGroup(
        [...groups.values()].filter((candidate) => candidate.postingDate === row.postingDate && normalized(candidate.machineLabel) === normalized(label)),
        row.documentNo
      );
    }
    if (!group) {
      const key = groupKey(row, label, "REJECT");
      group = groups.get(key) ?? {
        key,
        postingDate: row.postingDate,
        machineLabel: label,
        itemNo: row.itemNo,
        okRows: [],
        rejectRows: []
      };
      groups.set(key, group);
    }
    group.rejectRows.push(row);
  }

  return [...groups.values()]
    .map((group): DailyItemResumeRow => {
      const allRows = [...group.okRows, ...group.rejectRows];
      const anchor = group.okRows[0] ?? group.rejectRows[0];
      const positiveOutputQty = group.okRows.reduce((sum, row) => sum + (row.quantity > 0 ? row.quantity : 0), 0);
      const correctionOutputQty = group.okRows.reduce((sum, row) => sum + (row.quantity < 0 ? row.quantity : 0), 0);
      const netOutputQty = group.okRows.reduce((sum, row) => sum + row.quantity, 0);
      const grossWeight = representativeGrossWeight(group.okRows) ?? representativeGrossWeight(allRows);
      let rejectPcsEq = 0;
      let incompleteRejectConversion = false;
      const rejectDetails = group.rejectRows.map((row) => {
        const rejectKg = row.rejectKg && row.rejectKg > 0 ? row.rejectKg : Math.abs(row.quantity);
        const rowGrossWeight = row.grossWeightPerPcs && row.grossWeightPerPcs > 0 ? row.grossWeightPerPcs : grossWeight;
        const rowRejectPcsEq = rowGrossWeight && rowGrossWeight > 0 ? rejectKg / rowGrossWeight : null;
        if (rowRejectPcsEq === null && rejectKg > 0) incompleteRejectConversion = true;
        else rejectPcsEq += rowRejectPcsEq ?? 0;
        return {
          documentNo: clean(row.documentNo, "-"),
          itemNo: row.itemNo,
          itemDescription: row.itemDescription ?? null,
          rejectKg,
          grossWeight: rowGrossWeight ?? null,
          rejectPcsEq: rowRejectPcsEq
        };
      });
      const totalForRejectRate = netOutputQty + rejectPcsEq;
      const workHours = distinctWorkHours(group.okRows.length ? group.okRows : allRows, fallbackWorkHours);
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
          quantity: allRows.filter((candidate) => clean(candidate.documentNo, "-") === key && candidate.normalizedOutputType === "OK").reduce((sum, candidate) => sum + candidate.quantity, 0),
          rejectKg: allRows.filter((candidate) => clean(candidate.documentNo, "-") === key).reduce((sum, candidate) => sum + (candidate.rejectKg ?? 0), 0),
          type: allRows.some((candidate) => clean(candidate.documentNo, "-") === key && candidate.normalizedOutputType === "OK")
            && allRows.some((candidate) => clean(candidate.documentNo, "-") === key && (candidate.normalizedOutputType === "REJECT" || (candidate.rejectKg ?? 0) > 0))
            ? "MIXED" as const
            : row.normalizedOutputType === "OK" ? "OK" as const : "REJECT" as const
        }];
      })).values()];
      const operatorDetails = [...new Map(allRows.map((row) => {
        const key = `${clean(row.operatorName, "-")}|${clean(row.shiftCode, "-")}|${clean(row.documentNo, "-")}`;
        return [key, {
          operatorName: clean(row.operatorName, "-"),
          shiftCode: clean(row.shiftCode, "-"),
          documentNo: clean(row.documentNo, "-"),
          quantity: allRows
            .filter((candidate) => `${clean(candidate.operatorName, "-")}|${clean(candidate.shiftCode, "-")}|${clean(candidate.documentNo, "-")}` === key)
            .reduce((sum, candidate) => sum + candidate.quantity, 0)
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
        operatorSummary: uniqueSummary(allRows.map((row) => row.operatorName)),
        operatorDetails,
        shiftSummary: uniqueSummary(allRows.map((row) => row.shiftCode)),
        workHours,
        dailyTarget,
        transactionProrataTarget,
        netOutputQty,
        positiveOutputQty,
        correctionOutputQty,
        uom: uomSummary(group.okRows.length ? group.okRows : allRows),
        rejectKg: rejectDetails.reduce((sum, detail) => sum + detail.rejectKg, 0),
        rejectPcsEq: incompleteRejectConversion ? null : rejectPcsEq,
        rejectConversionStatus: incompleteRejectConversion ? "INCOMPLETE" : "COMPLETE",
        rejectPct: totalForRejectRate > 0 && !incompleteRejectConversion ? (rejectPcsEq / totalForRejectRate) * 100 : null,
        achievementPct,
        achievementStatus,
        grossWeight,
        inputCount: allRows.length,
        externalDocumentSummary: uniqueSummary(allRows.map((row) => row.externalDocumentNo)),
        notes: [
          ...(correctionOutputQty < 0 ? ["Contains negative Output correction"] : []),
          ...(incompleteRejectConversion ? ["Reject conversion incomplete"] : []),
          ...(achievementStatus === "TARGET_MISSING" ? ["Target missing"] : [])
        ],
        rejectDetails
      };
    })
    .sort((a, b) => b.postingDate.localeCompare(a.postingDate) || a.machineLabel.localeCompare(b.machineLabel) || a.itemNo.localeCompare(b.itemNo));
}
