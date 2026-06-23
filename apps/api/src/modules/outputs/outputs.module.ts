import { Module } from "@nestjs/common";
import { DashboardModule } from "../dashboard/dashboard.module.js";
import { OutputsController } from "./outputs.controller.js";
import { OutputsService } from "./outputs.service.js";

@Module({
  imports: [DashboardModule],
  controllers: [OutputsController],
  providers: [OutputsService]
})
export class OutputsModule {}
