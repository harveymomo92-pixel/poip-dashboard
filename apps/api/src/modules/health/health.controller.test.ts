import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { HealthController } from "./health.controller.js";
import type { HealthService } from "./health.service.js";

test("HealthController returns ok status", () => {
  const service = {
    getBasicHealth: () => ({ status: "ok" as const, service: "api" as const }),
    getReadiness: () => ({ status: "HEALTHY" })
  } as unknown as HealthService;
  const controller = new HealthController(service);
  assert.deepEqual(controller.getHealth(), { status: "ok", service: "api" });
});

test("HealthController protects readiness and deep health", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, HealthController.prototype.getReadiness),
    ["settings.manage"]
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, HealthController.prototype.getDeepHealth),
    ["settings.manage"]
  );
});

test("HealthController delegates readiness without mutating state", async () => {
  const service = {
    getBasicHealth: () => ({ status: "ok" as const, service: "api" as const }),
    getReadiness: async () => ({ status: "WARNING", checkedAt: "2026-06-24T01:00:00.000Z" })
  } as unknown as HealthService;
  const controller = new HealthController(service);

  assert.deepEqual(await controller.getReadiness(), {
    status: "WARNING",
    checkedAt: "2026-06-24T01:00:00.000Z"
  });
});
