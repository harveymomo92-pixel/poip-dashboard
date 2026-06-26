import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionalMappingRuleMatches,
  normalizeConditionalMappingConditionValue,
  resolveConditionalMapping,
  reviewedAliasMatches,
  type ConditionalMappingRuleInput
} from "./conditional-mapping.js";

const rules: readonly ConditionalMappingRuleInput[] = [
  {
    id: "rule-22",
    sourceField: "machine_center_no",
    sourceValue: "OMSO1 OZ",
    sourceValueNormalized: "OMSO1OZ",
    conditionType: "item_description_pattern",
    conditionValue: "22 OZ",
    entityId: "entity-printing-22-oz"
  },
  {
    id: "rule-lt-20",
    sourceField: "machine_center_no",
    sourceValue: "OMSO1 OZ",
    sourceValueNormalized: "OMSO1OZ",
    conditionType: "inferred_target_bucket",
    conditionValue: "target_printing_oz_lt_20",
    entityId: "entity-printing-oz-lt-20"
  },
  {
    id: "rule-non-oz",
    sourceField: "machine_center_no",
    sourceValue: "OMSO1 OZ",
    sourceValueNormalized: "OMSO1OZ",
    conditionType: "inferred_target_bucket",
    conditionValue: "target_printing_non_oz",
    entityId: "entity-printing-non-oz"
  }
];

test("conditional mapping matches 22 OZ items to Printing 22 OZ", () => {
  const result = resolveConditionalMapping({
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP 22 OZ PRINTING LOGO",
    itemCategoryCode: "JADI PRINTING"
  }, [rules[0]!]);

  assert.equal(result.status, "matched");
  assert.equal(result.entityId, "entity-printing-22-oz");
});

test("conditional mapping matches 14 OZ items to Printing OZ below 20 by inferred bucket", () => {
  const result = resolveConditionalMapping({
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP 14 OZ PRINTING",
    itemCategoryCode: "JADI PRINTING"
  }, [rules[1]!]);

  assert.equal(result.status, "matched");
  assert.equal(result.entityId, "entity-printing-oz-lt-20");
});

test("conditional mapping maps non-OZ printing items only when a non-OZ rule matches", () => {
  const row = {
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP CUSTOM PRINTING",
    itemCategoryCode: "JADI PRINTING"
  };

  assert.equal(resolveConditionalMapping(row, [rules[1]!]).status, "none");
  assert.equal(resolveConditionalMapping(row, [rules[2]!]).entityId, "entity-printing-non-oz");
});

test("conditional mapping leaves no-match rows unmapped", () => {
  const result = resolveConditionalMapping({
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "UNKNOWN ITEM",
    itemCategoryCode: "LAIN"
  }, rules);

  assert.equal(result.status, "none");
  assert.equal(result.entityId, null);
});

test("conditional mapping leaves multiple matching rules unmapped with conflict reason", () => {
  const result = resolveConditionalMapping({
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP 22 OZ PRINTING",
    itemCategoryCode: "JADI PRINTING"
  }, [
    rules[0]!,
    {
      id: "rule-22-bucket",
      sourceField: "machine_center_no",
      sourceValue: "OMSO1 OZ",
      sourceValueNormalized: "OMSO1OZ",
      conditionType: "inferred_target_bucket",
      conditionValue: "target_printing_22_oz",
      entityId: "entity-printing-22-oz-bucket"
    }
  ]);

  assert.equal(result.status, "conflict");
  assert.equal(result.entityId, null);
  assert.match(result.reason, /Multiple/);
});

test("exact reviewed alias wins over conditional mapping", () => {
  const row = {
    machineCenterNo: "OMSO1 OZ",
    itemDescription: "CUP 22 OZ PRINTING",
    itemCategoryCode: "JADI PRINTING"
  };
  const resolvedEntityId = reviewedAliasMatches(row, "machine_center_no", "OMSO1 OZ", "OMSO1OZ")
    ? "entity-reviewed-alias"
    : resolveConditionalMapping(row, [rules[0]!]).entityId;

  assert.equal(reviewedAliasMatches(row, "machine_center_no", "OMSO1 OZ", "OMSO1OZ"), true);
  assert.equal(resolvedEntityId, "entity-reviewed-alias");
});

test("conditional mapping supports item number patterns and gross weight ranges", () => {
  assert.equal(
    conditionalMappingRuleMatches(
      { itemNo: "FG-PRINT-22-001" },
      { conditionType: "item_no_pattern", conditionValue: "FG-PRINT-22-*" }
    ),
    true
  );
  assert.equal(
    conditionalMappingRuleMatches(
      { grossWeightPerPcs: 0.014 },
      { conditionType: "gross_weight_range", conditionValue: ">=0.012" }
    ),
    true
  );
  assert.equal(
    normalizeConditionalMappingConditionValue("gross_weight_range", "0.012..0.020"),
    "[0.012..0.02]"
  );
});
