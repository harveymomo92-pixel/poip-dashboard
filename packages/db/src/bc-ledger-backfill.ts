import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const BC_LEDGER_BACKFILL_PREVIEW_DIR = ".tmp/bc-ledger-backfill-preview";

interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: T[] }>;
}

const previewFiles = [
  "summary.json",
  "domain-classification-preview.csv",
  "mapping-status-preview.csv",
  "dashboard-ready-preview.csv",
  "future-use-preview.csv",
  "source-gap-preview.csv",
  "data-quality-preview.csv",
  "risk-report.csv",
  "import-manifest.json"
] as const;

function cell(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: readonly string[], rows: readonly Record<string, unknown>[]) {
  return [
    headers.map(cell).join(","),
    ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))
  ].join("\n") + "\n";
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function ledgerClassificationSql() {
  return `
    with source_rows as (
      select
        le.id,
        le.source_system,
        le.entry_no,
        le.posting_date,
        le.document_no,
        le.entry_type,
        le.normalized_output_type,
        le.item_no,
        le.item_description,
        le.item_category_code,
        le.machine_center_no,
        le.entity_id as current_entity_id,
        le.prod_line_no,
        le.prod_line_description,
        le.quantity,
        le.uom,
        le.row_hash,
        le.raw_payload,
        upper(coalesce(le.entry_type, '')) as entry_type_u,
        upper(coalesce(le.normalized_output_type, '')) as normalized_output_type_u,
        upper(coalesce(le.item_no, '')) as item_no_u,
        upper(coalesce(le.item_description, '')) as item_description_u,
        upper(coalesce(le.item_category_code, '')) as item_category_code_u,
        upper(coalesce(le.uom, '')) as uom_u,
        upper(coalesce(le.document_no, '')) as document_no_u,
        upper(coalesce(le.raw_payload ->> 'Location_Code', le.raw_payload ->> 'LocationCode', le.raw_payload ->> 'location_code', '')) as location_u
      from bc_ledger_entries le
    ),
    evidence as (
      select
        *,
        concat_ws(' ', entry_type_u, normalized_output_type_u, item_no_u, item_description_u, item_category_code_u, uom_u, document_no_u, location_u) as evidence_u,
        nullif(trim(prod_line_description), '') as prod_line_description_clean,
        nullif(trim(prod_line_no), '') as prod_line_no_clean,
        nullif(trim(machine_center_no), '') as machine_center_no_clean
      from source_rows
    ),
    classified as (
      select
        *,
        case
          when entry_type_u = 'TRANSFER' or evidence_u like '%TRANSFER%' or evidence_u like '%PINDAH GUDANG%' then 'TRANSFER_OR_INVENTORY'
          when entry_type_u = 'CONSUMPTION' or evidence_u like '%CONSUMPTION%' or evidence_u like '%KONSUMSI%' or evidence_u like '%MATERIAL USAGE%' then 'CONSUMPTION_OR_MATERIAL_USAGE'
          when entry_type_u = 'SALE' or evidence_u like '%SALE%' or evidence_u like '%SALES%' or evidence_u like '%PENJUALAN%' then 'SALES'
          when entry_type_u = 'PURCHASE' or evidence_u like '%PURCHASE%' or evidence_u like '%RECEIVING%' or evidence_u like '%PEMBELIAN%' then 'PURCHASE_OR_RECEIVING'
          when evidence_u like '%SPAREPART%' or evidence_u like '%SPARE PART%' or evidence_u like '%MATERIAL%' or evidence_u like '%BAHAN BAKU%' or evidence_u like '%BIJI PLASTIK%' then 'SPAREPART_OR_MATERIAL'
          when item_no_u like 'RJ%' or evidence_u like '%REJECT%' or location_u = 'REJECT' then 'REJECT_ATTACHMENT'
          when evidence_u like '%SCRAP%' or evidence_u like '%AVALAN%' or evidence_u like '%GUMPALAN%' or evidence_u like '%SAPUAN%' or evidence_u like '%WASTE%' or evidence_u like '%AFVAL%' then 'SCRAP_OR_WASTE'
          when normalized_output_type_u = 'OK' and (entry_type_u = 'OUTPUT' or evidence_u like '%JADI%' or evidence_u like '%FINISHED%' or evidence_u like '%OK%') then 'PRODUCTION_OUTPUT'
          when entry_type_u = 'OUTPUT' and normalized_output_type_u = 'OK' then 'PRODUCTION_OUTPUT'
          when entry_type_u = '' and item_no_u = '' and item_description_u = '' and item_category_code_u = '' and document_no_u = '' then 'SOURCE_DATA_GAP'
          else 'UNKNOWN_REVIEW'
        end as bc_domain,
        case
          when prod_line_description_clean is not null then 'prod_line_description'
          when prod_line_no_clean is not null then 'prod_line_no'
          when machine_center_no_clean is not null then 'machine_center_no'
          else null
        end as source_identity_field,
        case
          when prod_line_description_clean is not null then prod_line_description_clean
          when prod_line_no_clean is not null then prod_line_no_clean
          when machine_center_no_clean is not null then machine_center_no_clean
          else null
        end as source_identity_value
      from evidence
    ),
    entity_lookup as (
      select upper(trim(entity_code)) as lookup_key, id as entity_id
      from master_entities
      where is_active = true and nullif(trim(entity_code), '') is not null
      union all
      select upper(trim(display_name)) as lookup_key, id as entity_id
      from master_entities
      where is_active = true and nullif(trim(display_name), '') is not null
      union all
      select upper(trim(line_code)) as lookup_key, id as entity_id
      from master_entities
      where is_active = true and nullif(trim(coalesce(line_code, '')), '') is not null
      union all
      select upper(trim(report_group)) as lookup_key, id as entity_id
      from master_entities
      where is_active = true and nullif(trim(coalesce(report_group, '')), '') is not null
      union all
      select upper(trim(alias)) as lookup_key, entity_id
      from master_entity_aliases
      where is_active = true and nullif(trim(alias), '') is not null
    ),
    entity_lookup_unique as (
      select lookup_key, min(entity_id::text)::uuid as entity_id
      from entity_lookup
      group by lookup_key
    ),
    resolved as (
      select
        c.*,
        entity_lookup.entity_id as resolved_entity_id
      from classified c
      left join entity_lookup_unique entity_lookup
        on c.source_identity_field in ('prod_line_description', 'prod_line_no')
       and entity_lookup.lookup_key = upper(trim(c.source_identity_value))
    ),
    enriched as (
      select
        *,
        bc_domain as movement_domain,
        case
          when bc_domain in ('PRODUCTION_OUTPUT', 'REJECT_ATTACHMENT', 'TRANSFER_OR_INVENTORY', 'CONSUMPTION_OR_MATERIAL_USAGE', 'SALES', 'PURCHASE_OR_RECEIVING', 'SPAREPART_OR_MATERIAL', 'SCRAP_OR_WASTE') then 'CLASSIFIED'
          when bc_domain = 'SOURCE_DATA_GAP' then 'BLOCKED_UNSAFE'
          else 'NEEDS_REVIEW'
        end as movement_status,
        case
          when bc_domain = 'SOURCE_DATA_GAP' then 'UNMAPPED_SOURCE_GAP'
          when bc_domain <> 'PRODUCTION_OUTPUT' and bc_domain not in ('SOURCE_DATA_GAP', 'UNKNOWN_REVIEW') then 'FUTURE_USE_ONLY'
          when bc_domain = 'PRODUCTION_OUTPUT' and source_identity_field = 'machine_center_no' then 'MAPPED_FALLBACK_REVIEW'
          when bc_domain = 'PRODUCTION_OUTPUT' and source_identity_field is null then 'UNMAPPED_SOURCE_GAP'
          when bc_domain = 'PRODUCTION_OUTPUT' and resolved_entity_id is not null then 'MAPPED_READY'
          when bc_domain = 'PRODUCTION_OUTPUT' then 'UNMAPPED_NEEDS_REVIEW'
          else 'UNMAPPED_NEEDS_REVIEW'
        end as mapping_status,
        case
          when bc_domain = 'PRODUCTION_OUTPUT' and source_identity_field in ('prod_line_description', 'prod_line_no') and resolved_entity_id is not null then true
          else false
        end as dashboard_ready,
        case
          when bc_domain in ('REJECT_ATTACHMENT', 'TRANSFER_OR_INVENTORY', 'CONSUMPTION_OR_MATERIAL_USAGE', 'SALES', 'PURCHASE_OR_RECEIVING', 'SPAREPART_OR_MATERIAL', 'SCRAP_OR_WASTE') then true
          else false
        end as future_use_ready,
        case
          when bc_domain = 'PRODUCTION_OUTPUT' then 'Production output evidence from BC ledger row.'
          when bc_domain = 'SOURCE_DATA_GAP' then 'Insufficient source evidence.'
          when bc_domain = 'UNKNOWN_REVIEW' then 'No deterministic domain rule matched.'
          else 'Deterministic future-use BC ledger domain.'
        end as classification_reason,
        case
          when bc_domain = 'SOURCE_DATA_GAP' then 'No safe OData identity source is available.'
          when bc_domain <> 'PRODUCTION_OUTPUT' and bc_domain not in ('SOURCE_DATA_GAP', 'UNKNOWN_REVIEW') then 'Future-use ledger row, not production output KPI.'
          when source_identity_field = 'machine_center_no' then 'Machine_Center_No is fallback evidence only and requires review.'
          when bc_domain = 'PRODUCTION_OUTPUT' and source_identity_field is null then 'Production output row has no OData identity source.'
          when bc_domain = 'PRODUCTION_OUTPUT' and resolved_entity_id is not null then 'Exact OData production line identity matched active master data.'
          when bc_domain = 'PRODUCTION_OUTPUT' then 'No exact active master entity or alias matched OData production line identity.'
          else 'Review required before mapping.'
        end as mapping_reason
      from resolved
    )
  `;
}

export async function createBcLedgerBackfillPreview(db: Queryable, outputFolder: string) {
  const generatedAt = new Date().toISOString();
  const aggregate = await db.query<{
    bc_domain: string;
    movement_status: string;
    mapping_status: string;
    source_identity_field: string | null;
    source_identity_value: string | null;
    dashboard_ready: boolean;
    future_use_ready: boolean;
    rows: string | number;
  }>(`${ledgerClassificationSql()}
    select
      bc_domain,
      movement_status,
      mapping_status,
      source_identity_field,
      source_identity_value,
      dashboard_ready,
      future_use_ready,
      count(*) as rows
    from enriched
    group by
      bc_domain,
      movement_status,
      mapping_status,
      source_identity_field,
      source_identity_value,
      dashboard_ready,
      future_use_ready
    order by rows desc, bc_domain asc`);

  const groupRows = (
    keys: readonly string[],
    sourceRows: readonly Record<string, unknown>[] = aggregate.rows
  ): Record<string, unknown>[] => {
    const grouped = new Map<string, Record<string, unknown>>();
    for (const row of sourceRows) {
      const key = keys.map((field) => String(row[field] ?? "")).join("\u001f");
      const current = grouped.get(key);
      if (current) {
        current.rows = numberValue(current.rows) + numberValue(row.rows);
      } else {
        grouped.set(key, Object.fromEntries([...keys.map((field) => [field, row[field]]), ["rows", numberValue(row.rows)]]));
      }
    }
    return [...grouped.values()].sort((a, b) => numberValue(b.rows) - numberValue(a.rows));
  };

  const domainRows = groupRows(["bc_domain", "movement_status"]);
  const mappingRows = groupRows(["mapping_status", "source_identity_field"]);
  const dashboardRows = groupRows(["dashboard_ready", "bc_domain", "mapping_status"]);
  const futureUseRowsData = groupRows(
    ["bc_domain", "future_use_ready"],
    aggregate.rows.filter((row) => row.future_use_ready)
  );
  const sourceGapRowsData = groupRows(
    ["source_identity_field", "source_identity_value", "bc_domain", "mapping_status"],
    aggregate.rows
      .filter((row) => row.bc_domain === "SOURCE_DATA_GAP" || row.mapping_status === "UNMAPPED_SOURCE_GAP")
      .map((row) => ({ ...row, source_identity_value: row.source_identity_value ?? "(blank)" }))
  ).slice(0, 200);
  const dataQualityRows = groupRows(
    ["issue_code", "mapping_status", "bc_domain"],
    aggregate.rows
      .filter(
        (row) =>
          ["MAPPED_FALLBACK_REVIEW", "UNMAPPED_SOURCE_GAP", "UNMAPPED_NEEDS_REVIEW", "BLOCKED_UNSAFE"].includes(
            row.mapping_status
          ) || ["SOURCE_DATA_GAP", "UNKNOWN_REVIEW"].includes(row.bc_domain)
      )
      .map((row) => ({
        ...row,
        issue_code:
          row.bc_domain === "SOURCE_DATA_GAP"
            ? "BC_LEDGER_SOURCE_GAP"
            : row.mapping_status === "MAPPED_FALLBACK_REVIEW"
              ? "BC_LEDGER_MACHINE_FALLBACK_REVIEW"
              : row.mapping_status === "UNMAPPED_NEEDS_REVIEW"
                ? "BC_LEDGER_UNMAPPED_REVIEW"
                : row.bc_domain === "UNKNOWN_REVIEW"
                  ? "BC_LEDGER_UNKNOWN_DOMAIN"
                  : "BC_LEDGER_INFO"
      }))
  );
  const riskRows = groupRows(
    ["risk_level", "bc_domain", "mapping_status"],
    aggregate.rows.map((row) => ({
      ...row,
      risk_level:
        ["BLOCKED_UNSAFE", "UNMAPPED_SOURCE_GAP"].includes(row.mapping_status) || row.bc_domain === "SOURCE_DATA_GAP"
          ? "BLOCKED"
          : ["MAPPED_FALLBACK_REVIEW", "UNMAPPED_NEEDS_REVIEW"].includes(row.mapping_status) ||
              row.bc_domain === "UNKNOWN_REVIEW"
            ? "HIGH"
            : "LOW"
    }))
  );

  const domainCounts = Object.fromEntries(domainRows.map((row) => [String(row.bc_domain), numberValue(row.rows)]));
  const mappingCounts: Record<string, number> = {};
  for (const row of mappingRows) {
    const key = String(row.mapping_status);
    mappingCounts[key] = (mappingCounts[key] ?? 0) + numberValue(row.rows);
  }
  const dashboardReadyRows = dashboardRows
    .filter((row) => row.dashboard_ready === true || row.dashboard_ready === "true")
    .reduce((total, row) => total + numberValue(row.rows), 0);
  const futureUseRows = futureUseRowsData.reduce((total, row) => total + numberValue(row.rows), 0);
  const sourceGapRows = sourceGapRowsData.reduce((total, row) => total + numberValue(row.rows), 0);
  const summary = {
    generatedAt,
    status: "OK",
    outputFolder,
    domainCounts,
    mappingCounts,
    dashboardReadyRows,
    futureUseRows,
    sourceGapRows,
    safety: {
      databaseUpdated: false,
      bcLedgerEntriesUpdated: false,
      productionTargetsUpdated: false,
      targetProfilesUpdated: false,
      aliasesUpdated: false,
      dashboardChanged: false
    }
  };

  await mkdir(outputFolder, { recursive: true });
  const files: Record<(typeof previewFiles)[number], string> = {
    "summary.json": `${JSON.stringify(summary, null, 2)}\n`,
    "domain-classification-preview.csv": csv(["bc_domain", "movement_status", "rows"], domainRows),
    "mapping-status-preview.csv": csv(["mapping_status", "source_identity_field", "rows"], mappingRows),
    "dashboard-ready-preview.csv": csv(["dashboard_ready", "bc_domain", "mapping_status", "rows"], dashboardRows),
    "future-use-preview.csv": csv(["bc_domain", "future_use_ready", "rows"], futureUseRowsData),
    "source-gap-preview.csv": csv(
      ["source_identity_field", "source_identity_value", "bc_domain", "mapping_status", "rows"],
      sourceGapRowsData
    ),
    "data-quality-preview.csv": csv(["issue_code", "mapping_status", "bc_domain", "rows"], dataQualityRows),
    "risk-report.csv": csv(["risk_level", "bc_domain", "mapping_status", "rows"], riskRows),
    "import-manifest.json": `${JSON.stringify({ generatedAt, files: previewFiles, summary }, null, 2)}\n`
  };
  await Promise.all(Object.entries(files).map(([file, content]) => writeFile(join(outputFolder, file), content)));
  return summary;
}

export async function applyBcLedgerBackfill(db: Queryable): Promise<{ readonly updatedRows: number }> {
  const result = await db.query<{ updated_rows: string | number }>(`
    ${ledgerClassificationSql()},
    updated as (
      update bc_ledger_entries le
      set
        bc_domain = enriched.bc_domain,
        movement_domain = enriched.movement_domain,
        movement_status = enriched.movement_status,
        mapping_status = enriched.mapping_status,
        source_identity_field = enriched.source_identity_field,
        source_identity_value = enriched.source_identity_value,
        dashboard_ready = enriched.dashboard_ready,
        future_use_ready = enriched.future_use_ready,
        classification_reason = enriched.classification_reason,
        mapping_reason = enriched.mapping_reason,
        classified_at = now(),
        mapped_at = now(),
        entity_id = case
          when enriched.mapping_status = 'MAPPED_READY' and enriched.resolved_entity_id is not null then enriched.resolved_entity_id
          else le.entity_id
        end,
        updated_at = now()
      from enriched
      where le.id = enriched.id
      returning le.id
    )
    select count(*) as updated_rows from updated
  `);
  return { updatedRows: numberValue(result.rows[0]?.updated_rows) };
}
