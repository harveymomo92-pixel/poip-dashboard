import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { DashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";
import type { DailyItemResumeFilters, DashboardFilters } from "./dashboard.types.js";

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

test("DashboardController parses daily item resume query with default pagination", async () => {
  let receivedPageSize = 0;
  let receivedSearch: string | undefined;
  let receivedSort: DailyItemResumeFilters["sort"] | null = null;
  const controller = new DashboardController({
    getDailyItemResume: async (filters: DailyItemResumeFilters) => {
      receivedPageSize = filters.pageSize;
      receivedSearch = filters.search;
      receivedSort = filters.sort;
      return { rows: [], pagination: { page: filters.page, pageSize: filters.pageSize, totalRows: 0, totalPages: 0 } };
    }
  } as unknown as DashboardService);

  await controller.getDailyItemResume({
    from: "2026-06-01",
    to: "2026-06-22",
    search: "doc-1"
  });

  assert.equal(receivedPageSize, 20);
  assert.equal(receivedSearch, "doc-1");
  assert.equal(receivedSort, "postingDate.desc");
});
