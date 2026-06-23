import { createHash } from "node:crypto";

export interface DowntimeNaturalKeyInput {
  readonly eventDate: string;
  readonly shiftCode?: string | null;
  readonly area?: string | null;
  readonly machineCode?: string | null;
  readonly lineCode?: string | null;
  readonly category: string;
  readonly startTime: Date;
  readonly endTime?: Date | null;
  readonly sourceType?: string | null;
}

function normalizePart(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : "-";
}

function toIsoOrOpen(value: Date | null | undefined): string {
  return value ? value.toISOString() : "OPEN";
}

export function createDowntimeNaturalKey(input: DowntimeNaturalKeyInput): string {
  const canonical = [
    normalizePart(input.sourceType ?? "MANUAL"),
    normalizePart(input.eventDate),
    normalizePart(input.shiftCode),
    normalizePart(input.area),
    normalizePart(input.machineCode),
    normalizePart(input.lineCode),
    normalizePart(input.category),
    input.startTime.toISOString(),
    toIsoOrOpen(input.endTime)
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}
