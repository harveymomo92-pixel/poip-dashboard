import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { OutputListFilters } from "../dashboard/dashboard.types.js";
import { OutputsController } from "./outputs.controller.js";
import type { OutputsService } from "./outputs.service.js";

test("OutputsController requires output.view at class level", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, OutputsController), [
    "output.view"
  ]);
});

test("OutputsController parses pagination query and delegates to service", async () => {
  let pageSize = 0;
  const controller = new OutputsController({
    listOutputs: async (filters: OutputListFilters) => {
      pageSize = filters.pageSize;
      return {
        rows: [],
        pagination: { page: filters.page, pageSize: filters.pageSize, totalRows: 0, totalPages: 0 }
      };
    }
  } as unknown as OutputsService);

  const response = await controller.listOutputs({
    from: "2026-06-01",
    to: "2026-06-22",
    page: "2",
    pageSize: "10",
    sortBy: "itemNo",
    sortDir: "asc"
  });

  assert.equal(pageSize, 10);
  assert.equal(response.pagination.page, 2);
});
