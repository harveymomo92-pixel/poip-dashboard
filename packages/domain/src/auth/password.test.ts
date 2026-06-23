import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("verifyPassword accepts a matching scrypt hash", async () => {
  const hash = await hashPassword("change-this");
  assert.equal(await verifyPassword("change-this", hash), true);
});

test("verifyPassword rejects a wrong password or unknown hash format", async () => {
  const hash = await hashPassword("change-this");
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword("change-this", "plain:not-supported"), false);
});
