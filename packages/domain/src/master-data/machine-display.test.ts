import assert from "node:assert/strict";
import test from "node:test";
import { resolveMachineDisplay } from "./machine-display.js";

const cases: readonly [string, string][] = [
  ["BORCH 1 PREFORM 19 GR", "Borch 1"],
  ["BORCH 1 PREFORM 42.3 GR", "Borch 1"],
  ["BORCH 2 PREFORM 27.5 GR", "Borch 2"],
  ["CAI-2", "CAI 2"],
  ["OMSO 1-OZ", "OMSO 1"],
  ["OMSO-1-OZ", "OMSO 1"],
  ["THERMO ILLIG-1", "ILLIG 1"],
  ["THERMO ILLIG-2", "ILLIG 2"],
  ["THERMO 1 ILLIG", "ILLIG 1"],
  ["THERMO HENGFENG-2-OZ", "Hengfeng 2"],
  ["VFINE BOTOL 400 ML", "V-Fine"],
  ["GILINGAN", "GILINGAN"],
  ["REPACKING", "REPACKING"],
  ["Borche 1 - Preform 19.0 / 19.1 gram", "Borch 1"],
  ["Borche 2 - Preform 27.5 gram", "Borch 2"],
  ["CAI 2 - Cup Regular", "CAI 2"],
  ["Illig 2 - Thermoforming Cup", "ILLIG 2"]
];

test("resolveMachineDisplay returns short business display names", () => {
  for (const [input, expected] of cases) {
    assert.equal(resolveMachineDisplay(input).display, expected, input);
    assert.equal(resolveMachineDisplay(input).displaySource, "machine_display_mapping", input);
  }
});

test("resolveMachineDisplay normalizes non-breaking spaces and punctuation", () => {
  assert.equal(resolveMachineDisplay("THERMO\u00a0HENGFENG–2–OZ").display, "Hengfeng 2");
});

test("resolveMachineDisplay falls back safely for unknown labels", () => {
  assert.deepEqual(resolveMachineDisplay("Unknown Line 7"), {
    display: "Unknown Line 7",
    displaySource: "fallback"
  });
});
