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
  readonly afterEntryNo?: bigint;
  readonly pageSize?: string;
  readonly maxPages?: number;
  readonly forcePageSize?: boolean;
}

export interface ODataFetchStats {
  readonly pagesAttempted: number;
  readonly pagesFetched: number;
  readonly rowsFetched: number;
  readonly nextLinkUsed: boolean;
  readonly keysetPaginationUsed: boolean;
  readonly truncatedByMaxPages: boolean;
}

export interface ODataLatestEntryRequest {
  readonly sourceSystem: string;
  readonly range?: {
    readonly from: string;
    readonly to: string;
  };
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
  readonly requiredSelectFields?: readonly string[];
  readonly forceSelectFields?: boolean;
  readonly filters?: readonly string[];
  readonly range?: {
    readonly from: string;
    readonly to: string;
  };
  readonly backfill?: ODataBackfillOptions;
}

export interface ODataClient {
  fetchProductionOutputs(request: ODataFetchRequest): Promise<readonly ODataOutputRawRow[]>;
  fetchLatestEntryNo?(request: ODataLatestEntryRequest): Promise<bigint | null>;
  sourceUrl(): string | null;
  lastFetchStats?(): ODataFetchStats;
}

export interface StagedOutputRow extends NormalizationResult {
  readonly rawPayload: ODataOutputRawRow;
  readonly issues: readonly DataQualitySignal[];
}

export interface SyncCommitInput {
  readonly run: PreparedSyncRun;
  readonly sourceUrl: string | null;
  readonly rows: readonly StagedOutputRow[];
  readonly metadata?: Record<string, unknown>;
}

export interface SyncCommitResult {
  readonly runId: string;
  readonly status: "SUCCESS";
  readonly rowsFetched: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
  readonly rowsSkipped: number;
  readonly maxEntryNo: string | null;
  readonly checkpointAfter: SerializableSyncCheckpointSnapshot;
}

export interface SyncRunRepository {
  prepareRun(payload: ODataSyncJobPayload, sourceUrl: string | null): Promise<PreparedSyncRun>;
  getLatestLocalEntryNo(sourceSystem: string): Promise<bigint | null>;
  commitSuccessfulRun(input: SyncCommitInput): Promise<SyncCommitResult>;
  markRunFailed(input: {
    readonly runId: string;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void>;
}
