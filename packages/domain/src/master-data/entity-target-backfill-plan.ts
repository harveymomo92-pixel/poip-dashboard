import { normalizeAliasDisplay, normalizeAliasKey } from "./alias.js";
import {
  type BusinessCentralEntityV2ComparisonStatus,
  type BusinessCentralEntityV2MismatchReviewType,
  type BusinessCentralEntityV2ReviewClassification,
  type BusinessCentralEntityV2SourceField
} from "./entity-resolver-v2.js";
import { normalizeMachineCenterNo, normalizeTargetBucket } from "./target-profile.js";

export type EntityV2BackfillAction =
  | "NO_CHANGE"
  | "PROPOSE_CANONICAL_ENTITY_COLLAPSE"
  | "PROPOSE_CANONICAL_ENTITY_CREATION"
  | "REVIEW_ALIAS_CONFLICT"
  | "REVIEW_DATA_SOURCE_GAP"
  | "SKIP_HIGH_RISK";

export type BackfillRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface EntityV2BackfillPlanInput {
  readonly sourceField: BusinessCentralEntityV2SourceField;
  readonly sourceValue?: string | null;
  readonly currentEntityCode?: string | null;
  readonly currentEntityDisplayName?: string | null;
  readonly currentEntityCodesForSourceValue?: readonly string[] | null;
  readonly proposedEntityCode?: string | null;
  readonly proposedEntityDisplayName?: string | null;
  readonly suggestedCanonicalEntityCode?: string | null;
  readonly suggestedCanonicalEntityDisplayName?: string | null;
  readonly comparisonStatus: BusinessCentralEntityV2ComparisonStatus;
  readonly reviewClassification: BusinessCentralEntityV2ReviewClassification;
  readonly mismatchReviewType?: BusinessCentralEntityV2MismatchReviewType | "" | null;
}

export interface EntityV2BackfillPlan {
  readonly proposedCanonicalEntityCode: string | null;
  readonly proposedCanonicalEntityDisplayName: string | null;
  readonly backfillAction: EntityV2BackfillAction;
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly recommendedAction: string;
}

export interface TargetProfileBackfillPlanInput {
  readonly canonicalEntityCode?: string | null;
  readonly canonicalEntityDisplayName?: string | null;
  readonly currentEntityCode?: string | null;
  readonly currentEntityDisplayName?: string | null;
  readonly targetBucket?: string | null;
  readonly machineCenterNo?: string | null;
  readonly proposedTargetQty?: number | null;
  readonly entityBackfillRiskLevel?: BackfillRiskLevel | null;
  readonly entityBackfillAction?: EntityV2BackfillAction | null;
  readonly hasMultipleTargetQtySources?: boolean | null;
}

export interface TargetProfileBackfillPlan {
  readonly targetBucket: string;
  readonly machineCenterNo: string | null;
  readonly machineCenterNoNormalized: string | null;
  readonly proposedTargetQty: number | null;
  readonly unit: "PCS";
  readonly source: "p0.9-dry-run";
  readonly approvalStatus: "draft";
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly recommendedAction: string;
}

const legacyTargetVariantSuffixes = [
  "PRINTING 22 OZ",
  "PRINTING OZ < 20",
  "PRINTING NON-OZ",
  "THERMOFORMING"
] as const;

export function planEntityV2Backfill(input: EntityV2BackfillPlanInput): EntityV2BackfillPlan {
  const sourceValue = clean(input.sourceValue);
  const currentCode = clean(input.currentEntityCode);
  const currentDisplay = clean(input.currentEntityDisplayName);
  const proposedCode = clean(input.proposedEntityCode);
  const proposedDisplay = clean(input.proposedEntityDisplayName);
  const suggestedCode = clean(input.suggestedCanonicalEntityCode);
  const suggestedDisplay = clean(input.suggestedCanonicalEntityDisplayName);
  const proposedCanonicalCode = proposedCode || suggestedCode || sourceValue || null;
  const proposedCanonicalDisplayName = proposedDisplay || suggestedDisplay || sourceValue || null;

  if (input.comparisonStatus === "SAME_ENTITY") {
    return entityPlan({
      proposedCanonicalEntityCode: currentCode || proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: currentDisplay || proposedCanonicalDisplayName,
      backfillAction: "NO_CHANGE",
      riskLevel: "LOW",
      riskReason: "Current entity already matches resolver v2 canonical entity.",
      recommendedAction: "No entity backfill needed."
    });
  }

  if (!sourceValue || input.sourceField === "UNMAPPED") {
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: "REVIEW_DATA_SOURCE_GAP",
      riskLevel: "HIGH",
      riskReason: "Business Central source value is blank or unmapped.",
      recommendedAction: "Review source data before considering any entity migration."
    });
  }

  const currentCodesForSource = uniqueClean(input.currentEntityCodesForSourceValue ?? []);
  if (hasUnsafeCurrentEntityConflict(sourceValue, currentCodesForSource)) {
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: "REVIEW_ALIAS_CONFLICT",
      riskLevel: "HIGH",
      riskReason: "The same source value maps to multiple current entity codes that do not collapse to one canonical source value.",
      recommendedAction: "Review aliases/catalog manually; do not migrate this group automatically."
    });
  }

  if (currentCode && isLegacyDetailedEntityForSource(currentCode, sourceValue)) {
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: proposedCode ? "PROPOSE_CANONICAL_ENTITY_COLLAPSE" : "PROPOSE_CANONICAL_ENTITY_CREATION",
      riskLevel: "LOW",
      riskReason: "Current entity is a legacy detailed target-variant name for the same source value.",
      recommendedAction: proposedCode
        ? "Review low-risk canonical collapse in P0.9; do not update rows until P1.0 approval."
        : "Create or expose the canonical entity in a reviewed migration plan before any row update."
    });
  }

  if (input.reviewClassification === "CANONICAL_CATALOG_GAP" || input.reviewClassification === "LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED") {
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: "PROPOSE_CANONICAL_ENTITY_CREATION",
      riskLevel: "MEDIUM",
      riskReason: "Resolver v2 identified a canonical catalog/target-variant gap, but the current entity is not a simple same-source suffix.",
      recommendedAction: "Plan canonical entity creation and review samples before migration."
    });
  }

  if (input.reviewClassification === "POSSIBLE_RESOLVER_MISMATCH") {
    const mismatchType = input.mismatchReviewType || "UNKNOWN_MISMATCH_REVIEW";
    if (mismatchType === "LEGACY_NAME_VARIANT" || mismatchType === "TARGET_VARIANT_NAME_COLLISION") {
      return entityPlan({
        proposedCanonicalEntityCode: proposedCanonicalCode,
        proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
        backfillAction: "REVIEW_ALIAS_CONFLICT",
        riskLevel: "MEDIUM",
        riskReason: "Current and resolver v2 entities look related but are not a simple legacy suffix collapse.",
        recommendedAction: "Review canonical naming and aliases before migration; do not auto-apply."
      });
    }
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: "SKIP_HIGH_RISK",
      riskLevel: "HIGH",
      riskReason: "Resolver mismatch review indicates ambiguity or unrelated entity selection.",
      recommendedAction: "Investigate resolver/catalog/source data before migration."
    });
  }

  if (proposedCode && currentCode && !looksSameMachine(sourceValue, currentCode, proposedCode)) {
    return entityPlan({
      proposedCanonicalEntityCode: proposedCanonicalCode,
      proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
      backfillAction: "REVIEW_ALIAS_CONFLICT",
      riskLevel: "MEDIUM",
      riskReason: "Source value suggests a canonical entity but the current entity is a different size or variant.",
      recommendedAction: "Review samples and aliases; do not treat as a safe collapse."
    });
  }

  return entityPlan({
    proposedCanonicalEntityCode: proposedCanonicalCode,
    proposedCanonicalEntityDisplayName: proposedCanonicalDisplayName,
    backfillAction: proposedCode ? "PROPOSE_CANONICAL_ENTITY_COLLAPSE" : "SKIP_HIGH_RISK",
    riskLevel: proposedCode ? "MEDIUM" : "HIGH",
    riskReason: proposedCode
      ? "Resolver v2 proposes a different entity; review before migration."
      : "No safe canonical entity candidate is available.",
    recommendedAction: proposedCode
      ? "Review proposed canonical entity before migration."
      : "Do not migrate automatically; fix catalog/source data first."
  });
}

export function planTargetProfileBackfill(input: TargetProfileBackfillPlanInput): TargetProfileBackfillPlan {
  const targetBucket = normalizeTargetBucket(input.targetBucket) ?? "UNKNOWN";
  const proposedTargetQty = typeof input.proposedTargetQty === "number" && Number.isFinite(input.proposedTargetQty)
    ? input.proposedTargetQty
    : null;
  const machineCenterNo = clean(input.machineCenterNo) || null;
  const machineCenterNoNormalized = normalizeMachineCenterNo(machineCenterNo);
  const entityRisk = input.entityBackfillRiskLevel ?? "MEDIUM";

  if (!clean(input.canonicalEntityCode) || !clean(input.currentEntityCode)) {
    return targetProfilePlan({
      targetBucket,
      machineCenterNo,
      machineCenterNoNormalized,
      proposedTargetQty,
      riskLevel: "HIGH",
      riskReason: "Canonical or current entity is missing.",
      recommendedAction: "Resolve entity backfill plan before creating target profiles."
    });
  }

  if (entityRisk === "HIGH" || input.entityBackfillAction === "SKIP_HIGH_RISK" || input.entityBackfillAction === "REVIEW_DATA_SOURCE_GAP") {
    return targetProfilePlan({
      targetBucket,
      machineCenterNo,
      machineCenterNoNormalized,
      proposedTargetQty,
      riskLevel: "HIGH",
      riskReason: "Entity backfill candidate is high risk.",
      recommendedAction: "Do not create target profile automatically; resolve entity risk first."
    });
  }

  if (input.hasMultipleTargetQtySources) {
    return targetProfilePlan({
      targetBucket,
      machineCenterNo,
      machineCenterNoNormalized,
      proposedTargetQty: null,
      riskLevel: "HIGH",
      riskReason: "Multiple old target quantities could apply to this candidate.",
      recommendedAction: "Review old target periods/versions manually before migration."
    });
  }

  if (proposedTargetQty === null) {
    return targetProfilePlan({
      targetBucket,
      machineCenterNo,
      machineCenterNoNormalized,
      proposedTargetQty: null,
      riskLevel: entityRisk === "LOW" ? "MEDIUM" : entityRisk,
      riskReason: "Old target quantity source is missing or not safely available.",
      recommendedAction: "Fill target_qty manually before migration."
    });
  }

  if (targetBucket === "UNKNOWN") {
    return targetProfilePlan({
      targetBucket,
      machineCenterNo,
      machineCenterNoNormalized,
      proposedTargetQty,
      riskLevel: "MEDIUM",
      riskReason: "Target bucket is UNKNOWN and needs review before migration.",
      recommendedAction: "Review bucket inference before approving this target profile."
    });
  }

  return targetProfilePlan({
    targetBucket,
    machineCenterNo,
    machineCenterNoNormalized,
    proposedTargetQty,
    riskLevel: entityRisk,
    riskReason: "Target profile candidate is derived from reviewed entity backfill and old target quantity.",
    recommendedAction: "Review dry-run candidate; keep approval_status=draft until P1.0 approval."
  });
}

export function legacyCanonicalEntityCode(value: string | null | undefined): string | null {
  const text = clean(value);
  if (!text) return null;
  const display = normalizeAliasDisplay(text);
  for (const suffix of legacyTargetVariantSuffixes) {
    const marker = ` - ${suffix}`;
    if (display.endsWith(marker)) return display.slice(0, -marker.length).trim() || null;
  }
  return display;
}

function hasUnsafeCurrentEntityConflict(
  sourceValue: string,
  currentEntityCodes: readonly string[]
): boolean {
  const codes = currentEntityCodes.filter(Boolean);
  if (codes.length <= 1) return false;
  const canonicalKeys = new Set(codes.map((code) => normalizeAliasKey(legacyCanonicalEntityCode(code) ?? code)));
  const sourceKey = normalizeAliasKey(sourceValue);
  return canonicalKeys.size > 1 || (sourceKey ? !canonicalKeys.has(sourceKey) : true);
}

function isLegacyDetailedEntityForSource(currentEntityCode: string, sourceValue: string): boolean {
  const canonical = legacyCanonicalEntityCode(currentEntityCode);
  return !!canonical && normalizeAliasKey(canonical) === normalizeAliasKey(sourceValue) && canonical !== normalizeAliasDisplay(currentEntityCode);
}

function looksSameMachine(sourceValue: string, currentEntityCode: string, proposedEntityCode: string): boolean {
  const sourceKey = normalizeAliasKey(sourceValue);
  const currentCanonicalKey = normalizeAliasKey(legacyCanonicalEntityCode(currentEntityCode) ?? currentEntityCode);
  const proposedKey = normalizeAliasKey(proposedEntityCode);
  return !!sourceKey && currentCanonicalKey === sourceKey && proposedKey === sourceKey;
}

function uniqueClean(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function entityPlan(input: EntityV2BackfillPlan): EntityV2BackfillPlan {
  return input;
}

function targetProfilePlan(input: {
  readonly targetBucket: string;
  readonly machineCenterNo: string | null;
  readonly machineCenterNoNormalized: string | null;
  readonly proposedTargetQty: number | null;
  readonly riskLevel: BackfillRiskLevel;
  readonly riskReason: string;
  readonly recommendedAction: string;
}): TargetProfileBackfillPlan {
  return {
    targetBucket: input.targetBucket,
    machineCenterNo: input.machineCenterNo,
    machineCenterNoNormalized: input.machineCenterNoNormalized,
    proposedTargetQty: input.proposedTargetQty,
    unit: "PCS",
    source: "p0.9-dry-run",
    approvalStatus: "draft",
    riskLevel: input.riskLevel,
    riskReason: input.riskReason,
    recommendedAction: input.recommendedAction
  };
}

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}
