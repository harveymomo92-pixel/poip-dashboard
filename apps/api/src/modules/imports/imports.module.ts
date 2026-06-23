import { Module } from "@nestjs/common";
import { DATABASE } from "../database/database.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { ImportsController } from "./imports.controller.js";
import { ImportsRepository } from "./imports.repository.js";
import { ImportsService } from "./imports.service.js";

@Module({
  imports: [AuditModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    {
      provide: ImportsRepository,
      useFactory: (database: never) => new ImportsRepository(database),
      inject: [DATABASE]
    }
  ]
})
export class ImportsModule {}
