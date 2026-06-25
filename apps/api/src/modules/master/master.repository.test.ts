import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseConnection } from "../database/database.module.js";
import { MasterRepository } from "./master.repository.js";

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
