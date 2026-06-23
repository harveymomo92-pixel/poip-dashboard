import assert from "node:assert/strict";
import test from "node:test";
import { ODataSyncProcessor } from "./processor.js";
import type { ODataClient, SyncRunRepository } from "./types.js";

test("ODataSyncProcessor commits successful mocked OData rows", async () => {
  let committedEntryNo: bigint | null = null;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_1",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    commitSuccessfulRun: async (input) => {
      committedEntryNo = input.rows[0]?.normalized.entryNo ?? null;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 1,
        rowsUpdated: 0,
        rowsSkipped: 0,
        checkpointAfter: { lastEntryNo: "1001", lastPostingDate: "2026-06-22" }
      };
    },
    markRunFailed: async () => {
      throw new Error("should not fail");
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "mock://test",
    fetchProductionOutputs: async (request) => {
      assert.equal(request.lastEntryNo, 1000n);
      return [
        {
          Entry_No: "1001",
          Posting_Date: "2026-06-22",
          Document_No: "DOC-1",
          Entry_Type: "Output",
          Item_No: "FG-1",
          Quantity: "1"
        }
      ];
    }
  };

  const result = await new ODataSyncProcessor(repository, client).run({
    mode: "incremental",
    sourceSystem: "business-central"
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(committedEntryNo, 1001n);
});

test("ODataSyncProcessor marks failed run and leaves commit untouched", async () => {
  let failed = false;
  let committed = false;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_1",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    commitSuccessfulRun: async () => {
      committed = true;
      throw new Error("should not commit");
    },
    markRunFailed: async (input) => {
      failed = input.errorCode === "ODATA_SYNC_FAILED";
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "mock://test",
    fetchProductionOutputs: async () => {
      throw new Error("OData unavailable");
    }
  };

  await assert.rejects(() =>
    new ODataSyncProcessor(repository, client).run({
      mode: "incremental",
      sourceSystem: "business-central"
    })
  );

  assert.equal(failed, true);
  assert.equal(committed, false);
});
