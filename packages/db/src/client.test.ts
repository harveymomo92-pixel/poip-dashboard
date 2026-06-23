import assert from "node:assert/strict";
import test from "node:test";

test("db package test placeholder", () => {
  assert.equal(typeof "postgres://localhost", "string");
});
