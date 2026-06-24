export interface DashboardFilters {
  readonly from: string;
  readonly to: string;
  readonly entityId?: string;
  readonly machineCenterNo?: string;
  readonly itemNo?: string;
  readonly shiftCode?: string;
  readonly sourceSystem: string;
}

export interface OutputListFilters extends DashboardFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: "postingDate" | "entryNo" | "itemNo" | "machineCenterNo" | "quantity";
  readonly sortDir: "asc" | "desc";
}

export interface OutputRowDto {
  readonly id: string;
  readonly sourceSystem: string;
  readonly entryNo: string | null;
  readonly postingDate: string;
  readonly documentNo: string | null;
  readonly normalizedOutputType: string;
  readonly itemNo: string;
  readonly itemDescription: string | null;
  readonly machineCenterNo: string | null;
  readonly entityId: string | null;
  readonly entityName: string | null;
  readonly shiftCode: string | null;
  readonly quantity: number;
  readonly uom: string | null;
  readonly rejectKg: number;
  readonly rejectPcsEq: number | null;
  readonly syncRunId: string | null;
}

export interface OutputListResult {
  readonly rows: readonly OutputRowDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

export interface TrendRow {
  readonly postingDate: string;
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly rejectPcsEquivalent: number;
  readonly prorataTarget: number;
  readonly achievementPct: number | null;
}

export interface BreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly outputOkQty: number;
  readonly rejectKg: number;
  readonly rejectPcsEquivalent: number;
  readonly rowCount: number;
}

export interface DataQualitySummaryDto {
  readonly openIssues: number;
  readonly criticalIssues: number;
  readonly warningIssues: number;
  readonly infoIssues: number;
  readonly byCode: readonly {
    readonly issueCode: string;
    readonly count: number;
  }[];
}

export interface DowntimeSummaryDto {
  readonly totalDurationMinutes: number;
  readonly openEventCount: number;
  readonly eventCount: number;
  readonly topCategories: readonly {
    readonly category: string;
    readonly durationMinutes: number;
    readonly eventCount: number;
  }[];
  readonly topEntities: readonly {
    readonly label: string;
    readonly durationMinutes: number;
    readonly eventCount: number;
  }[];
}

export interface DashboardSummaryDto {
  readonly filters: DashboardFilters;
  readonly kpis: {
    readonly outputOkQty: number;
    readonly prorataTarget: number;
    readonly achievementPct: number | null;
    readonly targetStatus: string;
    readonly targetStatusReason: string | null;
    readonly rejectKg: number;
    readonly rejectPcsEquivalent: number;
    readonly rejectConversionStatus: string;
    readonly rejectRatePct: number | null;
    readonly activeDays: number;
    readonly incompleteRejectConversionCount: number;
  };
  readonly dataFreshness: {
    readonly status: string;
    readonly freshnessMinutes: number | null;
    readonly latestSuccessfulSyncFinishedAt: string | null;
  };
  readonly targetCoverage: {
    readonly activeEntityDays: number;
    readonly missingTargetEntityDays: number;
  };
  readonly dataQuality: DataQualitySummaryDto;
  readonly downtime: DowntimeSummaryDto;
}
