import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMappingPlanRows,
  containsMappingSecretLikeText,
  mappingPlanSourceFields,
  mappingPlanRowsToCsv,
  parseMappingPlanCsv,
  suggestMappingCandidates,
  tokenizeAliasValue,
  type CandidateEntityInput
} from "./mapping-candidates.js";

const entities: readonly CandidateEntityInput[] = [
  {
    entityId: "11111111-1111-1111-1111-111111111111",
    entityCode: "ILLIG 1",
    displayName: "Illig 1",
    aliasValues: ["ILLIG1"],
    targetExists: true
  },
  {
    entityId: "22222222-2222-2222-2222-222222222222",
    entityCode: "ILLIG 2",
    displayName: "Illig 2",
    targetExists: false
  },
  {
    entityId: "33333333-3333-3333-3333-333333333333",
    entityCode: "NEWDO 1",
    displayName: "Newdo 1",
    targetExists: true
  }
];

test("tokenizeAliasValue preserves family, number, and context tokens", () => {
  assert.deepEqual(tokenizeAliasValue("NEWDO 1 REG"), ["NEWDO", "1", "REG"]);
});

test("suggestMappingCandidates returns HIGH for exact existing alias match", () => {
  const [candidate] = suggestMappingCandidates("ILLIG1", entities);
  assert.equal(candidate?.entityId, "11111111-1111-1111-1111-111111111111");
  assert.equal(candidate?.confidence, "HIGH");
  assert.equal(candidate?.score, 100);
  assert.equal(candidate?.targetExists, true);
});

test("suggestMappingCandidates returns MEDIUM for clear token-based match", () => {
  const [candidate] = suggestMappingCandidates("NEWDO 1 REG", entities);
  assert.equal(candidate?.entityId, "33333333-3333-3333-3333-333333333333");
  assert.equal(candidate?.confidence, "MEDIUM");
  assert.match(candidate?.reason ?? "", /containment|family/i);
});

test("suggestMappingCandidates keeps ambiguous family-only source values low confidence", () => {
  const suggestions = suggestMappingCandidates("ILLIG", entities);
  assert.ok(suggestions.length >= 2);
  assert.equal(suggestions[0]?.confidence, "LOW");
  assert.match(suggestions[0]?.reason ?? "", /Ambiguous/i);
});

test("suggestMappingCandidates does not suggest blank source values", () => {
  assert.deepEqual(suggestMappingCandidates("   ", entities), []);
});

test("buildMappingPlanRows defaults all actions to REVIEW", () => {
  const [row] = buildMappingPlanRows([
    {
      sourceSystem: "business-central",
      sourceField: "machine_center_no",
      sourceValue: "ILLIG1",
      rowCount: 12,
      okQty: 34,
      firstPostingDate: "2026-01-01",
      lastPostingDate: "2026-01-31",
      suggestions: suggestMappingCandidates("ILLIG1", entities)
    }
  ]);
  assert.equal(row?.action, "REVIEW");
  assert.equal(row?.suggested_entity_code, "ILLIG 1");
});

test("mapping plan source fields prefer machine description before machine center", () => {
  assert.deepEqual(mappingPlanSourceFields, [
    "machine_description",
    "machine_center_no",
    "prod_line_description",
    "prod_line_no"
  ]);
});

test("mapping plan CSV round-trips reviewed rows", () => {
  const rows = buildMappingPlanRows([
    {
      sourceSystem: "business-central",
      sourceField: "machine_center_no",
      sourceValue: "ILLIG1",
      rowCount: 12,
      okQty: 34,
      firstPostingDate: "2026-01-01",
      lastPostingDate: "2026-01-31",
      suggestions: suggestMappingCandidates("ILLIG1", entities)
    }
  ]);
  const parsed = parseMappingPlanCsv(mappingPlanRowsToCsv(rows));
  assert.equal(parsed[0]?.source_value, "ILLIG1");
  assert.equal(parsed[0]?.action, "REVIEW");
  assert.equal(parsed[0]?.confidence, "HIGH");
});

test("containsMappingSecretLikeText flags credentials but not normal mapping values", () => {
  assert.equal(containsMappingSecretLikeText("machine=ILLIG1"), false);
  assert.equal(containsMappingSecretLikeText("Authorization: Bearer abc.def"), true);
  assert.equal(containsMappingSecretLikeText("BC_ODATA_PASSWORD=value"), true);
});
