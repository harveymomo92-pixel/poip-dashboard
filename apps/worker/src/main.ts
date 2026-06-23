import { APP_TIMEZONE } from "@poip/domain";
import { pathToFileURL } from "node:url";

export function getWorkerIdentity() {
  return {
    service: "worker",
    timezone: APP_TIMEZONE
  } as const;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ level: "info", message: "worker bootstrap", ...getWorkerIdentity() }));
}
