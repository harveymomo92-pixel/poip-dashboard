import type { DowntimeImportPayload, ImportIssue, ImportRowStatus } from "@poip/domain";

export type ImportType = "downtime";

export interface ImportPreviewInput {
  readonly importType: ImportType;
  readonly originalFilename: string;
  readonly fileBuffer: Buffer;
  readonly createdBy?: string | null;
}

export interface ImportCommitInput {
  readonly selectedRowIds?: readonly string[];
  readonly committedBy?: string | null;
}

export interface ImportRowDto {
  readonly id: string;
  readonly rowNumber: number;
  readonly rawPayload: Record<string, string>;
  readonly normalizedPayload: DowntimeImportPayload;
  readonly naturalKey: string | null;
  readonly status: ImportRowStatus;
  readonly issues: readonly ImportIssue[];
  readonly committedEntityType: string | null;
  readonly committedEntityId: string | null;
  readonly createdAt: string;
}

export interface ImportRunDto {
  readonly id: string;
  readonly importType: ImportType;
  readonly originalFilename: string;
  readonly fileHash: string;
  readonly status: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly rowsDuplicate: number;
  readonly rowsConflict: number;
  readonly rowsInserted: number;
  readonly rowsUpdated: number;
  readonly validationReport: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly committedBy: string | null;
  readonly committedAt: string | null;
  readonly createdAt: string;
  readonly rows?: readonly ImportRowDto[];
}

export interface ImportPreviewResult {
  readonly run: ImportRunDto;
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly duplicateRows: number;
    readonly conflictRows: number;
    readonly warningRows: number;
  };
}

export interface ImportCommitResult {
  readonly runId: string;
  readonly committedRows: number;
  readonly insertedRows: number;
  readonly skippedRows: number;
}

export interface ImportErrorReport {
  readonly filename: string;
  readonly contentType: "text/csv";
  readonly content: string;
}
