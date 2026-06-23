import { randomUUID } from "node:crypto";
import type { Request } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export function getRequestId(request: Request): string {
  const existing = request.headers[REQUEST_ID_HEADER];
  if (typeof existing === "string" && existing.length > 0) return existing;

  const generated = randomUUID();
  request.headers[REQUEST_ID_HEADER] = generated;
  return generated;
}
