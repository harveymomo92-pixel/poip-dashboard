export type ExternalDocumentParseStatus = "PARSED" | "UNPARSED";

export interface ParsedExternalDocument {
  readonly rawExternalDocument: string | null;
  readonly shiftCode: string | null;
  readonly shiftNumber: number | null;
  readonly workHours: number | null;
  readonly operatorName: string | null;
  readonly parseStatus: ExternalDocumentParseStatus;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

function unparsed(rawExternalDocument: string | null): ParsedExternalDocument {
  return {
    rawExternalDocument,
    shiftCode: null,
    shiftNumber: null,
    workHours: null,
    operatorName: null,
    parseStatus: "UNPARSED"
  };
}

export function parseExternalDocument(value: string | null | undefined): ParsedExternalDocument {
  const rawExternalDocument = clean(value) || null;
  if (!rawExternalDocument) return unparsed(null);

  const parts = rawExternalDocument.split("/").map((part) => clean(part));
  if (parts.length < 3) return unparsed(rawExternalDocument);

  const shiftMatch = /^S(\d+)$/i.exec(parts[0] ?? "");
  if (!shiftMatch?.[1]) return unparsed(rawExternalDocument);

  const hoursText = (parts[1] ?? "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(hoursText)) return unparsed(rawExternalDocument);
  const workHours = Number.parseFloat(hoursText);
  if (!Number.isFinite(workHours) || workHours <= 0) return unparsed(rawExternalDocument);

  const operatorName = parts.slice(2).filter(Boolean).join(" / ").toUpperCase();
  if (!operatorName) return unparsed(rawExternalDocument);

  const shiftNumber = Number.parseInt(shiftMatch[1], 10);
  return {
    rawExternalDocument,
    shiftCode: `S${shiftNumber}`,
    shiftNumber,
    workHours,
    operatorName,
    parseStatus: "PARSED"
  };
}
