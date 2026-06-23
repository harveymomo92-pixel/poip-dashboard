import { normalizeODataOutputRow } from "@poip/domain";
import type { ODataClient, ODataSyncJobPayload, SyncRunRepository } from "./types.js";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000);
  return "Unknown sync error";
}

export class ODataSyncProcessor {
  constructor(
    private readonly repository: SyncRunRepository,
    private readonly client: ODataClient
  ) {}

  async run(payload: ODataSyncJobPayload) {
    const sourceUrl = this.client.sourceUrl();
    const run = await this.repository.prepareRun(payload, sourceUrl);
    if (run.completedResult) return run.completedResult;

    try {
      const rawRows = await this.client.fetchProductionOutputs({
        mode: payload.mode,
        sourceSystem: payload.sourceSystem,
        lastEntryNo: payload.mode === "incremental" ? run.checkpointBefore.lastEntryNo : null,
        ...(payload.range ? { range: payload.range } : {})
      });
      const rows = rawRows.map((rawPayload) => ({
        ...normalizeODataOutputRow(rawPayload),
        rawPayload
      }));

      return await this.repository.commitSuccessfulRun({
        run,
        sourceUrl,
        rows
      });
    } catch (error) {
      await this.repository.markRunFailed({
        runId: run.id,
        errorCode: "ODATA_SYNC_FAILED",
        errorMessage: safeErrorMessage(error)
      });
      throw error;
    }
  }
}
