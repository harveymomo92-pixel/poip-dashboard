import { Inject, Injectable } from "@nestjs/common";
import { DashboardReadRepository } from "../dashboard/dashboard.repository.js";

@Injectable()
export class DataQualityService {
  constructor(@Inject(DashboardReadRepository) private readonly repository: DashboardReadRepository) {}

  getSummary() {
    return this.repository.getDataQualitySummary();
  }
}
