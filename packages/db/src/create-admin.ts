import { hashPassword } from "@poip/domain";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { eq, sql } from "drizzle-orm";
import { createDatabase } from "./client.js";
import { getDatabaseUrl } from "./env.js";
import { roles, userRoles, users } from "./schema.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function createAdminUser(): Promise<void> {
  const email = getRequiredEnv("ADMIN_EMAIL").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "System Admin").trim();
  const password = getRequiredEnv("ADMIN_PASSWORD");
  const passwordHash = await hashPassword(password);
  const { db, pool } = createDatabase({ connectionString: getDatabaseUrl() });

  try {
    await db.transaction(async (tx) => {
      const [adminRole] = await tx.select().from(roles).where(eq(roles.code, "Admin")).limit(1);
      if (!adminRole) {
        throw new Error("Admin role is missing. Run pnpm db:seed first.");
      }

      const [adminUser] = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          authProvider: "local",
          isActive: true
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name,
            passwordHash,
            authProvider: "local",
            isActive: true,
            updatedAt: sql`now()`
          }
        })
        .returning({ id: users.id });

      if (!adminUser) throw new Error("Admin user upsert failed");

      await tx
        .insert(userRoles)
        .values({ userId: adminUser.id, roleId: adminRole.id })
        .onConflictDoNothing();

      const auditDigest = createHash("sha256").update(email).digest("hex").slice(0, 12);
      console.log(`Created or updated admin user (${auditDigest}) and assigned Admin role.`);
    });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createAdminUser();
}
