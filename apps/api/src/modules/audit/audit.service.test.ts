import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseConnection } from "../database/database.module.js";
import { AuditService } from "./audit.service.js";

test("AuditService returns human-readable, redacted event detail", async () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    requestId: "request-1",
    actorUserId: "22222222-2222-4222-8222-222222222222",
    actorName: "PPIC Admin",
    actorEmail: "admin@example.local",
    action: "target.update",
    entityType: "production_target",
    entityId: "33333333-3333-4333-8333-333333333333",
    beforeValue: { dailyTargetQty: 100, password_hash: "hidden", raw_payload: { source: "private" } },
    afterValue: { dailyTargetQty: 120, password_hash: "changed", raw_payload: { source: "private" } },
    createdAt: new Date("2026-06-24T01:00:00.000Z")
  };
  const chain = {
    from() {
      return this;
    },
    leftJoin() {
      return this;
    },
    where() {
      return this;
    },
    async limit() {
      return [row];
    }
  };
  const database = {
    db: {
      select: () => chain
    }
  } as unknown as DatabaseConnection;
  const service = new AuditService(database);

  const event = await service.getById(row.id);

  assert.equal(event?.summary, "PPIC Admin memperbarui target produksi.");
  assert.deepEqual(event?.changedFields, ["dailyTargetQty"]);
  assert.deepEqual(event?.beforeValue, {
    dailyTargetQty: 100,
    password_hash: "[REDACTED]",
    raw_payload: "[REDACTED]"
  });
  assert.deepEqual(event?.afterValue, {
    dailyTargetQty: 120,
    password_hash: "[REDACTED]",
    raw_payload: "[REDACTED]"
  });
});
