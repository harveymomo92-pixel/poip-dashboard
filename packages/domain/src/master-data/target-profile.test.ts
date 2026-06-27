import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMachineCenterNo,
  normalizeTargetBucket,
  resolveBusinessCentralTargetProfile,
  type TargetProfile
} from "./target-profile.js";

const baseProfile = {
  id: "profile-generic",
  entityId: "entity-1",
  machineCenterNo: null,
  machineCenterNoNormalized: null,
  targetBucket: "OZ_22",
  targetBucketNormalized: "OZ_22",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  targetQty: 1000,
  unit: "PCS",
  isActive: true,
  approvalStatus: "APPROVED",
  source: "test",
  notes: null
} satisfies TargetProfile;

function profile(overrides: Partial<TargetProfile> = {}): TargetProfile {
  return { ...baseProfile, ...overrides };
}

test("target profile exact match wins by entity, bucket, machine center, and date", () => {
  const exact = profile({
    id: "profile-exact",
    machineCenterNo: "OMSO1 22 OZ",
    machineCenterNoNormalized: normalizeMachineCenterNo("OMSO1 22 OZ")
  });
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile(), exact]
  });

  assert.equal(result.status, "TARGET_PROFILE_MATCHED_EXACT");
  assert.equal(result.targetProfile?.id, "profile-exact");
});

test("target profile generic fallback matches entity and bucket when exact machine center is absent", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile()]
  });

  assert.equal(result.status, "TARGET_PROFILE_MATCHED_ENTITY_BUCKET");
  assert.equal(result.targetProfile?.id, "profile-generic");
});

test("target profile lookup returns no active profile outside effective range", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2025-12-31",
    profiles: [profile()]
  });

  assert.equal(result.status, "NO_ACTIVE_TARGET_PROFILE");
  assert.equal(result.targetProfile, null);
});

test("inactive target profile is ignored", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile({ isActive: false })]
  });

  assert.equal(result.status, "NO_ACTIVE_TARGET_PROFILE");
});

test("unapproved target profile is ignored", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile({ approvalStatus: "draft" })]
  });

  assert.equal(result.status, "NO_ACTIVE_TARGET_PROFILE");
});

test("multiple exact target profile matches are reported without guessing", () => {
  const exactA = profile({
    id: "exact-a",
    machineCenterNo: "OMSO1 22 OZ",
    machineCenterNoNormalized: normalizeMachineCenterNo("OMSO1 22 OZ")
  });
  const exactB = profile({
    id: "exact-b",
    machineCenterNo: "OMSO1-22OZ",
    machineCenterNoNormalized: normalizeMachineCenterNo("OMSO1-22OZ")
  });
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [exactA, exactB]
  });

  assert.equal(result.status, "MULTIPLE_TARGET_PROFILE_MATCH");
  assert.deepEqual(result.targetProfiles.map((item) => item.id), ["exact-a", "exact-b"]);
});

test("multiple generic target profile matches are reported without guessing", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile({ id: "generic-a" }), profile({ id: "generic-b" })]
  });

  assert.equal(result.status, "MULTIPLE_TARGET_PROFILE_MATCH");
  assert.deepEqual(result.targetProfiles.map((item) => item.id), ["generic-a", "generic-b"]);
});

test("invalid target bucket is rejected before lookup", () => {
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "guess_me",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile()]
  });

  assert.equal(result.status, "INVALID_TARGET_BUCKET");
  assert.equal(result.targetProfile, null);
});

test("exact and generic target profiles both exist and exact wins", () => {
  const exact = profile({
    id: "profile-exact",
    machineCenterNo: "OMSO1 22 OZ",
    machineCenterNoNormalized: normalizeMachineCenterNo("OMSO1 22 OZ")
  });
  const result = resolveBusinessCentralTargetProfile({
    entityId: "entity-1",
    targetBucket: "OZ_22",
    machineCenterNo: "OMSO1 22 OZ",
    postingDate: "2026-02-01",
    profiles: [profile({ id: "generic" }), exact]
  });

  assert.equal(result.status, "TARGET_PROFILE_MATCHED_EXACT");
  assert.equal(result.targetProfile?.id, "profile-exact");
});

test("target profile normalizers keep P0.7 bucket and machine-center evidence stable", () => {
  assert.equal(normalizeTargetBucket("preform weight 27.5 gr"), "PREFORM_WEIGHT_27_5_GR");
  assert.equal(normalizeTargetBucket("botol-size-600-ml"), "BOTOL_SIZE_600_ML");
  assert.equal(normalizeTargetBucket("unknown"), "UNKNOWN");
  assert.equal(normalizeMachineCenterNo("OMSO1 22 OZ"), "OMSO122OZ");
});
