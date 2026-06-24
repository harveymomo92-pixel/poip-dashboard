import assert from "node:assert/strict";
import test from "node:test";
import { readinessStatus } from "./health.repository.js";

test("readinessStatus reports critical infrastructure failures", () => {
  assert.equal(
    readinessStatus({
      database: "CRITICAL",
      redis: "HEALTHY",
      migrations: "HEALTHY",
      queue: "HEALTHY",
      syncMode: "HEALTHY",
      freshness: "HEALTHY",
      latestSyncStatus: "SUCCESS"
    }),
    "CRITICAL"
  );
});

test("readinessStatus reports operational warnings without marking the API down", () => {
  assert.equal(
    readinessStatus({
      database: "HEALTHY",
      redis: "HEALTHY",
      migrations: "HEALTHY",
      queue: "WARNING",
      syncMode: "HEALTHY",
      freshness: "CRITICAL",
      latestSyncStatus: "FAILED"
    }),
    "WARNING"
  );
});

test("readinessStatus reports healthy only when infrastructure and operations are healthy", () => {
  assert.equal(
    readinessStatus({
      database: "HEALTHY",
      redis: "HEALTHY",
      migrations: "HEALTHY",
      queue: "HEALTHY",
      syncMode: "HEALTHY",
      freshness: "HEALTHY",
      latestSyncStatus: "SUCCESS"
    }),
    "HEALTHY"
  );
});

test("readinessStatus warns when live OData mode is not enabled", () => {
  assert.equal(
    readinessStatus({
      database: "HEALTHY",
      redis: "HEALTHY",
      migrations: "HEALTHY",
      queue: "HEALTHY",
      syncMode: "WARNING",
      freshness: "HEALTHY",
      latestSyncStatus: "SUCCESS"
    }),
    "WARNING"
  );
});
