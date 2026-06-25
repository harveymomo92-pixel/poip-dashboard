import assert from "node:assert/strict";
import test from "node:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { DatabaseConnection } from "../database/database.module.js";
import { MasterRepository } from "./master.repository.js";

const ENTITY_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";

function repositoryWithQueries() {
  const queries: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  const repository = new MasterRepository({
    pool: {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes("from master_entities me")) return { rows: [] };
        if (text.includes("select entry_no::text")) return { rows: [] };
        if (text.includes("select * from grouped")) return { rows: [] };
        if (text.includes("select count(*) as total from grouped")) return { rows: [{ total: 0 }] };
        return { rows: [{ affected_rows: 0, already_mapped_rows: 0, unresolved_issue_count: 0 }] };
      }
    },
    db: {}
  } as unknown as DatabaseConnection);
  return { repository, queries };
}

function repositoryWithCommitFlow(entryNos: readonly unknown[], issueRowCount: number) {
  const dialect = new PgDialect();
  const executed: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const poolQueries: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  const now = new Date("2026-06-25T00:00:00.000Z");
  const alias = {
    id: "alias-1",
    entityId: ENTITY_ID,
    alias: "REPACKING",
    sourceSystem: "business-central",
    sourceField: "machine_description",
    aliasNormalized: "REPACKING",
    source: "mapping-center",
    confidence: "100",
    matchConfidence: "100",
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => []
        })
      })
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [alias]
      })
    }),
    execute: async (query: SQL) => {
      const compiled = dialect.sqlToQuery(query);
      executed.push({ sql: compiled.sql, params: compiled.params });
      if (compiled.sql.includes("update production_outputs")) {
        return { rows: entryNos.map((entry_no) => ({ entry_no })), rowCount: entryNos.length };
      }
      if (compiled.sql.includes("data_quality_issues")) {
        return { rows: [], rowCount: issueRowCount };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  const repository = new MasterRepository({
    pool: {
      query: async (text: string, values: readonly unknown[] = []) => {
        poolQueries.push({ text, values });
        if (text.includes("from master_entities me")) {
          return {
            rows: [{
              id: ENTITY_ID,
              entity_code: "REPACKING",
              display_name: "REPACKING",
              area: null,
              line_code: null,
              product_family: null,
              report_group: null,
              planned_runtime_hours: "24",
              is_active: true,
              alias_count: 0,
              target_count: 0,
              output_row_count: 0,
              created_at: now,
              updated_at: now
            }]
          };
        }
        if (text.includes("count(*) filter")) {
          return { rows: [{ affected_rows: entryNos.length, already_mapped_rows: 0, unresolved_issue_count: issueRowCount }] };
        }
        if (text.includes("select entry_no::text")) return { rows: [] };
        return { rows: [] };
      }
    },
    db: {
      transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx)
    }
  } as unknown as DatabaseConnection);
  return { repository, executed, poolQueries };
}

test("previewMapping selected source uses a typed third parameter without skipping $3", async () => {
  const { repository, queries } = repositoryWithQueries();

  await repository.previewMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: "11111111-1111-4111-8111-111111111111"
  });

  assert.match(queries[0]?.text ?? "", /\$3::boolean/);
  assert.doesNotMatch(queries[0]?.text ?? "", /\$4::boolean/);
  assert.deepEqual(queries[0]?.values, ["business-central", "REPACKING", false]);
});

test("listUnmappedSources groups by preferred machine description source", async () => {
  const { repository, queries } = repositoryWithQueries();

  await repository.listUnmappedSources({ page: 1, pageSize: 20, sourceField: "machine_description" });

  const groupedQuery = queries.find((query) => query.text.includes("with source_rows as"));
  assert.match(groupedQuery?.text ?? "", /machine_description/);
  assert.doesNotMatch(groupedQuery?.text ?? "", /union all/i);
  assert.ok(groupedQuery?.values.includes("machine_description"));
});

test("targetCoverage exposes preferred source field and machine description group", async () => {
  const { repository, queries } = repositoryWithQueries();

  await repository.targetCoverage({ page: 1, pageSize: 50 });

  const coverageQuery = queries.find((query) => query.text.includes("with coverage as"));
  assert.match(coverageQuery?.text ?? "", /machine_description/);
  assert.match(coverageQuery?.text ?? "", /source_field/);
  assert.match(coverageQuery?.text ?? "", /source_group/);
});

test("commitMapping skips data quality resolution when no source refs are updated", async () => {
  const { repository, executed } = repositoryWithCommitFlow([], 0);

  const result = await repository.commitMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  assert.equal(result.resolvedIssues, 0);
  assert.equal(executed.filter((query) => query.sql.includes("data_quality_issues")).length, 0);
});

test("commitMapping resolves one data quality source ref with a PostgreSQL array constructor", async () => {
  const { repository, executed } = repositoryWithCommitFlow(["100"], 1);

  const result = await repository.commitMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  const issueQuery = executed.find((query) => query.sql.includes("data_quality_issues"));
  assert.equal(result.resolvedIssues, 1);
  assert.ok(issueQuery);
  assert.match(issueQuery.sql, /source_ref = any\(array\[\$\d+\]::text\[\]\)/);
  assert.doesNotMatch(issueQuery.sql, /any\(\(\$\d+/);
  assert.ok(issueQuery.params.includes("100"));
});

test("commitMapping deduplicates many data quality source refs", async () => {
  const { repository, executed } = repositoryWithCommitFlow(["100", "100", " ", "101", null], 2);

  const result = await repository.commitMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  const issueQuery = executed.find((query) => query.sql.includes("data_quality_issues"));
  assert.equal(result.resolvedIssues, 2);
  assert.ok(issueQuery);
  assert.match(issueQuery.sql, /source_ref = any\(array\[\$\d+, \$\d+\]::text\[\]\)/);
  assert.doesNotMatch(issueQuery.sql, /any\(\(\$\d+/);
  assert.deepEqual(issueQuery.params.filter((value) => value === "100" || value === "101"), ["100", "101"]);
  assert.equal(issueQuery.params.includes(" "), false);
});

test("commitMapping data quality resolution only targets open matching machine issues", async () => {
  const { repository, executed } = repositoryWithCommitFlow(["100"], 1);

  await repository.commitMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  const issueQuery = executed.find((query) => query.sql.includes("data_quality_issues"));
  assert.ok(issueQuery);
  assert.match(issueQuery.sql, /where source_system = \$\d+/);
  assert.match(issueQuery.sql, /status in \('OPEN', 'ACKNOWLEDGED'\)/);
  assert.match(issueQuery.sql, /issue_code in \('UNKNOWN_MACHINE', 'UNMAPPED_ENTITY'\)/);
  assert.doesNotMatch(issueQuery.sql, /status in \('RESOLVED'/);
});
