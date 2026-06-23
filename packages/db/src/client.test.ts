import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { users, productionOutputs, downtimeEvents } from "./schema.js";

test("schema exports core Milestone 1 tables", () => {
  assert.equal(getTableName(users), "users");
  assert.equal(getTableName(productionOutputs), "production_outputs");
  assert.equal(getTableName(downtimeEvents), "downtime_events");
});
