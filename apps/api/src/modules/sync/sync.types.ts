export type ODataSyncMode = "incremental" | "resync-range";

export interface ODataSyncJobPayload {
  readonly syncRunId: string;
  readonly mode: ODataSyncMode;
  readonly sourceSystem: string;
  readonly requestedBy: string | null;
  readonly range?: {
    readonly from: string;
    readonly to: string;
  };
}
