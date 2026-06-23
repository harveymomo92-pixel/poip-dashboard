import type { Request } from "express";

export const SESSION_COOKIE = "poip_session";

export function readSessionToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(";")) {
    const [name, ...valueParts] = item.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
