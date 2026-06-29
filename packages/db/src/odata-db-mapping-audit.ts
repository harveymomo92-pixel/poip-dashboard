import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ODATA_DB_MAPPING_AUDIT_OUTPUT_FOLDER = ".tmp/bc-odata-db-mapping-audit";

const SAFETY = {
  databaseUpdated: false,
  productionOutputsUpdated: false,
  productionTargetsUpdated: false,
  targetProfilesUpdated: false,
  aliasesUpdated: false,
  mappingApplied: false,
  dashboardChanged: false
} as const;

const REQUIRED_FILES = [
  "summary.json",
  "README.md",
  "current-db-table-inventory.csv",
  "production-output-column-inventory.csv",
  "production-output-odata-sample.csv",
  "odata-identity-coverage.csv",
  "current-entity-linkage.csv",
  "odata-vs-current-entity-mismatch.csv",
  "machine-center-fallback-only.csv",
  "source-gap.csv",
  "future-remap-recommendation.csv",
  "risk-report.csv",
  "import-manifest.json"
] as const;

export type IdentitySource = "GPROD_DESCRIPTION" | "GPROD_NO" | "MACHINE_CENTER_ONLY" | "SOURCE_GAP";
export type RecommendationCategory =
  | "KEEP_CURRENT_MAPPING"
  | "REMAP_TO_GPROD_DESCRIPTION"
  | "REMAP_TO_GPROD_NO_REVIEW"
  | "MACHINE_CENTER_FALLBACK_REVIEW"
  | "SOURCE_GAP_REVIEW"
  | "FUTURE_USE_ONLY"
  | "UNKNOWN_REVIEW";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: T[] }>;
}

export interface TableInventoryRow {
  readonly tableName: string;
  readonly rowCount: number;
}

export interface ColumnInventoryRow {
  readonly columnName: string;
  readonly dataType: string;
  readonly isNullable: string;
  readonly ordinalPosition: number;
}

export interface OutputGroupRow {
  readonly identitySource: IdentitySource;
  readonly identityValue: string | null;
  readonly gprodDescription: string | null;
  readonly gprodNo: string | null;
  readonly machineCenterNo: string | null;
  readonly currentEntityId: string | null;
  readonly currentEntityCode: string | null;
  readonly currentEntityName: string | null;
  readonly currentAliases: readonly string[];
  readonly normalizedOutputType: string | null;
  readonly rows: number;
  readonly minPostingDate: string | null;
  readonly maxPostingDate: string | null;
}

export interface OutputSampleRow {
  readonly id: string | null;
  readonly entryNo: string | null;
  readonly postingDate: string | null;
  readonly documentNo: string | null;
  readonly itemNo: string | null;
  readonly itemDescription: string | null;
  readonly gitemDescription: string | null;
  readonly description: string | null;
  readonly gprodDescription: string | null;
  readonly gprodNo: string | null;
  readonly machineCenterNo: string | null;
  readonly identitySource: IdentitySource;
  readonly identityValue: string | null;
  readonly currentEntityId: string | null;
  readonly currentEntityCode: string | null;
  readonly currentEntityName: string | null;
  readonly normalizedOutputType: string | null;
}

export interface AuditData {
  readonly generatedAt: string;
  readonly outputFolder: string;
  readonly databaseConnected: boolean;
  readonly tableInventory: readonly TableInventoryRow[];
  readonly productionOutputColumns: readonly ColumnInventoryRow[];
  readonly outputGroups: readonly OutputGroupRow[];
  readonly outputSample: readonly OutputSampleRow[];
}

export interface AuditSummary {
  readonly generatedAt: string;
  readonly status: "OK" | "ERROR";
  readonly outputFolder: string;
  readonly databaseConnected: boolean;
  readonly tablesInspected: number;
  readonly productionOutputRows: number;
  readonly hasProductionOutputsTable: boolean;
  readonly hasMasterEntitiesTable: boolean;
  readonly hasAliasTable: boolean;
  readonly hasProductionTargetsTable: boolean;
  readonly hasTargetProfilesTable: boolean;
  readonly odataIdentityCoverage: Record<IdentitySource, number>;
  readonly currentEntityCoverage: {
    readonly mappedRows: number;
    readonly unmappedRows: number;
    readonly distinctCurrentEntities: number;
  };
  readonly mismatchRows: number;
  readonly fallbackOnlyRows: number;
  readonly sourceGapRows: number;
  readonly recommendedRemapRows: number;
  readonly blockedRows: number;
  readonly nextRecommendedMilestone: string;
  readonly safety: typeof SAFETY;
}

export interface AuditReport {
  readonly summary: AuditSummary;
  readonly files: Readonly<Record<(typeof REQUIRED_FILES)[number], string>>;
}

function countValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function textValue(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeComparable(value: string | null): string | null {
  if (!value) return null;
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function chooseODataIdentity(input: {
  readonly gprodDescription?: string | null;
  readonly gprodNo?: string | null;
  readonly machineCenterNo?: string | null;
}): { readonly source: IdentitySource; readonly value: string | null } {
  const gprodDescription = textValue(input.gprodDescription);
  if (gprodDescription) return { source: "GPROD_DESCRIPTION", value: gprodDescription };
  const gprodNo = textValue(input.gprodNo);
  if (gprodNo) return { source: "GPROD_NO", value: gprodNo };
  const machineCenterNo = textValue(input.machineCenterNo);
  if (machineCenterNo) return { source: "MACHINE_CENTER_ONLY", value: machineCenterNo };
  return { source: "SOURCE_GAP", value: null };
}

function matchesCurrentEntity(row: OutputGroupRow): boolean {
  const identity = normalizeComparable(row.identityValue);
  if (!identity || !row.currentEntityId) return false;
  const currentValues = [
    row.currentEntityCode,
    row.currentEntityName,
    ...row.currentAliases
  ].map((value) => normalizeComparable(value));
  return currentValues.includes(identity);
}

function recommendationFor(row: OutputGroupRow): RecommendationCategory {
  if (row.normalizedOutputType === "OTHER") return "FUTURE_USE_ONLY";
  if (row.identitySource === "SOURCE_GAP") return "SOURCE_GAP_REVIEW";
  if (row.identitySource === "MACHINE_CENTER_ONLY") return "MACHINE_CENTER_FALLBACK_REVIEW";
  if (matchesCurrentEntity(row)) return "KEEP_CURRENT_MAPPING";
  if (row.identitySource === "GPROD_DESCRIPTION") return "REMAP_TO_GPROD_DESCRIPTION";
  if (row.identitySource === "GPROD_NO") return "REMAP_TO_GPROD_NO_REVIEW";
  return "UNKNOWN_REVIEW";
}

function riskFor(category: RecommendationCategory, mismatched: boolean): RiskLevel {
  if (category === "SOURCE_GAP_REVIEW") return "BLOCKED";
  if (category === "MACHINE_CENTER_FALLBACK_REVIEW") return "HIGH";
  if (category === "REMAP_TO_GPROD_NO_REVIEW") return "HIGH";
  if (category === "UNKNOWN_REVIEW") return "HIGH";
  if (mismatched) return "HIGH";
  if (category === "REMAP_TO_GPROD_DESCRIPTION") return "MEDIUM";
  return "LOW";
}

function hasTable(data: AuditData, tableName: string): boolean {
  return data.tableInventory.some((table) => table.tableName === tableName);
}

function csvCell(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: readonly string[], rows: readonly object[]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => {
      const values = row as Record<string, unknown>;
      return headers.map((header) => csvCell(values[header])).join(",");
    })
  ].join("\n") + "\n";
}

function groupKey(values: readonly unknown[]): string {
  return values.map((value) => String(value ?? "")).join("\u001f");
}

function sortedRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  countField = "rows"
): readonly T[] {
  return [...rows].sort((left, right) => {
    const countDiff = countValue(right[countField]) - countValue(left[countField]);
    if (countDiff !== 0) return countDiff;
    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  });
}

function buildRecommendations(data: AuditData) {
  return data.outputGroups.map((row) => {
    const currentMatchesOData = matchesCurrentEntity(row);
    const hasCurrentEntity = Boolean(row.currentEntityId);
    const mismatched =
      hasCurrentEntity &&
      row.identitySource !== "SOURCE_GAP" &&
      !currentMatchesOData &&
      row.normalizedOutputType !== "OTHER";
    const recommendation = recommendationFor(row);
    const riskLevel = riskFor(recommendation, mismatched);
    return {
      identity_source: row.identitySource,
      identity_value: row.identityValue,
      current_entity_id: row.currentEntityId,
      current_entity_code: row.currentEntityCode,
      current_entity_name: row.currentEntityName,
      current_aliases: row.currentAliases.join("|"),
      normalized_output_type: row.normalizedOutputType,
      rows: row.rows,
      min_posting_date: row.minPostingDate,
      max_posting_date: row.maxPostingDate,
      current_matches_odata: currentMatchesOData,
      mismatched,
      recommendation,
      risk_level: riskLevel,
      rationale: recommendationRationale(recommendation, mismatched)
    };
  });
}

function recommendationRationale(category: RecommendationCategory, mismatched: boolean): string {
  if (mismatched) return "Current entity does not match the highest-precedence OData identity evidence.";
  if (category === "KEEP_CURRENT_MAPPING") return "Current entity matches reviewed OData identity evidence.";
  if (category === "REMAP_TO_GPROD_DESCRIPTION") {
    return "gProdOrRotLine_Description is present and has highest OData identity precedence.";
  }
  if (category === "REMAP_TO_GPROD_NO_REVIEW") {
    return "gProdOrRotLine_No is present but requires review because description is blank.";
  }
  if (category === "MACHINE_CENTER_FALLBACK_REVIEW") {
    return "Only Machine_Center_No is available; it is fallback evidence and must not become primary without review.";
  }
  if (category === "SOURCE_GAP_REVIEW") return "No OData identity source is available.";
  if (category === "FUTURE_USE_ONLY") return "Row group is outside the current normalized output KPI scope.";
  return "Insufficient evidence for an automatic recommendation.";
}

export function buildAuditReport(data: AuditData): AuditReport {
  const recommendations = buildRecommendations(data);
  const mismatches = recommendations.filter((row) => row.mismatched);
  const fallbackOnly = recommendations.filter((row) => row.identity_source === "MACHINE_CENTER_ONLY");
  const sourceGaps = recommendations.filter((row) => row.identity_source === "SOURCE_GAP");
  const remapRows = recommendations
    .filter((row) =>
      ["REMAP_TO_GPROD_DESCRIPTION", "REMAP_TO_GPROD_NO_REVIEW", "MACHINE_CENTER_FALLBACK_REVIEW"].includes(
        String(row.recommendation)
      )
    )
    .reduce((sum, row) => sum + countValue(row.rows), 0);
  const coverage: Record<IdentitySource, number> = {
    GPROD_DESCRIPTION: 0,
    GPROD_NO: 0,
    MACHINE_CENTER_ONLY: 0,
    SOURCE_GAP: 0
  };
  for (const row of data.outputGroups) {
    coverage[row.identitySource] += row.rows;
  }

  const mappedRows = data.outputGroups
    .filter((row) => row.currentEntityId)
    .reduce((sum, row) => sum + row.rows, 0);
  const productionOutputRows = data.outputGroups.reduce((sum, row) => sum + row.rows, 0);
  const distinctCurrentEntities = new Set(
    data.outputGroups.map((row) => row.currentEntityId).filter(Boolean)
  ).size;
  const summary: AuditSummary = {
    generatedAt: data.generatedAt,
    status: "OK",
    outputFolder: data.outputFolder,
    databaseConnected: data.databaseConnected,
    tablesInspected: data.tableInventory.length,
    productionOutputRows,
    hasProductionOutputsTable: hasTable(data, "bc_ledger_entries"),
    hasMasterEntitiesTable: hasTable(data, "master_entities"),
    hasAliasTable: hasTable(data, "master_entity_aliases"),
    hasProductionTargetsTable: hasTable(data, "production_targets"),
    hasTargetProfilesTable: hasTable(data, "target_profiles"),
    odataIdentityCoverage: coverage,
    currentEntityCoverage: {
      mappedRows,
      unmappedRows: productionOutputRows - mappedRows,
      distinctCurrentEntities
    },
    mismatchRows: mismatches.reduce((sum, row) => sum + countValue(row.rows), 0),
    fallbackOnlyRows: fallbackOnly.reduce((sum, row) => sum + countValue(row.rows), 0),
    sourceGapRows: sourceGaps.reduce((sum, row) => sum + countValue(row.rows), 0),
    recommendedRemapRows: remapRows,
    blockedRows: recommendations
      .filter((row) => row.risk_level === "BLOCKED")
      .reduce((sum, row) => sum + countValue(row.rows), 0),
    nextRecommendedMilestone: "P0-clean-2: OData DB Remap Dry-Run",
    safety: SAFETY
  };

  const recommendationCounts = new Map<string, number>();
  const riskCounts = new Map<string, number>();
  for (const row of recommendations) {
    recommendationCounts.set(
      String(row.recommendation),
      (recommendationCounts.get(String(row.recommendation)) ?? 0) + countValue(row.rows)
    );
    riskCounts.set(String(row.risk_level), (riskCounts.get(String(row.risk_level)) ?? 0) + countValue(row.rows));
  }

  const tableInventory = sortedRows(
    data.tableInventory.map((row) => ({
      table_name: row.tableName,
      row_count: row.rowCount,
      inspected: true
    })),
    "row_count"
  );
  const outputColumns = data.productionOutputColumns.map((row) => ({
    column_name: row.columnName,
    data_type: row.dataType,
    is_nullable: row.isNullable,
    ordinal_position: row.ordinalPosition,
    odata_mapping_relevance: columnRelevance(row.columnName)
  }));
  const identityCoverage = aggregateCoverage(data.outputGroups);
  const entityLinkage = aggregateEntityLinkage(data.outputGroups);
  const riskReport = sortedRows(
    recommendations.map((row) => ({
      risk_level: row.risk_level,
      recommendation: row.recommendation,
      identity_source: row.identity_source,
      identity_value: row.identity_value,
      current_entity_code: row.current_entity_code,
      rows: row.rows,
      rationale: row.rationale
    }))
  );

  return {
    summary,
    files: {
      "summary.json": `${JSON.stringify(summary, null, 2)}\n`,
      "README.md": buildReadme(summary),
      "current-db-table-inventory.csv": csv(["table_name", "row_count", "inspected"], tableInventory),
      "production-output-column-inventory.csv": csv(
        ["column_name", "data_type", "is_nullable", "ordinal_position", "odata_mapping_relevance"],
        outputColumns
      ),
      "production-output-odata-sample.csv": csv(
        [
          "id",
          "entryNo",
          "postingDate",
          "documentNo",
          "itemNo",
          "itemDescription",
          "gitemDescription",
          "description",
          "gprodDescription",
          "gprodNo",
          "machineCenterNo",
          "identitySource",
          "identityValue",
          "currentEntityId",
          "currentEntityCode",
          "currentEntityName",
          "normalizedOutputType"
        ],
        data.outputSample
      ),
      "odata-identity-coverage.csv": csv(
        [
          "identity_source",
          "identity_value",
          "rows",
          "mapped_rows",
          "unmapped_rows",
          "distinct_current_entities",
          "min_posting_date",
          "max_posting_date"
        ],
        identityCoverage
      ),
      "current-entity-linkage.csv": csv(
        [
          "current_entity_id",
          "current_entity_code",
          "current_entity_name",
          "rows",
          "gprod_description_rows",
          "gprod_no_rows",
          "machine_center_only_rows",
          "source_gap_rows"
        ],
        entityLinkage
      ),
      "odata-vs-current-entity-mismatch.csv": csv(
        [
          "identity_source",
          "identity_value",
          "current_entity_id",
          "current_entity_code",
          "current_entity_name",
          "current_aliases",
          "normalized_output_type",
          "rows",
          "min_posting_date",
          "max_posting_date",
          "recommendation",
          "risk_level",
          "rationale"
        ],
        sortedRows(mismatches)
      ),
      "machine-center-fallback-only.csv": csv(
        [
          "identity_source",
          "identity_value",
          "current_entity_id",
          "current_entity_code",
          "current_entity_name",
          "normalized_output_type",
          "rows",
          "min_posting_date",
          "max_posting_date",
          "recommendation",
          "risk_level",
          "rationale"
        ],
        sortedRows(fallbackOnly)
      ),
      "source-gap.csv": csv(
        [
          "identity_source",
          "identity_value",
          "current_entity_id",
          "current_entity_code",
          "current_entity_name",
          "normalized_output_type",
          "rows",
          "min_posting_date",
          "max_posting_date",
          "recommendation",
          "risk_level",
          "rationale"
        ],
        sortedRows(sourceGaps)
      ),
      "future-remap-recommendation.csv": csv(
        [
          "identity_source",
          "identity_value",
          "current_entity_id",
          "current_entity_code",
          "current_entity_name",
          "current_aliases",
          "normalized_output_type",
          "rows",
          "min_posting_date",
          "max_posting_date",
          "current_matches_odata",
          "recommendation",
          "risk_level",
          "rationale"
        ],
        sortedRows(recommendations)
      ),
      "risk-report.csv": csv(["risk_level", "recommendation", "identity_source", "identity_value", "current_entity_code", "rows", "rationale"], riskReport),
      "import-manifest.json": `${JSON.stringify(
        {
          generatedAt: data.generatedAt,
          outputFolder: data.outputFolder,
          files: REQUIRED_FILES,
          recommendationCounts: Object.fromEntries(recommendationCounts),
          riskCounts: Object.fromEntries(riskCounts),
          nextRecommendedMilestone: summary.nextRecommendedMilestone,
          safety: SAFETY
        },
        null,
        2
      )}\n`
    }
  };
}

function columnRelevance(columnName: string): string {
  if (columnName === "prod_line_description") return "normalized gProdOrRotLine_Description candidate";
  if (columnName === "prod_line_no") return "normalized gProdOrRotLine_No candidate";
  if (columnName === "machine_center_no") return "Machine_Center_No fallback evidence";
  if (columnName === "entity_id") return "current entity linkage";
  if (columnName === "raw_payload") return "raw OData evidence";
  if (columnName === "item_description") return "item description fallback";
  return "";
}

function aggregateCoverage(rows: readonly OutputGroupRow[]) {
  const groups = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = groupKey([row.identitySource, row.identityValue]);
    const existing = groups.get(key);
    if (existing) {
      existing.rows = countValue(existing.rows) + row.rows;
      existing.mapped_rows = countValue(existing.mapped_rows) + (row.currentEntityId ? row.rows : 0);
      existing.unmapped_rows = countValue(existing.unmapped_rows) + (row.currentEntityId ? 0 : row.rows);
      const entities = new Set(String(existing.distinct_current_entities_list ?? "").split("|").filter(Boolean));
      if (row.currentEntityId) entities.add(row.currentEntityId);
      existing.distinct_current_entities = entities.size;
      existing.distinct_current_entities_list = [...entities].join("|");
      existing.min_posting_date = minText(textValue(existing.min_posting_date), row.minPostingDate);
      existing.max_posting_date = maxText(textValue(existing.max_posting_date), row.maxPostingDate);
      continue;
    }
    groups.set(key, {
      identity_source: row.identitySource,
      identity_value: row.identityValue,
      rows: row.rows,
      mapped_rows: row.currentEntityId ? row.rows : 0,
      unmapped_rows: row.currentEntityId ? 0 : row.rows,
      distinct_current_entities: row.currentEntityId ? 1 : 0,
      distinct_current_entities_list: row.currentEntityId ?? "",
      min_posting_date: row.minPostingDate,
      max_posting_date: row.maxPostingDate
    });
  }
  return sortedRows(
    [...groups.values()].map(({ distinct_current_entities_list: _omit, ...row }) => row)
  );
}

function aggregateEntityLinkage(rows: readonly OutputGroupRow[]) {
  const groups = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = row.currentEntityId ?? "(unmapped)";
    const existing =
      groups.get(key) ??
      {
        current_entity_id: row.currentEntityId,
        current_entity_code: row.currentEntityCode,
        current_entity_name: row.currentEntityName,
        rows: 0,
        gprod_description_rows: 0,
        gprod_no_rows: 0,
        machine_center_only_rows: 0,
        source_gap_rows: 0
      };
    existing.rows = countValue(existing.rows) + row.rows;
    if (row.identitySource === "GPROD_DESCRIPTION") {
      existing.gprod_description_rows = countValue(existing.gprod_description_rows) + row.rows;
    } else if (row.identitySource === "GPROD_NO") {
      existing.gprod_no_rows = countValue(existing.gprod_no_rows) + row.rows;
    } else if (row.identitySource === "MACHINE_CENTER_ONLY") {
      existing.machine_center_only_rows = countValue(existing.machine_center_only_rows) + row.rows;
    } else {
      existing.source_gap_rows = countValue(existing.source_gap_rows) + row.rows;
    }
    groups.set(key, existing);
  }
  return sortedRows([...groups.values()]);
}

function minText(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

function maxText(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function buildReadme(summary: AuditSummary): string {
  return `# BC OData DB Mapping Alignment Audit

Generated at: ${summary.generatedAt}

This folder is produced by:

\`\`\`bash
pnpm bc:odata-db-mapping-audit
\`\`\`

## Purpose

This is an audit only. It inspects the current database and compares existing entity/mapping usage against Business Central OData identity evidence.

It does not generate final mapping yet. It does not apply DB changes. It is meant to align existing DB data with OData identity rules before any remap.

## Identity Precedence

1. \`gProdOrRotLine_Description\`
2. \`gProdOrRotLine_No\`
3. \`Machine_Center_No\` as fallback evidence only

\`Machine_Center_No\` must not become primary identity unless explicitly reviewed later.

## Item Description Precedence

1. \`gItem_Description\`
2. \`Description\`

## Safety

\`\`\`json
${JSON.stringify(summary.safety, null, 2)}
\`\`\`

## Next Step

Next step is ${summary.nextRecommendedMilestone}.

User review remains required before any apply.
`;
}

export async function writeAuditReport(report: AuditReport, outputFolder: string): Promise<void> {
  await mkdir(outputFolder, { recursive: true });
  await Promise.all(
    Object.entries(report.files).map(([filename, content]) => writeFile(join(outputFolder, filename), content))
  );
}

export async function collectAuditData(db: Queryable, outputFolder = ODATA_DB_MAPPING_AUDIT_OUTPUT_FOLDER): Promise<AuditData> {
  const tableInventory = await getTableInventory(db);
  const tableNames = new Set(tableInventory.map((table) => table.tableName));
  const hasOutputs = tableNames.has("bc_ledger_entries");
  const productionOutputColumns = hasOutputs ? await getProductionOutputColumns(db) : [];
  const outputGroups = hasOutputs ? await getOutputGroups(db, tableNames) : [];
  const outputSample = hasOutputs ? await getOutputSample(db, tableNames) : [];
  return {
    generatedAt: new Date().toISOString(),
    outputFolder,
    databaseConnected: true,
    tableInventory,
    productionOutputColumns,
    outputGroups,
    outputSample
  };
}

async function getTableInventory(db: Queryable): Promise<TableInventoryRow[]> {
  const tables = await db.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `
  );
  const inventory: TableInventoryRow[] = [];
  for (const table of tables.rows) {
    const tableName = textValue(table.table_name);
    if (!tableName || !/^[a-z_][a-z0-9_]*$/i.test(tableName)) continue;
    const count = await db.query<{ row_count: string | number }>(`select count(*) as row_count from "${tableName}"`);
    inventory.push({ tableName, rowCount: countValue(count.rows[0]?.row_count) });
  }
  return inventory;
}

async function getProductionOutputColumns(db: Queryable): Promise<ColumnInventoryRow[]> {
  const result = await db.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    ordinal_position: string | number;
  }>(
    `
      select column_name, data_type, is_nullable, ordinal_position
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bc_ledger_entries'
      order by ordinal_position
    `
  );
  return result.rows.map((row) => ({
    columnName: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable,
    ordinalPosition: countValue(row.ordinal_position)
  }));
}

async function getOutputGroups(db: Queryable, tableNames: ReadonlySet<string>): Promise<OutputGroupRow[]> {
  const hasMasterEntities = tableNames.has("master_entities");
  const hasAliases = tableNames.has("master_entity_aliases");
  const result = await db.query<Record<string, unknown>>(buildOutputGroupSql(hasMasterEntities, hasAliases));
  return result.rows.map((row) => ({
    identitySource: row.identity_source as IdentitySource,
    identityValue: textValue(row.identity_value),
    gprodDescription: textValue(row.gprod_description),
    gprodNo: textValue(row.gprod_no),
    machineCenterNo: textValue(row.machine_center_no),
    currentEntityId: textValue(row.current_entity_id),
    currentEntityCode: textValue(row.current_entity_code),
    currentEntityName: textValue(row.current_entity_name),
    currentAliases: textValue(row.current_aliases)?.split("|").filter(Boolean) ?? [],
    normalizedOutputType: textValue(row.normalized_output_type),
    rows: countValue(row.rows),
    minPostingDate: textValue(row.min_posting_date),
    maxPostingDate: textValue(row.max_posting_date)
  }));
}

async function getOutputSample(db: Queryable, tableNames: ReadonlySet<string>): Promise<OutputSampleRow[]> {
  const hasMasterEntities = tableNames.has("master_entities");
  const result = await db.query<Record<string, unknown>>(buildOutputSampleSql(hasMasterEntities));
  return result.rows.map((row) => ({
    id: textValue(row.id),
    entryNo: textValue(row.entry_no),
    postingDate: textValue(row.posting_date),
    documentNo: textValue(row.document_no),
    itemNo: textValue(row.item_no),
    itemDescription: textValue(row.item_description),
    gitemDescription: textValue(row.gitem_description),
    description: textValue(row.description),
    gprodDescription: textValue(row.gprod_description),
    gprodNo: textValue(row.gprod_no),
    machineCenterNo: textValue(row.machine_center_no),
    identitySource: row.identity_source as IdentitySource,
    identityValue: textValue(row.identity_value),
    currentEntityId: textValue(row.current_entity_id),
    currentEntityCode: textValue(row.current_entity_code),
    currentEntityName: textValue(row.current_entity_name),
    normalizedOutputType: textValue(row.normalized_output_type)
  }));
}

function odataEvidenceCte() {
  return `
    with evidence as (
      select
        po.id::text,
        po.entry_no::text,
        po.posting_date::text,
        po.document_no,
        po.item_no,
        po.item_description,
        nullif(trim(coalesce(po.raw_payload ->> 'gItem_Description', po.raw_payload ->> 'gItemDescription')), '') as gitem_description,
        nullif(trim(coalesce(po.raw_payload ->> 'Description', po.raw_payload ->> 'description')), '') as description,
        nullif(trim(coalesce(po.raw_payload ->> 'gProdOrRotLine_Description', po.raw_payload ->> 'gProdOrRotLineDescription', po.prod_line_description)), '') as gprod_description,
        nullif(trim(coalesce(po.raw_payload ->> 'gProdOrRotLine_No', po.raw_payload ->> 'gProdOrRotLineNo', po.prod_line_no)), '') as gprod_no,
        nullif(trim(coalesce(po.raw_payload ->> 'Machine_Center_No', po.raw_payload ->> 'MachineCenterNo', po.machine_center_no)), '') as machine_center_no,
        po.entity_id::text as current_entity_id,
        po.normalized_output_type
      from bc_ledger_entries po
    ),
    classified as (
      select
        *,
        case
          when gprod_description is not null then 'GPROD_DESCRIPTION'
          when gprod_no is not null then 'GPROD_NO'
          when machine_center_no is not null then 'MACHINE_CENTER_ONLY'
          else 'SOURCE_GAP'
        end as identity_source,
        case
          when gprod_description is not null then gprod_description
          when gprod_no is not null then gprod_no
          when machine_center_no is not null then machine_center_no
          else null
        end as identity_value
      from evidence
    )
  `;
}

function buildOutputGroupSql(hasMasterEntities: boolean, hasAliases: boolean): string {
  const entityCode = hasMasterEntities ? "me.entity_code" : "null::text";
  const entityName = hasMasterEntities ? "me.display_name" : "null::text";
  const entityJoin = hasMasterEntities
    ? "left join master_entities me on me.id::text = c.current_entity_id"
    : "";
  const aliasSelect = hasAliases && hasMasterEntities
    ? "coalesce(string_agg(distinct mea.alias, '|' order by mea.alias), '')"
    : "''::text";
  const aliasJoin =
    hasAliases && hasMasterEntities
      ? "left join master_entity_aliases mea on mea.entity_id = me.id and mea.is_active = true"
      : "";
  return `
    ${odataEvidenceCte()}
    select
      c.identity_source,
      c.identity_value,
      c.gprod_description,
      c.gprod_no,
      c.machine_center_no,
      c.current_entity_id,
      ${entityCode} as current_entity_code,
      ${entityName} as current_entity_name,
      ${aliasSelect} as current_aliases,
      c.normalized_output_type,
      count(distinct c.id) as rows,
      min(c.posting_date)::text as min_posting_date,
      max(c.posting_date)::text as max_posting_date
    from classified c
    ${entityJoin}
    ${aliasJoin}
    group by
      c.identity_source,
      c.identity_value,
      c.gprod_description,
      c.gprod_no,
      c.machine_center_no,
      c.current_entity_id,
      ${entityCode},
      ${entityName},
      c.normalized_output_type
    order by rows desc, c.identity_source, c.identity_value nulls last
  `;
}

function buildOutputSampleSql(hasMasterEntities: boolean): string {
  const entityCode = hasMasterEntities ? "me.entity_code" : "null::text";
  const entityName = hasMasterEntities ? "me.display_name" : "null::text";
  const entityJoin = hasMasterEntities
    ? "left join master_entities me on me.id::text = c.current_entity_id"
    : "";
  return `
    ${odataEvidenceCte()}
    select
      c.id,
      c.entry_no,
      c.posting_date,
      c.document_no,
      c.item_no,
      c.item_description,
      c.gitem_description,
      c.description,
      c.gprod_description,
      c.gprod_no,
      c.machine_center_no,
      c.identity_source,
      c.identity_value,
      c.current_entity_id,
      ${entityCode} as current_entity_code,
      ${entityName} as current_entity_name,
      c.normalized_output_type
    from classified c
    ${entityJoin}
    order by c.posting_date desc nulls last, c.entry_no desc nulls last, c.id
    limit 500
  `;
}
