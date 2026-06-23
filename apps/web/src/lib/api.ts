export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

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
  };
  readonly meta: {
    readonly requestId: string;
  };
}

export type ApiResult<TData> = ApiEnvelope<TData> | ApiErrorEnvelope;

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}
