import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });
config();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function optionalEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value : null;
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function getDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}
