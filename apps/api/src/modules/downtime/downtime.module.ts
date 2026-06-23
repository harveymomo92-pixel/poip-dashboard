import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import { DowntimeController } from "./downtime.controller.js";
import { DowntimeRepository } from "./downtime.repository.js";
import { DowntimeService } from "./downtime.service.js";

@Module({
  imports: [AuditModule],
  controllers: [DowntimeController],
  providers: [
    DowntimeService,
    {
      provide: DowntimeRepository,
      useFactory: (database: DatabaseConnection) => new DowntimeRepository(database),
      inject: [DATABASE]
    }
  ]
})
export class DowntimeModule {}
