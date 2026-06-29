import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyBcLedgerBackfill,
  createBcLedgerBackfillPreview,
  ledgerClassificationSql
} from "./bc-ledger-backfill.js";

type PreviewDb = Parameters<typeof createBcLedgerBackfillPreview>[0];
type ApplyDb = Parameters<typeof applyBcLedgerBackfill>[0];

function rows<T extends Record<string, unknown>>(rows: T[]) {
  return { rows };
}

function queryResult<T extends Record<string, unknown>>(data: readonly Record<string, unknown>[]) {
  return rows(data as T[]);
}

test("BC ledger backfill preview writes every required output file and keeps safety false", async () => {
  const outputFolder = await mkdtemp(join(tmpdir(), "poip-bc-ledger-preview-"));
  const queries: string[] = [];
  const fakeDb: PreviewDb = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      assert.doesNotMatch(text, /\b(insert|update|delete|alter|drop|truncate|create)\b/i);
      return queryResult<T>([
        {
          bc_domain: "PRODUCTION_OUTPUT",
          movement_status: "CLASSIFIED",
          mapping_status: "MAPPED_READY",
          source_identity_field: "prod_line_description",
          source_identity_value: "LINE A",
          dashboard_ready: true,
          future_use_ready: false,
          rows: "2"
        },
        {
          bc_domain: "TRANSFER_OR_INVENTORY",
          movement_status: "CLASSIFIED",
          mapping_status: "FUTURE_USE_ONLY",
          source_identity_field: "prod_line_description",
          source_identity_value: "LINE A",
          dashboard_ready: false,
          future_use_ready: true,
          rows: "1"
        }
      ]);
    }
  };

  try {
    const summary = await createBcLedgerBackfillPreview(fakeDb, outputFolder);
    const files = await readdir(outputFolder);
    const summaryFile = JSON.parse(await readFile(join(outputFolder, "summary.json"), "utf8")) as typeof summary;

    assert.deepEqual(files.sort(), [
      "dashboard-ready-preview.csv",
      "data-quality-preview.csv",
      "domain-classification-preview.csv",
      "future-use-preview.csv",
      "import-manifest.json",
      "mapping-status-preview.csv",
      "risk-report.csv",
      "source-gap-preview.csv",
      "summary.json"
    ]);
    assert.equal(summary.dashboardReadyRows, 2);
    assert.equal(summaryFile.dashboardReadyRows, 2);
    assert.equal(summaryFile.futureUseRows, 1);
    assert.deepEqual(summaryFile.safety, {
      databaseUpdated: false,
      bcLedgerEntriesUpdated: false,
      productionTargetsUpdated: false,
      targetProfilesUpdated: false,
      aliasesUpdated: false,
      dashboardChanged: false
    });
    assert.equal(queries.length, 1);
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
});

test("ledger classification SQL keeps machine center as fallback and uses exact master matching", () => {
  const sql = ledgerClassificationSql();

  assert.match(sql, /when prod_line_description_clean is not null then 'prod_line_description'/);
  assert.match(sql, /when prod_line_no_clean is not null then 'prod_line_no'/);
  assert.match(sql, /when machine_center_no_clean is not null then 'machine_center_no'/);
  assert.match(sql, /source_identity_field in \('prod_line_description', 'prod_line_no'\)/);
  assert.match(sql, /source_identity_field = 'machine_center_no' then 'MAPPED_FALLBACK_REVIEW'/);
  assert.doesNotMatch(sql, /source_identity_field in \('prod_line_description', 'prod_line_no', 'machine_center_no'\)/);
});

test("guarded ledger apply updates only ledger semantic fields and safe entity_id", async () => {
  const queries: string[] = [];
  const fakeDb: ApplyDb = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      assert.match(text, /update bc_ledger_entries le/);
      assert.doesNotMatch(text, /production_targets|target_profiles|insert into|delete from|truncate/i);
      return queryResult<T>([{ updated_rows: "3" }]);
    }
  };

  const result = await applyBcLedgerBackfill(fakeDb);

  assert.equal(result.updatedRows, 3);
  assert.match(queries[0] ?? "", /entity_id = case\s+when enriched\.mapping_status = 'MAPPED_READY'/);
});
