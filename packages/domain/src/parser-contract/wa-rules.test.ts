import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWhatsAppOperationalText } from "./wa-rules.js";

test("parseWhatsAppOperationalText parses production output rows", () => {
  const result = parseWhatsAppOperationalText(
    "2026-06-22 Shift A MC-MOCK-01 item FG-MOCK-001 output 120 reject 2"
  );

  assert.equal(result.summary.totalRows, 1);
  assert.equal(result.summary.validRows, 1);
  const row = result.rows[0];
  assert.equal(row?.type, "PRODUCTION_OUTPUT");
  assert.equal(row?.parsedPayload.type, "PRODUCTION_OUTPUT");
  if (row?.parsedPayload.type === "PRODUCTION_OUTPUT") {
    assert.equal(row.parsedPayload.postingDate, "2026-06-22");
    assert.equal(row.parsedPayload.machineCode, "MC-MOCK-01");
    assert.equal(row.parsedPayload.itemNo, "FG-MOCK-001");
    assert.equal(row.parsedPayload.quantity, 120);
    assert.equal(row.parsedPayload.rejectKg, 2);
  }
});

test("parseWhatsAppOperationalText parses cross-midnight downtime rows", () => {
  const result = parseWhatsAppOperationalText(
    "22/06/2026 shift N downtime MC-MOCK-01 23:30-01:00 breakdown root bearing action replaced bearing"
  );
  const row = result.rows[0];

  assert.equal(row?.status, "VALID");
  assert.equal(row?.parsedPayload.type, "DOWNTIME");
  if (row?.parsedPayload.type === "DOWNTIME") {
    assert.equal(row.parsedPayload.durationMinutes, 90);
    assert.equal(row.parsedPayload.category, "BREAKDOWN");
  }
});

test("parseWhatsAppOperationalText marks missing required fields invalid", () => {
  const result = parseWhatsAppOperationalText("output item FG-MOCK-001 qty 10");
  assert.equal(result.summary.invalidRows, 1);
  assert.equal(result.rows[0]?.issues.some((issue) => issue.code === "MISSING_DATE"), true);
});
