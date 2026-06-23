export interface OutputQuantityRow {
  readonly normalizedOutputType: string;
  readonly quantity: number;
}

export interface RejectConversionResult {
  readonly rejectPcsEquivalent: number | null;
  readonly incompleteConversion: boolean;
}

export type TargetStatus = "NO_TARGET" | "NO_OUTPUT" | "UNDER_TARGET" | "ON_TRACK" | "ABOVE_TARGET";
export type DataFreshnessStatus = "FRESH" | "STALE" | "CRITICAL" | "NEVER_SYNCED";

export function calculateOutputOkQty(rows: readonly OutputQuantityRow[]): number {
  return rows.reduce((total, row) => {
    if (row.normalizedOutputType !== "OK" || row.quantity <= 0) return total;
    return total + row.quantity;
  }, 0);
}

export function calculateRejectKg(values: readonly number[]): number {
  return values.reduce((total, value) => {
    if (value <= 0) return total;
    return total + value;
  }, 0);
}

export function calculateRejectPcsEquivalent(
  rejectKg: number,
  grossWeightPerPcs: number | null | undefined
): RejectConversionResult {
  if (!grossWeightPerPcs || grossWeightPerPcs <= 0) {
    return {
      rejectPcsEquivalent: null,
      incompleteConversion: rejectKg > 0
    };
  }

  return {
    rejectPcsEquivalent: rejectKg / grossWeightPerPcs,
    incompleteConversion: false
  };
}

export function calculateAchievementPct(outputOkQty: number, prorataTarget: number): number | null {
  if (prorataTarget <= 0) return null;
  return (outputOkQty / prorataTarget) * 100;
}

export function calculateRejectRate(outputOkQty: number, rejectPcsEquivalent: number): number | null {
  const denominator = outputOkQty + rejectPcsEquivalent;
  if (denominator <= 0) return null;
  return (rejectPcsEquivalent / denominator) * 100;
}

export function calculateProrataTarget(dailyTarget: number, activeDays: number): number {
  return dailyTarget * activeDays;
}

export function getTargetStatus(input: {
  readonly hasTarget: boolean;
  readonly outputOkQty: number;
  readonly achievementPct: number | null;
  readonly minAchievementPct?: number;
  readonly maxAchievementPct?: number;
}): TargetStatus {
  if (!input.hasTarget) return "NO_TARGET";
  if (input.outputOkQty <= 0) return "NO_OUTPUT";
  if (input.achievementPct === null) return "NO_OUTPUT";

  const min = input.minAchievementPct ?? 95;
  const max = input.maxAchievementPct ?? 110;
  if (input.achievementPct < min) return "UNDER_TARGET";
  if (input.achievementPct > max) return "ABOVE_TARGET";
  return "ON_TRACK";
}

export function calculateDataFreshnessStatus(input: {
  readonly latestSuccessfulSyncFinishedAt: Date | null;
  readonly now: Date;
  readonly warningMinutes?: number;
  readonly criticalMinutes?: number;
}): DataFreshnessStatus {
  if (!input.latestSuccessfulSyncFinishedAt) return "NEVER_SYNCED";

  const warningMinutes = input.warningMinutes ?? 120;
  const criticalMinutes = input.criticalMinutes ?? 360;
  const freshnessMinutes =
    (input.now.getTime() - input.latestSuccessfulSyncFinishedAt.getTime()) / 60_000;

  if (freshnessMinutes <= warningMinutes) return "FRESH";
  if (freshnessMinutes <= criticalMinutes) return "STALE";
  return "CRITICAL";
}
