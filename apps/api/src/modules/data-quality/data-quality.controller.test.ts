import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditEvent, AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DataQualityController } from "./data-quality.controller.js";
import type { DataQualityService } from "./data-quality.service.js";

test("DataQualityController summary requires data_quality.view", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DataQualityController.prototype.getSummary),
    ["data_quality.view"]
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DataQualityController.prototype.listIssues),
    ["data_quality.view"]
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DataQualityController.prototype.getIssue),
    ["data_quality.view"]
  );
});

test("DataQualityController status actions require settings.manage", () => {
  for (const action of ["acknowledge", "resolve", "ignore", "reopen"] as const) {
    assert.deepEqual(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DataQualityController.prototype[action]),
      ["settings.manage"]
    );
  }
});

test("DataQualityController resolves an issue and writes an audit event", async () => {
  const events: AuditEvent[] = [];
  const service = {
    getIssueOrThrow: async () => ({ id: "11111111-1111-4111-8111-111111111111", status: "OPEN" }),
    updateStatus: async (_id: string, input: { readonly status: string; readonly note?: string }) => ({
      id: "11111111-1111-4111-8111-111111111111",
      status: input.status,
      resolutionNote: input.note ?? null
    })
  } as unknown as DataQualityService;
  const audit = {
    log: async (event: AuditEvent) => {
      events.push(event);
    }
  } as unknown as AuditService;
  const controller = new DataQualityController(service, audit);
  const request = {
    headers: { "user-agent": "test-agent" },
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["settings.manage"]
    }
  } as unknown as AuthenticatedRequest;

  const result = await controller.resolve(
    "11111111-1111-4111-8111-111111111111",
    { note: "Machine mapping corrected" },
    request
  );

  assert.equal(result.status, "RESOLVED");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "data_quality.resolved");
  assert.equal(events[0]?.entityType, "data_quality_issue");
  assert.equal(events[0]?.actorUserId, "22222222-2222-4222-8222-222222222222");
});
