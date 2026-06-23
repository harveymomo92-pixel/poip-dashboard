import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransitionDowntimeStatus, isDowntimeStatus } from "./status.js";

test("isDowntimeStatus accepts supported downtime statuses", () => {
  assert.equal(isDowntimeStatus("OPEN"), true);
  assert.equal(isDowntimeStatus("CLOSED"), true);
  assert.equal(isDowntimeStatus("REOPENED"), false);
});

test("canTransitionDowntimeStatus allows closing open downtime only", () => {
  assert.equal(canTransitionDowntimeStatus("OPEN", "CLOSED"), true);
  assert.equal(canTransitionDowntimeStatus("OPEN", "OPEN"), true);
  assert.equal(canTransitionDowntimeStatus("CLOSED", "OPEN"), false);
});
