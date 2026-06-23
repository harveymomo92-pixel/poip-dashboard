import { Inject, Injectable } from "@nestjs/common";
import { WaParserRepository } from "./wa-parser.repository.js";
import type { WaParserCommitInput, WaParserPreviewInput } from "./wa-parser.types.js";

@Injectable()
export class WaParserService {
  constructor(@Inject(WaParserRepository) private readonly repository: WaParserRepository) {}

  preview(input: WaParserPreviewInput) {
    return this.repository.preview(input);
  }

  listRuns(limit?: number) {
    return this.repository.listRuns(limit);
  }

  getRun(id: string) {
    return this.repository.getRun(id);
  }

  getRunOrThrow(id: string) {
    return this.repository.getRunOrThrow(id);
  }

  commit(runId: string, input: WaParserCommitInput) {
    return this.repository.commit(runId, input);
  }
}
