import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import { TargetsController } from "./targets.controller.js";
import { TargetsRepository } from "./targets.repository.js";
import { TargetsService } from "./targets.service.js";

@Module({
  imports: [AuditModule],
  controllers: [TargetsController],
  providers: [
    TargetsService,
    {
      provide: TargetsRepository,
      useFactory: (database: DatabaseConnection) => new TargetsRepository(database),
      inject: [DATABASE]
    }
  ]
})
export class TargetsModule {}
