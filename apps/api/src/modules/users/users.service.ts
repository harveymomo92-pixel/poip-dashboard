import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { roles, userRoles, users } from "@poip/db";
import { hashPassword, isRole, type Role } from "@poip/domain";
import { eq, inArray, sql } from "drizzle-orm";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly roles: readonly Role[];
}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly roles: readonly Role[];
}

export interface UpdateUserInput {
  readonly name?: string;
  readonly isActive?: boolean;
  readonly roles?: readonly Role[];
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseConnection) {}

  async listUsers(): Promise<UserSummary[]> {
    const allUsers = await this.database.db.select().from(users);
    return Promise.all(allUsers.map((user) => this.toSummary(user)));
  }

  async createUser(input: CreateUserInput): Promise<UserSummary> {
    const existing = await this.findByEmail(input.email);
    if (existing) throw new ConflictException("Email already exists");

    const passwordHash = await hashPassword(input.password);
    const created = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          passwordHash,
          authProvider: "local",
          isActive: true
        })
        .returning();
      if (!user) throw new Error("User create failed");
      await this.replaceRoles(user.id, input.roles, tx);
      return user;
    });

    return this.toSummary(created);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserSummary> {
    const before = await this.getUserOrThrow(id);
    const updated = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({
          name: input.name?.trim() ?? before.name,
          isActive: input.isActive ?? before.isActive,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, id))
        .returning();
      if (!user) throw new NotFoundException("User not found");
      if (input.roles) await this.replaceRoles(user.id, input.roles, tx);
      return user;
    });

    return this.toSummary(updated);
  }

  async disableUser(id: string): Promise<UserSummary> {
    return this.updateUser(id, { isActive: false });
  }

  async getUserOrThrow(id: string) {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async findByEmail(email: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return user;
  }

  private async toSummary(user: typeof users.$inferSelect): Promise<UserSummary> {
    const assignedRoles = await this.database.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles: assignedRoles.map((role) => role.code).filter(isRole)
    };
  }

  private async replaceRoles(
    userId: string,
    roleCodes: readonly Role[],
    tx: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0]
  ): Promise<void> {
    if (roleCodes.length === 0) return;
    const targetRoles = await tx.select().from(roles).where(inArray(roles.code, [...roleCodes]));
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    for (const role of targetRoles) {
      await tx.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();
    }
  }
}
