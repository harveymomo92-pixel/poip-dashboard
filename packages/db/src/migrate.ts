import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { getDatabaseUrl } from "./env.js";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

async function ensureMigrationTable(client: pg.Client): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function hasMigration(client: pg.Client, id: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "select exists(select 1 from schema_migrations where id = $1) as exists",
    [id]
  );
  return result.rows[0]?.exists ?? false;
}

export async function runMigrations(): Promise<void> {
  const client = new pg.Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    await ensureMigrationTable(client);
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      const migrationId = basename(file, ".sql");
      if (await hasMigration(client, migrationId)) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (id) values ($1)", [migrationId]);
        await client.query("commit");
        console.log(`Applied migration ${migrationId}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runMigrations();
}
