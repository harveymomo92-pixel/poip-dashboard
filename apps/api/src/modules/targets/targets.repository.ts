import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { masterEntities, productionTargets } from "@poip/db";
import {
  canTransitionTargetStatus,
  findOverlappingActiveTargets,
  type TargetWorkflowStatus
} from "@poip/domain";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../database/database.module.js";
import type {
  CreateTargetInput,
  ProductionTargetDto,
  TargetEntityDto,
  TargetListFilters,
  TargetListResult,
  TargetStatus,
  UpdateTargetInput
} from "./targets.types.js";

interface SqlParts {
  readonly where: string;
  readonly params: unknown[];
}

interface TargetRow {
  readonly id: string;
  readonly entity_id: string;
  readonly entity_code: string;
  readonly entity_name: string;
  readonly target_version: string | number;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly daily_target_qty: string | number;
  readonly reject_target_pct: string | number | null;
  readonly min_achievement_pct: string | number;
  readonly max_achievement_pct: string | number;
  readonly status: string;
  readonly approved_by: string | null;
  readonly approved_at: Date | string | null;
  readonly created_by: string | null;
  readonly created_at: Date | string;
}

interface ActiveTargetRow {
  readonly id: string;
  readonly entityId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: string;
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timestampText(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function serializeTarget(row: TargetRow): ProductionTargetDto {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityName: row.entity_name,
    targetVersion: numberValue(row.target_version),
    effectiveFrom: dateText(row.effective_from),
    effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
    dailyTargetQty: numberValue(row.daily_target_qty),
    rejectTargetPct: row.reject_target_pct === null ? null : numberValue(row.reject_target_pct),
    minAchievementPct: numberValue(row.min_achievement_pct),
    maxAchievementPct: numberValue(row.max_achievement_pct),
    status: row.status as TargetStatus,
    approvedBy: row.approved_by,
    approvedAt: timestampText(row.approved_at),
    createdBy: row.created_by,
    createdAt: timestampText(row.created_at) ?? new Date().toISOString()
  };
}

function buildListWhere(filters: TargetListFilters): SqlParts {
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`(pt.effective_to is null or pt.effective_to >= $${params.length})`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`pt.effective_from <= $${params.length}`);
  }
  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`pt.entity_id = $${params.length}`);
  }
  if (filters.entity) {
    params.push(`%${filters.entity.toLowerCase()}%`);
    clauses.push(
      `(lower(me.entity_code) like $${params.length} or lower(me.display_name) like $${params.length})`
    );
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`pt.status = $${params.length}`);
  }

  return { where: clauses.join(" and "), params };
}

function targetValues(input: CreateTargetInput | UpdateTargetInput) {
  return {
    ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    ...(typeof input.dailyTargetQty === "number"
      ? { dailyTargetQty: input.dailyTargetQty.toString() }
      : {}),
    ...(input.rejectTargetPct !== undefined
      ? { rejectTargetPct: input.rejectTargetPct === null ? null : input.rejectTargetPct.toString() }
      : {}),
    ...(typeof input.minAchievementPct === "number"
      ? { minAchievementPct: input.minAchievementPct.toString() }
      : {}),
    ...(typeof input.maxAchievementPct === "number"
      ? { maxAchievementPct: input.maxAchievementPct.toString() }
      : {})
  };
}

@Injectable()
export class TargetsRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async listEntities(): Promise<readonly TargetEntityDto[]> {
    const result = await this.database.db
      .select({
        id: masterEntities.id,
        entityCode: masterEntities.entityCode,
        displayName: masterEntities.displayName,
        area: masterEntities.area,
        lineCode: masterEntities.lineCode
      })
      .from(masterEntities)
      .where(eq(masterEntities.isActive, true))
      .orderBy(masterEntities.entityCode);
    return result;
  }

  async listTargets(filters: TargetListFilters): Promise<TargetListResult> {
    const where = buildListWhere(filters);
    const offset = (filters.page - 1) * filters.pageSize;
    const countResult = await this.database.pool.query<{ total: string | number }>(
      `
        select count(*) as total
        from production_targets pt
        inner join master_entities me on me.id = pt.entity_id
        where ${where.where}
      `,
      where.params
    );
    const targetResult = await this.database.pool.query<TargetRow>(
      `
        select
          pt.id,
          pt.entity_id,
          me.entity_code,
          me.display_name as entity_name,
          pt.target_version,
          pt.effective_from::text,
          pt.effective_to::text,
          pt.daily_target_qty,
          pt.reject_target_pct,
          pt.min_achievement_pct,
          pt.max_achievement_pct,
          pt.status,
          pt.approved_by,
          pt.approved_at,
          pt.created_by,
          pt.created_at
        from production_targets pt
        inner join master_entities me on me.id = pt.entity_id
        where ${where.where}
        order by pt.effective_from desc, me.entity_code asc, pt.target_version desc
        limit $${where.params.length + 1}
        offset $${where.params.length + 2}
      `,
      [...where.params, filters.pageSize, offset]
    );
    const totalRows = numberValue(countResult.rows[0]?.total);
    return {
      rows: targetResult.rows.map(serializeTarget),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async getTarget(id: string): Promise<ProductionTargetDto | null> {
    const result = await this.database.pool.query<TargetRow>(
      `
        select
          pt.id,
          pt.entity_id,
          me.entity_code,
          me.display_name as entity_name,
          pt.target_version,
          pt.effective_from::text,
          pt.effective_to::text,
          pt.daily_target_qty,
          pt.reject_target_pct,
          pt.min_achievement_pct,
          pt.max_achievement_pct,
          pt.status,
          pt.approved_by,
          pt.approved_at,
          pt.created_by,
          pt.created_at
        from production_targets pt
        inner join master_entities me on me.id = pt.entity_id
        where pt.id = $1
        limit 1
      `,
      [id]
    );
    return result.rows[0] ? serializeTarget(result.rows[0]) : null;
  }

  async getTargetOrThrow(id: string): Promise<ProductionTargetDto> {
    const target = await this.getTarget(id);
    if (!target) throw new NotFoundException("Target not found");
    return target;
  }

  async listOverlappingActiveTargetsForTarget(id: string): Promise<readonly ProductionTargetDto[]> {
    const target = await this.getTargetOrThrow(id);
    const activeTargets = await this.listActiveTargets(target.entityId, id);
    return findOverlappingActiveTargets(
      {
        entityId: target.entityId,
        effectiveFrom: target.effectiveFrom,
        effectiveTo: target.effectiveTo
      },
      activeTargets
    );
  }

  async createTarget(input: CreateTargetInput): Promise<ProductionTargetDto> {
    await this.ensureEntityExists(input.entityId);
    const createdId = await this.database.db.transaction(async (tx) => {
      const targetVersion = await this.nextTargetVersion(input.entityId, tx);
      const [target] = await tx
        .insert(productionTargets)
        .values({
          entityId: input.entityId,
          targetVersion,
          status: "DRAFT",
          createdBy: input.createdBy ?? null,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
          dailyTargetQty: input.dailyTargetQty.toString(),
          rejectTargetPct: input.rejectTargetPct === null || input.rejectTargetPct === undefined
            ? null
            : input.rejectTargetPct.toString(),
          minAchievementPct: input.minAchievementPct.toString(),
          maxAchievementPct: input.maxAchievementPct.toString()
        })
        .returning({ id: productionTargets.id });
      if (!target) throw new Error("Target create failed");
      return target.id;
    });
    return this.getTargetOrThrow(createdId);
  }

  async updateTarget(id: string, input: UpdateTargetInput): Promise<ProductionTargetDto> {
    const before = await this.getTargetOrThrow(id);
    const effectiveFrom = input.effectiveFrom ?? before.effectiveFrom;
    const effectiveTo = input.effectiveTo !== undefined ? input.effectiveTo : before.effectiveTo;
    if (effectiveTo && effectiveFrom > effectiveTo) {
      throw new ConflictException("effectiveTo must be after effectiveFrom");
    }

    if (before.status === "DRAFT") {
      const [updated] = await this.database.db
        .update(productionTargets)
        .set(targetValues(input))
        .where(eq(productionTargets.id, id))
        .returning({ id: productionTargets.id });
      if (!updated) throw new NotFoundException("Target not found");
      return this.getTargetOrThrow(updated.id);
    }

    const replacement = await this.createTarget({
      entityId: before.entityId,
      effectiveFrom,
      effectiveTo,
      dailyTargetQty: input.dailyTargetQty ?? before.dailyTargetQty,
      rejectTargetPct:
        input.rejectTargetPct !== undefined ? input.rejectTargetPct : before.rejectTargetPct,
      minAchievementPct: input.minAchievementPct ?? before.minAchievementPct,
      maxAchievementPct: input.maxAchievementPct ?? before.maxAchievementPct,
      createdBy: input.createdBy ?? null
    });
    return replacement;
  }

  async submitTarget(id: string): Promise<ProductionTargetDto> {
    const target = await this.getTargetOrThrow(id);
    if (!this.canTransition(target.status, "SUBMITTED")) {
      throw new ConflictException("Only draft or rejected targets can be submitted");
    }
    if (target.status === "SUBMITTED") return target;
    await this.database.db
      .update(productionTargets)
      .set({ status: "SUBMITTED" })
      .where(eq(productionTargets.id, id));
    return this.getTargetOrThrow(id);
  }

  async approveTarget(id: string, approvedBy: string | null): Promise<ProductionTargetDto> {
    const target = await this.getTargetOrThrow(id);
    if (!this.canTransition(target.status, "APPROVED")) {
      throw new ConflictException("Only draft or submitted targets can be approved");
    }
    if (target.status === "APPROVED") return target;

    await this.database.db.transaction(async (tx) => {
      const activeTargets = await tx
        .select({
          id: productionTargets.id,
          entityId: productionTargets.entityId,
          effectiveFrom: productionTargets.effectiveFrom,
          effectiveTo: productionTargets.effectiveTo,
          status: productionTargets.status
        })
        .from(productionTargets)
        .where(
          and(
            eq(productionTargets.entityId, target.entityId),
            ne(productionTargets.id, id),
            inArray(productionTargets.status, ["APPROVED", "ACTIVE"])
          )
        );
      const overlaps = findOverlappingActiveTargets(
        {
          entityId: target.entityId,
          effectiveFrom: target.effectiveFrom,
          effectiveTo: target.effectiveTo
        },
        activeTargets.map((row): ActiveTargetRow => ({
          id: row.id,
          entityId: row.entityId,
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
          status: row.status
        }))
      );
      if (overlaps.length > 0) {
        await tx
          .update(productionTargets)
          .set({ status: "SUPERSEDED" })
          .where(inArray(productionTargets.id, overlaps.map((row) => row.id)));
      }
      await tx
        .update(productionTargets)
        .set({
          status: "APPROVED",
          approvedBy,
          approvedAt: new Date()
        })
        .where(eq(productionTargets.id, id));
    });

    return this.getTargetOrThrow(id);
  }

  async rejectTarget(id: string): Promise<ProductionTargetDto> {
    const target = await this.getTargetOrThrow(id);
    if (!this.canTransition(target.status, "REJECTED")) {
      throw new ConflictException("Only draft or submitted targets can be rejected");
    }
    if (target.status === "REJECTED") return target;
    await this.database.db
      .update(productionTargets)
      .set({ status: "REJECTED" })
      .where(eq(productionTargets.id, id));
    return this.getTargetOrThrow(id);
  }

  async deactivateTarget(id: string): Promise<ProductionTargetDto> {
    const target = await this.getTargetOrThrow(id);
    if (!this.canTransition(target.status, "INACTIVE")) {
      throw new ConflictException("Only approved or active targets can be deactivated");
    }
    if (target.status === "INACTIVE") return target;
    await this.database.db
      .update(productionTargets)
      .set({ status: "INACTIVE" })
      .where(eq(productionTargets.id, id));
    return this.getTargetOrThrow(id);
  }

  private async ensureEntityExists(entityId: string): Promise<void> {
    const [entity] = await this.database.db
      .select({ id: masterEntities.id })
      .from(masterEntities)
      .where(eq(masterEntities.id, entityId))
      .limit(1);
    if (!entity) throw new NotFoundException("Master entity not found");
  }

  private async listActiveTargets(
    entityId: string,
    excludedId: string
  ): Promise<readonly ProductionTargetDto[]> {
    const result = await this.database.pool.query<TargetRow>(
      `
        select
          pt.id,
          pt.entity_id,
          me.entity_code,
          me.display_name as entity_name,
          pt.target_version,
          pt.effective_from::text,
          pt.effective_to::text,
          pt.daily_target_qty,
          pt.reject_target_pct,
          pt.min_achievement_pct,
          pt.max_achievement_pct,
          pt.status,
          pt.approved_by,
          pt.approved_at,
          pt.created_by,
          pt.created_at
        from production_targets pt
        inner join master_entities me on me.id = pt.entity_id
        where pt.entity_id = $1
          and pt.id <> $2
          and pt.status in ('APPROVED', 'ACTIVE')
      `,
      [entityId, excludedId]
    );
    return result.rows.map(serializeTarget);
  }

  private canTransition(from: TargetStatus, to: TargetWorkflowStatus): boolean {
    return canTransitionTargetStatus(from as TargetWorkflowStatus, to);
  }

  private async nextTargetVersion(
    entityId: string,
    tx: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0]
  ): Promise<number> {
    const [row] = await tx
      .select({
        nextVersion: sql<number>`coalesce(max(${productionTargets.targetVersion}), 0) + 1`
      })
      .from(productionTargets)
      .where(eq(productionTargets.entityId, entityId));
    return numberValue(row?.nextVersion) || 1;
  }
}
