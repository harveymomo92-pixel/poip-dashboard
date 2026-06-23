import assert from "node:assert/strict";
import "reflect-metadata";
import test from "node:test";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { DataQualityController } from "./data-quality.controller.js";

test("DataQualityController summary requires data_quality.view", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, DataQualityController.prototype.getSummary),
    ["data_quality.view"]
  );
});
