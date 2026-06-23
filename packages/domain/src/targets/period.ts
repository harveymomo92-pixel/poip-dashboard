export interface TargetPeriod {
  readonly entityId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status?: string;
}

export const targetActiveStatuses = ["APPROVED", "ACTIVE"] as const;

export type TargetActiveStatus = (typeof targetActiveStatuses)[number];

export function isTargetActiveStatus(status: string): status is TargetActiveStatus {
  return targetActiveStatuses.includes(status as TargetActiveStatus);
}

export function targetPeriodsOverlap(left: TargetPeriod, right: TargetPeriod): boolean {
  if (left.entityId !== right.entityId) return false;
  const leftEnd = left.effectiveTo ?? "9999-12-31";
  const rightEnd = right.effectiveTo ?? "9999-12-31";
  return left.effectiveFrom <= rightEnd && right.effectiveFrom <= leftEnd;
}

export function findOverlappingActiveTargets<TTarget extends TargetPeriod>(
  candidate: TargetPeriod,
  targets: readonly TTarget[]
): TTarget[] {
  return targets.filter(
    (target) =>
      (!target.status || isTargetActiveStatus(target.status)) &&
      targetPeriodsOverlap(candidate, target)
  );
}
