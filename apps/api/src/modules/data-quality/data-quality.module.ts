import { Module } from "@nestjs/common";
import { DashboardModule } from "../dashboard/dashboard.module.js";
import { DataQualityController } from "./data-quality.controller.js";
import { DataQualityService } from "./data-quality.service.js";

@Module({
  imports: [DashboardModule],
  controllers: [DataQualityController],
  providers: [DataQualityService]
})
export class DataQualityModule {}
