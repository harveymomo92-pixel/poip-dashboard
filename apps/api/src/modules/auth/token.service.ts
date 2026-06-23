import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

interface TokenPayload {
  readonly sub: string;
  readonly exp: number;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SECRET or SESSION_SECRET is required");
  return secret;
}

@Injectable()
export class TokenService {
  sign(userId: string, now = new Date()): string {
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
      sub: userId,
      exp: Math.floor(now.getTime() / 1000) + 8 * 60 * 60
    } satisfies TokenPayload);
    const signature = this.signContent(`${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  verify(token: string, now = new Date()): TokenPayload {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) {
      throw new UnauthorizedException("Invalid session");
    }

    const expected = this.signContent(`${header}.${payload}`);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid session");
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    if (!decoded.sub || decoded.exp <= Math.floor(now.getTime() / 1000)) {
      throw new UnauthorizedException("Session expired");
    }
    return decoded;
  }

  private signContent(content: string): string {
    return createHmac("sha256", getSecret()).update(content).digest("base64url");
  }
}
