import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "./health.controller.js";

test("HealthController returns ok status", () => {
  const controller = new HealthController();
  assert.deepEqual(controller.getHealth(), { status: "ok", service: "api" });
});
