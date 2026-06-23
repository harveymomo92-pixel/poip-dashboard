export const downtimeStatuses = ["OPEN", "CLOSED"] as const;
export const downtimeSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type DowntimeStatus = (typeof downtimeStatuses)[number];
export type DowntimeSeverity = (typeof downtimeSeverities)[number];

export interface DowntimeEntityDto {
  readonly id: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly area: string | null;
  readonly lineCode: string | null;
}

export interface DowntimeEventDto {
  readonly id: string;
  readonly eventDate: string;
  readonly shiftCode: string | null;
  readonly area: string | null;
  readonly entityId: string | null;
  readonly entityCode: string | null;
  readonly entityName: string | null;
  readonly machineCode: string | null;
  readonly lineCode: string | null;
  readonly category: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly durationMinutes: number;
  readonly status: DowntimeStatus;
  readonly severity: DowntimeSeverity;
  readonly rootCause: string | null;
  readonly actionTaken: string | null;
  readonly sourceType: string;
  readonly naturalKey: string;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DowntimeListFilters {
  readonly from?: string;
  readonly to?: string;
  readonly entityId?: string;
  readonly machine?: string;
  readonly status?: DowntimeStatus;
  readonly category?: string;
  readonly shiftCode?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface DowntimeListResult {
  readonly rows: readonly DowntimeEventDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalRows: number;
    readonly totalPages: number;
  };
}

export interface CreateDowntimeInput {
  readonly eventDate: string;
  readonly shiftCode?: string | null;
  readonly area?: string | null;
  readonly entityId?: string | null;
  readonly machineCode?: string | null;
  readonly lineCode?: string | null;
  readonly category: string;
  readonly startTime: Date;
  readonly endTime?: Date | null;
  readonly severity: DowntimeSeverity;
  readonly rootCause?: string | null;
  readonly actionTaken?: string | null;
  readonly sourceType?: string;
  readonly sourceLine?: string | null;
  readonly createdBy?: string | null;
}

export interface UpdateDowntimeInput {
  readonly eventDate?: string;
  readonly shiftCode?: string | null;
  readonly area?: string | null;
  readonly entityId?: string | null;
  readonly machineCode?: string | null;
  readonly lineCode?: string | null;
  readonly category?: string;
  readonly startTime?: Date;
  readonly severity?: DowntimeSeverity;
  readonly rootCause?: string | null;
  readonly actionTaken?: string | null;
  readonly updatedBy?: string | null;
}

export interface CloseDowntimeInput {
  readonly endTime: Date;
  readonly rootCause: string;
  readonly actionTaken: string;
  readonly updatedBy?: string | null;
}
