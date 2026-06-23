export interface WaParserPreviewInput {
  readonly sourceText: string;
  readonly parserMode: "rules";
  readonly createdBy?: string | null;
}

export interface WaParserCommitInput {
  readonly selectedRowIds?: readonly string[];
  readonly committedBy?: string | null;
}

export interface WaParserRowDto {
  readonly id: string;
  readonly rowNumber: number;
  readonly sourceLine: string;
  readonly parsedPayload: Record<string, unknown>;
  readonly confidence: number;
  readonly warnings: readonly Record<string, unknown>[];
  readonly status: string;
  readonly downtimeEventId: string | null;
  readonly createdAt: string;
}

export interface WaParserRunDto {
  readonly id: string;
  readonly parserMode: string;
  readonly parserVersion: string;
  readonly status: string;
  readonly createdBy: string | null;
  readonly committedBy: string | null;
  readonly committedAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly rows?: readonly WaParserRowDto[];
}

export interface WaParserPreviewResult {
  readonly run: WaParserRunDto;
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly warningRows: number;
  };
}

export interface WaParserCommitResult {
  readonly runId: string;
  readonly committedRows: number;
  readonly productionRowsCommitted: number;
  readonly downtimeRowsCommitted: number;
  readonly skippedRows: number;
}
