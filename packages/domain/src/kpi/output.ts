export function calculateAchievementPct(outputOkQty: number, prorataTarget: number): number | null {
  if (prorataTarget <= 0) return null;
  return (outputOkQty / prorataTarget) * 100;
}

export function calculateRejectRate(outputOkQty: number, rejectPcsEquivalent: number): number | null {
  const denominator = outputOkQty + rejectPcsEquivalent;
  if (denominator <= 0) return null;
  return (rejectPcsEquivalent / denominator) * 100;
}
