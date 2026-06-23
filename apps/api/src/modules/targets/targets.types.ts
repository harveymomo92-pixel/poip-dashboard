export const targetStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "INACTIVE",
  "SUPERSEDED"
] as const;

export type TargetStatus = (typeof targetStatuses)[number];

export interface TargetEntityDto {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly area: string | null;
  readonly lineCode: string | null;
}

export interface ProductionTargetDto {
  readonly id: string;
  readonly entityId: string;
  readonly entityCode: string;
  readonly entityName: string;
  readonly targetVersion: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly dailyTargetQty: number;
  readonly rejectTargetPct: number | null;
  readonly minAchievementPct: number;
  readonly maxAchievementPct: number;
  readonly status: TargetStatus;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export interface TargetListFilters {
  readonly from?: string;
  readonly to?: string;
  readonly entityId?: string;
  readonly entity?: string;
  readonly status?: TargetStatus;
  readonly page: number;
  readonly pageSize: number;
}

export interface TargetListResult {
  readonly rows: readonly ProductionTargetDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

export interface CreateTargetInput {
  readonly entityId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
  readonly dailyTargetQty: number;
  readonly rejectTargetPct?: number | null;
  readonly minAchievementPct: number;
  readonly maxAchievementPct: number;
  readonly createdBy?: string | null;
}

export interface UpdateTargetInput {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string | null;
  readonly dailyTargetQty?: number;
  readonly rejectTargetPct?: number | null;
  readonly minAchievementPct?: number;
  readonly maxAchievementPct?: number;
  readonly createdBy?: string | null;
}
