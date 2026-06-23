import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@poip/domain";

export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
