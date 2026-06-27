#!/usr/bin/env node
/**
 * collect-bc-odata-sample.mjs
 *
 * Business Central OData sampler untuk redesign entity + target.
 *
 * Output aman untuk dibagikan ke ChatGPT:
 * - Tidak menulis credential.
 * - Tidak menulis .env.
 * - Hanya mengambil sample rows + profiling field + kombinasi source.
 *
 * Cara pakai dari root repo:
 *   mkdir -p scripts
 *   cp collect-bc-odata-sample.mjs scripts/collect-bc-odata-sample.mjs
 *   chmod +x scripts/collect-bc-odata-sample.mjs
 *   node scripts/collect-bc-odata-sample.mjs --top=500 --pages=3 --raw-limit=200
 *
 * Opsional override:
 *   node scripts/collect-bc-odata-sample.mjs --url="..." --username="..." --password="..."
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const DEFAULTS = {
  top: 500,
  pages: 3,
  rawLimit: 200,
  outBase: ".tmp",
  timeoutMs: 120000
};

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) args[arg.slice(2)] = true;
    else args[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return args;
}

function parseDotenv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function truncate(value, max = 300) {
  if (value == null) return value;
  const str = String(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function flattenObject(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@odata.")) continue;
    const flatKey = prefix ? `${prefix}_${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= 25) {
      flattenObject(value, flatKey, out);
    } else {
      out[flatKey] = value;
    }
  }
  return out;
}

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  return `${lines.join("\n")}\n`;
}

function buildFetchUrl(rawUrl, top) {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("$top")) url.searchParams.set("$top", String(top));
  if (!url.searchParams.has("$format")) url.searchParams.set("$format", "json");
  return url.toString();
}

async function fetchJsonWithTimeout(url, headers, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response ${res.status}: ${text.slice(0, 700)}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 1200)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function getRowsFromOData(json) {
  if (Array.isArray(json?.value)) return json.value;
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") return [json];
  return [];
}

function getNextLink(json) {
  return json?.["@odata.nextLink"] || json?.["odata.nextLink"] || null;
}

const FIELD_ALIASES = {
  entryNo: ["entryno", "entrynumber", "entry_no", "entry"],
  postingDate: ["postingdate", "posting_date", "date", "tanggalposting"],
  documentNo: ["documentno", "documentnumber", "document_no", "docno"],
  itemNo: ["itemno", "item_no", "itemnumber", "noitem", "no"],
  itemDescription: ["itemdescription", "item_description", "description", "deskripsiitem", "description2"],
  itemCategoryCode: ["itemcategorycode", "item_category_code", "categorycode", "itemcategory", "productgroupcode"],
  quantity: ["quantity", "qty", "outputqty", "outputquantity", "jumlah"],
  uom: ["unitofmeasurecode", "unit_of_measure_code", "uom", "uomcode", "unitofmeasure"],
  outputType: ["outputtype", "output_type", "normalizedoutputtype", "type", "entrytype"],
  machineCenterNo: ["machinecenterno", "machine_center_no", "machinecenter", "machinecentercode", "workcenterno", "work_center_no", "workcenter"],
  machineDescription: ["machinedescription", "machine_description", "machinecenterdescription", "workcenterdescription"],
  prodLineNo: ["prodlineno", "prod_line_no", "productionlineno", "production_line_no", "prodline", "linecode"],
  prodLineDescription: ["prodlinedescription", "prod_line_description", "productionlinedescription", "production_line_description", "linedescription"],
  operator: ["operator", "operatorname", "namaoperator"],
  shift: ["shift", "shiftcode", "shiftdescription"],
  workHours: ["workhours", "work_hours", "runtime", "runhours", "jamkerja"],
  grossWeight: ["grossweight", "gross_weight", "grossweightperpcs", "gross_weight_per_pcs", "beratgross"]
};

function detectFields(rows) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const normalizedToActual = new Map(keys.map((k) => [normalizeKey(k), k]));
  const detected = {};
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    let found = null;
    for (const alias of aliases) {
      const n = normalizeKey(alias);
      if (normalizedToActual.has(n)) {
        found = normalizedToActual.get(n);
        break;
      }
    }
    if (!found) {
      const needles = aliases.map(normalizeKey).filter((x) => x.length >= 5);
      found = keys.find((key) => {
        const nk = normalizeKey(key);
        return needles.some((needle) => nk.includes(needle) || needle.includes(nk));
      }) || null;
    }
    detected[canonical] = found;
  }
  return detected;
}

function valueOf(row, detected, canonical) {
  const key = detected[canonical];
  return key ? row[key] : null;
}

function inferOzBucket(text) {
  const t = normalizeText(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*OZ/);
  if (!m) return "";
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return "OZ_UNKNOWN";
  if (n === 22) return "OZ_22";
  if (n < 20) return "OZ_LT_20";
  if (n > 22) return "OZ_GT_22";
  return `OZ_${String(n).replace(".", "_")}`;
}

function inferGramBucket(text) {
  const t = normalizeText(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(GR|GRAM|G)\b/);
  if (!m) return "";
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return "GRAM_UNKNOWN";
  if (n <= 12) return "GW_LE_12";
  return "GW_GT_12";
}

function inferOutputKind(row, detected) {
  const outType = normalizeText(valueOf(row, detected, "outputType"));
  const itemNo = normalizeText(valueOf(row, detected, "itemNo"));
  const itemCat = normalizeText(valueOf(row, detected, "itemCategoryCode"));
  const desc = normalizeText(valueOf(row, detected, "itemDescription"));
  if (outType.includes("REJECT") || itemNo.startsWith("RJ") || itemCat.includes("REJECT") || desc.includes("REJECT")) return "REJECT";
  if (outType.includes("OK")) return "OK";
  return "";
}

function toNumberLike(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function profileFields(rows) {
  const profile = new Map();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!profile.has(key)) {
        profile.set(key, { field: key, normalizedField: normalizeKey(key), nonNull: 0, blank: 0, types: new Set(), sampleValues: new Set() });
      }
      const p = profile.get(key);
      const blank = value == null || value === "";
      if (blank) p.blank += 1;
      else p.nonNull += 1;
      p.types.add(Array.isArray(value) ? "array" : typeof value);
      if (!blank && p.sampleValues.size < 12) p.sampleValues.add(truncate(value, 120));
    }
  }
  return Array.from(profile.values()).map((p) => ({
    field: p.field,
    normalizedField: p.normalizedField,
    nonNull: p.nonNull,
    blank: p.blank,
    types: Array.from(p.types).sort().join("|"),
    sampleValues: Array.from(p.sampleValues).join(" || ")
  })).sort((a, b) => a.field.localeCompare(b.field));
}

function aggregateCombos(rows, detected) {
  const combos = new Map();
  for (const row of rows) {
    const machineDescription = normalizeText(valueOf(row, detected, "machineDescription"));
    const machineCenterNo = normalizeText(valueOf(row, detected, "machineCenterNo"));
    const prodLineNo = normalizeText(valueOf(row, detected, "prodLineNo"));
    const prodLineDescription = normalizeText(valueOf(row, detected, "prodLineDescription"));
    const itemCategoryCode = normalizeText(valueOf(row, detected, "itemCategoryCode"));
    const itemNo = normalizeText(valueOf(row, detected, "itemNo"));
    const itemDescription = normalizeText(valueOf(row, detected, "itemDescription"));
    const ozBucket = inferOzBucket(itemDescription);
    const gramBucket = inferGramBucket(itemDescription);
    const outputKind = inferOutputKind(row, detected);
    const quantity = toNumberLike(valueOf(row, detected, "quantity"));
    const key = [machineDescription, machineCenterNo, prodLineNo, prodLineDescription, itemCategoryCode, ozBucket, gramBucket, outputKind].join("||");

    if (!combos.has(key)) {
      combos.set(key, {
        machineDescription,
        machineCenterNo,
        prodLineNo,
        prodLineDescription,
        itemCategoryCode,
        ozBucket,
        gramBucket,
        outputKind,
        rows: 0,
        quantity: 0,
        sampleItemNos: new Set(),
        sampleItemDescriptions: new Set(),
        sampleDocumentNos: new Set()
      });
    }
    const c = combos.get(key);
    c.rows += 1;
    c.quantity += quantity;
    if (itemNo && c.sampleItemNos.size < 8) c.sampleItemNos.add(itemNo);
    if (itemDescription && c.sampleItemDescriptions.size < 5) c.sampleItemDescriptions.add(truncate(itemDescription, 120));
    const documentNo = normalizeText(valueOf(row, detected, "documentNo"));
    if (documentNo && c.sampleDocumentNos.size < 8) c.sampleDocumentNos.add(documentNo);
  }

  return Array.from(combos.values()).map((c) => ({
    machineDescription: c.machineDescription,
    machineCenterNo: c.machineCenterNo,
    prodLineNo: c.prodLineNo,
    prodLineDescription: c.prodLineDescription,
    itemCategoryCode: c.itemCategoryCode,
    ozBucket: c.ozBucket,
    gramBucket: c.gramBucket,
    outputKind: c.outputKind,
    rows: c.rows,
    quantity: Number(c.quantity.toFixed(4)),
    sampleItemNos: Array.from(c.sampleItemNos).join(" | "),
    sampleItemDescriptions: Array.from(c.sampleItemDescriptions).join(" | "),
    sampleDocumentNos: Array.from(c.sampleDocumentNos).join(" | ")
  })).sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity) || b.rows - a.rows);
}

function mappingRow(row, detected) {
  const itemDescription = valueOf(row, detected, "itemDescription");
  return {
    entryNo: valueOf(row, detected, "entryNo"),
    postingDate: valueOf(row, detected, "postingDate"),
    documentNo: valueOf(row, detected, "documentNo"),
    itemNo: valueOf(row, detected, "itemNo"),
    itemDescription,
    itemCategoryCode: valueOf(row, detected, "itemCategoryCode"),
    quantity: valueOf(row, detected, "quantity"),
    uom: valueOf(row, detected, "uom"),
    outputType: valueOf(row, detected, "outputType"),
    inferredOutputKind: inferOutputKind(row, detected),
    inferredOzBucket: inferOzBucket(itemDescription),
    inferredGramBucket: inferGramBucket(itemDescription),
    grossWeight: valueOf(row, detected, "grossWeight"),
    machineDescription: valueOf(row, detected, "machineDescription"),
    machineCenterNo: valueOf(row, detected, "machineCenterNo"),
    prodLineNo: valueOf(row, detected, "prodLineNo"),
    prodLineDescription: valueOf(row, detected, "prodLineDescription"),
    operator: valueOf(row, detected, "operator"),
    shift: valueOf(row, detected, "shift"),
    workHours: valueOf(row, detected, "workHours")
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dotEnv = parseDotenv(path.resolve(process.cwd(), ".env"));
  const env = { ...dotEnv, ...process.env };

  const rawUrl = args.url || env.BC_ODATA_URL || env.ODATA_URL;
  const username = args.username || env.BC_ODATA_USERNAME || env.ODATA_USERNAME;
  const password = args.password || env.BC_ODATA_PASSWORD || env.ODATA_PASSWORD;

  const top = Number(args.top || DEFAULTS.top);
  const pages = Number(args.pages || DEFAULTS.pages);
  const rawLimit = Number(args["raw-limit"] || args.rawLimit || DEFAULTS.rawLimit);
  const outBase = args.out || DEFAULTS.outBase;
  const timeoutMs = Number(args.timeout || DEFAULTS.timeoutMs);

  if (!rawUrl) {
    console.error("Missing BC_ODATA_URL. Set it in .env or pass --url=...");
    process.exit(1);
  }
  if (!username || !password) {
    console.error("Missing BC OData username/password. Set BC_ODATA_USERNAME and BC_ODATA_PASSWORD in .env or pass --username/--password.");
    process.exit(1);
  }

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(process.cwd(), outBase, `odata-sample-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const endpointHash = crypto.createHash("sha256").update(rawUrl).digest("hex").slice(0, 16);
  const headers = { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };

  let url = buildFetchUrl(rawUrl, top);
  const fetchedRows = [];
  const fetchLog = [];

  for (let page = 1; page <= pages && url; page += 1) {
    console.log(`Fetching page ${page}/${pages}`);
    const json = await fetchJsonWithTimeout(url, headers, timeoutMs);
    const rows = getRowsFromOData(json).map((row) => flattenObject(row));
    fetchedRows.push(...rows);
    fetchLog.push({ page, rows: rows.length, hasNextLink: Boolean(getNextLink(json)) });
    url = getNextLink(json);
  }

  const detected = detectFields(fetchedRows);
  const profile = profileFields(fetchedRows);
  const combos = aggregateCombos(fetchedRows, detected);
  const mappingRows = fetchedRows.map((row) => mappingRow(row, detected));

  fs.writeFileSync(path.join(outDir, "detected-fields.json"), JSON.stringify({ detected, allFields: profile.map((p) => p.field) }, null, 2));
  fs.writeFileSync(path.join(outDir, "field-profile.json"), JSON.stringify(profile, null, 2));
  fs.writeFileSync(path.join(outDir, "field-profile.csv"), toCsv(profile, ["field", "normalizedField", "nonNull", "blank", "types", "sampleValues"]));
  fs.writeFileSync(path.join(outDir, "source-combos.csv"), toCsv(combos, [
    "machineDescription", "machineCenterNo", "prodLineNo", "prodLineDescription", "itemCategoryCode", "ozBucket", "gramBucket", "outputKind", "rows", "quantity", "sampleItemNos", "sampleItemDescriptions", "sampleDocumentNos"
  ]));
  fs.writeFileSync(path.join(outDir, "rows-mapping-sample.jsonl"), `${mappingRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  fs.writeFileSync(path.join(outDir, "rows-raw-sample.json"), JSON.stringify(fetchedRows.slice(0, rawLimit), null, 2));

  const meta = {
    generatedAt: new Date().toISOString(),
    endpointHash,
    rowCount: fetchedRows.length,
    top,
    pages,
    rawLimit,
    fetchLog,
    detected,
    filesToShareWithChatGPT: ["meta.json", "detected-fields.json", "field-profile.csv", "source-combos.csv", "rows-mapping-sample.jsonl", "rows-raw-sample.json"],
    safetyNote: "Credentials are not written. Do not upload .env, cookies, or backup SQL files."
  };

  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(outDir, "README.txt"), [
    "Business Central OData sample pack", "", "Upload these files back to ChatGPT for entity/target redesign:",
    "- meta.json", "- detected-fields.json", "- field-profile.csv", "- source-combos.csv", "- rows-mapping-sample.jsonl", "- rows-raw-sample.json", "",
    "Do NOT upload:", "- .env", "- cookies", "- backup SQL", "- any file containing BC credentials", "", `Rows fetched: ${fetchedRows.length}`, `Endpoint hash: ${endpointHash}`, ""
  ].join("\n"));

  const tarPath = `${outDir}.tar.gz`;
  const tar = spawnSync("tar", ["-czf", tarPath, "-C", path.dirname(outDir), path.basename(outDir)], { stdio: "ignore" });
  const tarCreated = tar.status === 0 && fs.existsSync(tarPath);

  console.log("");
  console.log("Done.");
  console.log(`Output folder: ${outDir}`);
  if (tarCreated) console.log(`Archive: ${tarPath}`);
  console.log("");
  console.log("Upload these files to ChatGPT:");
  console.log("- meta.json");
  console.log("- detected-fields.json");
  console.log("- field-profile.csv");
  console.log("- source-combos.csv");
  console.log("- rows-mapping-sample.jsonl");
  console.log("- rows-raw-sample.json");
  if (tarCreated) console.log(`Or upload archive: ${tarPath}`);
  console.log("");
  console.log("Do NOT upload .env, cookies, backup SQL, or credentials.");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
