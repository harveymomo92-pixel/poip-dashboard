import assert from "node:assert/strict";
import test from "node:test";

test("config package test placeholder", () => {
  assert.equal("Asia/Jakarta".includes("/"), true);
});
