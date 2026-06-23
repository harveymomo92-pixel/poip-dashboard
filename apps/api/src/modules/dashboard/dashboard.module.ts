import { Module } from "@nestjs/common";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardReadRepository } from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: DashboardReadRepository,
      useFactory: (database: DatabaseConnection) => new DashboardReadRepository(database),
      inject: [DATABASE]
    }
  ],
  exports: [DashboardReadRepository]
})
export class DashboardModule {}
