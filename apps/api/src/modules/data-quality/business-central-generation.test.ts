import assert from "node:assert/strict";
import test from "node:test";
import {
  businessCentralIssueSeverity,
  businessCentralIssueSourceRef,
  dedupeGeneratedBusinessCentralIssues,
  generatedBusinessCentralIssueChanged,
  recommendedActionForUnmappedSource,
  type GeneratedBusinessCentralIssue
} from "./business-central-generation.js";

function issue(input: Partial<GeneratedBusinessCentralIssue> = {}): GeneratedBusinessCentralIssue {
  return {
    issueCode: input.issueCode ?? "BC_UNMAPPED_SOURCE",
    severity: input.severity ?? "MEDIUM",
    entityType: input.entityType ?? "business_central_source_group",
    entityId: input.entityId ?? null,
    sourceSystem: input.sourceSystem ?? "business-central",
    sourceRef: input.sourceRef ?? businessCentralIssueSourceRef("unmapped-source", ["machine_center_no", "OMSO1OZ", "2026-06-01"]),
    description: input.description ?? "Unmapped Business Central source",
    payload: input.payload ?? {
      sourceSystem: "business-central",
      sourceField: "machine_center_no",
      sourceValue: "OMSO1 OZ",
      normalizedValue: "OMSO1OZ",
      rowCount: 1,
      okQty: 1,
      firstPostingDate: "2026-06-01",
      lastPostingDate: "2026-06-01",
      sampleDocumentNos: ["SPK-1"],
      sampleItemNos: ["ITEM-1"],
      suggestedTargetEntities: [],
      recommendedAction: "Use Conditional Mapping Rule, not broad alias.",
      relatedEndpoint: "/master-data"
    }
  };
}

test("Business Central generated issue dedupe keeps one issue per stable key", () => {
  const duplicate = issue({ payload: { ...issue().payload, rowCount: 3 } });
  const deduped = dedupeGeneratedBusinessCentralIssues([issue(), duplicate]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.payload.rowCount, 3);
});

test("Business Central generated issue rerun can remain unchanged instead of duplicating", () => {
  const generated = issue();

  assert.equal(generatedBusinessCentralIssueChanged({
    issueCode: generated.issueCode,
    severity: generated.severity,
    description: generated.description,
    payload: generated.payload,
    status: "OPEN"
  }, generated), false);
  assert.equal(generatedBusinessCentralIssueChanged({
    issueCode: generated.issueCode,
    severity: generated.severity,
    description: generated.description,
    payload: { ...generated.payload, rowCount: 2 },
    status: "OPEN"
  }, generated), true);
  assert.equal(generatedBusinessCentralIssueChanged({
    issueCode: generated.issueCode,
    severity: generated.severity,
    description: generated.description,
    payload: generated.payload,
    status: "RESOLVED"
  }, generated), true);
});

test("Business Central issue severity follows P0.6 thresholds", () => {
  assert.equal(businessCentralIssueSeverity({ okQty: 1_000_000 }), "CRITICAL");
  assert.equal(businessCentralIssueSeverity({ okQty: 100_000 }), "HIGH");
  assert.equal(businessCentralIssueSeverity({ okQty: 1 }), "MEDIUM");
  assert.equal(businessCentralIssueSeverity({ okQty: 0 }), "LOW");
  assert.equal(businessCentralIssueSeverity({ okQty: 1, targetBlocksAchievement: true }), "CRITICAL");
  assert.equal(businessCentralIssueSeverity({ okQty: 0, rejectPcsGap: true }), "HIGH");
});

test("unmapped OMSO or printing source recommends conditional mapping", () => {
  assert.equal(
    recommendedActionForUnmappedSource({ sourceValue: "OMSO1 OZ", sampleItemNos: ["PF22OZ"] }),
    "Use Conditional Mapping Rule, not broad alias."
  );
  assert.equal(
    recommendedActionForUnmappedSource({ sourceValue: "UNKNOWN", suggestedTargetEntities: [] }),
    "Review or create master entity/alias."
  );
});

test("target and reject issue payloads can carry required actions", () => {
  const target = issue({
    issueCode: "BC_NO_ACTIVE_TARGET",
    severity: "CRITICAL",
    payload: {
      ...issue().payload,
      recommendedAction: "Create or approve target for this entity-day/month.",
      targetReason: "NO_ACTIVE_TARGET"
    }
  });
  const reject = issue({
    issueCode: "BC_REJECT_PCS_INCOMPLETE",
    severity: "HIGH",
    payload: {
      ...issue().payload,
      recommendedAction: "Review reject attachment or gross-weight conversion source.",
      conversionGapReason: "MISSING_OK_GROSS_WEIGHT"
    }
  });

  assert.equal(target.payload.targetReason, "NO_ACTIVE_TARGET");
  assert.match(target.payload.recommendedAction, /Create or approve target/);
  assert.equal(reject.payload.conversionGapReason, "MISSING_OK_GROSS_WEIGHT");
  assert.match(reject.payload.recommendedAction, /gross-weight conversion/);
});

