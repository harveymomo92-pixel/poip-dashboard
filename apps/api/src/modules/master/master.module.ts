import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { MasterController } from "./master.controller.js";
import { MasterRepository } from "./master.repository.js";
import { MasterService } from "./master.service.js";

@Module({
  imports: [AuditModule],
  controllers: [MasterController],
  providers: [MasterRepository, MasterService],
  exports: [MasterService]
})
export class MasterModule {}

