import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { TokenService } from "./token.service.js";

test("TokenService signs and verifies local session token", () => {
  process.env.SESSION_SECRET = "test-secret";
  const service = new TokenService();
  const token = service.sign("user_1", new Date("2026-06-22T00:00:00.000Z"));
  const payload = service.verify(token, new Date("2026-06-22T01:00:00.000Z"));
  assert.equal(payload.sub, "user_1");
});

test("TokenService rejects expired tokens", () => {
  process.env.SESSION_SECRET = "test-secret";
  const service = new TokenService();
  const token = service.sign("user_1", new Date("2026-06-22T00:00:00.000Z"));
  assert.throws(
    () => service.verify(token, new Date("2026-06-22T09:00:00.000Z")),
    UnauthorizedException
  );
});
