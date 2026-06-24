import type {
  DataQualitySignal,
  NormalizationResult,
  ODataOutputRawRow
} from "@poip/domain";

export type ODataSyncMode = "incremental" | "resync-range" | "backfill";
export type SyncRunStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

export interface ODataBackfillOptions {
  readonly from: string;
  readonly to?: string;
  readonly dateField: string;
  readonly pageSize?: string;
  readonly maxPages?: number;
  readonly forcePageSize?: boolean;
}

export interface ODataSyncJobPayload {
  readonly syncRunId?: string;
  readonly mode: ODataSyncMode;
  readonly sourceSystem: string;
  readonly requestedBy?: string | null;
  readonly range?: {
    readonly from: string;
    readonly to: string;
  };
  readonly backfill?: ODataBackfillOptions;
}

export interface SyncCheckpointSnapshot {
  readonly lastEntryNo: bigint | null;
  readonly lastPostingDate: string | null;
}

export interface SerializableSyncCheckpointSnapshot {
  readonly lastEntryNo: string | null;
  readonly lastPostingDate: string | null;
}

export interface PreparedSyncRun {
  readonly id: string;
  readonly sourceSystem: string;
  readonly mode: ODataSyncMode;
  readonly checkpointBefore: SyncCheckpointSnapshot;
  readonly completedResult?: SyncCommitResult;
}

export interface ODataFetchRequest {
  readonly mode: ODataSyncMode;
  readonly sourceSystem: string;
  readonly lastEntryNo: bigint | null;
  readonly range?: {
    readonly from: string;
    readonly to: string;
  };
  readonly backfill?: ODataBackfillOptions;
}

export interface ODataClient {
  fetchProductionOutputs(request: ODataFetchRequest): Promise<readonly ODataOutputRawRow[]>;
  sourceUrl(): string | null;
}

export interface StagedOutputRow extends NormalizationResult {
  readonly rawPayload: ODataOutputRawRow;
  readonly issues: readonly DataQualitySignal[];
}

export interface SyncCommitInput {
  readonly run: PreparedSyncRun;
  readonly sourceUrl: string | null;
  readonly rows: readonly StagedOutputRow[];
}

export interface SyncCommitResult {
  readonly runId: string;
  readonly status: "SUCCESS";
  readonly rowsFetched: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
  readonly rowsSkipped: number;
  readonly checkpointAfter: SerializableSyncCheckpointSnapshot;
}

export interface SyncRunRepository {
  prepareRun(payload: ODataSyncJobPayload, sourceUrl: string | null): Promise<PreparedSyncRun>;
  commitSuccessfulRun(input: SyncCommitInput): Promise<SyncCommitResult>;
  markRunFailed(input: {
    readonly runId: string;
    readonly errorCode: string;
    readonly errorMessage: string;
  }): Promise<void>;
}
