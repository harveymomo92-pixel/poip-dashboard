import assert from "node:assert/strict";
import test from "node:test";
import { toAsiaJakartaBusinessDate } from "./timezone.js";

test("toAsiaJakartaBusinessDate returns local business date", () => {
  assert.equal(toAsiaJakartaBusinessDate(new Date("2026-06-22T18:00:00.000Z")), "2026-06-23");
});
