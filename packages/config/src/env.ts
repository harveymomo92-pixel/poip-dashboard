export const requiredEnvironment = [
  "APP_TIMEZONE",
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET"
] as const;

export type RequiredEnvironmentKey = (typeof requiredEnvironment)[number];
