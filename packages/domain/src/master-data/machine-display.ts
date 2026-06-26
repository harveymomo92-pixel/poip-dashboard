export type MachineDisplaySource = "machine_display_mapping" | "fallback";

export interface MachineDisplayResolution {
  readonly display: string;
  readonly areaLine?: string;
  readonly matchedMachineDescription?: string;
  readonly displaySource: MachineDisplaySource;
}

interface MachineDisplayRule {
  readonly display: string;
  readonly areaLine: string;
  readonly pattern: RegExp;
}

const MACHINE_DISPLAY_RULES: readonly MachineDisplayRule[] = [
  { display: "Borch 1", areaLine: "INJECTION", pattern: /\bBORCH(?:E)?\s*[- ]?\s*1\b/ },
  { display: "Borch 2", areaLine: "INJECTION", pattern: /\bBORCH(?:E)?\s*[- ]?\s*2\b/ },
  { display: "CAI 2", areaLine: "THERMOFORMING", pattern: /\bCAI\s*[- ]?\s*2\b/ },
  { display: "OMSO 1", areaLine: "PRINTING", pattern: /\bOMSO\s*[- ]?\s*1(?:\s*[- ]?\s*OZ)?\b/ },
  { display: "OMSO 2", areaLine: "PRINTING", pattern: /\bOMSO\s*[- ]?\s*2(?:\s*[- ]?\s*OZ)?\b/ },
  { display: "ILLIG 1", areaLine: "THERMOFORMING", pattern: /\b(?:ILLIG\s*[- ]?\s*1|1\s*[- ]?\s*ILLIG)\b/ },
  { display: "ILLIG 2", areaLine: "THERMOFORMING", pattern: /\b(?:ILLIG\s*[- ]?\s*2|2\s*[- ]?\s*ILLIG)\b/ },
  { display: "Hengfeng 2", areaLine: "THERMOFORMING", pattern: /\bHENGFENG\s*[- ]?\s*2\b/ },
  { display: "V-Fine", areaLine: "BLOWING", pattern: /\bV\s*[- ]?\s*FINE\b|\bVFINE\b/ },
  { display: "GILINGAN", areaLine: "GILINGAN", pattern: /\bGILINGAN\b/ },
  { display: "REPACKING", areaLine: "REPACKING", pattern: /\bREPACKING\b/ }
];

function cleanDisplayInput(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayInput(value: string | null | undefined): string {
  return cleanDisplayInput(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^A-Z0-9. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveMachineDisplay(value: string | null | undefined): MachineDisplayResolution {
  const fallback = cleanDisplayInput(value) || "Unmapped";
  const normalized = normalizeDisplayInput(value);
  for (const rule of MACHINE_DISPLAY_RULES) {
    if (!rule.pattern.test(normalized)) continue;
    return {
      display: rule.display,
      areaLine: rule.areaLine,
      matchedMachineDescription: fallback,
      displaySource: "machine_display_mapping"
    };
  }
  return {
    display: fallback,
    displaySource: "fallback"
  };
}
