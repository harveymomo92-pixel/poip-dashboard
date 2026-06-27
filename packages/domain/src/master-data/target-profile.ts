import { normalizeAliasKey } from "./alias.js";

export type TargetProfileLookupStatus =
  | "TARGET_PROFILE_MATCHED_EXACT"
  | "TARGET_PROFILE_MATCHED_ENTITY_BUCKET"
  | "NO_ACTIVE_TARGET_PROFILE"
  | "MULTIPLE_TARGET_PROFILE_MATCH"
  | "INVALID_TARGET_BUCKET"
  | "INVALID_ENTITY";

export interface TargetProfile {
  readonly id: string;
  readonly entityId: string;
  readonly machineCenterNo?: string | null;
  readonly machineCenterNoNormalized?: string | null;
  readonly targetBucket: string;
  readonly targetBucketNormalized?: string | null;
  readonly effectiveFrom: string | Date;
  readonly effectiveTo?: string | Date | null;
  readonly targetQty: number;
  readonly unit: string;
  readonly isActive: boolean;
  readonly approvalStatus: string;
  readonly source?: string | null;
  readonly notes?: string | null;
}

export interface TargetProfileLookupInput {
  readonly entityId?: string | null;
  readonly targetBucket?: string | null;
  readonly machineCenterNo?: string | null;
  readonly postingDate?: string | Date | null;
  readonly profiles: readonly TargetProfile[];
}

export interface TargetProfileLookupResult {
  readonly status: TargetProfileLookupStatus;
  readonly targetProfile: TargetProfile | null;
  readonly targetProfiles: readonly TargetProfile[];
  readonly normalizedTargetBucket: string | null;
  readonly normalizedMachineCenterNo: string | null;
  readonly reason: string;
}

const exactBucketValues = new Set(["OZ_22", "OZ_LT_20", "REG", "CUP_REG", "UNKNOWN", "DEFAULT"]);

export function normalizeTargetBucket(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  if (exactBucketValues.has(normalized)) return normalized;
  if (/^BOTOL_SIZE_\d+(?:_\d+)?_ML$/.test(normalized)) return normalized;
  if (/^PREFORM_WEIGHT_\d+(?:_\d+)?_GR$/.test(normalized)) return normalized;
  return null;
}

export function normalizeMachineCenterNo(value: string | null | undefined): string | null {
  const normalized = normalizeAliasKey(value ?? "");
  return normalized || null;
}

export function resolveBusinessCentralTargetProfile(
  input: TargetProfileLookupInput
): TargetProfileLookupResult {
  const entityId = clean(input.entityId);
  const targetBucket = normalizeTargetBucket(input.targetBucket);
  const postingDate = dateText(input.postingDate);
  const machineCenterNo = normalizeMachineCenterNo(input.machineCenterNo);

  if (!entityId) {
    return lookupResult({
      status: "INVALID_ENTITY",
      targetProfile: null,
      targetProfiles: [],
      normalizedTargetBucket: targetBucket,
      normalizedMachineCenterNo: machineCenterNo,
      reason: "Resolver v2 did not produce a target-profile eligible entity."
    });
  }
  if (!targetBucket) {
    return lookupResult({
      status: "INVALID_TARGET_BUCKET",
      targetProfile: null,
      targetProfiles: [],
      normalizedTargetBucket: null,
      normalizedMachineCenterNo: machineCenterNo,
      reason: "Target bucket is blank or not part of the P0.8 allowlisted bucket model."
    });
  }

  const activeProfiles = input.profiles.filter((profile) => isEligibleProfile(profile, entityId, postingDate));

  if (machineCenterNo) {
    const exactMatches = activeProfiles.filter((profile) => (
      profileBucket(profile) === targetBucket
      && profileMachineCenter(profile) === machineCenterNo
    ));
    const exact = priorityResult({
      matches: exactMatches,
      status: "TARGET_PROFILE_MATCHED_EXACT",
      normalizedTargetBucket: targetBucket,
      normalizedMachineCenterNo: machineCenterNo,
      reason: "Matched active approved target profile by entity, bucket, exact machine center, and posting date."
    });
    if (exact) return exact;
  }

  const genericMatches = activeProfiles.filter((profile) => (
    profileBucket(profile) === targetBucket
    && profileMachineCenter(profile) === null
  ));
  const generic = priorityResult({
    matches: genericMatches,
    status: "TARGET_PROFILE_MATCHED_ENTITY_BUCKET",
    normalizedTargetBucket: targetBucket,
    normalizedMachineCenterNo: machineCenterNo,
    reason: "Matched active approved generic target profile by entity, bucket, and posting date."
  });
  if (generic) return generic;

  const fallbackBuckets = ["DEFAULT", "UNKNOWN"];
  const fallbackMatches = activeProfiles.filter((profile) => (
    fallbackBuckets.includes(profileBucket(profile) ?? "")
    && profileMachineCenter(profile) === null
  ));
  const fallback = priorityResult({
    matches: fallbackMatches,
    status: "TARGET_PROFILE_MATCHED_ENTITY_BUCKET",
    normalizedTargetBucket: targetBucket,
    normalizedMachineCenterNo: machineCenterNo,
    reason: "Matched active approved default/unknown target profile by entity and posting date."
  });
  if (fallback) return fallback;

  return lookupResult({
    status: "NO_ACTIVE_TARGET_PROFILE",
    targetProfile: null,
    targetProfiles: [],
    normalizedTargetBucket: targetBucket,
    normalizedMachineCenterNo: machineCenterNo,
    reason: "No active approved target profile matched entity, bucket, machine center priority, and posting date."
  });
}

function priorityResult(input: {
  readonly matches: readonly TargetProfile[];
  readonly status: Extract<TargetProfileLookupStatus, "TARGET_PROFILE_MATCHED_EXACT" | "TARGET_PROFILE_MATCHED_ENTITY_BUCKET">;
  readonly normalizedTargetBucket: string;
  readonly normalizedMachineCenterNo: string | null;
  readonly reason: string;
}): TargetProfileLookupResult | null {
  if (input.matches.length === 0) return null;
  if (input.matches.length > 1) {
    return lookupResult({
      status: "MULTIPLE_TARGET_PROFILE_MATCH",
      targetProfile: null,
      targetProfiles: input.matches,
      normalizedTargetBucket: input.normalizedTargetBucket,
      normalizedMachineCenterNo: input.normalizedMachineCenterNo,
      reason: "Multiple active approved target profiles matched at the same priority level; P0.8 does not guess."
    });
  }
  const targetProfile = input.matches[0] ?? null;
  return lookupResult({
    status: input.status,
    targetProfile,
    targetProfiles: targetProfile ? [targetProfile] : [],
    normalizedTargetBucket: input.normalizedTargetBucket,
    normalizedMachineCenterNo: input.normalizedMachineCenterNo,
    reason: input.reason
  });
}

function isEligibleProfile(profile: TargetProfile, entityId: string, postingDate: string | null): boolean {
  if (!postingDate) return false;
  if (clean(profile.entityId) !== entityId) return false;
  if (!profile.isActive) return false;
  if (clean(profile.approvalStatus).toUpperCase() !== "APPROVED") return false;
  const effectiveFrom = dateText(profile.effectiveFrom);
  const effectiveTo = dateText(profile.effectiveTo);
  if (!effectiveFrom || effectiveFrom > postingDate) return false;
  if (effectiveTo && effectiveTo < postingDate) return false;
  return true;
}

function profileBucket(profile: TargetProfile): string | null {
  return normalizeTargetBucket(profile.targetBucketNormalized || profile.targetBucket);
}

function profileMachineCenter(profile: TargetProfile): string | null {
  return normalizeMachineCenterNo(profile.machineCenterNoNormalized || profile.machineCenterNo);
}

function lookupResult(input: TargetProfileLookupResult): TargetProfileLookupResult {
  return input;
}

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function dateText(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
