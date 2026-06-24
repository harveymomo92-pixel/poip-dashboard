import { Inject, Injectable } from "@nestjs/common";
import { HealthRepository } from "./health.repository.js";

@Injectable()
export class HealthService {
  constructor(@Inject(HealthRepository) private readonly repository: HealthRepository) {}

  getBasicHealth() {
    return {
      status: "ok" as const,
      service: "api" as const
    };
  }

  getReadiness() {
    return this.repository.readiness();
  }
}
