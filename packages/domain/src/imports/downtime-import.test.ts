import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeImportHeader,
  normalizeTabularRows,
  parseCsvRecords,
  parseDowntimeImportRows
} from "./downtime-import.js";

test("normalizeImportHeader maps common downtime aliases", () => {
  assert.equal(normalizeImportHeader("Tanggal"), "event_date");
  assert.equal(normalizeImportHeader("Machine Code"), "machine_code");
  assert.equal(normalizeImportHeader("Root Cause"), "root_cause");
});

test("parseCsvRecords handles quoted CSV cells", () => {
  const rows = parseCsvRecords('date,machine,category,root cause\n2026-06-22,MC-01,"Breakdown, motor",Bearing');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.event_date, "2026-06-22");
  assert.equal(rows[0]?.category, "Breakdown, motor");
});

test("normalizeTabularRows converts XLSX-style arrays to records", () => {
  const rows = normalizeTabularRows([
    ["Tanggal", "Mesin", "Category"],
    ["22/06/2026", "MC-01", "Breakdown"]
  ]);
  assert.deepEqual(rows[0], { event_date: "22/06/2026", machine_code: "MC-01", category: "Breakdown" });
});

test("parseDowntimeImportRows validates closed downtime rows", () => {
  const parsed = parseDowntimeImportRows([
    {
      event_date: "22/06/2026",
      shift_code: "N",
      machine_code: "MC-01",
      category: "breakdown",
      start_time: "23:30",
      end_time: "01:00",
      root_cause: "Bearing",
      action_taken: "Replace bearing"
    }
  ]);
  assert.equal(parsed.summary.validRows, 1);
  assert.equal(parsed.rows[0]?.normalized.durationMinutes, 90);
  assert.equal(parsed.rows[0]?.normalized.status, "CLOSED");
});

test("parseDowntimeImportRows reports missing required fields", () => {
  const parsed = parseDowntimeImportRows([{ machine_code: "MC-01", category: "breakdown" }]);
  assert.equal(parsed.summary.invalidRows, 1);
  assert.equal(parsed.rows[0]?.issues[0]?.code, "MISSING_EVENT_DATE");
});

test("parseDowntimeImportRows detects duplicate natural keys in file", () => {
  const row = {
    event_date: "2026-06-22",
    machine_code: "MC-01",
    category: "breakdown",
    start_time: "08:00"
  };
  const parsed = parseDowntimeImportRows([row, row]);
  assert.equal(parsed.summary.validRows, 1);
  assert.equal(parsed.summary.duplicateRows, 1);
});
