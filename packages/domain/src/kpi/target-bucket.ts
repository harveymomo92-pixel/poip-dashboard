export const RESUME_TARGET_BUCKET_LABELS = {
  target_botol_preform: "Botol/Preform",
  target_thermoforming: "Thermoforming",
  target_thermoforming_gw_gt_12: "Thermoforming GW > 12g",
  target_printing_non_oz: "Printing non-OZ",
  target_printing_oz_lt_20: "Printing OZ < 20",
  target_printing_22_oz: "Printing 22 OZ"
} as const;

export type ResumeTargetBucket = keyof typeof RESUME_TARGET_BUCKET_LABELS;

export type ResumeTargetBucketReason = "INFERRED" | "TARGET_BUCKET_MISSING" | "TARGET_BUCKET_AMBIGUOUS";

export interface ResumeTargetBucketInput {
  readonly entityCode?: string | null;
  readonly entityDisplayName?: string | null;
  readonly machineLabel?: string | null;
  readonly machineDescription?: string | null;
  readonly machineCenterNo?: string | null;
  readonly prodLineNo?: string | null;
  readonly prodLineDescription?: string | null;
  readonly itemNo?: string | null;
  readonly itemDescription?: string | null;
  readonly itemCategoryCode?: string | null;
  readonly grossWeightPerPcs?: number | null;
}

export interface ResumeTargetBucketInference {
  readonly bucket: ResumeTargetBucket | null;
  readonly bucketLabel: string | null;
  readonly reason: ResumeTargetBucketReason;
  readonly candidates: readonly ResumeTargetBucket[];
  readonly evidence: readonly string[];
}

const THERMOFORMING_GW_GT_12_THRESHOLD = 0.012;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalized(value: string | null | undefined): string {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function addUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function ozSize(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*OZ\b/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function inferResumeTargetBucket(input: ResumeTargetBucketInput): ResumeTargetBucketInference {
  const machineText = normalized([
    input.entityCode,
    input.entityDisplayName,
    input.machineLabel,
    input.machineDescription,
    input.machineCenterNo,
    input.prodLineNo,
    input.prodLineDescription
  ].filter(Boolean).join(" "));
  const itemText = normalized([input.itemNo, input.itemDescription, input.itemCategoryCode].filter(Boolean).join(" "));
  const allText = `${machineText} ${itemText}`.trim();
  const evidence: string[] = [];
  const familyCandidates: ("printing" | "thermoforming" | "botol_preform")[] = [];

  if (hasAny(machineText, ["PRINT", "OMSO", "POLYPRINT"]) || hasAny(itemText, ["JADI PRINTING", "CUP PRT", "CUP PRIN"])) {
    familyCandidates.push("printing");
    evidence.push("printing family signal");
  }
  if (hasAny(machineText, ["THERMO", "ILLIG", "HENGFENG"]) || hasAny(itemText, ["THERMOFORMING"])) {
    familyCandidates.push("thermoforming");
    evidence.push("thermoforming family signal");
  }
  if (hasAny(machineText, ["BLOWING", "INJECTION", "BORCH", "LONGSUN", "CHUM", "VFINE"]) || hasAny(itemText, ["PREFORM", "BOTOL", "BOTTLE"])) {
    familyCandidates.push("botol_preform");
    evidence.push("bottle/preform family signal");
  }

  const uniqueFamilies = [...new Set(familyCandidates)];
  if (uniqueFamilies.length > 1) {
    const candidates: ResumeTargetBucket[] = [];
    if (uniqueFamilies.includes("printing")) addUnique(candidates, "target_printing_non_oz");
    if (uniqueFamilies.includes("thermoforming")) addUnique(candidates, "target_thermoforming");
    if (uniqueFamilies.includes("botol_preform")) addUnique(candidates, "target_botol_preform");
    return {
      bucket: null,
      bucketLabel: null,
      reason: "TARGET_BUCKET_AMBIGUOUS",
      candidates,
      evidence
    };
  }

  const family = uniqueFamilies[0];
  if (family === "printing") {
    const oz = ozSize(itemText || allText);
    if (oz === null) {
      evidence.push("printing item has no OZ size");
      return bucketResult("target_printing_non_oz", evidence);
    }
    evidence.push(`printing item OZ size ${oz}`);
    return bucketResult(oz === 22 ? "target_printing_22_oz" : "target_printing_oz_lt_20", evidence);
  }

  if (family === "thermoforming") {
    const grossWeight = input.grossWeightPerPcs;
    if (grossWeight !== null && typeof grossWeight !== "undefined" && Number.isFinite(grossWeight) && grossWeight >= THERMOFORMING_GW_GT_12_THRESHOLD) {
      evidence.push(`gross weight ${grossWeight} >= ${THERMOFORMING_GW_GT_12_THRESHOLD}`);
      return bucketResult("target_thermoforming_gw_gt_12", evidence);
    }
    if (grossWeight !== null && typeof grossWeight !== "undefined" && Number.isFinite(grossWeight)) {
      evidence.push(`gross weight ${grossWeight} < ${THERMOFORMING_GW_GT_12_THRESHOLD}`);
    } else {
      evidence.push("gross weight missing; using v1 default thermoforming bucket");
    }
    return bucketResult("target_thermoforming", evidence);
  }

  if (family === "botol_preform") return bucketResult("target_botol_preform", evidence);

  return {
    bucket: null,
    bucketLabel: null,
    reason: "TARGET_BUCKET_MISSING",
    candidates: [],
    evidence: evidence.length > 0 ? evidence : ["no reliable v1 target bucket signal"],
  };
}

function bucketResult(bucket: ResumeTargetBucket, evidence: readonly string[]): ResumeTargetBucketInference {
  return {
    bucket,
    bucketLabel: RESUME_TARGET_BUCKET_LABELS[bucket],
    reason: "INFERRED",
    candidates: [bucket],
    evidence
  };
}
