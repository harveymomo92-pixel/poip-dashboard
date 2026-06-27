import fs from "node:fs";
import path from "node:path";

function readEnvFile(file = ".env") {
  const env = {};
  if (!fs.existsSync(file)) return env;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const idx = arg.indexOf("=");
    if (idx === -1) args[arg.slice(2)] = true;
    else args[arg.slice(2, idx)] = arg.slice(idx + 1);
  }
  return args;
}

function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function safeName(name) {
  return name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows, fields) {
  const lines = [fields.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(fields.map((field) => csvEscape(row[field])).join(","));
  }
  return lines.join("\n") + "\n";
}

function normalizeText(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function inferOutputKind(row) {
  const entryType = normalizeText(row.Entry_Type);
  const itemNo = normalizeText(row.Item_No);
  const itemCat = normalizeText(row.Item_Category_Code);
  const desc = normalizeText(row.gItem_Description || row.Description);

  if (
    entryType.includes("NEGATIVE") ||
    itemNo.startsWith("RJ") ||
    itemCat.includes("REJECT") ||
    desc.includes("REJECT")
  ) {
    return "REJECT";
  }

  if (
    entryType.includes("OUTPUT") ||
    entryType.includes("POSITIVE") ||
    itemCat.includes("JADI")
  ) {
    return "OK_OR_OUTPUT";
  }

  return "";
}

function inferBucket(row) {
  const desc = normalizeText(row.gItem_Description || row.Description);
  const oz = desc.match(/(\d+(?:[.,]\d+)?)\s*OZ/);
  if (oz) {
    const n = Number(oz[1].replace(",", "."));
    if (n === 22) return "OZ_22";
    if (n < 20) return "OZ_LT_20";
    if (n > 22) return "OZ_GT_22";
    return `OZ_${String(n).replace(".", "_")}`;
  }

  const gram = desc.match(/(\d+(?:[.,]\d+)?)\s*(GR|GRAM|G)\b/);
  if (gram) {
    const n = Number(gram[1].replace(",", "."));
    if (Number.isFinite(n)) return n <= 12 ? "GW_LE_12" : "GW_GT_12";
  }

  if (desc.includes("PREFORM")) return "PREFORM";
  if (desc.includes("BOTOL") || desc.includes("BTL")) return "BOTOL";
  if (desc.includes("CUP")) return "CUP";
  return "";
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: res.ok, status: res.status, text, json: null };
  }

  return { ok: res.ok, status: res.status, text, json };
}

function rowsFrom(json) {
  if (Array.isArray(json?.value)) return json.value;
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") return [json];
  return [];
}

function projectRows(rows) {
  return rows.map((row) => ({
    Entry_No: row.Entry_No,
    Posting_Date: row.Posting_Date,
    Document_Date: row.Document_Date,
    Entry_Type: row.Entry_Type,
    Document_No: row.Document_No,
    Item_No: row.Item_No,
    gItem_Description: row.gItem_Description,
    Description: row.Description,
    Item_Category_Code: row.Item_Category_Code,
    Location_Code: row.Location_Code,
    Quantity: row.Quantity,
    Unit_of_Measure_Code: row.Unit_of_Measure_Code,
    Gross_Weight: row.Gross_Weight,
    gProdOrRotLine_No: row.gProdOrRotLine_No,
    gProdOrRotLine_Description: row.gProdOrRotLine_Description,
    Machine_Center_No: row.Machine_Center_No,
    dimcode: row.dimcode,
    divcode: row.divcode,
    divname: row.divname,
    inferred_output_kind: inferOutputKind(row),
    inferred_bucket: inferBucket(row)
  }));
}

function aggregateCombos(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.gProdOrRotLine_Description || "",
      row.Machine_Center_No || "",
      row.gProdOrRotLine_No || "",
      row.Item_Category_Code || "",
      row.inferred_output_kind || "",
      row.inferred_bucket || ""
    ].join("||");

    if (!map.has(key)) {
      map.set(key, {
        gProdOrRotLine_Description: row.gProdOrRotLine_Description || "",
        Machine_Center_No: row.Machine_Center_No || "",
        gProdOrRotLine_No: row.gProdOrRotLine_No || "",
        Item_Category_Code: row.Item_Category_Code || "",
        inferred_output_kind: row.inferred_output_kind || "",
        inferred_bucket: row.inferred_bucket || "",
        rows: 0,
        qty: 0,
        sample_items: new Set(),
        sample_docs: new Set(),
        sample_desc: new Set()
      });
    }

    const item = map.get(key);
    item.rows += 1;
    item.qty += Number(row.Quantity || 0);

    if (row.Item_No && item.sample_items.size < 8) item.sample_items.add(row.Item_No);
    if (row.Document_No && item.sample_docs.size < 8) item.sample_docs.add(row.Document_No);
    if ((row.gItem_Description || row.Description) && item.sample_desc.size < 5) {
      item.sample_desc.add(row.gItem_Description || row.Description);
    }
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      qty: Number(item.qty.toFixed(4)),
      sample_items: [...item.sample_items].join(" | "),
      sample_docs: [...item.sample_docs].join(" | "),
      sample_desc: [...item.sample_desc].join(" | ")
    }))
    .sort((a, b) => Math.abs(b.qty) - Math.abs(a.qty) || b.rows - a.rows);
}

async function main() {
  const args = parseArgs();
  const env = { ...readEnvFile(".env"), ...process.env };

  const ODATA_URL = args.url || env.BC_ODATA_URL || env.ODATA_URL;
  const USERNAME = args.username || env.BC_ODATA_USERNAME || env.ODATA_USERNAME;
  const PASSWORD = args.password || env.BC_ODATA_PASSWORD || env.ODATA_PASSWORD;

  if (!ODATA_URL) {
    console.error("ERROR: BC_ODATA_URL / ODATA_URL tidak ditemukan.");
    process.exit(1);
  }

  if (!USERNAME || !PASSWORD) {
    console.error("ERROR: BC_ODATA_USERNAME / BC_ODATA_PASSWORD tidak ditemukan.");
    process.exit(1);
  }

  const top = args.top || "300";
  const since = args.since || "2026-01-01";
  const outDir = ".tmp/odata-production-sample";
  fs.mkdirSync(outDir, { recursive: true });

  const headers = {
    Accept: "application/json",
    Authorization: "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")
  };

  const select = [
    "Entry_No",
    "Posting_Date",
    "Document_Date",
    "Entry_Type",
    "Document_No",
    "Item_No",
    "gItem_Description",
    "Description",
    "Item_Category_Code",
    "Location_Code",
    "Quantity",
    "Unit_of_Measure_Code",
    "Gross_Weight",
    "gProdOrRotLine_No",
    "gProdOrRotLine_Description",
    "Machine_Center_No",
    "dimcode",
    "divcode",
    "divname"
  ].join(",");

  const queries = [
    {
      name: "recent-all",
      filter: `Posting_Date ge ${since}`
    },
    {
      name: "machine-center-not-blank",
      filter: `Machine_Center_No ne ''`
    },
    {
      name: "machine-desc-not-blank",
      filter: `gProdOrRotLine_Description ne ''`
    },
    {
      name: "prod-line-not-blank",
      filter: `gProdOrRotLine_No ne ''`
    },
    {
      name: "jadi-printing",
      filter: `Item_Category_Code eq 'JADI-PRINTING'`
    },
    {
      name: "reject-items",
      filter: `startswith(Item_No,'RJ')`
    },
    {
      name: "spk-documents",
      filter: `startswith(Document_No,'SPK')`
    },
    {
      name: "printing-oz-items",
      filter: `contains(gItem_Description,'OZ')`
    }
  ];

  const allRows = [];

  for (const query of queries) {
    const url = buildUrl(ODATA_URL, {
      "$top": top,
      "$format": "json",
      "$select": select,
      "$filter": query.filter,
      "$orderby": "Posting_Date desc"
    });

    console.log(`Fetching ${query.name}...`);

    const res = await fetchJson(url, headers);
    const rawFile = path.join(outDir, `${safeName(query.name)}.raw.txt`);
    fs.writeFileSync(rawFile, res.text);

    if (!res.ok || !res.json) {
      console.log(`- FAILED status=${res.status}. Lihat ${rawFile}`);
      continue;
    }

    const rows = projectRows(rowsFrom(res.json));
    allRows.push(...rows.map((row) => ({ ...row, sample_source: query.name })));

    fs.writeFileSync(
      path.join(outDir, `${safeName(query.name)}.json`),
      JSON.stringify(rows, null, 2)
    );

    fs.writeFileSync(
      path.join(outDir, `${safeName(query.name)}.csv`),
      toCsv(rows, [
        "Entry_No",
        "Posting_Date",
        "Document_Date",
        "Entry_Type",
        "Document_No",
        "Item_No",
        "gItem_Description",
        "Description",
        "Item_Category_Code",
        "Location_Code",
        "Quantity",
        "Unit_of_Measure_Code",
        "Gross_Weight",
        "gProdOrRotLine_No",
        "gProdOrRotLine_Description",
        "Machine_Center_No",
        "dimcode",
        "divcode",
        "divname",
        "inferred_output_kind",
        "inferred_bucket"
      ])
    );

    console.log(`- OK rows=${rows.length}`);
  }

  const dedupe = new Map();
  for (const row of allRows) {
    const key = row.Entry_No ?? JSON.stringify(row);
    if (!dedupe.has(key)) dedupe.set(key, row);
  }

  const uniqueRows = [...dedupe.values()];
  const combos = aggregateCombos(uniqueRows);

  fs.writeFileSync(
    path.join(outDir, "all-production-sample.csv"),
    toCsv(uniqueRows, [
      "sample_source",
      "Entry_No",
      "Posting_Date",
      "Document_Date",
      "Entry_Type",
      "Document_No",
      "Item_No",
      "gItem_Description",
      "Description",
      "Item_Category_Code",
      "Location_Code",
      "Quantity",
      "Unit_of_Measure_Code",
      "Gross_Weight",
      "gProdOrRotLine_No",
      "gProdOrRotLine_Description",
      "Machine_Center_No",
      "dimcode",
      "divcode",
      "divname",
      "inferred_output_kind",
      "inferred_bucket"
    ])
  );

  fs.writeFileSync(
    path.join(outDir, "source-combos.csv"),
    toCsv(combos, [
      "gProdOrRotLine_Description",
      "Machine_Center_No",
      "gProdOrRotLine_No",
      "Item_Category_Code",
      "inferred_output_kind",
      "inferred_bucket",
      "rows",
      "qty",
      "sample_items",
      "sample_docs",
      "sample_desc"
    ])
  );

  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        top,
        since,
        queryCount: queries.length,
        uniqueRows: uniqueRows.length,
        outputFiles: [
          "summary.json",
          "all-production-sample.csv",
          "source-combos.csv",
          "... plus per-query csv/json/raw files"
        ],
        note: "No credentials are written. Do not upload .env."
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(outDir, "README.txt"),
    [
      "OData production-focused sample.",
      "",
      "Upload these files to ChatGPT:",
      "- summary.json",
      "- all-production-sample.csv",
      "- source-combos.csv",
      "- machine-center-not-blank.csv if exists and has rows",
      "- machine-desc-not-blank.csv if exists and has rows",
      "- prod-line-not-blank.csv if exists and has rows",
      "- spk-documents.csv if exists and has rows",
      "- jadi-printing.csv if exists and has rows",
      "",
      "Do NOT upload .env, cookies, or credentials."
    ].join("\n")
  );

  console.log("");
  console.log(`Unique rows collected: ${uniqueRows.length}`);
  console.log(`Output folder: ${outDir}`);
  console.log("Main files:");
  console.log("- summary.json");
  console.log("- all-production-sample.csv");
  console.log("- source-combos.csv");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
