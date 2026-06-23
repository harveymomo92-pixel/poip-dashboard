export interface ApiSuccessEnvelope<TData> {
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
