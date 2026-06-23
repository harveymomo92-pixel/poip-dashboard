import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { roles as domainRoles, type Role } from "@poip/domain";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { getRequestId } from "../../common/request-context.js";
import { parseBody } from "../../common/validation.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UsersService } from "./users.service.js";

const roleSchema = z.enum(domainRoles);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(roleSchema).min(1)
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    roles: z.array(roleSchema).min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0);

function roleArray(values: readonly Role[]): readonly Role[] {
  return values;
}

function userAgent(request: Request): string | null {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : null;
}

@Controller("users")
@RequirePermissions("users.manage")
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  @Get()
  listUsers() {
    return this.usersService.listUsers();
  }

  @Post()
  async createUser(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const input = parseBody(createUserSchema, body);
    const user = await this.usersService.createUser({
      ...input,
      roles: roleArray(input.roles)
    });
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      afterValue: user,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
    return user;
  }

  @Patch(":id")
  async updateUser(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest
  ) {
    const input = parseBody(updateUserSchema, body);
    const before = await this.usersService.getUserOrThrow(id);
    const updateInput = {
      ...(input.name ? { name: input.name } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
      ...(input.roles ? { roles: roleArray(input.roles) } : {})
    };
    const user = await this.usersService.updateUser(id, updateInput);
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action: "user.update",
      entityType: "user",
      entityId: user.id,
      beforeValue: {
        id: before.id,
        email: before.email,
        name: before.name,
        isActive: before.isActive
      },
      afterValue: user,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
    return user;
  }

  @Post(":id/disable")
  async disableUser(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const before = await this.usersService.getUserOrThrow(id);
    const user = await this.usersService.disableUser(id);
    await this.auditService.log({
      requestId: getRequestId(request),
      actorUserId: request.user?.id ?? null,
      action: "user.disable",
      entityType: "user",
      entityId: user.id,
      beforeValue: {
        id: before.id,
        email: before.email,
        name: before.name,
        isActive: before.isActive
      },
      afterValue: user,
      ipAddress: request.ip ?? null,
      userAgent: userAgent(request)
    });
    return user;
  }
}
