import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardKpiSummary } from "./dashboard.js";

test("buildDashboardKpiSummary calculates achievement and reject rate", () => {
  const summary = buildDashboardKpiSummary({
    outputOkQty: 90,
    rejectKg: 5,
    rejectPcsEquivalent: 10,
    prorataTarget: 100,
    hasTarget: true,
    activeDays: 2,
    incompleteRejectConversionCount: 1,
    latestSuccessfulSyncFinishedAt: new Date("2026-06-22T07:00:00.000Z"),
    now: new Date("2026-06-22T08:00:00.000Z")
  });

  assert.equal(summary.achievementPct, 90);
  assert.equal(summary.rejectRatePct, null);
  assert.equal(summary.targetStatus, "UNDER_TARGET");
  assert.equal(summary.targetStatusReason, null);
  assert.equal(summary.rejectConversionStatus, "INCOMPLETE");
  assert.equal(summary.dataFreshnessStatus, "FRESH");
  assert.equal(summary.freshnessMinutes, 60);
});

test("buildDashboardKpiSummary calculates reject rate only when conversion is complete", () => {
  const summary = buildDashboardKpiSummary({
    outputOkQty: 90,
    rejectKg: 5,
    rejectPcsEquivalent: 10,
    prorataTarget: 100,
    hasTarget: true,
    activeDays: 2,
    incompleteRejectConversionCount: 0,
    latestSuccessfulSyncFinishedAt: new Date("2026-06-22T07:00:00.000Z"),
    now: new Date("2026-06-22T08:00:00.000Z")
  });

  assert.equal(summary.rejectRatePct, 10);
  assert.equal(summary.rejectConversionStatus, "COMPLETE");
});

test("buildDashboardKpiSummary reports no output and never synced states", () => {
  const summary = buildDashboardKpiSummary({
    outputOkQty: 0,
    rejectKg: 0,
    rejectPcsEquivalent: 0,
    prorataTarget: 0,
    hasTarget: false,
    activeDays: 0,
    incompleteRejectConversionCount: 0,
    latestSuccessfulSyncFinishedAt: null,
    now: new Date("2026-06-22T08:00:00.000Z")
  });

  assert.equal(summary.achievementPct, null);
  assert.equal(summary.rejectRatePct, null);
  assert.equal(summary.targetStatus, "NO_TARGET");
  assert.equal(summary.targetStatusReason, "NO_OUTPUT");
  assert.equal(summary.rejectConversionStatus, "COMPLETE");
  assert.equal(summary.dataFreshnessStatus, "NEVER_SYNCED");
});

test("buildDashboardKpiSummary reports missing target as N/A even when a partial target value exists", () => {
  const summary = buildDashboardKpiSummary({
    outputOkQty: 100,
    rejectKg: 0,
    rejectPcsEquivalent: 0,
    prorataTarget: 50,
    hasTarget: false,
    activeDays: 1,
    incompleteRejectConversionCount: 0,
    latestSuccessfulSyncFinishedAt: new Date("2026-06-22T07:00:00.000Z"),
    now: new Date("2026-06-22T08:00:00.000Z")
  });

  assert.equal(summary.achievementPct, null);
  assert.equal(summary.targetStatus, "NO_TARGET");
  assert.equal(summary.targetStatusReason, "TARGET_MISSING");
});
