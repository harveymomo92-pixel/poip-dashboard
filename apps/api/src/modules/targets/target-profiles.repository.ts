import { Injectable } from "@nestjs/common";
import { targetProfiles } from "@poip/db";
import {
  normalizeMachineCenterNo,
  normalizeTargetBucket,
  resolveBusinessCentralTargetProfile,
  type TargetProfile,
  type TargetProfileLookupResult
} from "@poip/domain";
import { eq } from "drizzle-orm";
import type { DatabaseConnection } from "../database/database.module.js";

export interface CreateTargetProfileInput {
  readonly entityId: string;
  readonly machineCenterNo?: string | null;
  readonly targetBucket: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
  readonly targetQty: number;
  readonly unit?: string | null;
  readonly approvalStatus?: string | null;
  readonly source?: string | null;
  readonly notes?: string | null;
  readonly createdBy?: string | null;
  readonly updatedBy?: string | null;
}

export interface TargetProfileLookupRepositoryInput {
  readonly entityId?: string | null;
  readonly targetBucket?: string | null;
  readonly machineCenterNo?: string | null;
  readonly postingDate?: string | null;
}

interface TargetProfileRow {
  readonly id: string;
  readonly entity_id: string;
  readonly machine_center_no: string | null;
  readonly machine_center_no_normalized: string | null;
  readonly target_bucket: string;
  readonly target_bucket_normalized: string;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly target_qty: string | number;
  readonly unit: string;
  readonly is_active: boolean;
  readonly approval_status: string;
  readonly source: string | null;
  readonly notes: string | null;
}

function numberValue(value: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function serializeTargetProfile(row: TargetProfileRow): TargetProfile {
  return {
    id: row.id,
    entityId: row.entity_id,
    machineCenterNo: row.machine_center_no,
    machineCenterNoNormalized: row.machine_center_no_normalized,
    targetBucket: row.target_bucket,
    targetBucketNormalized: row.target_bucket_normalized,
    effectiveFrom: dateText(row.effective_from),
    effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
    targetQty: numberValue(row.target_qty),
    unit: row.unit,
    isActive: row.is_active,
    approvalStatus: row.approval_status,
    source: row.source,
    notes: row.notes
  };
}

@Injectable()
export class TargetProfilesRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async listTargetProfilesByEntity(entityId: string): Promise<readonly TargetProfile[]> {
    const result = await this.database.pool.query<TargetProfileRow>(
      `
        select id,
               entity_id,
               machine_center_no,
               machine_center_no_normalized,
               target_bucket,
               target_bucket_normalized,
               effective_from::text,
               effective_to::text,
               target_qty,
               unit,
               is_active,
               approval_status,
               source,
               notes
        from target_profiles
        where entity_id = $1
        order by target_bucket_normalized, machine_center_no_normalized nulls first, effective_from desc
      `,
      [entityId]
    );
    return result.rows.map(serializeTargetProfile);
  }

  async listActiveApprovedTargetProfilesForLookup(
    input: TargetProfileLookupRepositoryInput
  ): Promise<readonly TargetProfile[]> {
    const entityId = input.entityId?.trim();
    if (!entityId) return [];
    const normalizedBucket = normalizeTargetBucket(input.targetBucket);
    const bucketCandidates = normalizedBucket && normalizedBucket !== "DEFAULT" && normalizedBucket !== "UNKNOWN"
      ? [normalizedBucket, "DEFAULT", "UNKNOWN"]
      : ["DEFAULT", "UNKNOWN"];
    const result = await this.database.pool.query<TargetProfileRow>(
      `
        select id,
               entity_id,
               machine_center_no,
               machine_center_no_normalized,
               target_bucket,
               target_bucket_normalized,
               effective_from::text,
               effective_to::text,
               target_qty,
               unit,
               is_active,
               approval_status,
               source,
               notes
        from target_profiles
        where entity_id = $1
          and is_active = true
          and upper(approval_status) = 'APPROVED'
          and target_bucket_normalized = any($2::text[])
        order by target_bucket_normalized, machine_center_no_normalized nulls first, effective_from desc
      `,
      [entityId, bucketCandidates]
    );
    return result.rows.map(serializeTargetProfile);
  }

  async createTargetProfile(input: CreateTargetProfileInput): Promise<TargetProfile> {
    const targetBucketNormalized = normalizeTargetBucket(input.targetBucket);
    if (!targetBucketNormalized) throw new Error("Invalid target bucket");
    const machineCenterNoNormalized = normalizeMachineCenterNo(input.machineCenterNo);
    const [created] = await this.database.db
      .insert(targetProfiles)
      .values({
        entityId: input.entityId,
        machineCenterNo: input.machineCenterNo?.trim() || null,
        machineCenterNoNormalized,
        targetBucket: input.targetBucket.trim(),
        targetBucketNormalized,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        targetQty: input.targetQty.toString(),
        unit: input.unit?.trim() || "PCS",
        approvalStatus: input.approvalStatus?.trim() || "draft",
        source: input.source?.trim() || "manual",
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
        updatedBy: input.updatedBy ?? null
      })
      .returning({ id: targetProfiles.id });
    if (!created) throw new Error("Target profile create failed");
    const [row] = await this.database.db
      .select()
      .from(targetProfiles)
      .where(eq(targetProfiles.id, created.id))
      .limit(1);
    if (!row) throw new Error("Target profile not found after create");
    return {
      id: row.id,
      entityId: row.entityId,
      machineCenterNo: row.machineCenterNo,
      machineCenterNoNormalized: row.machineCenterNoNormalized,
      targetBucket: row.targetBucket,
      targetBucketNormalized: row.targetBucketNormalized,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      targetQty: numberValue(row.targetQty),
      unit: row.unit,
      isActive: row.isActive,
      approvalStatus: row.approvalStatus,
      source: row.source,
      notes: row.notes
    };
  }

  async dryRunLookup(input: TargetProfileLookupRepositoryInput): Promise<TargetProfileLookupResult> {
    const profiles = await this.listActiveApprovedTargetProfilesForLookup(input);
    return resolveBusinessCentralTargetProfile({
      entityId: input.entityId ?? null,
      targetBucket: input.targetBucket ?? null,
      machineCenterNo: input.machineCenterNo ?? null,
      postingDate: input.postingDate ?? null,
      profiles
    });
  }
}
