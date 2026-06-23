import { APP_TIMEZONE } from "@poip/domain";
import { Worker } from "bullmq";
import { pathToFileURL } from "node:url";
import { createODataClientFromEnv } from "./jobs/odata-sync/odata-client.js";
import { ODataSyncProcessor } from "./jobs/odata-sync/processor.js";
import { DrizzleSyncRunRepository } from "./jobs/odata-sync/repository.js";
import { ODATA_SYNC_JOB, ODATA_SYNC_QUEUE, createRedisConnection } from "./queues/odata-sync.queue.js";

export function getWorkerIdentity() {
  return {
    service: "worker",
    timezone: APP_TIMEZONE
  } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ level: "info", message: "worker bootstrap", ...getWorkerIdentity() }));
  const repository = new DrizzleSyncRunRepository();
  const processor = new ODataSyncProcessor(repository, createODataClientFromEnv());
  const connection = createRedisConnection();
  const worker = new Worker(
    ODATA_SYNC_QUEUE,
    async (job) => {
      if (job.name !== ODATA_SYNC_JOB) throw new Error(`Unsupported job ${job.name}`);
      return processor.run(job.data);
    },
    {
      connection,
      concurrency: Number.parseInt(process.env.ODATA_SYNC_CONCURRENCY ?? "1", 10),
      lockDuration: 300_000
    }
  );

  const shutdown = async () => {
    await worker.close();
    await repository.close();
    connection.disconnect();
  };
  process.once("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
}
