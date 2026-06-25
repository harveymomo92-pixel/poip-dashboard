import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../packages/db/src/client.js";
import {
  buildV1ImportPlan,
  containsSecretLikeText,
  estimateV1Reconcile,
  type V1ImportPlan,
  type V1OutputSourceRow,
  type V1ReconcileEstimate
} from "../packages/domain/src/master-data/v1-import.js";

export const SOURCE_SYSTEM = "business-central";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");
export const inspectionDir = path.join(repoRoot, ".tmp", "v1-inspection");

export const sourceFiles = {
  sqliteDb: path.join(inspectionDir, "ppic-dashboard.db"),
  masterTargetJson: path.join(inspectionDir, "master-entity-target-produksi.json"),
  masterTargetSummaryJson: path.join(inspectionDir, "master-entity-target-summary.json"),
  masterTargetCsv: path.join(inspectionDir, "master_entity_target_produksi.csv"),
  machineCsv: path.join(inspectionDir, "entity_machines_itemledgerppic.csv"),
  itemLedgerCsv: path.join(inspectionDir, "itemledgerppic_output_last3months.csv")
} as const;

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function optionalDateEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  return value;
}

function readRequired(filePath: string): string {
  if (!existsSync(filePath)) throw new Error(`Missing v1 export file: ${path.relative(repoRoot, filePath)}`);
  return readFileSync(filePath, "utf8");
}

export function loadLocalV1Plan(): V1ImportPlan {
  const plan = buildV1ImportPlan({
    masterTargetCsvText: readRequired(sourceFiles.masterTargetCsv),
    machineCsvText: existsSync(sourceFiles.machineCsv) ? readFileSync(sourceFiles.machineCsv, "utf8") : undefined,
    itemLedgerCsvText: existsSync(sourceFiles.itemLedgerCsv) ? readFileSync(sourceFiles.itemLedgerCsv, "utf8") : undefined
  });
  if (containsSecretLikeText(plan)) {
    throw new Error("Refusing to print/import v1 plan because it contains secret-like text");
  }
  return plan;
}

export function createV2Database() {
  return createDatabase({ connectionString: requireEnv("DATABASE_URL") });
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function printRows(title: string, rows: readonly Record<string, unknown>[], limit = 10): void {
  console.log("");
  console.log(title);
  if (rows.length === 0) {
    console.log("- none");
    return;
  }
  for (const row of rows.slice(0, limit)) {
    console.log(`- ${Object.entries(row).map(([key, value]) => `${key}=${String(value)}`).join("; ")}`);
  }
}

export async function loadV2OutputRows(pool: ReturnType<typeof createDatabase>["pool"]): Promise<V1OutputSourceRow[]> {
  const result = await pool.query<{
    id: string;
    source_system: string;
    entity_id: string | null;
    machine_center_no: string | null;
    prod_line_no: string | null;
    prod_line_description: string | null;
    posting_date: string | null;
    item_no: string | null;
    uom: string | null;
    normalized_output_type: string | null;
    quantity: string | number | null;
  }>(
    `
      select id::text,
             source_system,
             entity_id::text,
             posting_date::text,
             machine_center_no,
             prod_line_no,
             prod_line_description,
             item_no,
             uom,
             normalized_output_type,
             quantity
      from production_outputs
      where source_system = $1
    `,
    [SOURCE_SYSTEM]
  );
  return result.rows.map((row) => ({
    id: row.id,
    sourceSystem: row.source_system,
    entityId: row.entity_id,
    postingDate: row.posting_date,
    machineCenterNo: row.machine_center_no,
    prodLineNo: row.prod_line_no,
    prodLineDescription: row.prod_line_description,
    itemNo: row.item_no,
    uom: row.uom,
    normalizedOutputType: row.normalized_output_type,
    quantity: row.quantity === null ? null : Number(row.quantity)
  }));
}

export async function estimateAgainstV2(pool: ReturnType<typeof createDatabase>["pool"], plan: V1ImportPlan): Promise<V1ReconcileEstimate> {
  const rows = await loadV2OutputRows(pool);
  return estimateV1Reconcile(plan, rows, Number(process.env.V1_RECONCILE_LIMIT ?? 15) || 15);
}

export function printPlanSummary(plan: V1ImportPlan): void {
  console.log(`Raw v1 master target rows: ${plan.stats.rawMasterRows}`);
  console.log(`Planned entities: ${plan.entities.length}`);
  console.log(`Planned aliases: ${plan.aliases.length}`);
  console.log(`Planned targets: ${plan.targets.length}`);
  console.log(`Planned item conversions: ${plan.conversions.length}`);
  console.log(`Conflicts/warnings: ${plan.conflicts.length}`);
}

export function topAliases(plan: V1ImportPlan, sourceField: string, limit = 10): Record<string, unknown>[] {
  return plan.aliases
    .filter((alias) => alias.sourceField === sourceField)
    .slice()
    .sort((left, right) => right.evidenceQuantity - left.evidenceQuantity || right.evidenceRows - left.evidenceRows)
    .slice(0, limit)
    .map((alias) => ({
      alias: alias.alias,
      sourceField: alias.sourceField,
      entityCode: alias.entityCode,
      evidenceRows: alias.evidenceRows,
      evidenceQty: formatNumber(alias.evidenceQuantity, 0)
    }));
}

export function topTargets(plan: V1ImportPlan, limit = 10): Record<string, unknown>[] {
  return plan.entities
    .slice()
    .sort((left, right) => right.dailyTargetQty - left.dailyTargetQty)
    .slice(0, limit)
    .map((entity) => ({
      entityCode: entity.entityCode,
      area: entity.area,
      targetType: entity.targetLabel,
      dailyTargetQty: entity.dailyTargetQty,
      minAchievementPct: entity.minAchievementPct,
      rejectTargetPct: entity.rejectTargetPct ?? "N/A"
    }));
}
