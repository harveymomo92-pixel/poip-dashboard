import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { AuditController } from "./audit.controller.js";
import type { AuditService } from "./audit.service.js";

test("AuditController requires audit.view", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, AuditController), ["audit.view"]);
});

test("AuditController validates filters and delegates list requests", async () => {
  const calls: unknown[] = [];
  const service = {
    list: async (filters: unknown) => {
      calls.push(filters);
      return { rows: [], pagination: { page: 2, pageSize: 10, totalRows: 0, totalPages: 0 } };
    }
  } as unknown as AuditService;
  const controller = new AuditController(service);

  const result = await controller.list({
    page: "2",
    pageSize: "10",
    actor: "admin",
    from: "2026-06-01",
    to: "2026-06-24"
  });

  assert.equal(result.pagination.page, 2);
  assert.deepEqual(calls[0], {
    page: 2,
    pageSize: 10,
    actor: "admin",
    from: "2026-06-01",
    to: "2026-06-24"
  });
});
