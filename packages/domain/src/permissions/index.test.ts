import assert from "node:assert/strict";
import test from "node:test";
import { getPermissionsForRoles, hasPermission } from "./index.js";

test("Admin has every permission", () => {
  assert.equal(hasPermission(["Admin"], "users.manage"), true);
  assert.equal(hasPermission(["Admin"], "sync.run"), true);
});

test("Viewer cannot manage users", () => {
  assert.equal(hasPermission(["Viewer"], "users.manage"), false);
});

test("getPermissionsForRoles deduplicates permissions across roles", () => {
  const permissions = getPermissionsForRoles(["Viewer", "QC"]);
  assert.equal(permissions.filter((permission) => permission === "dashboard.view").length, 1);
});
