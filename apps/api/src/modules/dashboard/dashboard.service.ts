import { Inject, Injectable } from "@nestjs/common";
import { DashboardReadRepository } from "./dashboard.repository.js";
import type { DailyItemResumeFilters, DashboardFilters } from "./dashboard.types.js";

@Injectable()
export class DashboardService {
  constructor(@Inject(DashboardReadRepository) private readonly repository: DashboardReadRepository) {}

  getSummary(filters: DashboardFilters) {
    return this.repository.getSummary(filters);
  }

  getTrends(filters: DashboardFilters) {
    return this.repository.getTrends(filters);
  }

  getBreakdowns(input: {
    readonly filters: DashboardFilters;
    readonly groupBy: "machine" | "entity" | "item" | "shift";
    readonly limit: number;
  }) {
    return this.repository.getBreakdowns(input);
  }

  getDailyItemResume(filters: DailyItemResumeFilters) {
    return this.repository.listDailyItemResume(filters);
  }
}
