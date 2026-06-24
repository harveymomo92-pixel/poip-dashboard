export type DataQualityStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "IGNORED";

export interface DataQualityIssueFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: DataQualityStatus;
  readonly severity?: string;
  readonly source?: string;
  readonly issueCode?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface DataQualityStatusInput {
  readonly status: DataQualityStatus;
  readonly actorUserId: string | null;
  readonly note?: string;
}
