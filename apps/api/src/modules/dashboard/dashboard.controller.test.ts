import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { DashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";
import type { DashboardFilters } from "./dashboard.types.js";

test("DashboardController requires dashboard.view at class level", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DashboardController), [
    "dashboard.view"
  ]);
});

test("DashboardController parses summary query and delegates to service", async () => {
  let receivedFrom: string | null = null;
  const controller = new DashboardController({
    getSummary: async (filters: DashboardFilters) => {
      receivedFrom = filters.from;
      return { filters };
    }
  } as unknown as DashboardService);

  const response = await controller.getSummary({
    from: "2026-06-01",
    to: "2026-06-22",
    itemNo: " fg-001 "
  });

  assert.equal(receivedFrom, "2026-06-01");
  assert.equal(response.filters.itemNo, "FG-001");
});
