export interface ApiEnvelope<TData> {
  readonly data: TData;
  readonly meta: {
    readonly requestId: string;
  };
}

export interface HealthResponse {
  readonly status: "ok";
  readonly service: "api";
}
