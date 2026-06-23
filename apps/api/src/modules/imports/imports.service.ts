import { Inject, Injectable } from "@nestjs/common";
import { parseImportFile } from "./imports.file.js";
import { ImportsRepository } from "./imports.repository.js";
import type { ImportCommitInput, ImportPreviewInput } from "./imports.types.js";

@Injectable()
export class ImportsService {
  constructor(@Inject(ImportsRepository) private readonly importsRepository: ImportsRepository) {}

  preview(input: ImportPreviewInput) {
    const records = parseImportFile(input.originalFilename, input.fileBuffer);
    return this.importsRepository.preview(input, records);
  }

  listRuns(limit?: number) {
    return this.importsRepository.listRuns(limit);
  }

  getRun(id: string) {
    return this.importsRepository.getRun(id);
  }

  getRunOrThrow(id: string) {
    return this.importsRepository.getRunOrThrow(id);
  }

  commit(id: string, input: ImportCommitInput) {
    return this.importsRepository.commit(id, input);
  }

  errorReport(id: string) {
    return this.importsRepository.errorReport(id);
  }
}
