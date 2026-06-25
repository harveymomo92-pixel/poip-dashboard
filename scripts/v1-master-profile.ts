import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import {
  createV2Database,
  estimateAgainstV2,
  formatNumber,
  loadLocalV1Plan,
  printPlanSummary,
  printRows,
  repoRoot,
  sourceFiles,
  topAliases,
  topTargets
} from "./v1-master-lib.js";

function sqliteSummary(): Record<string, unknown>[] {
  const db = new DatabaseSync(sourceFiles.sqliteDb, { readOnly: true });
  try {
    const tables = db.prepare("select name from sqlite_master where type = 'table' order by name").all() as Array<{ name: string }>;
    return tables.map((table) => ({
      table: table.name,
      rows: (db.prepare(`select count(*) as count from ${table.name}`).get() as { count: number }).count
    }));
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const plan = loadLocalV1Plan();
  console.log("V1 master data profile");
  console.log(`Inspection dir: ${path.relative(repoRoot, path.dirname(sourceFiles.masterTargetCsv))}`);
  console.log(`SQLite source: ${path.relative(repoRoot, sourceFiles.sqliteDb)}`);
  printPlanSummary(plan);

  printRows("V1 SQLite tables", sqliteSummary(), 20);
  printRows("Top machine aliases planned", topAliases(plan, "machine_center_no", 12), 12);
  printRows("Top production-line aliases planned", topAliases(plan, "prod_line_description", 12), 12);
  printRows("Top target entities", topTargets(plan, 12), 12);
  printRows(
    "Possible conflicts",
    plan.conflicts.slice(0, 20).map((conflict) => ({
      kind: conflict.kind,
      sourceField: conflict.sourceField ?? "",
      sourceValue: conflict.sourceValue,
      entityCodes: conflict.entityCodes?.join(" | ") ?? "",
      details: conflict.details ?? ""
    })),
    20
  );
  printRows(
    "Top item conversions",
    plan.conversions.slice(0, 12).map((conversion) => ({
      itemNo: conversion.itemNo,
      uom: conversion.uom,
      grossWeightPerPcs: conversion.grossWeightPerPcs,
      evidenceRows: conversion.evidenceRows
    })),
    12
  );

  const database = createV2Database();
  try {
    const estimate = await estimateAgainstV2(database.pool, plan);
    console.log("");
    console.log("V2 overlap estimate");
    console.log(`Rows that would become mapped: ${estimate.matchedRows}`);
    console.log(`OK rows that would become mapped: ${estimate.matchedOkRows}`);
    console.log(`OK quantity that would become mapped: ${formatNumber(estimate.matchedOkQty, 4)}`);
    console.log(`Rows with conflicting planned aliases: ${estimate.conflictRows}`);
    console.log(`Rows remaining unmapped after planned aliases: ${estimate.remainingUnmappedRows}`);
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown v1 master profile error";
  console.error(message);
  process.exitCode = 1;
});
