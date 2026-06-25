import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditEvent, AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { MasterController } from "./master.controller.js";
import type { MasterService } from "./master.service.js";

const request = {
  headers: { "user-agent": "test-agent" },
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "admin@example.local",
    name: "Admin",
    roles: ["Admin"],
    permissions: ["master_data.manage", "master_data.view"]
  }
} as unknown as AuthenticatedRequest;

test("MasterController protects read routes with master_data.view", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.overview), ["master_data.view"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.unmappedSources), ["master_data.view"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.targetCoverage), ["master_data.view"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.conversionGaps), ["master_data.view"]);
});

test("MasterController protects write routes with master_data.manage", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.createEntity), ["master_data.manage"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.createAlias), ["master_data.manage"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.commitMapping), ["master_data.manage"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MasterController.prototype.commitConversion), ["master_data.manage"]);
});

test("MasterController audits alias creation", async () => {
  const events: AuditEvent[] = [];
  const controller = new MasterController(
    {
      createAlias: async () => ({
        id: "33333333-3333-4333-8333-333333333333",
        entityId: "11111111-1111-4111-8111-111111111111",
        alias: "ILLIG2",
        sourceSystem: "business-central",
        sourceField: "machine_center_no",
        aliasNormalized: "ILLIG2",
        source: "manual",
        matchConfidence: 100,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: null
      })
    } as unknown as MasterService,
    {
      log: async (event: AuditEvent) => {
        events.push(event);
      }
    } as unknown as AuditService
  );

  const result = await controller.createAlias(
    "11111111-1111-4111-8111-111111111111",
    { alias: "ILLIG2", sourceField: "machine_center_no" },
    request
  );

  assert.equal(result.alias, "ILLIG2");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "master.alias.create");
  assert.equal(events[0]?.entityType, "master_entity_alias");
});

test("MasterController audits mapping commit", async () => {
  const events: AuditEvent[] = [];
  const controller = new MasterController(
    {
      commitMapping: async () => ({
        sourceSystem: "business-central",
        sourceField: "machine_center_no",
        sourceValue: "ILLIG2",
        entityId: "11111111-1111-4111-8111-111111111111",
        affectedRows: 12,
        alreadyMappedRows: 0,
        unresolvedIssueCount: 12,
        sampleEntryNos: ["1"],
        commitRequired: true,
        updatedRows: 12,
        resolvedIssues: 12
      })
    } as unknown as MasterService,
    {
      log: async (event: AuditEvent) => {
        events.push(event);
      }
    } as unknown as AuditService
  );

  const result = await controller.commitMapping(
    {
      sourceField: "machine_center_no",
      sourceValue: "ILLIG2",
      entityId: "11111111-1111-4111-8111-111111111111"
    },
    request
  );

  assert.equal(result.updatedRows, 12);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "master.mapping.commit");
});

