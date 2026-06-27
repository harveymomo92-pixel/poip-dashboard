import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessCentralUnknownScopeProfile,
  type BusinessCentralUnknownScopeProfileInputRow
} from "./unknown-scope-profile.js";

const baseRow: BusinessCentralUnknownScopeProfileInputRow = {
  entryType: "Output",
  locationCode: "",
  itemCategoryCode: "",
  unitOfMeasureCode: "",
  documentNo: "",
  itemNo: "",
  sourceValue: "",
  currentEntityCode: "",
  canonicalEntityCode: "",
  targetBucket: "UNKNOWN",
  machineCenterNo: "",
  bcCurrentKpiScope: "UNKNOWN_SCOPE_REVIEW",
  bcEntitySourceStatus: "ENTITY_SOURCE_BLANK_UNKNOWN",
  blocksP10AfterScope: true
};

test("unknown scope profile groups by document prefix", () => {
  const { summary, groups } = buildBusinessCentralUnknownScopeProfile({
    generatedAt: "2026-06-27T00:00:00.000Z",
    rows: [
      { ...baseRow, documentNo: "SO-001", itemNo: "FG001" },
      { ...baseRow, documentNo: "SO-002", itemNo: "FG002" },
      { ...baseRow, documentNo: "PO-001", itemNo: "RM001" }
    ]
  });

  assert.deepEqual(summary.unknownByDocumentPrefix.slice(0, 2), [
    { value: "SO", rows: 2 },
    { value: "PO", rows: 1 }
  ]);
  assert.ok(groups.some((group) => group.documentPrefix === "SO" && group.rows === 2));
});

test("unknown scope profile groups by item prefix", () => {
  const { summary } = buildBusinessCentralUnknownScopeProfile({
    rows: [
      { ...baseRow, itemNo: "RJ001" },
      { ...baseRow, itemNo: "RJ002" },
      { ...baseRow, itemNo: "SP001" }
    ]
  });

  assert.deepEqual(summary.unknownByItemPrefix.slice(0, 2), [
    { value: "RJ", rows: 2 },
    { value: "SP", rows: 1 }
  ]);
});

test("unknown scope profile groups by location and unit", () => {
  const { groups, summary } = buildBusinessCentralUnknownScopeProfile({
    rows: [
      { ...baseRow, locationCode: "GUDANG", unitOfMeasureCode: "KG", itemNo: "MAT001" },
      { ...baseRow, locationCode: "GUDANG", unitOfMeasureCode: "KG", itemNo: "MAT002" },
      { ...baseRow, locationCode: "JADI", unitOfMeasureCode: "PCS", itemNo: "FG001" }
    ]
  });

  assert.deepEqual(summary.unknownByLocationCode.slice(0, 2), [
    { value: "GUDANG", rows: 2 },
    { value: "JADI", rows: 1 }
  ]);
  assert.ok(groups.some((group) => group.locationCode === "GUDANG" && group.unitOfMeasureCode === "KG" && group.rows === 2));
});

test("suggested rule candidate does not mutate actual classification", () => {
  const { groups } = buildBusinessCentralUnknownScopeProfile({
    rows: [{ ...baseRow, locationCode: "JADI", unitOfMeasureCode: "PCS", itemNo: "FG001" }]
  });

  assert.equal(groups[0]?.suggestedCurrentKpiScope, "OUTPUT_KPI_OK_SCOPE");
  assert.equal(baseRow.bcCurrentKpiScope, "UNKNOWN_SCOPE_REVIEW");
});

test("blocking unknown remains blocking in p10 impact estimate", () => {
  const { summary, groups } = buildBusinessCentralUnknownScopeProfile({
    rows: [
      { ...baseRow, documentNo: "SO-001", blocksP10AfterScope: true },
      { ...baseRow, documentNo: "SO-002", blocksP10AfterScope: false }
    ]
  });

  assert.equal(summary.unknownScopeRows, 2);
  assert.equal(summary.unknownScopeBlockingRows, 1);
  assert.equal(summary.p10ImpactEstimate.blockingRowsBeforeProfiler, 1);
  assert.equal(summary.p10ImpactEstimate.blockingRowsAfterProfiler, 1);
  assert.ok(groups.some((group) => group.blocksP10AfterScope));
});

test("unknown scope profile summary carries CSV and JSON output paths", () => {
  const { summary, groups } = buildBusinessCentralUnknownScopeProfile({
    rows: [baseRow],
    outputFiles: {
      csv: ".tmp/bc-unknown-scope-profile.csv",
      json: ".tmp/bc-unknown-scope-profile.json"
    }
  });

  assert.equal(groups.length, 1);
  assert.deepEqual(summary.outputFiles, {
    csv: ".tmp/bc-unknown-scope-profile.csv",
    json: ".tmp/bc-unknown-scope-profile.json"
  });
});
