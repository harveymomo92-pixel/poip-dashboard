import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@poip/api-client";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @Public()
  getHealth(): HealthResponse {
    return this.healthService.getBasicHealth();
  }

  @Get("readiness")
  @RequirePermissions("settings.manage")
  getReadiness() {
    return this.healthService.getReadiness();
  }

  @Get("deep")
  @RequirePermissions("settings.manage")
  getDeepHealth() {
    return this.healthService.getReadiness();
  }
}
