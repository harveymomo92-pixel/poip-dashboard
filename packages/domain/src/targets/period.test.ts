import assert from "node:assert/strict";
import { test } from "node:test";
import { findOverlappingActiveTargets, targetPeriodsOverlap } from "./period.js";

test("targetPeriodsOverlap detects intersecting date ranges for the same entity", () => {
  assert.equal(
    targetPeriodsOverlap(
      { entityId: "entity-1", effectiveFrom: "2026-06-01", effectiveTo: "2026-06-10" },
      { entityId: "entity-1", effectiveFrom: "2026-06-10", effectiveTo: "2026-06-20" }
    ),
    true
  );
  assert.equal(
    targetPeriodsOverlap(
      { entityId: "entity-1", effectiveFrom: "2026-06-01", effectiveTo: "2026-06-09" },
      { entityId: "entity-1", effectiveFrom: "2026-06-10", effectiveTo: "2026-06-20" }
    ),
    false
  );
});

test("targetPeriodsOverlap treats open-ended targets as active into the future", () => {
  assert.equal(
    targetPeriodsOverlap(
      { entityId: "entity-1", effectiveFrom: "2026-06-01", effectiveTo: null },
      { entityId: "entity-1", effectiveFrom: "2027-01-01", effectiveTo: "2027-01-31" }
    ),
    true
  );
});

test("findOverlappingActiveTargets ignores inactive and rejected versions", () => {
  const matches = findOverlappingActiveTargets(
    { entityId: "entity-1", effectiveFrom: "2026-06-01", effectiveTo: "2026-06-30" },
    [
      {
        id: "approved",
        entityId: "entity-1",
        effectiveFrom: "2026-06-15",
        effectiveTo: null,
        status: "APPROVED"
      },
      {
        id: "draft",
        entityId: "entity-1",
        effectiveFrom: "2026-06-15",
        effectiveTo: null,
        status: "DRAFT"
      },
      {
        id: "other",
        entityId: "entity-2",
        effectiveFrom: "2026-06-01",
        effectiveTo: null,
        status: "APPROVED"
      }
    ]
  );

  assert.deepEqual(matches.map((target) => target.id), ["approved"]);
});
