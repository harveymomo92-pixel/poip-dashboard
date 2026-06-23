import assert from "node:assert/strict";
import test from "node:test";
import { calculateDowntimeDurationMinutes } from "./duration.js";

test("calculateDowntimeDurationMinutes handles explicit cross-midnight dates", () => {
  assert.equal(
    calculateDowntimeDurationMinutes({
      startTime: new Date("2026-06-22T16:30:00.000Z"),
      endTime: new Date("2026-06-22T18:00:00.000Z")
    }),
    90
  );
});

test("calculateDowntimeDurationMinutes treats end earlier than start as next day", () => {
  assert.equal(
    calculateDowntimeDurationMinutes({
      startTime: new Date("2026-06-22T23:30:00.000Z"),
      endTime: new Date("2026-06-22T01:00:00.000Z")
    }),
    90
  );
});

test("calculateDowntimeDurationMinutes uses now for open events", () => {
  assert.equal(
    calculateDowntimeDurationMinutes({
      startTime: new Date("2026-06-22T01:00:00.000Z"),
      now: new Date("2026-06-22T01:45:00.000Z")
    }),
    45
  );
});
