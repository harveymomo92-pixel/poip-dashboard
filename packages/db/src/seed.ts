import {
  permissionDescriptions,
  permissions as permissionCodes,
  roleDescriptions,
  rolePermissionMatrix,
  roles as roleCodes
} from "@poip/domain";
import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { createDatabase } from "./client.js";
import { getDatabaseUrl } from "./env.js";
import { permissions, rolePermissions, roles } from "./schema.js";

export async function seedRolesAndPermissions(): Promise<void> {
  const { db, pool } = createDatabase({ connectionString: getDatabaseUrl() });

  try {
    await db.transaction(async (tx) => {
      for (const roleCode of roleCodes) {
        await tx
          .insert(roles)
          .values({
            code: roleCode,
            name: roleCode,
            description: roleDescriptions[roleCode]
          })
          .onConflictDoUpdate({
            target: roles.code,
            set: {
              name: roleCode,
              description: roleDescriptions[roleCode]
            }
          });
      }

      for (const permissionCode of permissionCodes) {
        await tx
          .insert(permissions)
          .values({
            code: permissionCode,
            description: permissionDescriptions[permissionCode]
          })
          .onConflictDoUpdate({
            target: permissions.code,
            set: {
              description: permissionDescriptions[permissionCode]
            }
          });
      }

      await tx.delete(rolePermissions);

      const storedRoles = await tx.select().from(roles);
      const storedPermissions = await tx.select().from(permissions);
      const roleIdByCode = new Map(storedRoles.map((role) => [role.code, role.id]));
      const permissionIdByCode = new Map(
        storedPermissions.map((permission) => [permission.code, permission.id])
      );

      for (const roleCode of roleCodes) {
        const roleId = roleIdByCode.get(roleCode);
        if (!roleId) throw new Error(`Missing seeded role: ${roleCode}`);

        for (const permissionCode of rolePermissionMatrix[roleCode]) {
          const permissionId = permissionIdByCode.get(permissionCode);
          if (!permissionId) throw new Error(`Missing seeded permission: ${permissionCode}`);

          await tx
            .insert(rolePermissions)
            .values({ roleId, permissionId })
            .onConflictDoNothing();
        }
      }

      const [adminRole] = await tx.select().from(roles).where(eq(roles.code, "Admin")).limit(1);
      if (!adminRole) throw new Error("Admin role seed failed");
    });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedRolesAndPermissions();
  console.log("Seeded roles, permissions, and role-permission matrix.");
}
