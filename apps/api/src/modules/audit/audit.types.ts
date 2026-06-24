export interface AuditListFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly entityType?: string;
  readonly action?: string;
  readonly actor?: string;
  readonly entityId?: string;
  readonly from?: string;
  readonly to?: string;
}
