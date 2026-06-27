import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { DataQualityRepository } from "./data-quality.repository.js";
import { DataQualityService } from "./data-quality.service.js";

test("DataQualityService requires a note when resolving or ignoring", async () => {
  const repository = {
    getByIdOrThrow: async () => ({ id: "issue-1", status: "OPEN" }),
    updateStatus: async () => ({ id: "issue-1" })
  } as unknown as DataQualityRepository;
  const service = new DataQualityService(repository);

  await assert.rejects(
    () => service.updateStatus("issue-1", { status: "RESOLVED", actorUserId: "user-1" }),
    BadRequestException
  );
  await assert.rejects(
    () => service.updateStatus("issue-1", { status: "IGNORED", actorUserId: "user-1" }),
    BadRequestException
  );
});

test("DataQualityService delegates acknowledged transitions without requiring a note", async () => {
  const calls: unknown[] = [];
  const repository = {
    getByIdOrThrow: async () => ({ id: "issue-1", status: "OPEN" }),
    updateStatus: async (id: string, input: unknown) => {
      calls.push({ id, input });
      return { id, status: "ACKNOWLEDGED" };
    }
  } as unknown as DataQualityRepository;
  const service = new DataQualityService(repository);
  const result = await service.updateStatus("issue-1", {
    status: "ACKNOWLEDGED",
    actorUserId: "user-1"
  });

  assert.equal(result.status, "ACKNOWLEDGED");
  assert.equal(calls.length, 1);
});

test("DataQualityService blocks unsafe status transitions", async () => {
  const repository = {
    getByIdOrThrow: async () => ({ id: "issue-1", status: "RESOLVED" }),
    updateStatus: async () => ({ id: "issue-1" })
  } as unknown as DataQualityRepository;
  const service = new DataQualityService(repository);

  await assert.rejects(
    () => service.updateStatus("issue-1", {
      status: "ACKNOWLEDGED",
      actorUserId: "user-1"
    }),
    BadRequestException
  );
});

test("DataQualityService delegates Business Central issue generation", async () => {
  const calls: unknown[] = [];
  const repository = {
    generateBusinessCentralIssues: async (input: unknown) => {
      calls.push(input);
      return { created: 1, updated: 0, unchanged: 0, resolved: 0, byType: {}, bySeverity: {} };
    }
  } as unknown as DataQualityRepository;
  const service = new DataQualityService(repository);

  const result = await service.generateBusinessCentralIssues({ actorUserId: "user-1" });

  assert.equal(result.created, 1);
  assert.deepEqual(calls, [{ actorUserId: "user-1" }]);
});
