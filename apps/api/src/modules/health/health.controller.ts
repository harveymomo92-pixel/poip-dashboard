import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@poip/api-client";
import { Public } from "../../common/public.decorator.js";

@Controller("health")
@Public()
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "api"
    };
  }
}
