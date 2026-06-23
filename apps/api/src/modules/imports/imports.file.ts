import { BadRequestException } from "@nestjs/common";
import { parseCsvRecords, normalizeTabularRows } from "@poip/domain";
import { read, utils } from "xlsx";

const maxFileBytes = 5 * 1024 * 1024;

function extension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] ?? "" : "";
}

export function parseImportFile(filename: string, buffer: Buffer): readonly Record<string, string>[] {
  if (buffer.length === 0) throw new BadRequestException("Import file is empty");
  if (buffer.length > maxFileBytes) throw new BadRequestException("Import file exceeds 5 MB");

  const ext = extension(filename);
  if (ext === "csv") {
    return parseCsvRecords(buffer.toString("utf8"));
  }

  if (ext === "xlsx") {
    const workbook = read(buffer, { type: "buffer", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException("XLSX file has no worksheets");
    const sheet = workbook.Sheets[firstSheet];
    if (!sheet) throw new BadRequestException("XLSX worksheet is unreadable");
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
    return normalizeTabularRows(rows);
  }

  throw new BadRequestException("Only CSV and XLSX imports are supported");
}
