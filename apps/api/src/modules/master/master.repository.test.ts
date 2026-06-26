import assert from "node:assert/strict";
import test from "node:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { DatabaseConnection } from "../database/database.module.js";
import { MasterRepository } from "./master.repository.js";

const ENTITY_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ENTITY_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-06-25T00:00:00.000Z");

type AliasFixture = {
  readonly id: string;
  readonly entityId: string;
  readonly alias: string;
  readonly sourceSystem: string;
  readonly sourceField: string;
  readonly aliasNormalized: string;
  readonly source: string;
  readonly confidence: string | null;
  readonly matchConfidence: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date | null;
};

function aliasFixture(overrides: Partial<AliasFixture> = {}): AliasFixture {
  return {
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

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

function repositoryWithCommitFlow(
  entryNos: readonly unknown[],
  issueRowCount: number,
  options: { readonly existingAlias?: AliasFixture | null | undefined } = {}
) {
  const dialect = new PgDialect();
  const executed: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const selectConditions: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const insertedAliases: unknown[] = [];
  const updatedAliases: unknown[] = [];
  const poolQueries: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  const alias = aliasFixture();
  const tx = {
    select: () => ({
      from: () => ({
        where: (condition: SQL) => ({
          limit: async () => {
            const compiled = dialect.sqlToQuery(condition);
            selectConditions.push({ sql: compiled.sql, params: compiled.params });
            return options.existingAlias ? [options.existingAlias] : [];
          }
        })
      })
    }),
    insert: () => ({
      values: (values: unknown) => ({
        returning: async () => {
          insertedAliases.push(values);
          return [alias];
        }
      })
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            updatedAliases.push(values);
            if (!options.existingAlias) return [];
            return [{
              ...options.existingAlias,
              ...values,
              createdAt: options.existingAlias.createdAt,
              updatedAt: NOW
            }];
          }
        })
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
              created_at: NOW,
              updated_at: NOW
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
  return { repository, executed, insertedAliases, poolQueries, selectConditions, updatedAliases };
}

function repositoryWithResetPreview() {
  const queries: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  let transactionCalled = false;
  const repository = new MasterRepository({
    pool: {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes("aliases_matched")) {
          return { rows: [{ total_output_rows: 4, mapped_output_rows_before: 3, aliases_matched: 1 }] };
        }
        if (text.includes("with output_entities")) {
          return {
            rows: [{
              entity_id: ENTITY_ID,
              entity_code: "THERMO2",
              display_name: "Thermo 2",
              mapped_output_rows: 3,
              active_alias_rows: 1
            }]
          };
        }
        return { rows: [] };
      }
    },
    db: {
      transaction: async () => {
        transactionCalled = true;
        throw new Error("Preview must not open a write transaction");
      }
    }
  } as unknown as DatabaseConnection);
  return { repository, queries, transactionCalled: () => transactionCalled };
}

function repositoryWithResetCommitFlow(options: {
  readonly sourceField?: "prod_line_description" | "prod_line_no" | "machine_center_no" | "machine_description";
  readonly sourceValue?: string;
  readonly mappedBefore?: number;
  readonly mappedAfter?: number;
  readonly aliasesBefore?: number;
  readonly aliasesAfter?: number;
  readonly aliasesDeactivated?: number;
} = {}) {
  const dialect = new PgDialect();
  const executed: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const mappedBefore = options.mappedBefore ?? 2;
  const aliasesBefore = options.aliasesBefore ?? 1;
  const tx = {
    execute: async (query: SQL) => {
      const compiled = dialect.sqlToQuery(query);
      executed.push({ sql: compiled.sql, params: compiled.params });
      if (compiled.sql.includes("with output_entities")) {
        return {
          rows: [{
            entity_id: ENTITY_ID,
            entity_code: "THERMO2",
            display_name: "Thermo 2",
            mapped_output_rows: mappedBefore,
            active_alias_rows: aliasesBefore
          }],
          rowCount: 1
        };
      }
      if (compiled.sql.includes("total_output_rows")) {
        return {
          rows: [{
            total_output_rows: 3,
            mapped_output_rows_before: mappedBefore,
            aliases_matched: aliasesBefore
          }],
          rowCount: 1
        };
      }
      if (compiled.sql.includes("update production_outputs")) {
        return { rows: [], rowCount: mappedBefore };
      }
      if (compiled.sql.includes("update") && compiled.sql.includes("master_entity_aliases")) {
        return { rows: [], rowCount: options.aliasesDeactivated ?? aliasesBefore };
      }
      if (compiled.sql.includes("mapped_output_rows_after")) {
        return {
          rows: [{
            mapped_output_rows_after: options.mappedAfter ?? 0,
            aliases_active_after: options.aliasesAfter ?? 0
          }],
          rowCount: 1
        };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  const repository = new MasterRepository({
    pool: {
      query: async () => ({ rows: [] })
    },
    db: {
      transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx)
    }
  } as unknown as DatabaseConnection);
  return {
    repository,
    executed,
    sourceField: options.sourceField ?? "prod_line_description",
    sourceValue: options.sourceValue ?? "THERMO 2 ILLIG"
  };
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

test("previewBusinessCentralMappingReset is read-only and reports projected reset counts", async () => {
  const { repository, queries, transactionCalled } = repositoryWithResetPreview();

  const result = await repository.previewBusinessCentralMappingReset({
    sourceField: "prod_line_description",
    sourceValue: "THERMO 2 ILLIG"
  });

  assert.equal(transactionCalled(), false);
  assert.equal(result.mode, "preview");
  assert.equal(result.totalOutputRows, 4);
  assert.equal(result.mappedOutputRowsBefore, 3);
  assert.equal(result.mappedOutputRowsAfter, 0);
  assert.equal(result.aliasesMatched, 1);
  assert.equal(result.aliasesDeactivated, 1);
  assert.equal(result.affectedEntities[0]?.entityCode, "THERMO2");
  assert.match(result.warnings[0] ?? "", /KPI quantities are not changed/);
  assert.equal(queries.length, 2);
  assert.equal(queries.some((query) => /\b(update|insert|delete)\b/i.test(query.text)), false);
  assert.deepEqual(queries[0]?.values, ["business-central", "THERMO 2 ILLIG", "prod_line_description"]);
});

test("commitBusinessCentralMappingReset resets only exact matching Business Central source rows", async () => {
  const { repository, executed } = repositoryWithResetCommitFlow();

  const result = await repository.commitBusinessCentralMappingReset({
    sourceField: "prod_line_description",
    sourceValue: "THERMO 2 ILLIG",
    actorUserId: ACTOR_ID
  });

  const outputUpdate = executed.find((query) => query.sql.includes("update production_outputs"));
  assert.equal(result.mode, "commit");
  assert.equal(result.mappedOutputRowsBefore, 2);
  assert.equal(result.mappedOutputRowsAfter, 0);
  assert.ok(outputUpdate);
  assert.match(outputUpdate.sql, /set entity_id = null/);
  assert.match(outputUpdate.sql, /po\.source_system = \$\d+/);
  assert.match(outputUpdate.sql, /btrim\(coalesce\(po\.prod_line_description, ''\)\) = \$\d+/);
  assert.match(outputUpdate.sql, /po\.entity_id is not null/);
  assert.ok(outputUpdate.params.includes("business-central"));
  assert.ok(outputUpdate.params.includes("THERMO 2 ILLIG"));
});

test("commitBusinessCentralMappingReset deactivates only matching active alias rows", async () => {
  const { repository, executed } = repositoryWithResetCommitFlow({ aliasesBefore: 2, aliasesDeactivated: 2 });

  const result = await repository.commitBusinessCentralMappingReset({
    sourceField: "prod_line_description",
    sourceValue: "THERMO 2 ILLIG",
    actorUserId: ACTOR_ID
  });

  const aliasUpdate = executed.find((query) => query.sql.includes("update") && query.sql.includes("master_entity_aliases"));
  assert.equal(result.aliasesMatched, 2);
  assert.equal(result.aliasesDeactivated, 2);
  assert.ok(aliasUpdate);
  assert.match(aliasUpdate.sql, /set is_active = false/);
  assert.match(aliasUpdate.sql, /source_system = \$\d+/);
  assert.match(aliasUpdate.sql, /source_field = \$\d+/);
  assert.match(aliasUpdate.sql, /alias = \$\d+/);
  assert.match(aliasUpdate.sql, /is_active/);
  assert.ok(aliasUpdate.params.includes("business-central"));
  assert.ok(aliasUpdate.params.includes("prod_line_description"));
  assert.ok(aliasUpdate.params.includes("THERMO 2 ILLIG"));
});

test("commitBusinessCentralMappingReset does not reset unrelated mapped source fields", async () => {
  const { repository, executed } = repositoryWithResetCommitFlow({
    sourceField: "machine_center_no",
    sourceValue: "VFINE-BT400"
  });

  await repository.commitBusinessCentralMappingReset({
    sourceField: "machine_center_no",
    sourceValue: "VFINE-BT400",
    actorUserId: ACTOR_ID
  });

  const outputUpdate = executed.find((query) => query.sql.includes("update production_outputs"));
  assert.ok(outputUpdate);
  assert.match(outputUpdate.sql, /po\.machine_center_no/);
  assert.doesNotMatch(outputUpdate.sql, /po\.prod_line_description/);
  assert.doesNotMatch(outputUpdate.sql, /po\.prod_line_no/);
  assert.doesNotMatch(outputUpdate.sql, /po\.machine_description/);
});

test("commitMapping skips data quality resolution when no source refs are updated", async () => {
  const { repository, executed, insertedAliases, selectConditions } = repositoryWithCommitFlow([], 0);

  const result = await repository.commitMapping({
    sourceField: "machine_description",
    sourceValue: "REPACKING",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  assert.equal(result.resolvedIssues, 0);
  assert.equal(result.aliasCommitStatus, "inserted");
  assert.equal(insertedAliases.length, 1);
  assert.equal(executed.filter((query) => query.sql.includes("data_quality_issues")).length, 0);
  assert.match(selectConditions[0]?.sql ?? "", /source_system/);
  assert.match(selectConditions[0]?.sql ?? "", /source_field/);
  assert.match(selectConditions[0]?.sql ?? "", /alias_normalized/);
  assert.deepEqual(selectConditions[0]?.params, ["business-central", "machine_description", "REPACKING"]);
});

test("commitMapping same alias and same entity is idempotent", async () => {
  const { repository, insertedAliases, updatedAliases } = repositoryWithCommitFlow(["200"], 0, {
    existingAlias: aliasFixture({
      alias: "VFINE-BT400",
      sourceField: "machine_center_no",
      aliasNormalized: "VFINEBT400"
    })
  });

  const result = await repository.commitMapping({
    sourceField: "machine_center_no",
    sourceValue: "VFINE-BT400",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  assert.equal(result.aliasCommitStatus, "already_mapped");
  assert.equal(result.alias?.alias, "VFINE-BT400");
  assert.equal(result.alias?.sourceField, "machine_center_no");
  assert.equal(insertedAliases.length, 0);
  assert.equal(updatedAliases.length, 1);
  assert.equal((updatedAliases[0] as { isActive?: unknown }).isActive, true);
});

test("commitMapping reactivates inactive same-entity alias", async () => {
  const { repository, insertedAliases, updatedAliases } = repositoryWithCommitFlow(["200"], 0, {
    existingAlias: aliasFixture({
      alias: "VFINE-BT400",
      sourceField: "machine_center_no",
      aliasNormalized: "VFINEBT400",
      isActive: false
    })
  });

  const result = await repository.commitMapping({
    sourceField: "machine_center_no",
    sourceValue: "VFINE-BT400",
    entityId: ENTITY_ID,
    actorUserId: ACTOR_ID
  });

  assert.equal(result.aliasCommitStatus, "reactivated");
  assert.equal(result.alias?.isActive, true);
  assert.equal(insertedAliases.length, 0);
  assert.equal(updatedAliases.length, 1);
  assert.equal((updatedAliases[0] as { isActive?: unknown }).isActive, true);
});

test("commitMapping same alias mapped to another entity returns a friendly conflict", async () => {
  const { repository, executed, insertedAliases, updatedAliases } = repositoryWithCommitFlow(["200"], 0, {
    existingAlias: aliasFixture({
      entityId: OTHER_ENTITY_ID,
      alias: "VFINE-BT400",
      sourceField: "machine_center_no",
      aliasNormalized: "VFINEBT400"
    })
  });

  await assert.rejects(
    () => repository.commitMapping({
      sourceField: "machine_center_no",
      sourceValue: "VFINE-BT400",
      entityId: ENTITY_ID,
      actorUserId: ACTOR_ID
    }),
    (error) => {
      const response = error && typeof error === "object" && "getResponse" in error
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;
      assert.equal((response as { code?: unknown } | null)?.code, "ALIAS_ALREADY_MAPPED");
      assert.match(String((response as { message?: unknown } | null)?.message), /VFINE-BT400/);
      return true;
    }
  );

  assert.equal(insertedAliases.length, 0);
  assert.equal(updatedAliases.length, 0);
  assert.equal(executed.length, 0);
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
