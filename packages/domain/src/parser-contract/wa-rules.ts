import { createHash } from "node:crypto";
import { calculateDowntimeDurationMinutes } from "../downtime/duration.js";
import { createDowntimeNaturalKey } from "../downtime/natural-key.js";

export type WaParsedRowType = "PRODUCTION_OUTPUT" | "DOWNTIME" | "UNKNOWN";
export type WaRowStatus = "VALID" | "INVALID";

export interface WaParsedRowIssue {
  readonly code: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly message: string;
}

export interface WaProductionPayload {
  readonly type: "PRODUCTION_OUTPUT";
  readonly postingDate: string | null;
  readonly shiftCode: string | null;
  readonly machineCode: string | null;
  readonly itemNo: string | null;
  readonly quantity: number;
  readonly rejectKg: number;
  readonly normalizedOutputType: "OK" | "REJECT";
  readonly documentNo: string | null;
  readonly naturalKey: string;
}

export interface WaDowntimePayload {
  readonly type: "DOWNTIME";
  readonly eventDate: string | null;
  readonly shiftCode: string | null;
  readonly area: string | null;
  readonly machineCode: string | null;
  readonly lineCode: string | null;
  readonly category: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly durationMinutes: number | null;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly rootCause: string | null;
  readonly actionTaken: string | null;
  readonly naturalKey: string | null;
}

export type WaParsedPayload = WaProductionPayload | WaDowntimePayload | { readonly type: "UNKNOWN" };

export interface WaParsedRow {
  readonly rowNumber: number;
  readonly sourceLine: string;
  readonly type: WaParsedRowType;
  readonly parsedPayload: WaParsedPayload;
  readonly confidence: number;
  readonly status: WaRowStatus;
  readonly issues: readonly WaParsedRowIssue[];
}

export interface WaParseResult {
  readonly rows: readonly WaParsedRow[];
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly warningRows: number;
  };
}

function clean(value: string | null | undefined, uppercase = false): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return uppercase ? trimmed.toUpperCase() : trimmed;
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(line: string): string | null {
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(line);
  if (iso?.[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const local = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/.exec(line);
  if (!local?.[1] || !local[2] || !local[3]) return null;
  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function extractAfter(line: string, labels: readonly string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:=]?\\s*([^|;,]+)`, "i");
    const match = pattern.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractCode(line: string, labels: readonly string[], fallbackPrefix?: string): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(?::|=|\\s)\\s*([^|;,]+)`, "i");
    const match = pattern.exec(line);
    if (match?.[1]) return clean(match[1].split(/\s+/)[0], true);
  }
  if (!fallbackPrefix) return null;
  const fallback = new RegExp(`\\b(${fallbackPrefix}[A-Z0-9_-]*)\\b`, "i").exec(line);
  return clean(fallback?.[1], true);
}

function extractShift(line: string): string | null {
  const labelled = /(?:shift|sh)\s*[:=]?\s*([A-Za-z0-9]+)/i.exec(line);
  return clean(labelled?.[1], true);
}

function extractTimeRange(line: string): { start: string | null; end: string | null } {
  const range =
    /(?:jam|time|pukul)?\s*(\d{1,2}[:.]\d{2})\s*(?:-|s\/d|sd|to|until)\s*(\d{1,2}[:.]\d{2})/i.exec(
      line
    );
  if (!range?.[1] || !range[2]) return { start: null, end: null };
  return { start: range[1].replace(".", ":"), end: range[2].replace(".", ":") };
}

function localDateTime(date: string, time: string, addDays = 0): Date {
  const base = new Date(`${date}T00:00:00.000+07:00`);
  base.setUTCDate(base.getUTCDate() + addDays);
  const [hour = "0", minute = "0"] = time.split(":");
  const dateText = base.toISOString().slice(0, 10);
  return new Date(`${dateText}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00.000+07:00`);
}

function hashNaturalKey(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function classifyLine(line: string): WaParsedRowType {
  if (/\b(downtime|dt|breakdown|trouble|stop|rusak|mati)\b/i.test(line)) return "DOWNTIME";
  if (/\b(output|produksi|prod|qty|ok|reject|item)\b/i.test(line)) return "PRODUCTION_OUTPUT";
  return "UNKNOWN";
}

function parseProductionLine(line: string): Omit<WaParsedRow, "rowNumber" | "sourceLine"> {
  const issues: WaParsedRowIssue[] = [];
  const postingDate = parseDate(line);
  const shiftCode = extractShift(line);
  const machineCode = extractCode(line, ["machine", "mesin", "mc"], "MC");
  const itemNo = extractCode(line, ["item", "barang", "fg", "produk"]);
  const quantity =
    parseNumber(/(?:qty|ok|output|produksi|prod)\s*[:=]?\s*(-?\d+(?:[,.]\d+)?)/i.exec(line)?.[1]) ??
    0;
  const rejectKg =
    parseNumber(/(?:reject|rijek|scrap)\s*[:=]?\s*(-?\d+(?:[,.]\d+)?)/i.exec(line)?.[1]) ?? 0;
  const documentNo = clean(/(?:doc|spk|mo)\s*[:=]?\s*([A-Z0-9_-]+)/i.exec(line)?.[1], true);

  if (!postingDate) issues.push({ code: "MISSING_DATE", severity: "CRITICAL", message: "Date is required" });
  if (!itemNo) issues.push({ code: "MISSING_ITEM", severity: "CRITICAL", message: "Item number is required" });
  if (!machineCode) issues.push({ code: "MISSING_MACHINE", severity: "WARNING", message: "Machine code is missing" });
  if (quantity < 0 || rejectKg < 0) {
    issues.push({ code: "NEGATIVE_VALUE", severity: "CRITICAL", message: "Quantity and reject must not be negative" });
  }
  if (quantity === 0 && rejectKg === 0) {
    issues.push({ code: "MISSING_QUANTITY", severity: "CRITICAL", message: "Quantity or reject must be provided" });
  }

  const naturalKey = hashNaturalKey(["WA_OUTPUT", postingDate, shiftCode, machineCode, itemNo, quantity, rejectKg, documentNo]);
  const criticalCount = issues.filter((issue) => issue.severity === "CRITICAL").length;
  const warningCount = issues.filter((issue) => issue.severity === "WARNING").length;
  return {
    type: "PRODUCTION_OUTPUT",
    parsedPayload: {
      type: "PRODUCTION_OUTPUT",
      postingDate,
      shiftCode,
      machineCode,
      itemNo,
      quantity,
      rejectKg,
      normalizedOutputType: rejectKg > 0 && quantity === 0 ? "REJECT" : "OK",
      documentNo,
      naturalKey
    },
    confidence: Math.max(30, 95 - criticalCount * 35 - warningCount * 10),
    status: criticalCount > 0 ? "INVALID" : "VALID",
    issues
  };
}

function parseDowntimeLine(line: string): Omit<WaParsedRow, "rowNumber" | "sourceLine"> {
  const issues: WaParsedRowIssue[] = [];
  const eventDate = parseDate(line);
  const shiftCode = extractShift(line);
  const area = clean(extractAfter(line, ["area"]), true);
  const machineCode = extractCode(line, ["machine", "mesin", "mc"], "MC");
  const lineCode = extractCode(line, ["line", "line_code"]);
  const explicitCategory = clean(extractAfter(line, ["category", "kategori", "reason", "problem"]), true);
  const category =
    explicitCategory ??
    (/\bbreakdown\b/i.test(line)
      ? "BREAKDOWN"
      : /\b(planned|setting|setup)\b/i.test(line)
        ? "PLANNED_STOP"
        : "DOWNTIME");
  const { start, end } = extractTimeRange(line);
  const severity = /\b(critical|urgent|parah)\b/i.test(line)
    ? "CRITICAL"
    : /\b(high|tinggi)\b/i.test(line)
      ? "HIGH"
      : "MEDIUM";
  const rootCause = clean(extractAfter(line, ["root cause", "root", "cause", "rc", "penyebab"]));
  const actionTaken = clean(extractAfter(line, ["action", "tindakan", "aksi"]));

  if (!eventDate) issues.push({ code: "MISSING_DATE", severity: "CRITICAL", message: "Event date is required" });
  if (!machineCode) issues.push({ code: "MISSING_MACHINE", severity: "WARNING", message: "Machine code is missing" });
  if (!start) issues.push({ code: "MISSING_START_TIME", severity: "CRITICAL", message: "Start time is required" });

  let startTime: Date | null = null;
  let endTime: Date | null = null;
  let durationMinutes: number | null = null;
  if (eventDate && start) {
    startTime = localDateTime(eventDate, start);
    if (end) {
      const sameDayEnd = localDateTime(eventDate, end);
      endTime = sameDayEnd.getTime() < startTime.getTime() ? localDateTime(eventDate, end, 1) : sameDayEnd;
      durationMinutes = calculateDowntimeDurationMinutes({ startTime, endTime });
      if (!rootCause || !actionTaken) {
        issues.push({
          code: "MISSING_CLOSE_DETAIL",
          severity: "CRITICAL",
          message: "Root cause and action taken are required for closed downtime"
        });
      }
    }
  }

  const naturalKey =
    eventDate && startTime
      ? createDowntimeNaturalKey({
          eventDate,
          shiftCode,
          area,
          machineCode,
          lineCode,
          category,
          startTime,
          endTime,
          sourceType: "WA"
        })
      : null;
  const criticalCount = issues.filter((issue) => issue.severity === "CRITICAL").length;
  const warningCount = issues.filter((issue) => issue.severity === "WARNING").length;

  return {
    type: "DOWNTIME",
    parsedPayload: {
      type: "DOWNTIME",
      eventDate,
      shiftCode,
      area,
      machineCode,
      lineCode,
      category,
      startTime: startTime?.toISOString() ?? null,
      endTime: endTime?.toISOString() ?? null,
      durationMinutes,
      severity,
      rootCause,
      actionTaken,
      naturalKey
    },
    confidence: Math.max(30, 95 - criticalCount * 35 - warningCount * 10),
    status: criticalCount > 0 ? "INVALID" : "VALID",
    issues
  };
}

function parseUnknownLine(): Omit<WaParsedRow, "rowNumber" | "sourceLine"> {
  return {
    type: "UNKNOWN",
    parsedPayload: { type: "UNKNOWN" },
    confidence: 30,
    status: "INVALID",
    issues: [{ code: "UNRECOGNIZED_FORMAT", severity: "CRITICAL", message: "Line format was not recognized" }]
  };
}

export function parseWhatsAppOperationalText(sourceText: string): WaParseResult {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = lines.map((line, index): WaParsedRow => {
    const parsed =
      classifyLine(line) === "DOWNTIME"
        ? parseDowntimeLine(line)
        : classifyLine(line) === "PRODUCTION_OUTPUT"
          ? parseProductionLine(line)
          : parseUnknownLine();
    return {
      rowNumber: index + 1,
      sourceLine: line,
      ...parsed
    };
  });

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.status === "VALID").length,
      invalidRows: rows.filter((row) => row.status === "INVALID").length,
      warningRows: rows.filter((row) => row.issues.some((issue) => issue.severity === "WARNING")).length
    }
  };
}
