import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiEnvelopeInterceptor } from "../common/api-envelope.interceptor.js";
import { ApiExceptionFilter } from "../common/api-exception.filter.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthModule } from "./auth/auth.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DataQualityModule } from "./data-quality/data-quality.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DowntimeModule } from "./downtime/downtime.module.js";
import { HealthModule } from "./health/health.module.js";
import { OutputsModule } from "./outputs/outputs.module.js";
import { WaParserModule } from "./parser/wa-parser.module.js";
import { SyncModule } from "./sync/sync.module.js";
import { TargetsModule } from "./targets/targets.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    OutputsModule,
    SyncModule,
    TargetsModule,
    DowntimeModule,
    WaParserModule,
    DataQualityModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiEnvelopeInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter
    }
  ]
})
export class AppModule {}
