import { createDatabase } from "../packages/db/src/client.js";
import {
  buildAuditReport,
  collectAuditData,
  ODATA_DB_MAPPING_AUDIT_OUTPUT_FOLDER,
  writeAuditReport
} from "../packages/db/src/odata-db-mapping-audit.js";
import { getDatabaseUrl } from "../packages/db/src/env.js";

async function main() {
  const outputFolder = process.env.BC_ODATA_DB_MAPPING_AUDIT_DIR?.trim() || ODATA_DB_MAPPING_AUDIT_OUTPUT_FOLDER;
  const database = createDatabase({ connectionString: getDatabaseUrl() });
  const client = await database.pool.connect();

  try {
    await client.query("begin transaction read only");
    const data = await collectAuditData(client, outputFolder);
    await client.query("commit");

    const report = buildAuditReport(data);
    await writeAuditReport(report, outputFolder);

    console.log("BC OData DB mapping alignment audit completed");
    console.log(`Output folder: ${outputFolder}`);
    console.log(`Tables inspected: ${report.summary.tablesInspected}`);
    console.log(`BC ledger entry rows: ${report.summary.productionOutputRows}`);
    console.log(`Mismatch rows: ${report.summary.mismatchRows}`);
    console.log(`Fallback-only rows: ${report.summary.fallbackOnlyRows}`);
    console.log(`Source-gap rows: ${report.summary.sourceGapRows}`);
    console.log(`Next recommended milestone: ${report.summary.nextRecommendedMilestone}`);
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Ignore rollback failures so the original audit error is reported.
    }
    throw error;
  } finally {
    client.release();
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown audit error";
  console.error(`BC OData DB mapping alignment audit failed: ${message}`);
  process.exitCode = 1;
});
