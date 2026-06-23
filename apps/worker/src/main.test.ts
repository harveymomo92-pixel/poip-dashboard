import assert from "node:assert/strict";
import test from "node:test";
import { getWorkerIdentity } from "./main.js";

test("worker exposes service identity", () => {
  assert.equal(getWorkerIdentity().service, "worker");
});
