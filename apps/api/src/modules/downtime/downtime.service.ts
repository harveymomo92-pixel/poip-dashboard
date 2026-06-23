import { Inject, Injectable } from "@nestjs/common";
import { DowntimeRepository } from "./downtime.repository.js";
import type {
  CloseDowntimeInput,
  CreateDowntimeInput,
  DowntimeListFilters,
  UpdateDowntimeInput
} from "./downtime.types.js";

@Injectable()
export class DowntimeService {
  constructor(@Inject(DowntimeRepository) private readonly downtimeRepository: DowntimeRepository) {}

  listEntities() {
    return this.downtimeRepository.listEntities();
  }

  listDowntime(filters: DowntimeListFilters) {
    return this.downtimeRepository.listDowntime(filters);
  }

  getDowntime(id: string) {
    return this.downtimeRepository.getDowntime(id);
  }

  getDowntimeOrThrow(id: string) {
    return this.downtimeRepository.getDowntimeOrThrow(id);
  }

  createDowntime(input: CreateDowntimeInput) {
    return this.downtimeRepository.createDowntime(input);
  }

  updateDowntime(id: string, input: UpdateDowntimeInput) {
    return this.downtimeRepository.updateDowntime(id, input);
  }

  closeDowntime(id: string, input: CloseDowntimeInput) {
    return this.downtimeRepository.closeDowntime(id, input);
  }
}
