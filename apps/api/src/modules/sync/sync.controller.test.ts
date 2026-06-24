import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditEvent, AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SyncController } from "./sync.controller.js";
import type { SyncService } from "./sync.service.js";

test("SyncController protects status and history with sync.view", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, SyncController.prototype.getStatus),
    ["sync.view"]
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, SyncController.prototype.listRuns),
    ["sync.view"]
  );
});

test("SyncController protects manual sync with sync.run", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, SyncController.prototype.triggerODataSync),
    ["sync.run"]
  );
});

test("SyncController audits manual sync requests", async () => {
  const events: AuditEvent[] = [];
  const syncService = {
    triggerODataSync: async () => ({ runId: "11111111-1111-4111-8111-111111111111", jobId: "job-1", status: "QUEUED" })
  } as unknown as SyncService;
  const auditService = {
    log: async (event: AuditEvent) => {
      events.push(event);
    }
  } as unknown as AuditService;
  const controller = new SyncController(syncService, auditService);
  const request = {
    headers: { "user-agent": "test-agent" },
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["sync.run"]
    }
  } as unknown as AuthenticatedRequest;

  const result = await controller.triggerODataSync({}, request);

  assert.equal(result.status, "QUEUED");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "sync.run");
  assert.equal(events[0]?.entityId, result.runId);
});
