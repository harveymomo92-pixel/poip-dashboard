import assert from "node:assert/strict";
import test from "node:test";
import { calculateAchievementPct, calculateRejectRate } from "./output.js";

test("calculateAchievementPct returns null when target is zero", () => {
  assert.equal(calculateAchievementPct(100, 0), null);
});

test("calculateRejectRate follows PRD denominator rule", () => {
  assert.equal(calculateRejectRate(90, 10), 10);
});
