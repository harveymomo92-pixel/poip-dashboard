import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DowntimeController } from "./downtime.controller.js";
import type { DowntimeService } from "./downtime.service.js";

const event = {
  id: "6dc3b43c-b1e8-4970-aa48-78fe5e556c1c",
  eventDate: "2026-06-22",
  shiftCode: "N",
  area: "FINISHING",
  entityId: null,
  entityCode: null,
  entityName: null,
  machineCode: "MC-01",
  lineCode: null,
  category: "BREAKDOWN",
  startTime: "2026-06-22T16:30:00.000Z",
  endTime: null,
  durationMinutes: 30,
  status: "OPEN",
  severity: "MEDIUM",
  rootCause: null,
  actionTaken: null,
  sourceType: "MANUAL",
  naturalKey: "natural-key",
  createdBy: "admin",
  updatedBy: "admin",
  createdAt: "2026-06-22T16:30:00.000Z",
  updatedAt: "2026-06-22T16:30:00.000Z"
} as const;

function permissionFor(method: keyof DowntimeController) {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DowntimeController.prototype[method]);
}

function request(): AuthenticatedRequest {
  return {
    user: {
      id: "0a0b061d-7ffe-4b91-87ef-bd4aa709fd71",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["downtime.view", "downtime.create", "downtime.update", "downtime.close"]
    },
    headers: {},
    ip: "127.0.0.1"
  } as unknown as AuthenticatedRequest;
}

test("DowntimeController protects routes with expected permissions", () => {
  assert.deepEqual(permissionFor("listDowntime"), ["downtime.view"]);
  assert.deepEqual(permissionFor("getDowntime"), ["downtime.view"]);
  assert.deepEqual(permissionFor("createDowntime"), ["downtime.create"]);
  assert.deepEqual(permissionFor("updateDowntime"), ["downtime.update"]);
  assert.deepEqual(permissionFor("closeDowntime"), ["downtime.close"]);
});

test("DowntimeController createDowntime validates input and writes audit log", async () => {
  const auditEvents: unknown[] = [];
  const controller = new DowntimeController(
    {
      createDowntime: async () => event
    } as unknown as DowntimeService,
    {
      log: async (auditEvent: unknown) => {
        auditEvents.push(auditEvent);
      }
    } as unknown as AuditService
  );

  const response = await controller.createDowntime(
    {
      eventDate: "2026-06-22",
      shiftCode: "N",
      area: "Finishing",
      machineCode: "MC-01",
      category: "Breakdown",
      startTime: "2026-06-22T16:30:00.000Z"
    },
    request()
  );

  assert.equal(response.id, event.id);
  assert.equal(auditEvents.length, 1);
});

test("DowntimeController closeDowntime requires close fields and audits write", async () => {
  const auditEvents: unknown[] = [];
  const closed = {
    ...event,
    endTime: "2026-06-22T17:30:00.000Z",
    durationMinutes: 60,
    status: "CLOSED",
    rootCause: "Bearing failure",
    actionTaken: "Replaced bearing"
  };
  const controller = new DowntimeController(
    {
      getDowntimeOrThrow: async () => event,
      closeDowntime: async () => closed
    } as unknown as DowntimeService,
    {
      log: async (auditEvent: unknown) => {
        auditEvents.push(auditEvent);
      }
    } as unknown as AuditService
  );

  const response = await controller.closeDowntime(
    event.id,
    {
      endTime: "2026-06-22T17:30:00.000Z",
      rootCause: "Bearing failure",
      actionTaken: "Replaced bearing"
    },
    request()
  );

  assert.equal(response.status, "CLOSED");
  assert.equal(auditEvents.length, 1);
});
