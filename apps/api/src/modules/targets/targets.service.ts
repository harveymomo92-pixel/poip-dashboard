import { Inject, Injectable } from "@nestjs/common";
import type { CreateTargetInput, TargetListFilters, UpdateTargetInput } from "./targets.types.js";
import { TargetsRepository } from "./targets.repository.js";

@Injectable()
export class TargetsService {
  constructor(@Inject(TargetsRepository) private readonly targetsRepository: TargetsRepository) {}

  listEntities() {
    return this.targetsRepository.listEntities();
  }

  listTargets(filters: TargetListFilters) {
    return this.targetsRepository.listTargets(filters);
  }

  getTarget(id: string) {
    return this.targetsRepository.getTarget(id);
  }

  getTargetOrThrow(id: string) {
    return this.targetsRepository.getTargetOrThrow(id);
  }

  listOverlappingActiveTargetsForTarget(id: string) {
    return this.targetsRepository.listOverlappingActiveTargetsForTarget(id);
  }

  createTarget(input: CreateTargetInput) {
    return this.targetsRepository.createTarget(input);
  }

  updateTarget(id: string, input: UpdateTargetInput) {
    return this.targetsRepository.updateTarget(id, input);
  }

  submitTarget(id: string) {
    return this.targetsRepository.submitTarget(id);
  }

  approveTarget(id: string, approvedBy: string | null) {
    return this.targetsRepository.approveTarget(id, approvedBy);
  }

  rejectTarget(id: string) {
    return this.targetsRepository.rejectTarget(id);
  }

  deactivateTarget(id: string) {
    return this.targetsRepository.deactivateTarget(id);
  }
}
