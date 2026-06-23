import { Global, Module } from "@nestjs/common";
import { config } from "dotenv";
import { resolve } from "node:path";
import { createDatabase } from "@poip/db";

export const DATABASE = Symbol("DATABASE");

export type DatabaseConnection = ReturnType<typeof createDatabase>;

function getDatabaseUrl(): string {
  config({ path: resolve(process.cwd(), "../../.env") });
  config();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => createDatabase({ connectionString: getDatabaseUrl() })
    }
  ],
  exports: [DATABASE]
})
export class DatabaseModule {}
