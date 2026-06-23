import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAchievementPct,
  calculateDataFreshnessStatus,
  calculateOutputOkQty,
  calculateProrataTarget,
  calculateRejectKg,
  calculateRejectPcsEquivalent,
  calculateRejectRate,
  getTargetStatus
} from "./output.js";

test("calculateOutputOkQty sums only positive OK output", () => {
  assert.equal(
    calculateOutputOkQty([
      { normalizedOutputType: "OK", quantity: 10 },
      { normalizedOutputType: "OK", quantity: -2 },
      { normalizedOutputType: "REJECT", quantity: 5 }
    ]),
    10
  );
});

test("calculateRejectKg sums only positive reject kilograms", () => {
  assert.equal(calculateRejectKg([3, 0, -2, 4.5]), 7.5);
});

test("calculateRejectPcsEquivalent flags missing gross weight", () => {
  assert.deepEqual(calculateRejectPcsEquivalent(12, 0), {
    rejectPcsEquivalent: null,
    incompleteConversion: true
  });
});

test("calculateRejectPcsEquivalent converts when gross weight is present", () => {
  assert.deepEqual(calculateRejectPcsEquivalent(12, 0.5), {
    rejectPcsEquivalent: 24,
    incompleteConversion: false
  });
});

test("calculateAchievementPct returns null when target is zero", () => {
  assert.equal(calculateAchievementPct(100, 0), null);
});

test("calculateProrataTarget multiplies daily target by active days", () => {
  assert.equal(calculateProrataTarget(120, 5), 600);
});

test("calculateRejectRate follows PRD denominator rule", () => {
  assert.equal(calculateRejectRate(90, 10), 10);
});

test("calculateRejectRate returns null when denominator is zero", () => {
  assert.equal(calculateRejectRate(0, 0), null);
});

test("getTargetStatus follows default achievement thresholds", () => {
  assert.equal(
    getTargetStatus({
      hasTarget: true,
      outputOkQty: 90,
      achievementPct: 90
    }),
    "UNDER_TARGET"
  );
  assert.equal(
    getTargetStatus({
      hasTarget: true,
      outputOkQty: 100,
      achievementPct: 100
    }),
    "ON_TRACK"
  );
  assert.equal(
    getTargetStatus({
      hasTarget: true,
      outputOkQty: 120,
      achievementPct: 120
    }),
    "ABOVE_TARGET"
  );
});

test("calculateDataFreshnessStatus follows PRD thresholds", () => {
  const now = new Date("2026-06-22T08:00:00.000Z");
  assert.equal(
    calculateDataFreshnessStatus({
      latestSuccessfulSyncFinishedAt: new Date("2026-06-22T06:30:00.000Z"),
      now
    }),
    "FRESH"
  );
  assert.equal(
    calculateDataFreshnessStatus({
      latestSuccessfulSyncFinishedAt: new Date("2026-06-22T04:00:00.000Z"),
      now
    }),
    "STALE"
  );
  assert.equal(
    calculateDataFreshnessStatus({
      latestSuccessfulSyncFinishedAt: null,
      now
    }),
    "NEVER_SYNCED"
  );
});
