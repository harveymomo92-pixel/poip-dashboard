import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { ImportsController } from "./imports.controller.js";
import type { ImportsService } from "./imports.service.js";

const run = {
  id: "3808aee6-cfdb-4300-9ef6-806a39493181",
  importType: "downtime" as const,
  originalFilename: "downtime.csv",
  fileHash: "abc123",
  status: "PREVIEW",
  rowsTotal: 1,
  rowsValid: 1,
  rowsInvalid: 0,
  rowsDuplicate: 0,
  rowsConflict: 0,
  rowsInserted: 0,
  rowsUpdated: 0,
  validationReport: { totalRows: 1 },
  createdBy: "admin",
  committedBy: null,
  committedAt: null,
  createdAt: "2026-06-22T00:00:00.000Z",
  rows: [
    {
      id: "74c52948-b114-4760-9d90-e1378b0706e9",
      rowNumber: 2,
      rawPayload: { event_date: "2026-06-22" },
      normalizedPayload: {
        eventDate: "2026-06-22",
        shiftCode: null,
        area: null,
        machineCode: "MC-01",
        lineCode: null,
        category: "BREAKDOWN",
        startTime: "2026-06-22T01:00:00.000Z",
        endTime: null,
        durationMinutes: null,
        status: "OPEN",
        severity: "MEDIUM",
        rootCause: null,
        actionTaken: null,
        naturalKey: "key"
      },
      naturalKey: "key",
      status: "VALID" as const,
      issues: [],
      committedEntityType: null,
      committedEntityId: null,
      createdAt: "2026-06-22T00:00:00.000Z"
    }
  ]
} as const;

function permissionFor(method: keyof ImportsController) {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, ImportsController.prototype[method]);
}

function request(): AuthenticatedRequest {
  return {
    user: {
      id: "0a0b061d-7ffe-4b91-87ef-bd4aa709fd71",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["import.preview", "import.commit"]
    },
    headers: {},
    ip: "127.0.0.1"
  } as unknown as AuthenticatedRequest;
}

test("ImportsController protects routes with expected permissions", () => {
  assert.deepEqual(permissionFor("preview"), ["import.preview"]);
  assert.deepEqual(permissionFor("listRuns"), ["import.preview"]);
  assert.deepEqual(permissionFor("getRun"), ["import.preview"]);
  assert.deepEqual(permissionFor("errorReport"), ["import.preview"]);
  assert.deepEqual(permissionFor("commit"), ["import.commit"]);
});

test("ImportsController preview validates upload and audits run", async () => {
  const auditEvents: unknown[] = [];
  const controller = new ImportsController(
    {
      preview: async () => ({
        run,
        summary: { totalRows: 1, validRows: 1, invalidRows: 0, duplicateRows: 0, conflictRows: 0, warningRows: 0 }
      })
    } as unknown as ImportsService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.preview(
    { originalname: "downtime.csv", buffer: Buffer.from("x"), size: 1 },
    "downtime",
    request()
  );

  assert.equal(response.run.id, run.id);
  assert.equal(auditEvents.length, 1);
});

test("ImportsController commit audits import commit", async () => {
  const auditEvents: unknown[] = [];
  const controller = new ImportsController(
    {
      getRunOrThrow: async () => run,
      commit: async () => ({ runId: run.id, committedRows: 1, insertedRows: 1, skippedRows: 0 })
    } as unknown as ImportsService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.commit(run.id, { selectedRowIds: [run.rows[0].id] }, request());

  assert.equal(response.committedRows, 1);
  assert.equal(auditEvents.length, 1);
});
