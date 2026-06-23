import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";
import type { AuthPrincipal } from "./auth.types.js";
import type { TokenService } from "./token.service.js";
import type { AuditService } from "../audit/audit.service.js";

const principal: AuthPrincipal = {
  id: "user_1",
  email: "admin@example.local",
  name: "System Admin",
  roles: ["Admin"],
  permissions: ["users.manage"]
};

test("AuthController login returns user and token", async () => {
  const auditEvents: unknown[] = [];
  const controller = new AuthController(
    {
      validateLogin: async () => principal
    } as unknown as AuthService,
    {
      sign: () => "signed-token"
    } as unknown as TokenService,
    {
      log: async (event: unknown) => {
        auditEvents.push(event);
      }
    } as unknown as AuditService
  );
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    }
  } as unknown as Response;
  const request = {
    headers: {},
    ip: "127.0.0.1"
  } as unknown as Request;

  const result = await controller.login(
    { email: "admin@example.local", password: "change-this" },
    request,
    response
  );

  assert.equal(result.token, "signed-token");
  assert.equal(result.user.email, "admin@example.local");
  assert.match(headers.get("Set-Cookie") ?? "", /poip_session=/);
  assert.equal(auditEvents.length, 1);
});

test("AuthController me returns request principal", () => {
  const controller = new AuthController(
    {} as unknown as AuthService,
    {} as unknown as TokenService,
    {} as unknown as AuditService
  );

  assert.deepEqual(controller.me({ user: principal } as never), { user: principal });
});
