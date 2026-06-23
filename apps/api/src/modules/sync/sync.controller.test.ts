import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { SyncController } from "./sync.controller.js";

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
