import assert from "node:assert/strict";
import test from "node:test";
import { ODataSyncProcessor } from "./processor.js";
import type { ODataClient, SyncRunRepository } from "./types.js";

test("ODataSyncProcessor commits successful mocked OData rows", async () => {
  let committedEntryNo: bigint | null = null;
  let requiredSelectFields: readonly string[] = [];
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_1",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    getLatestLocalEntryNo: async () => null,
    commitSuccessfulRun: async (input) => {
      committedEntryNo = input.rows[0]?.normalized.entryNo ?? null;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 1,
        rowsUpdated: 0,
        rowsSkipped: 0,
        maxEntryNo: "1001",
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
      requiredSelectFields = request.requiredSelectFields ?? [];
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
  assert.deepEqual(requiredSelectFields, ["gItem_Description", "gProdOrRotLine_No", "gProdOrRotLine_Description"]);
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
    getLatestLocalEntryNo: async () => null,
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

test("ODataSyncProcessor forwards backfill options without using incremental checkpoint", async () => {
  let receivedBackfillFrom: string | null = null;
  let receivedLastEntryNo: bigint | null | undefined;
  let receivedMetadata: Record<string, unknown> | undefined;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_backfill",
      sourceSystem: "business-central",
      mode: "backfill",
      checkpointBefore: { lastEntryNo: 9999n, lastPostingDate: "2026-06-20" }
    }),
    getLatestLocalEntryNo: async () => 9999n,
    commitSuccessfulRun: async (input) => {
      receivedMetadata = input.metadata;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsSkipped: input.rows.length,
        maxEntryNo: null,
        checkpointAfter: { lastEntryNo: null, lastPostingDate: null }
      };
    },
    markRunFailed: async () => {
      throw new Error("should not fail");
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "mock://test",
    lastFetchStats: () => ({
      pagesAttempted: 1,
      pagesFetched: 1,
      rowsFetched: 0,
      nextLinkUsed: false,
      keysetPaginationUsed: false,
      truncatedByMaxPages: false
    }),
    fetchProductionOutputs: async (request) => {
      receivedBackfillFrom = request.backfill?.from ?? null;
      receivedLastEntryNo = request.lastEntryNo;
      return [];
    }
  };

  const result = await new ODataSyncProcessor(repository, client).run({
    mode: "backfill",
    sourceSystem: "business-central",
    backfill: {
      from: "2026-01-01",
      dateField: "Posting_Date"
    }
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(receivedBackfillFrom, "2026-01-01");
  assert.equal(receivedLastEntryNo, null);
  assert.equal((receivedMetadata?.backfill as { from?: string } | undefined)?.from, "2026-01-01");
  assert.equal((receivedMetadata?.pagination as { pagesFetched?: number } | undefined)?.pagesFetched, 1);
  assert.equal(typeof receivedMetadata?.durationMs, "number");
});

test("ODataSyncProcessor skips large pull when remote latest Entry_No is not newer and scan window is disabled", async () => {
  const previousScanDays = process.env.BC_ODATA_BACKFILL_SCAN_DAYS;
  process.env.BC_ODATA_BACKFILL_SCAN_DAYS = "0";
  let fetchCalled = false;
  let metadata: Record<string, unknown> | undefined;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_skip",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    getLatestLocalEntryNo: async () => 2000n,
    commitSuccessfulRun: async (input) => {
      metadata = input.metadata;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsSkipped: 0,
        maxEntryNo: null,
        checkpointAfter: { lastEntryNo: "1000", lastPostingDate: "2026-06-20" }
      };
    },
    markRunFailed: async () => {
      throw new Error("should not fail");
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "https://businesscentral.example.test/odata",
    fetchLatestEntryNo: async () => 1999n,
    fetchProductionOutputs: async () => {
      fetchCalled = true;
      return [];
    }
  };

  try {
    const result = await new ODataSyncProcessor(repository, client).run({
      mode: "incremental",
      sourceSystem: "business-central"
    });
    assert.equal(result.rowsFetched, 0);
    assert.equal(fetchCalled, false);
    assert.equal((metadata?.syncStrategy as { mode?: string } | undefined)?.mode, "skip");
  } finally {
    if (previousScanDays === undefined) delete process.env.BC_ODATA_BACKFILL_SCAN_DAYS;
    else process.env.BC_ODATA_BACKFILL_SCAN_DAYS = previousScanDays;
  }
});

test("ODataSyncProcessor fetches only Entry_No greater than latest local entry when remote is newer", async () => {
  let receivedLastEntryNo: bigint | null | undefined;
  let metadata: Record<string, unknown> | undefined;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_incremental",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    getLatestLocalEntryNo: async () => 2000n,
    commitSuccessfulRun: async (input) => {
      metadata = input.metadata;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 1,
        rowsUpdated: 0,
        rowsSkipped: 0,
        maxEntryNo: "2001",
        checkpointAfter: { lastEntryNo: "2001", lastPostingDate: "2026-06-22" }
      };
    },
    markRunFailed: async () => {
      throw new Error("should not fail");
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "https://businesscentral.example.test/odata",
    fetchLatestEntryNo: async () => 2001n,
    fetchProductionOutputs: async (request) => {
      receivedLastEntryNo = request.lastEntryNo;
      return [
        {
          Entry_No: "2001",
          Posting_Date: "2026-06-22",
          Document_No: "DOC-2001",
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
  assert.equal(receivedLastEntryNo, 2000n);
  assert.equal((metadata?.syncStrategy as { mode?: string } | undefined)?.mode, "incremental");
});

test("ODataSyncProcessor uses a recent backfill scan window when remote latest is unchanged", async () => {
  const previousScanDays = process.env.BC_ODATA_BACKFILL_SCAN_DAYS;
  process.env.BC_ODATA_BACKFILL_SCAN_DAYS = "14";
  let receivedRange: { from: string; to: string } | undefined;
  let metadata: Record<string, unknown> | undefined;
  const repository: SyncRunRepository = {
    prepareRun: async () => ({
      id: "run_scan",
      sourceSystem: "business-central",
      mode: "incremental",
      checkpointBefore: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" }
    }),
    getLatestLocalEntryNo: async () => 2000n,
    commitSuccessfulRun: async (input) => {
      metadata = input.metadata;
      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsSkipped: 0,
        maxEntryNo: null,
        checkpointAfter: { lastEntryNo: "1000", lastPostingDate: "2026-06-20" }
      };
    },
    markRunFailed: async () => {
      throw new Error("should not fail");
    }
  };
  const client: ODataClient = {
    sourceUrl: () => "https://businesscentral.example.test/odata",
    fetchLatestEntryNo: async () => 2000n,
    fetchProductionOutputs: async (request) => {
      receivedRange = request.range;
      return [];
    }
  };

  try {
    await new ODataSyncProcessor(repository, client).run({
      mode: "incremental",
      sourceSystem: "business-central"
    });

    assert.equal((metadata?.syncStrategy as { mode?: string } | undefined)?.mode, "backfill-scan");
    assert.equal(typeof receivedRange?.from, "string");
    assert.equal(typeof receivedRange?.to, "string");
  } finally {
    if (previousScanDays === undefined) delete process.env.BC_ODATA_BACKFILL_SCAN_DAYS;
    else process.env.BC_ODATA_BACKFILL_SCAN_DAYS = previousScanDays;
  }
});
