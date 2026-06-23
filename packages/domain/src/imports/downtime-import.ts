import { createHash } from "node:crypto";
import { calculateDowntimeDurationMinutes } from "../downtime/duration.js";
import { createDowntimeNaturalKey } from "../downtime/natural-key.js";

export type ImportRowStatus = "VALID" | "INVALID" | "DUPLICATE" | "CONFLICT" | "COMMITTED";

export interface ImportIssue {
  readonly code: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly message: string;
}

export interface DowntimeImportPayload {
  readonly eventDate: string | null;
  readonly shiftCode: string | null;
  readonly area: string | null;
  readonly machineCode: string | null;
  readonly lineCode: string | null;
  readonly category: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly durationMinutes: number | null;
  readonly status: "OPEN" | "CLOSED";
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly rootCause: string | null;
  readonly actionTaken: string | null;
  readonly naturalKey: string | null;
}

export interface ParsedImportRow {
  readonly rowNumber: number;
  readonly raw: Record<string, string>;
  readonly normalized: DowntimeImportPayload;
  readonly naturalKey: string | null;
  readonly rowHash: string;
  readonly status: ImportRowStatus;
  readonly issues: readonly ImportIssue[];
}

export interface ParsedImportFile {
  readonly rows: readonly ParsedImportRow[];
  readonly summary: {
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly duplicateRows: number;
    readonly conflictRows: number;
    readonly warningRows: number;
  };
}

const headerAliases = new Map<string, string>([
  ["date", "event_date"],
  ["tanggal", "event_date"],
  ["eventdate", "event_date"],
  ["event_date", "event_date"],
  ["business_date", "event_date"],
  ["shift", "shift_code"],
  ["shift_code", "shift_code"],
  ["area", "area"],
  ["machine", "machine_code"],
  ["machine_code", "machine_code"],
  ["machine_no", "machine_code"],
  ["mesin", "machine_code"],
  ["mc", "machine_code"],
  ["line", "line_code"],
  ["line_code", "line_code"],
  ["category", "category"],
  ["kategori", "category"],
  ["reason", "category"],
  ["problem", "category"],
  ["start", "start_time"],
  ["start_time", "start_time"],
  ["jam_mulai", "start_time"],
  ["mulai", "start_time"],
  ["end", "end_time"],
  ["end_time", "end_time"],
  ["jam_selesai", "end_time"],
  ["selesai", "end_time"],
  ["severity", "severity"],
  ["root_cause", "root_cause"],
  ["rootcause", "root_cause"],
  ["cause", "root_cause"],
  ["penyebab", "root_cause"],
  ["action", "action_taken"],
  ["action_taken", "action_taken"],
  ["tindakan", "action_taken"]
]);

function clean(value: string | null | undefined, uppercase = false): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return uppercase ? trimmed.toUpperCase() : trimmed;
}

export function normalizeImportHeader(header: string): string {
  const normalized = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return headerAliases.get(normalized) ?? normalized;
}

export function parseCsvRecords(source: string): readonly Record<string, string>[] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0]?.map(normalizeImportHeader) ?? [];
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))
  );
}

export function normalizeTabularRows(rows: readonly (readonly unknown[])[]): readonly Record<string, string>[] {
  const [headerRow, ...dataRows] = rows.filter((row) => row.some((value) => String(value ?? "").trim()));
  if (!headerRow) return [];
  const headers = headerRow.map((value) => normalizeImportHeader(String(value ?? "")));
  return dataRows
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const iso = /^(20\d{2})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (iso?.[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](20\d{2})$/.exec(value.trim());
  if (!local?.[1] || !local[2] || !local[3]) return null;
  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function localDateTime(date: string, timeOrDateTime: string, addDays = 0): Date | null {
  const value = timeOrDateTime.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const time = /^(\d{1,2})[:.](\d{2})$/.exec(value);
  if (!time?.[1] || !time[2]) return null;
  const base = new Date(`${date}T00:00:00.000+07:00`);
  base.setUTCDate(base.getUTCDate() + addDays);
  const dateText = base.toISOString().slice(0, 10);
  return new Date(`${dateText}T${time[1].padStart(2, "0")}:${time[2]}:00.000+07:00`);
}

function severity(value: string | null): DowntimeImportPayload["severity"] {
  const normalized = clean(value, true);
  if (normalized === "LOW" || normalized === "HIGH" || normalized === "CRITICAL") return normalized;
  return "MEDIUM";
}

function hashRow(row: unknown): string {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

function parseDowntimeRow(row: Record<string, string>, rowNumber: number): ParsedImportRow {
  const issues: ImportIssue[] = [];
  const eventDate = parseDate(clean(row.event_date));
  const shiftCode = clean(row.shift_code, true);
  const area = clean(row.area, true);
  const machineCode = clean(row.machine_code, true);
  const lineCode = clean(row.line_code, true);
  const category = clean(row.category, true);
  const rootCause = clean(row.root_cause);
  const actionTaken = clean(row.action_taken);

  if (!eventDate) issues.push({ code: "MISSING_EVENT_DATE", severity: "CRITICAL", message: "Event date is required" });
  if (!category) issues.push({ code: "MISSING_CATEGORY", severity: "CRITICAL", message: "Category is required" });
  if (!row.start_time?.trim()) {
    issues.push({ code: "MISSING_START_TIME", severity: "CRITICAL", message: "Start time is required" });
  }

  const startTime = eventDate && row.start_time ? localDateTime(eventDate, row.start_time) : null;
  if (eventDate && row.start_time && !startTime) {
    issues.push({ code: "INVALID_START_TIME", severity: "CRITICAL", message: "Start time is invalid" });
  }

  const sameDayEnd = eventDate && row.end_time ? localDateTime(eventDate, row.end_time) : null;
  const endTime =
    startTime && sameDayEnd && sameDayEnd.getTime() < startTime.getTime()
      ? localDateTime(eventDate ?? "", row.end_time ?? "", 1)
      : sameDayEnd;

  if (row.end_time?.trim() && !endTime) {
    issues.push({ code: "INVALID_END_TIME", severity: "CRITICAL", message: "End time is invalid" });
  }
  if (endTime && (!rootCause || !actionTaken)) {
    issues.push({
      code: "MISSING_CLOSE_DETAIL",
      severity: "CRITICAL",
      message: "Root cause and action taken are required for closed downtime"
    });
  }

  const durationMinutes = startTime && endTime ? calculateDowntimeDurationMinutes({ startTime, endTime }) : null;
  const naturalKey =
    eventDate && category && startTime
      ? createDowntimeNaturalKey({
          eventDate,
          shiftCode,
          area,
          machineCode,
          lineCode,
          category,
          startTime,
          endTime,
          sourceType: "IMPORT"
        })
      : null;
  const criticalCount = issues.filter((issue) => issue.severity === "CRITICAL").length;
  const normalized: DowntimeImportPayload = {
    eventDate,
    shiftCode,
    area,
    machineCode,
    lineCode,
    category,
    startTime: startTime?.toISOString() ?? null,
    endTime: endTime?.toISOString() ?? null,
    durationMinutes,
    status: endTime ? "CLOSED" : "OPEN",
    severity: severity(row.severity ?? null),
    rootCause,
    actionTaken,
    naturalKey
  };

  return {
    rowNumber,
    raw: row,
    normalized,
    naturalKey,
    rowHash: hashRow(normalized),
    status: criticalCount > 0 ? "INVALID" : "VALID",
    issues
  };
}

export function parseDowntimeImportRows(records: readonly Record<string, string>[]): ParsedImportFile {
  const seen = new Set<string>();
  const rows = records.map((record, index) => {
    const parsed = parseDowntimeRow(record, index + 2);
    if (!parsed.naturalKey || parsed.status !== "VALID") return parsed;
    if (seen.has(parsed.naturalKey)) {
      return {
        ...parsed,
        status: "DUPLICATE" as const,
        issues: [
          ...parsed.issues,
          { code: "DUPLICATE_IN_FILE", severity: "CRITICAL" as const, message: "Duplicate downtime row in file" }
        ]
      };
    }
    seen.add(parsed.naturalKey);
    return parsed;
  });

  return summarizeImportRows(rows);
}

export function summarizeImportRows(rows: readonly ParsedImportRow[]): ParsedImportFile {
  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.status === "VALID").length,
      invalidRows: rows.filter((row) => row.status === "INVALID").length,
      duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
      conflictRows: rows.filter((row) => row.status === "CONFLICT").length,
      warningRows: rows.filter((row) => row.issues.some((issue) => issue.severity === "WARNING")).length
    }
  };
}
