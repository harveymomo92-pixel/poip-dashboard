import assert from "node:assert/strict";
import test from "node:test";
import { createDowntimeNaturalKey } from "./natural-key.js";

test("createDowntimeNaturalKey is stable across casing and whitespace", () => {
  const first = createDowntimeNaturalKey({
    eventDate: "2026-06-22",
    shiftCode: " a ",
    area: "packing",
    machineCode: " mc-01 ",
    lineCode: "line-1",
    category: "breakdown",
    startTime: new Date("2026-06-22T01:00:00.000Z"),
    endTime: new Date("2026-06-22T01:30:00.000Z"),
    sourceType: "manual"
  });

  const second = createDowntimeNaturalKey({
    eventDate: "2026-06-22",
    shiftCode: "A",
    area: "PACKING",
    machineCode: "MC-01",
    lineCode: "LINE-1",
    category: "BREAKDOWN",
    startTime: new Date("2026-06-22T01:00:00.000Z"),
    endTime: new Date("2026-06-22T01:30:00.000Z"),
    sourceType: "MANUAL"
  });

  assert.equal(first, second);
});

test("createDowntimeNaturalKey changes when event time changes", () => {
  const base = {
    eventDate: "2026-06-22",
    category: "BREAKDOWN",
    startTime: new Date("2026-06-22T01:00:00.000Z")
  };

  assert.notEqual(
    createDowntimeNaturalKey(base),
    createDowntimeNaturalKey({
      ...base,
      startTime: new Date("2026-06-22T02:00:00.000Z")
    })
  );
});
