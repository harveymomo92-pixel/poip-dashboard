import { Controller, Get, Inject } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { DataQualityService } from "./data-quality.service.js";

@Controller("data-quality")
export class DataQualityController {
  constructor(@Inject(DataQualityService) private readonly dataQualityService: DataQualityService) {}

  @Get("summary")
  @RequirePermissions("data_quality.view")
  getSummary() {
    return this.dataQualityService.getSummary();
  }
}
