import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { TargetsController } from "./targets.controller.js";
import type { TargetsService } from "./targets.service.js";

const target = {
  id: "96c6033a-3218-4eb9-8a4f-7af90385db3e",
  entityId: "27514d77-74d1-4a83-9e98-c6861faf3253",
  entityCode: "MC-01",
  entityName: "Machine 01",
  targetVersion: 1,
  effectiveFrom: "2026-06-01",
  effectiveTo: null,
  dailyTargetQty: 100,
  rejectTargetPct: null,
  minAchievementPct: 95,
  maxAchievementPct: 110,
  status: "DRAFT",
  approvedBy: null,
  approvedAt: null,
  createdBy: "admin",
  createdAt: "2026-06-01T00:00:00.000Z"
} as const;

function permissionFor(method: keyof TargetsController) {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, TargetsController.prototype[method]);
}

function request(): AuthenticatedRequest {
  return {
    user: {
      id: "0a0b061d-7ffe-4b91-87ef-bd4aa709fd71",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["target.view", "target.create", "target.approve"]
    },
    headers: {},
    ip: "127.0.0.1"
  } as unknown as AuthenticatedRequest;
}

test("TargetsController protects target routes with expected permissions", () => {
  assert.deepEqual(permissionFor("listTargets"), ["target.view"]);
  assert.deepEqual(permissionFor("getTarget"), ["target.view"]);
  assert.deepEqual(permissionFor("createTarget"), ["target.create"]);
  assert.deepEqual(permissionFor("updateTarget"), ["target.create"]);
  assert.deepEqual(permissionFor("submitTarget"), ["target.create"]);
  assert.deepEqual(permissionFor("approveTarget"), ["target.approve"]);
  assert.deepEqual(permissionFor("rejectTarget"), ["target.approve"]);
  assert.deepEqual(permissionFor("deactivateTarget"), ["target.create"]);
});

test("TargetsController createTarget validates input and writes audit log", async () => {
  const auditEvents: unknown[] = [];
  const controller = new TargetsController(
    {
      createTarget: async () => target
    } as unknown as TargetsService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.createTarget(
    {
      entityId: target.entityId,
      effectiveFrom: "2026-06-01",
      dailyTargetQty: 100,
      minAchievementPct: 95,
      maxAchievementPct: 110
    },
    request()
  );

  assert.equal(response.id, target.id);
  assert.equal(auditEvents.length, 1);
});

test("TargetsController approveTarget audits before and after values", async () => {
  const auditEvents: unknown[] = [];
  const approved = { ...target, status: "APPROVED", approvedBy: "admin" };
  const superseded = {
    ...target,
    id: "e0b66fe0-b971-4399-9d7d-c38952300969",
    targetVersion: 0,
    status: "APPROVED"
  };
  const controller = new TargetsController(
    {
      getTargetOrThrow: async () => target,
      listOverlappingActiveTargetsForTarget: async () => [superseded],
      approveTarget: async () => approved
    } as unknown as TargetsService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );

  const response = await controller.approveTarget(target.id, request());

  assert.equal(response.status, "APPROVED");
  assert.equal(auditEvents.length, 2);
});
