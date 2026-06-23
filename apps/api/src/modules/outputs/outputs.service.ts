import { Inject, Injectable } from "@nestjs/common";
import { DashboardReadRepository } from "../dashboard/dashboard.repository.js";
import type { OutputListFilters } from "../dashboard/dashboard.types.js";

@Injectable()
export class OutputsService {
  constructor(@Inject(DashboardReadRepository) private readonly repository: DashboardReadRepository) {}

  listOutputs(filters: OutputListFilters) {
    return this.repository.listOutputs(filters);
  }

  getOutput(id: string) {
    return this.repository.getOutputById(id);
  }
}
