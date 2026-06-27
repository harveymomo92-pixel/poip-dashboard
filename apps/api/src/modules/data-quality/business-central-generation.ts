export const businessCentralIssueCodes = [
  "BC_UNMAPPED_SOURCE",
  "BC_CONDITIONAL_MAPPING_REVIEW",
  "BC_TARGET_MISSING",
  "BC_NO_ACTIVE_TARGET",
  "BC_REJECT_PCS_INCOMPLETE",
  "BC_AMBIGUOUS_REJECT_ATTACHMENT"
] as const;

export type BusinessCentralIssueCode = (typeof businessCentralIssueCodes)[number];
export type BusinessCentralIssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface BusinessCentralIssuePayload {
  readonly sourceSystem: string;
  readonly sourceField: string;
  readonly sourceValue: string;
  readonly normalizedValue: string;
  readonly rowCount: number;
  readonly okQty: number;
  readonly firstPostingDate: string | null;
  readonly lastPostingDate: string | null;
  readonly sampleDocumentNos: readonly string[];
  readonly sampleItemNos: readonly string[];
  readonly suggestedTargetEntities: readonly Record<string, unknown>[];
  readonly recommendedAction: string;
  readonly relatedEndpoint: string;
  readonly [key: string]: unknown;
}

export interface GeneratedBusinessCentralIssue {
  readonly issueCode: BusinessCentralIssueCode;
  readonly severity: BusinessCentralIssueSeverity;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly sourceSystem: string;
  readonly sourceRef: string;
  readonly description: string;
  readonly payload: BusinessCentralIssuePayload;
}

export interface ExistingGeneratedIssue {
  readonly issueCode: string;
  readonly severity: string;
  readonly description: string;
  readonly payload: unknown;
  readonly status: string;
}

export interface BusinessCentralIssueOperationCounts {
  created: number;
  updated: number;
  unchanged: number;
  resolved: number;
}

export interface BusinessCentralIssueGenerationSummary extends BusinessCentralIssueOperationCounts {
  byType: Record<string, BusinessCentralIssueOperationCounts>;
  bySeverity: Record<string, BusinessCentralIssueOperationCounts>;
}

const emptyCounts = (): BusinessCentralIssueOperationCounts => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  resolved: 0
});

export function newBusinessCentralIssueGenerationSummary(): BusinessCentralIssueGenerationSummary {
  return {
    ...emptyCounts(),
    byType: {},
    bySeverity: {}
  };
}

export function addBusinessCentralIssueSummary(
  summary: BusinessCentralIssueGenerationSummary,
  issueCode: string,
  severity: string,
  operation: keyof BusinessCentralIssueOperationCounts
): void {
  summary[operation] += 1;
  summary.byType[issueCode] = summary.byType[issueCode] ?? emptyCounts();
  summary.byType[issueCode][operation] += 1;
  summary.bySeverity[severity] = summary.bySeverity[severity] ?? emptyCounts();
  summary.bySeverity[severity][operation] += 1;
}

export function businessCentralIssueSeverity(input: {
  readonly okQty: number;
  readonly targetBlocksAchievement?: boolean;
  readonly rejectPcsGap?: boolean;
}): BusinessCentralIssueSeverity {
  if (input.targetBlocksAchievement && input.okQty > 0) return "CRITICAL";
  if (input.okQty >= 1_000_000) return "CRITICAL";
  if (input.rejectPcsGap) return "HIGH";
  if (input.okQty >= 100_000) return "HIGH";
  if (input.okQty > 0) return "MEDIUM";
  return "LOW";
}

export function normalizeBusinessCentralIssueKeyPart(value: string | number | null | undefined): string {
  const normalized = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return normalized || "BLANK";
}

export function businessCentralIssueSourceRef(
  type: string,
  parts: readonly (string | number | null | undefined)[]
): string {
  return ["bc", type, ...parts.map(normalizeBusinessCentralIssueKeyPart)].join(":").slice(0, 500);
}

export function isConditionalMappingRecommended(sourceValue: string, sampleItemNos: readonly string[] = []): boolean {
  const text = `${sourceValue} ${sampleItemNos.join(" ")}`.toUpperCase();
  return /OMSO|POLYPRINT|PRINTING/.test(text);
}

export function recommendedActionForUnmappedSource(input: {
  readonly sourceValue: string;
  readonly sampleItemNos?: readonly string[];
  readonly suggestedTargetEntities?: readonly unknown[];
}): string {
  if (isConditionalMappingRecommended(input.sourceValue, input.sampleItemNos ?? [])) {
    return "Use Conditional Mapping Rule, not broad alias.";
  }
  if ((input.suggestedTargetEntities ?? []).length === 0) {
    return "Review or create master entity/alias.";
  }
  return "Review candidate entity and create a reviewed alias or conditional mapping rule.";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function generatedBusinessCentralIssueChanged(
  existing: ExistingGeneratedIssue,
  generated: GeneratedBusinessCentralIssue
): boolean {
  if (existing.status === "RESOLVED") return true;
  return (
    existing.severity !== generated.severity ||
    existing.description !== generated.description ||
    stableStringify(existing.payload) !== stableStringify(generated.payload)
  );
}

export function dedupeGeneratedBusinessCentralIssues(
  issues: readonly GeneratedBusinessCentralIssue[]
): readonly GeneratedBusinessCentralIssue[] {
  const byKey = new Map<string, GeneratedBusinessCentralIssue>();
  for (const issue of issues) {
    const key = `${issue.issueCode}|${issue.sourceSystem}|${issue.sourceRef}`;
    const existing = byKey.get(key);
    if (!existing || issue.payload.rowCount > existing.payload.rowCount) {
      byKey.set(key, issue);
    }
  }
  return [...byKey.values()];
}
