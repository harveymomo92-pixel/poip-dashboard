import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DATABASE, type DatabaseConnection } from "../database/database.module.js";
import { WaParserController } from "./wa-parser.controller.js";
import { WaParserRepository } from "./wa-parser.repository.js";
import { WaParserService } from "./wa-parser.service.js";

@Module({
  imports: [AuditModule],
  controllers: [WaParserController],
  providers: [
    WaParserService,
    {
      provide: WaParserRepository,
      useFactory: (database: DatabaseConnection) => new WaParserRepository(database),
      inject: [DATABASE]
    }
  ]
})
export class WaParserModule {}
