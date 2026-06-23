import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@poip/domain";
import { IS_PUBLIC_KEY } from "../../common/public.decorator.js";
import { REQUIRED_PERMISSIONS_KEY } from "../../common/permissions.decorator.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { readSessionToken } from "./cookie.js";
import { TokenService } from "./token.service.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);
    if (!token) throw new UnauthorizedException("Unauthorized");

    const payload = this.tokenService.verify(token);
    const principal = await this.authService.getPrincipal(payload.sub);
    request.user = principal;

    const requiredPermissions =
      this.reflector.getAllAndOverride<readonly Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (!this.authService.can(principal, requiredPermissions)) {
      throw new ForbiddenException("Forbidden");
    }

    return true;
  }
}
