import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DataQualityRepository } from "./data-quality.repository.js";
import type {
  DataQualityIssueFilters,
  DataQualityStatusInput
} from "./data-quality.types.js";

@Injectable()
export class DataQualityService {
  constructor(@Inject(DataQualityRepository) private readonly repository: DataQualityRepository) {}

  getSummary() {
    return this.repository.getSummary();
  }

  listIssues(filters: DataQualityIssueFilters) {
    return this.repository.list(filters);
  }

  getIssue(id: string) {
    return this.repository.getById(id);
  }

  getIssueOrThrow(id: string) {
    return this.repository.getByIdOrThrow(id);
  }

  async updateStatus(id: string, input: DataQualityStatusInput) {
    if (["RESOLVED", "IGNORED"].includes(input.status) && !input.note?.trim()) {
      throw new BadRequestException("Resolution note is required");
    }
    const current = await this.repository.getByIdOrThrow(id);
    const allowed: Readonly<Record<string, readonly string[]>> = {
      OPEN: ["ACKNOWLEDGED", "RESOLVED", "IGNORED"],
      ACKNOWLEDGED: ["OPEN", "RESOLVED", "IGNORED"],
      RESOLVED: ["OPEN"],
      IGNORED: ["OPEN"]
    };
    if (!(allowed[current.status] ?? []).includes(input.status)) {
      throw new BadRequestException(`Cannot move issue from ${current.status} to ${input.status}`);
    }
    return this.repository.updateStatus(id, input);
  }
}
