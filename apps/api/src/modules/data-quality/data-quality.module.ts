import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DataQualityController } from "./data-quality.controller.js";
import { DataQualityRepository } from "./data-quality.repository.js";
import { DataQualityService } from "./data-quality.service.js";

@Module({
  imports: [AuditModule],
  controllers: [DataQualityController],
  providers: [DataQualityService, DataQualityRepository]
})
export class DataQualityModule {}
