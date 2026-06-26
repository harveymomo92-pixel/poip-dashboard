export interface ApiEnvelope<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly meta: {
    readonly requestId: string;
    readonly generatedAt: string;
  };
}

export interface ApiErrorEnvelope {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly meta: {
    readonly requestId: string;
  };
}

export interface HealthResponse {
  readonly status: "ok";
  readonly service: "api";
}

export interface CurrentUserResponse {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly roles: readonly string[];
    readonly permissions: readonly string[];
  };
}

export type BusinessCentralMappingResetSourceField =
  | "prod_line_description"
  | "prod_line_no"
  | "machine_center_no"
  | "machine_description";

export interface BusinessCentralMappingResetRequest {
  readonly sourceField: BusinessCentralMappingResetSourceField;
  readonly sourceValue: string;
}

export interface BusinessCentralMappingResetCommitRequest extends BusinessCentralMappingResetRequest {
  readonly confirmation: "RESET";
}

export interface BusinessCentralMappingResetResponse {
  readonly sourceSystem: "business-central";
  readonly sourceField: BusinessCentralMappingResetSourceField;
  readonly sourceValue: string;
  readonly mode: "preview" | "commit";
  readonly totalOutputRows: number;
  readonly mappedOutputRowsBefore: number;
  readonly mappedOutputRowsAfter: number;
  readonly aliasesMatched: number;
  readonly aliasesDeactivated: number;
  readonly aliasesActiveAfter: number;
  readonly affectedEntities: readonly {
    readonly entityId: string;
    readonly entityCode: string;
    readonly displayName: string;
    readonly mappedOutputRows: number;
    readonly activeAliasRows: number;
  }[];
  readonly warnings: readonly string[];
}
