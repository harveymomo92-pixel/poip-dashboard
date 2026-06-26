import { normalizeODataOutputRow, type ODataOutputRawRow } from "@poip/domain";

export const BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE = {
  machineDescription: null,
  prodLineNo: "gProdOrRotLine_No",
  prodLineDescription: "gProdOrRotLine_Description"
} as const;

export interface BusinessCentralSourceFieldExposure {
  readonly machineDescriptionExposed: boolean;
  readonly prodLineNoExposed: boolean;
  readonly prodLineDescriptionExposed: boolean;
}

export interface LocalSourceFieldsRow {
  readonly entryNo: string;
  readonly postingDate: string;
  readonly machineCenterNo: string | null;
  readonly machineDescription: string | null;
  readonly prodLineNo: string | null;
  readonly prodLineDescription: string | null;
}

export interface SourceFieldsBackfillUpdate {
  readonly entryNo: string;
  readonly oldProdLineNo: string | null;
  readonly newProdLineNo: string | null;
  readonly oldProdLineDescription: string | null;
  readonly newProdLineDescription: string | null;
}

export interface SourceFieldsBackfillPlan {
  readonly missingRows: number;
  readonly matchedRows: number;
  readonly updateableProdLineNoRows: number;
  readonly updateableProdLineDescriptionRows: number;
  readonly updateableMachineDescriptionRows: 0;
  readonly unchangedRows: number;
  readonly withoutSourceValueRows: number;
  readonly notFoundRows: number;
  readonly exposure: BusinessCentralSourceFieldExposure;
  readonly updates: readonly SourceFieldsBackfillUpdate[];
}

function blank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}

function hasOwn(row: ODataOutputRawRow, fieldName: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, fieldName);
}

export function detectBusinessCentralSourceFieldExposure(
  rows: readonly ODataOutputRawRow[]
): BusinessCentralSourceFieldExposure {
  return {
    machineDescriptionExposed: rows.some((row) =>
      hasOwn(row, "Machine_Description") ||
      hasOwn(row, "MachineDescription") ||
      hasOwn(row, "Machine Description") ||
      hasOwn(row, "machine_description")
    ),
    prodLineNoExposed: rows.some((row) => hasOwn(row, BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineNo)),
    prodLineDescriptionExposed: rows.some((row) =>
      hasOwn(row, BUSINESS_CENTRAL_SOURCE_FIELD_PROFILE.prodLineDescription)
    )
  };
}

export function createSourceFieldsBackfillPlan(
  localRows: readonly LocalSourceFieldsRow[],
  remoteRows: readonly ODataOutputRawRow[]
): SourceFieldsBackfillPlan {
  const remoteByEntryNo = new Map<string, { prodLineNo: string | null; prodLineDescription: string | null }>();
  for (const remoteRow of remoteRows) {
    const normalized = normalizeODataOutputRow(remoteRow).normalized;
    if (normalized.entryNo === null) continue;
    remoteByEntryNo.set(normalized.entryNo.toString(), {
      prodLineNo: normalized.prodLineNo,
      prodLineDescription: normalized.prodLineDescription
    });
  }

  let matchedRows = 0;
  let unchangedRows = 0;
  let withoutSourceValueRows = 0;
  let notFoundRows = 0;
  let updateableProdLineNoRows = 0;
  let updateableProdLineDescriptionRows = 0;
  const updates: SourceFieldsBackfillUpdate[] = [];

  for (const localRow of localRows) {
    const needsProdLineNo = blank(localRow.prodLineNo);
    const needsProdLineDescription = blank(localRow.prodLineDescription);
    if (!needsProdLineNo && !needsProdLineDescription) {
      unchangedRows += 1;
      continue;
    }

    const remote = remoteByEntryNo.get(localRow.entryNo);
    if (!remote) {
      notFoundRows += 1;
      continue;
    }

    matchedRows += 1;
    const newProdLineNo = needsProdLineNo && !blank(remote.prodLineNo) ? remote.prodLineNo : null;
    const newProdLineDescription =
      needsProdLineDescription && !blank(remote.prodLineDescription) ? remote.prodLineDescription : null;

    if (!newProdLineNo && !newProdLineDescription) {
      withoutSourceValueRows += 1;
      continue;
    }

    if (newProdLineNo) updateableProdLineNoRows += 1;
    if (newProdLineDescription) updateableProdLineDescriptionRows += 1;
    updates.push({
      entryNo: localRow.entryNo,
      oldProdLineNo: localRow.prodLineNo,
      newProdLineNo,
      oldProdLineDescription: localRow.prodLineDescription,
      newProdLineDescription
    });
  }

  return {
    missingRows: localRows.length,
    matchedRows,
    updateableProdLineNoRows,
    updateableProdLineDescriptionRows,
    updateableMachineDescriptionRows: 0,
    unchangedRows,
    withoutSourceValueRows,
    notFoundRows,
    exposure: detectBusinessCentralSourceFieldExposure(remoteRows),
    updates
  };
}
