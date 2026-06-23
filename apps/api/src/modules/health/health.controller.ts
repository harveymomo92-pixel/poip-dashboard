import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@poip/api-client";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "api"
    };
  }
}
