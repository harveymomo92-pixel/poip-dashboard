import assert from "node:assert/strict";
import test from "node:test";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UsersController } from "./users.controller.js";
import type { UsersService } from "./users.service.js";

test("UsersController createUser creates admin-only user action audit", async () => {
  const auditEvents: unknown[] = [];
  const controller = new UsersController(
    {
      createUser: async () => ({
        id: "user_2",
        email: "planner@example.local",
        name: "Planner",
        isActive: true,
        roles: ["PPIC"]
      })
    } as unknown as UsersService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );
  const request = {
    user: {
      id: "admin_1",
      email: "admin@example.local",
      name: "Admin",
      roles: ["Admin"],
      permissions: ["users.manage"]
    },
    headers: {},
    ip: "127.0.0.1"
  } as unknown as AuthenticatedRequest;

  const user = await controller.createUser(
    {
      email: "planner@example.local",
      name: "Planner",
      password: "change-this",
      roles: ["PPIC"]
    },
    request
  );

  assert.equal(user.email, "planner@example.local");
  assert.equal(auditEvents.length, 1);
});
