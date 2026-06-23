import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { WaParserController } from "./wa-parser.controller.js";
import type { WaParserService } from "./wa-parser.service.js";

const run = {
  id: "3808aee6-cfdb-4300-9ef6-806a39493181",
  parserMode: "rules",
  parserVersion: "rules-v1",
  status: "PREVIEW",
  createdBy: "admin",
  committedBy: null,
  committedAt: null,
  metadata: { totalRows: 1 },
  createdAt: "2026-06-22T00:00:00.000Z",
  rows: [
    {
      id: "74c52948-b114-4760-9d90-e1378b0706e9",
      rowNumber: 1,
      sourceLine: "2026-06-22 output MC-01 item FG-001 qty 10",
      parsedPayload: { type: "PRODUCTION_OUTPUT" },
      confidence: 95,
      warnings: [],
      status: "VALID",
      downtimeEventId: null,
      createdAt: "2026-06-22T00:00:00.000Z"
    }
  ]
} as const;

function permissionFor(method: keyof WaParserController) {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, WaParserController.prototype[method]);
}

function request(): AuthenticatedRequest {
  return {
    user: {
      id: "0a0b061d-7ffe-4b91-87ef-bd4aa709fd71",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["parser.preview", "parser.commit"]
    },
    headers: {},
    ip: "127.0.0.1"
  } as unknown as AuthenticatedRequest;
}

test("WaParserController protects routes with expected permissions", () => {
  assert.deepEqual(permissionFor("preview"), ["parser.preview"]);
  assert.deepEqual(permissionFor("listRuns"), ["parser.preview"]);
  assert.deepEqual(permissionFor("getRun"), ["parser.preview"]);
  assert.deepEqual(permissionFor("commit"), ["parser.commit"]);
});

test("WaParserController preview validates input and audits run", async () => {
  const auditEvents: unknown[] = [];
  const controller = new WaParserController(
    {
      preview: async () => ({
        run,
        summary: { totalRows: 1, validRows: 1, invalidRows: 0, warningRows: 0 }
      })
    } as unknown as WaParserService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.preview({ sourceText: run.rows[0].sourceLine }, request());

  assert.equal(response.run.id, run.id);
  assert.equal(auditEvents.length, 1);
});

test("WaParserController commit audits parser commit", async () => {
  const auditEvents: unknown[] = [];
  const controller = new WaParserController(
    {
      getRunOrThrow: async () => run,
      commit: async () => ({
        runId: run.id,
        committedRows: 1,
        productionRowsCommitted: 1,
        downtimeRowsCommitted: 0,
        skippedRows: 0
      })
    } as unknown as WaParserService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.commit(
    run.id,
    { selectedRowIds: [run.rows[0].id] },
    request()
  );

  assert.equal(response.committedRows, 1);
  assert.equal(auditEvents.length, 1);
});
