import assert from "node:assert/strict";
import test from "node:test";
import type { HealthRepository } from "./health.repository.js";
import { HealthService } from "./health.service.js";

test("HealthService exposes basic identity and delegates readiness", async () => {
  const repository = {
    readiness: async () => ({ status: "HEALTHY", checkedAt: "now" })
  } as unknown as HealthRepository;
  const service = new HealthService(repository);

  assert.deepEqual(service.getBasicHealth(), { status: "ok", service: "api" });
  assert.deepEqual(await service.getReadiness(), { status: "HEALTHY", checkedAt: "now" });
});
