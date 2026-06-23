import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, TokenService],
  exports: [AuthService, AuthGuard, TokenService]
})
export class AuthModule {}
