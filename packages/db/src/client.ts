import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export interface DatabaseConfig {
  readonly connectionString: string;
}

export function createDatabase(config: DatabaseConfig) {
  const pool = new pg.Pool({ connectionString: config.connectionString });
  return {
    pool,
    db: drizzle(pool)
  };
}
