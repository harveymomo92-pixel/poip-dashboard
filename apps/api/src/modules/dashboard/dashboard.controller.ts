import { Controller, Get, Inject, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { parseQuery } from "../../common/validation.js";
import { breakdownQuerySchema, dailyItemResumeQuerySchema, dashboardQuerySchema } from "./dashboard.query.js";
import { DashboardService } from "./dashboard.service.js";
import type { DailyItemResumeFilters, DashboardFilters } from "./dashboard.types.js";

@Controller("dashboard")
@RequirePermissions("dashboard.view")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(dashboardQuerySchema, query) as DashboardFilters;
    return this.dashboardService.getSummary(filters);
  }

  @Get("trends")
  getTrends(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(dashboardQuerySchema, query) as DashboardFilters;
    return this.dashboardService.getTrends(filters);
  }

  @Get("breakdowns")
  getBreakdowns(@Query() query: Record<string, unknown>) {
    const input = parseQuery(breakdownQuerySchema, query) as DashboardFilters & {
      readonly groupBy: "machine" | "entity" | "item" | "shift";
      readonly limit: number;
    };
    return this.dashboardService.getBreakdowns({
      filters: input,
      groupBy: input.groupBy,
      limit: input.limit
    });
  }

  @Get("daily-item-resume")
  getDailyItemResume(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(dailyItemResumeQuerySchema, query) as DailyItemResumeFilters;
    return this.dashboardService.getDailyItemResume(filters);
  }
}
