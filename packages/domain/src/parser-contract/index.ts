export type ParserWarningCode = "LOW_CONFIDENCE" | "MISSING_MACHINE" | "MISSING_TIME" | "DUPLICATE_CANDIDATE";

export interface ParsedDowntimeCandidate {
  readonly sourceLine: number;
  readonly confidence: number;
  readonly parsedPayload: Record<string, unknown>;
  readonly warnings: readonly ParserWarningCode[];
}

export * from "./wa-rules.js";
