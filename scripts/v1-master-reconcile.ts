import {
  createV2Database,
  formatNumber,
  loadLocalV1Plan,
  loadV2OutputRows,
  optionalDateEnv,
  printRows,
  SOURCE_SYSTEM
} from "./v1-master-lib.js";
import { estimateV1Reconcile } from "../packages/domain/src/master-data/v1-import.js";

async function currentUnmappedSummary(pool: ReturnType<typeof createV2Database>["pool"]) {
  const result = await pool.query<{
    total_rows: string | number;
    unmapped_rows: string | number;
    unmapped_ok_rows: string | number;
    unmapped_ok_qty: string | number;
  }>(
    `
      select count(*) as total_rows,
             count(*) filter (where entity_id is null) as unmapped_rows,
             count(*) filter (where entity_id is null and normalized_output_type = 'OK' and quantity > 0) as unmapped_ok_rows,
             coalesce(sum(quantity) filter (where entity_id is null and normalized_output_type = 'OK' and quantity > 0), 0) as unmapped_ok_qty
      from production_outputs
      where source_system = $1
    `,
    [SOURCE_SYSTEM]
  );
  return result.rows[0] ?? { total_rows: 0, unmapped_rows: 0, unmapped_ok_rows: 0, unmapped_ok_qty: 0 };
}

async function main(): Promise<void> {
  const effectiveFrom = optionalDateEnv("V1_TARGET_EFFECTIVE_FROM", "2026-01-01");
  const plan = loadLocalV1Plan();
  const database = createV2Database();
  try {
    const [rows, current] = await Promise.all([
      loadV2OutputRows(database.pool),
      currentUnmappedSummary(database.pool)
    ]);
    const estimate = estimateV1Reconcile(plan, rows, Number(process.env.V1_RECONCILE_LIMIT ?? 15) || 15);
    const targetEligibleEstimate = estimateV1Reconcile(
      plan,
      rows.filter((row) => !row.postingDate || row.postingDate >= effectiveFrom),
      Number(process.env.V1_RECONCILE_LIMIT ?? 15) || 15
    );

    console.log("V1 master data reconcile");
    console.log(`Source system: ${SOURCE_SYSTEM}`);
    console.log(`Target effective from assumption: ${effectiveFrom}`);
    console.log(`Current BC rows: ${current.total_rows}`);
    console.log(`Current unmapped rows: ${current.unmapped_rows}`);
    console.log(`Current unmapped OK rows: ${current.unmapped_ok_rows}`);
    console.log(`Current unmapped OK qty: ${formatNumber(Number(current.unmapped_ok_qty), 4)}`);
    console.log("");
    console.log(`Rows that would become mapped: ${estimate.matchedRows}`);
    console.log(`OK rows that would become mapped: ${estimate.matchedOkRows}`);
    console.log(`OK qty that would become mapped: ${formatNumber(estimate.matchedOkQty, 4)}`);
    console.log(`Rows with conflicting planned aliases: ${estimate.conflictRows}`);
    console.log(`Remaining unmapped rows after planned aliases: ${estimate.remainingUnmappedRows}`);
    console.log(
      `Expected target coverage improvement: ${targetEligibleEstimate.matchedOkRows} OK rows / ${formatNumber(targetEligibleEstimate.matchedOkQty, 4)} OK qty would have an imported approved target in the effective window.`
    );

    printRows(
      "Top matching source values",
      estimate.topMatches.map((row) => ({
        sourceField: row.sourceField,
        sourceValue: row.sourceValue,
        entityCode: row.entityCode,
        rows: row.rows,
        okQty: formatNumber(row.okQty, 4)
      })),
      estimate.topMatches.length
    );
    printRows(
      "Remaining unmapped groups",
      estimate.remainingGroups.map((row) => ({
        sourceField: row.sourceField,
        sourceValue: row.sourceValue,
        rows: row.rows,
        okQty: formatNumber(row.okQty, 4)
      })),
      estimate.remainingGroups.length
    );
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown v1 master reconcile error";
  console.error(message);
  process.exitCode = 1;
});
