import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransitionTargetStatus } from "./status.js";

test("canTransitionTargetStatus allows target approval workflow transitions", () => {
  assert.equal(canTransitionTargetStatus("DRAFT", "SUBMITTED"), true);
  assert.equal(canTransitionTargetStatus("SUBMITTED", "APPROVED"), true);
  assert.equal(canTransitionTargetStatus("DRAFT", "APPROVED"), true);
  assert.equal(canTransitionTargetStatus("REJECTED", "SUBMITTED"), true);
});

test("canTransitionTargetStatus allows approved target retirement transitions", () => {
  assert.equal(canTransitionTargetStatus("APPROVED", "INACTIVE"), true);
  assert.equal(canTransitionTargetStatus("ACTIVE", "SUPERSEDED"), true);
});

test("canTransitionTargetStatus blocks unsafe target workflow transitions", () => {
  assert.equal(canTransitionTargetStatus("APPROVED", "DRAFT"), false);
  assert.equal(canTransitionTargetStatus("INACTIVE", "APPROVED"), false);
  assert.equal(canTransitionTargetStatus("SUPERSEDED", "ACTIVE"), false);
});
