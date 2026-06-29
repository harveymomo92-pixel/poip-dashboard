import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildAuditReport,
  chooseODataIdentity,
  collectAuditData,
  type AuditData,
  type Queryable,
  writeAuditReport
} from "./odata-db-mapping-audit.js";

function queryRows<T extends Record<string, unknown>>(rows: Record<string, unknown>[]) {
  return { rows: rows as T[] };
}

function sampleAuditData(overrides: Partial<AuditData> = {}): AuditData {
  return {
    generatedAt: "2026-06-29T00:00:00.000Z",
    outputFolder: ".tmp/test-bc-odata-db-mapping-audit",
    databaseConnected: true,
    tableInventory: [
      { tableName: "bc_ledger_entries", rowCount: 8 },
      { tableName: "master_entities", rowCount: 2 },
      { tableName: "master_entity_aliases", rowCount: 1 }
    ],
    productionOutputColumns: [
      { columnName: "prod_line_description", dataType: "text", isNullable: "YES", ordinalPosition: 1 },
      { columnName: "prod_line_no", dataType: "text", isNullable: "YES", ordinalPosition: 2 },
      { columnName: "machine_center_no", dataType: "text", isNullable: "YES", ordinalPosition: 3 },
      { columnName: "entity_id", dataType: "uuid", isNullable: "YES", ordinalPosition: 4 },
      { columnName: "raw_payload", dataType: "jsonb", isNullable: "NO", ordinalPosition: 5 }
    ],
    outputGroups: [
      {
        identitySource: "GPROD_DESCRIPTION",
        identityValue: "LINE A",
        gprodDescription: "LINE A",
        gprodNo: "ROT-A",
        machineCenterNo: "MC-A",
        currentEntityId: "entity-a",
        currentEntityCode: "LINE-A",
        currentEntityName: "Line A",
        currentAliases: [],
        normalizedOutputType: "OK",
        rows: 2,
        minPostingDate: "2026-06-01",
        maxPostingDate: "2026-06-02"
      },
      {
        identitySource: "GPROD_DESCRIPTION",
        identityValue: "LINE B ODATA",
        gprodDescription: "LINE B ODATA",
        gprodNo: null,
        machineCenterNo: "MC-B",
        currentEntityId: "entity-b",
        currentEntityCode: "LINE-B-OLD",
        currentEntityName: "Line B Old",
        currentAliases: [],
        normalizedOutputType: "OK",
        rows: 3,
        minPostingDate: "2026-06-01",
        maxPostingDate: "2026-06-03"
      },
      {
        identitySource: "MACHINE_CENTER_ONLY",
        identityValue: "MC-C",
        gprodDescription: null,
        gprodNo: null,
        machineCenterNo: "MC-C",
        currentEntityId: null,
        currentEntityCode: null,
        currentEntityName: null,
        currentAliases: [],
        normalizedOutputType: "OK",
        rows: 2,
        minPostingDate: "2026-06-01",
        maxPostingDate: "2026-06-04"
      },
      {
        identitySource: "SOURCE_GAP",
        identityValue: null,
        gprodDescription: null,
        gprodNo: null,
        machineCenterNo: null,
        currentEntityId: null,
        currentEntityCode: null,
        currentEntityName: null,
        currentAliases: [],
        normalizedOutputType: "OK",
        rows: 1,
        minPostingDate: "2026-06-05",
        maxPostingDate: "2026-06-05"
      }
    ],
    outputSample: [],
    ...overrides
  };
}

test("OData DB mapping audit writes every required output file", async () => {
  const outputFolder = await mkdtemp(join(tmpdir(), "poip-odata-audit-"));
  try {
    const report = buildAuditReport(sampleAuditData({ outputFolder }));
    await writeAuditReport(report, outputFolder);
    const files = await readdir(outputFolder);

    assert.deepEqual(files.sort(), [
      "README.md",
      "current-db-table-inventory.csv",
      "current-entity-linkage.csv",
      "future-remap-recommendation.csv",
      "import-manifest.json",
      "machine-center-fallback-only.csv",
      "odata-identity-coverage.csv",
      "odata-vs-current-entity-mismatch.csv",
      "production-output-column-inventory.csv",
      "production-output-odata-sample.csv",
      "risk-report.csv",
      "source-gap.csv",
      "summary.json"
    ]);
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
});

test("OData identity precedence uses gProdOrRotLine_Description before other fields", () => {
  const identity = chooseODataIdentity({
    gprodDescription: "Preferred Line Description",
    gprodNo: "ROT-001",
    machineCenterNo: "MC-001"
  });

  assert.deepEqual(identity, {
    source: "GPROD_DESCRIPTION",
    value: "Preferred Line Description"
  });
});

test("Machine_Center_No-only rows are classified as fallback-only review", () => {
  const report = buildAuditReport(sampleAuditData());

  assert.equal(report.summary.fallbackOnlyRows, 2);
  assert.match(report.files["machine-center-fallback-only.csv"], /MACHINE_CENTER_FALLBACK_REVIEW/);
  assert.match(report.files["machine-center-fallback-only.csv"], /fallback evidence/);
});

test("blank OData identity becomes source gap and blocked review", () => {
  const report = buildAuditReport(sampleAuditData());

  assert.equal(report.summary.sourceGapRows, 1);
  assert.equal(report.summary.blockedRows, 1);
  assert.match(report.files["source-gap.csv"], /SOURCE_GAP_REVIEW/);
});

test("mismatch recommendation is exported", () => {
  const report = buildAuditReport(sampleAuditData());

  assert.equal(report.summary.mismatchRows, 3);
  assert.match(report.files["odata-vs-current-entity-mismatch.csv"], /LINE B ODATA/);
  assert.match(report.files["odata-vs-current-entity-mismatch.csv"], /REMAP_TO_GPROD_DESCRIPTION/);
});

test("summary safety flags remain false", () => {
  const report = buildAuditReport(sampleAuditData());

  assert.deepEqual(report.summary.safety, {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    productionTargetsUpdated: false,
    targetProfilesUpdated: false,
    aliasesUpdated: false,
    mappingApplied: false,
    dashboardChanged: false
  });
});

test("collectAuditData uses read-only query shapes and does not mutate DB", async () => {
  const queries: string[] = [];
  const fakeDb: Queryable = {
    async query(text) {
      queries.push(text);
      assert.doesNotMatch(text, /\b(insert|update|delete|alter|drop|truncate|create)\b/i);
      if (text.includes("information_schema.tables")) {
        return queryRows([{ table_name: "bc_ledger_entries" }]);
      }
      if (text.includes('count(*) as row_count from "bc_ledger_entries"')) {
        return queryRows([{ row_count: "0" }]);
      }
      if (text.includes("information_schema.columns")) {
        return queryRows([]);
      }
      return queryRows([]);
    }
  };

  const data = await collectAuditData(fakeDb);

  assert.equal(data.tableInventory.length, 1);
  assert.ok(queries.length >= 4);
});

test("missing optional mapping tables do not crash report generation", async () => {
  const fakeDb: Queryable = {
    async query(text) {
      if (text.includes("information_schema.tables")) {
        return queryRows([{ table_name: "bc_ledger_entries" }]);
      }
      if (text.includes('count(*) as row_count from "bc_ledger_entries"')) {
        return queryRows([{ row_count: "1" }]);
      }
      if (text.includes("information_schema.columns")) {
        return queryRows([{ column_name: "raw_payload", data_type: "jsonb", is_nullable: "NO", ordinal_position: 1 }]);
      }
      return queryRows([
          {
            identity_source: "GPROD_NO",
            identity_value: "ROT-1",
            gprod_description: null,
            gprod_no: "ROT-1",
            machine_center_no: "MC-1",
            current_entity_id: null,
            current_entity_code: null,
            current_entity_name: null,
            current_aliases: "",
            normalized_output_type: "OK",
            rows: "1",
            min_posting_date: "2026-06-01",
            max_posting_date: "2026-06-01"
          }
        ]);
    }
  };

  const data = await collectAuditData(fakeDb);
  const report = buildAuditReport(data);

  assert.equal(report.summary.hasMasterEntitiesTable, false);
  assert.equal(report.summary.hasAliasTable, false);
  assert.equal(report.summary.odataIdentityCoverage.GPROD_NO, 1);
});
