import { createDatabase } from "../packages/db/src/client.js";
import { applyBcLedgerBackfill } from "../packages/db/src/bc-ledger-backfill.js";
import { getDatabaseUrl } from "../packages/db/src/env.js";

function assertApplyGuard() {
  if (process.env.ALLOW_BC_LEDGER_BACKFILL_APPLY !== "true") {
    throw new Error("Refusing apply: set ALLOW_BC_LEDGER_BACKFILL_APPLY=true");
  }
  if (!process.argv.includes("--confirm")) {
    throw new Error("Refusing apply: pass --confirm");
  }
}

async function main() {
  assertApplyGuard();
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  const client = await database.pool.connect();
  try {
    await client.query("begin");
    const result = await applyBcLedgerBackfill(client);
    await client.query("commit");
    console.log("BC ledger semantic backfill applied");
    console.log(`Updated rows: ${result.updatedRows}`);
    console.log("Targets untouched: production_targets and target_profiles were not updated by this command.");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Keep original error visible.
    }
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown apply error";
  console.error(`BC ledger semantic backfill apply failed: ${message}`);
  process.exitCode = 1;
});
