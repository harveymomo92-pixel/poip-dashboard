import assert from "node:assert/strict";
import test from "node:test";
import { nextSyncCheckpoint } from "./checkpoint.js";

test("nextSyncCheckpoint advances successful incremental runs", () => {
  const next = nextSyncCheckpoint({
    mode: "incremental",
    status: "SUCCESS",
    current: { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" },
    maxCommittedEntryNo: 1010n,
    maxCommittedPostingDate: "2026-06-22"
  });

  assert.equal(next.lastEntryNo, 1010n);
  assert.equal(next.lastPostingDate, "2026-06-22");
});

test("nextSyncCheckpoint does not move on failed or range runs", () => {
  const current = { lastEntryNo: 1000n, lastPostingDate: "2026-06-20" };

  assert.deepEqual(
    nextSyncCheckpoint({
      mode: "incremental",
      status: "FAILED",
      current,
      maxCommittedEntryNo: 1010n,
      maxCommittedPostingDate: "2026-06-22"
    }),
    current
  );
  assert.deepEqual(
    nextSyncCheckpoint({
      mode: "resync-range",
      status: "SUCCESS",
      current,
      maxCommittedEntryNo: 1010n,
      maxCommittedPostingDate: "2026-06-22"
    }),
    current
  );
});
