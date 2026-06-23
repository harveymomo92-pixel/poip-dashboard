import type { Permission, Role } from "@poip/domain";
import type { Request } from "express";

export interface AuthPrincipal {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly Role[];
  readonly permissions: readonly Permission[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPrincipal;
}
