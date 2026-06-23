import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { permissions, rolePermissions, roles, userRoles, users } from "@poip/db";
import {
  getPermissionsForRoles,
  isRole,
  type Permission,
  verifyPassword
} from "@poip/domain";
import { eq } from "drizzle-orm";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import type { AuthPrincipal } from "./auth.types.js";

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async validateLogin(email: string, password: string): Promise<AuthPrincipal> {
    const user = await this.findUserByEmail(email);
    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException("Email atau password tidak valid");
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Email atau password tidak valid");
    }

    return this.getPrincipal(user.id);
  }

  async getPrincipal(userId: string): Promise<AuthPrincipal> {
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Session tidak valid");
    }

    const roleRows = await this.database.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));
    const userRoleCodes = roleRows.map((row) => row.code).filter(isRole);
    const domainPermissions = getPermissionsForRoles(userRoleCodes);
    const databasePermissionRows = await this.database.db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, user.id));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: userRoleCodes,
      permissions:
        databasePermissionRows.length > 0
          ? domainPermissions.filter((permission) =>
              databasePermissionRows.some((row) => row.code === permission)
            )
          : domainPermissions
    };
  }

  can(principal: AuthPrincipal, requiredPermissions: readonly Permission[]): boolean {
    return requiredPermissions.every((permission) => principal.permissions.includes(permission));
  }

  private async findUserByEmail(email: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return user;
  }
}
