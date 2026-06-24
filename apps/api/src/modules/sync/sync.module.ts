import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { SyncController } from "./sync.controller.js";
import { SyncService } from "./sync.service.js";

@Module({
  imports: [AuditModule],
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
