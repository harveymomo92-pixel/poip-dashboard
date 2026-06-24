export interface SyncCheckpointState {
  readonly lastEntryNo: bigint | null;
  readonly lastPostingDate: string | null;
}

export interface CheckpointUpdateInput {
  readonly mode: "incremental" | "resync-range" | "backfill";
  readonly status: "SUCCESS" | "FAILED";
  readonly current: SyncCheckpointState;
  readonly maxCommittedEntryNo: bigint | null;
  readonly maxCommittedPostingDate: string | null;
}

export function nextSyncCheckpoint(input: CheckpointUpdateInput): SyncCheckpointState {
  if (input.status !== "SUCCESS" || input.mode !== "incremental" || !input.maxCommittedEntryNo) {
    return input.current;
  }

  const shouldAdvance =
    !input.current.lastEntryNo || input.maxCommittedEntryNo > input.current.lastEntryNo;

  return {
    lastEntryNo: shouldAdvance ? input.maxCommittedEntryNo : input.current.lastEntryNo,
    lastPostingDate: shouldAdvance
      ? input.maxCommittedPostingDate
      : input.current.lastPostingDate
  };
}
