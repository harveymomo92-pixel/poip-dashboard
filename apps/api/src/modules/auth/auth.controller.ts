import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { Public } from "../../common/public.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { clearSessionCookie, sessionCookie } from "./cookie.js";
import { TokenService } from "./token.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(loginSchema, body);
    const principal = await this.authService.validateLogin(input.email, input.password);
    const token = this.tokenService.sign(principal.id);
    response.setHeader("Set-Cookie", sessionCookie(token));
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: principal.id,
      action: "auth.login",
      entityType: "user",
      entityId: principal.id,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });

    return { user: principal, token };
  }

  @Post("logout")
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    response.setHeader("Set-Cookie", clearSessionCookie());
    if (request.user) {
      await this.auditService.log({
        requestId: getRequestId(request),
        actorUserId: request.user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: request.user.id,
        ipAddress: request.ip ?? null,
        userAgent: userAgent(request)
      });
    }
    return { ok: true };
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }
}
