import assert from "node:assert/strict";
import test from "node:test";
import { parseExternalDocument } from "./external-document.js";

test("parseExternalDocument parses S1/8/RAHMAT", () => {
  assert.deepEqual(parseExternalDocument("S1/8/RAHMAT"), {
    rawExternalDocument: "S1/8/RAHMAT",
    shiftCode: "S1",
    shiftNumber: 1,
    workHours: 8,
    operatorName: "RAHMAT",
    parseStatus: "PARSED"
  });
});

test("parseExternalDocument parses common shift hour operator variants", () => {
  assert.equal(parseExternalDocument("S2/12/ANDI").shiftCode, "S2");
  assert.equal(parseExternalDocument("S2/12/ANDI").workHours, 12);
  assert.equal(parseExternalDocument("S3/7.5/BUDI").workHours, 7.5);
  assert.equal(parseExternalDocument("S1 / 8 / RAHMAT").operatorName, "RAHMAT");
  assert.equal(parseExternalDocument("s1/8/rahmat").operatorName, "RAHMAT");
});

test("parseExternalDocument joins extra operator parts consistently", () => {
  const parsed = parseExternalDocument("S1/8/RAHMAT/EXTRA");

  assert.equal(parsed.parseStatus, "PARSED");
  assert.equal(parsed.operatorName, "RAHMAT / EXTRA");
});

test("parseExternalDocument handles empty, invalid shift, invalid hours, and operator spaces", () => {
  assert.equal(parseExternalDocument("").parseStatus, "UNPARSED");
  assert.equal(parseExternalDocument(null).parseStatus, "UNPARSED");
  assert.equal(parseExternalDocument("SHIFT1/8/RAHMAT").parseStatus, "UNPARSED");
  assert.equal(parseExternalDocument("S1/eight/RAHMAT").parseStatus, "UNPARSED");
  assert.equal(parseExternalDocument("S1/8/Rahmat   Hidayat").operatorName, "RAHMAT HIDAYAT");
});
