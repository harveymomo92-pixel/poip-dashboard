import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getRedisUrl } from "../common/env.js";
import type { ODataSyncJobPayload } from "../jobs/odata-sync/types.js";

export const ODATA_SYNC_QUEUE = "odata-sync";
export const ODATA_SYNC_JOB = "odata-sync";

export function createRedisConnection() {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: null });
}

export function createODataSyncQueue(connection = createRedisConnection()) {
  return new Queue<ODataSyncJobPayload>(ODATA_SYNC_QUEUE, { connection });
}
