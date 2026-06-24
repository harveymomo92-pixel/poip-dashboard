import {
  calculateAchievementPct,
  calculateDataFreshnessStatus,
  calculateRejectRate,
  getTargetStatus,
  type DataFreshnessStatus,
  type TargetStatus
} from "./output.js";

export interface DashboardKpiInput {
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly rejectPcsEquivalent: number;
  readonly prorataTarget: number;
  readonly hasTarget: boolean;
  readonly activeDays: number;
  readonly incompleteRejectConversionCount: number;
  readonly latestSuccessfulSyncFinishedAt: Date | null;
  readonly now: Date;
  readonly minAchievementPct?: number;
  readonly maxAchievementPct?: number;
}

export type TargetStatusReason = "NO_OUTPUT" | "TARGET_MISSING" | "TARGET_ZERO" | null;
export type RejectConversionStatus = "COMPLETE" | "INCOMPLETE";

export interface DashboardKpiSummary {
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly rejectPcsEquivalent: number;
  readonly rejectRatePct: number | null;
  readonly prorataTarget: number;
  readonly achievementPct: number | null;
  readonly targetStatus: TargetStatus;
  readonly targetStatusReason: TargetStatusReason;
  readonly rejectConversionStatus: RejectConversionStatus;
  readonly dataFreshnessStatus: DataFreshnessStatus;
  readonly freshnessMinutes: number | null;
  readonly activeDays: number;
  readonly incompleteRejectConversionCount: number;
}

function targetStatusReason(input: DashboardKpiInput): TargetStatusReason {
  if (input.outputOkQty <= 0) return "NO_OUTPUT";
  if (!input.hasTarget) return "TARGET_MISSING";
  if (input.prorataTarget <= 0) return "TARGET_ZERO";
  return null;
}

export function buildDashboardKpiSummary(input: DashboardKpiInput): DashboardKpiSummary {
  const achievementPct = input.hasTarget
    ? calculateAchievementPct(input.outputOkQty, input.prorataTarget)
    : null;
  const latestSync = input.latestSuccessfulSyncFinishedAt;
  return {
    outputOkQty: input.outputOkQty,
    rejectKg: input.rejectKg,
    rejectPcsEquivalent: input.rejectPcsEquivalent,
    rejectRatePct: calculateRejectRate(input.outputOkQty, input.rejectPcsEquivalent),
    prorataTarget: input.prorataTarget,
    achievementPct,
    targetStatus: getTargetStatus({
      hasTarget: input.hasTarget,
      outputOkQty: input.outputOkQty,
      achievementPct,
      ...(typeof input.minAchievementPct === "number"
        ? { minAchievementPct: input.minAchievementPct }
        : {}),
      ...(typeof input.maxAchievementPct === "number"
        ? { maxAchievementPct: input.maxAchievementPct }
        : {})
    }),
    targetStatusReason: targetStatusReason(input),
    rejectConversionStatus: input.incompleteRejectConversionCount > 0 ? "INCOMPLETE" : "COMPLETE",
    dataFreshnessStatus: calculateDataFreshnessStatus({
      latestSuccessfulSyncFinishedAt: latestSync,
      now: input.now
    }),
    freshnessMinutes: latestSync
      ? Math.floor((input.now.getTime() - latestSync.getTime()) / 60_000)
      : null,
    activeDays: input.activeDays,
    incompleteRejectConversionCount: input.incompleteRejectConversionCount
  };
}
