import { createDatabase } from "../packages/db/src/client.js";
import { createBcLedgerBackfillPreview, BC_LEDGER_BACKFILL_PREVIEW_DIR } from "../packages/db/src/bc-ledger-backfill.js";
import { getDatabaseUrl } from "../packages/db/src/env.js";

async function main() {
  const outputFolder = process.env.BC_LEDGER_BACKFILL_PREVIEW_DIR?.trim() || BC_LEDGER_BACKFILL_PREVIEW_DIR;
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  const client = await database.pool.connect();
  try {
    await client.query("begin transaction read only");
    const summary = await createBcLedgerBackfillPreview(client, outputFolder);
    await client.query("commit");
    console.log("BC ledger backfill preview completed");
    console.log(`Output folder: ${outputFolder}`);
    console.log(`Dashboard-ready rows: ${summary.dashboardReadyRows}`);
    console.log(`Future-use rows: ${summary.futureUseRows}`);
    console.log(`Source-gap rows: ${summary.sourceGapRows}`);
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Keep the original error visible.
    }
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown preview error";
  console.error(`BC ledger backfill preview failed: ${message}`);
  process.exitCode = 1;
});
