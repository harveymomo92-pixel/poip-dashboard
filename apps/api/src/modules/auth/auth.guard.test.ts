import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { AuthGuard } from "./auth.guard.js";
import type { AuthService } from "./auth.service.js";
import type { TokenService } from "./token.service.js";

test("AuthGuard rejects authenticated users without required permission", async () => {
  const request = {
    headers: {
      authorization: "Bearer token"
    }
  };
  const guard = new AuthGuard(
    {
      getAllAndOverride: (key: string) => (key === REQUIRED_PERMISSIONS_KEY ? ["users.manage"] : false)
    } as unknown as Reflector,
    {
      getPrincipal: async () => ({
        id: "viewer_1",
        email: "viewer@example.local",
        name: "Viewer",
        roles: ["Viewer"],
        permissions: ["dashboard.view"]
      }),
      can: () => false
    } as unknown as AuthService,
    {
      verify: () => ({ sub: "viewer_1", exp: 1 })
    } as unknown as TokenService
  );

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
});

test("AuthGuard allows users with required permission", async () => {
  const request = {
    headers: {
      authorization: "Bearer token"
    }
  };
  const guard = new AuthGuard(
    {
      getAllAndOverride: (key: string) => (key === REQUIRED_PERMISSIONS_KEY ? ["users.manage"] : false)
    } as unknown as Reflector,
    {
      getPrincipal: async () => ({
        id: "admin_1",
        email: "admin@example.local",
        name: "Admin",
        roles: ["Admin"],
        permissions: ["users.manage"]
      }),
      can: () => true
    } as unknown as AuthService,
    {
      verify: () => ({ sub: "admin_1", exp: 1 })
    } as unknown as TokenService
  );

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;

  assert.equal(await guard.canActivate(context), true);
});
