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

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows, fields) {
  return [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(","))
  ].join("\n") + "\n";
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
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { ok: res.ok, status: res.status, text, json };
}

function rowsFrom(json) {
  if (Array.isArray(json?.value)) return json.value;
  if (Array.isArray(json)) return json;
  return [];
}

function pick(row) {
  return {
    Entry_No: row.Entry_No,
    Posting_Date: row.Posting_Date,
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
    divname: row.divname
  };
}

function hasProductionSignal(row) {
  return Boolean(
    row.Machine_Center_No ||
    row.gProdOrRotLine_No ||
    row.gProdOrRotLine_Description ||
    String(row.Document_No || "").startsWith("SPK") ||
    String(row.Item_Category_Code || "").startsWith("JADI") ||
    String(row.Item_No || "").startsWith("RJ")
  );
}

async function main() {
  const env = { ...readEnvFile(".env"), ...process.env };

  const ODATA_URL = env.BC_ODATA_URL || env.ODATA_URL;
  const USERNAME = env.BC_ODATA_USERNAME || env.ODATA_USERNAME;
  const PASSWORD = env.BC_ODATA_PASSWORD || env.ODATA_PASSWORD;

  if (!ODATA_URL) {
    console.error("ERROR: BC_ODATA_URL / ODATA_URL tidak ditemukan di .env");
    process.exit(1);
  }

  if (!USERNAME || !PASSWORD) {
    console.error("ERROR: BC_ODATA_USERNAME / BC_ODATA_PASSWORD tidak ditemukan di .env");
    process.exit(1);
  }

  const outDir = ".tmp/odata-probe";
  fs.mkdirSync(outDir, { recursive: true });

  const headers = {
    Accept: "application/json",
    Authorization: "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")
  };

  const select = [
    "Entry_No",
    "Posting_Date",
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

  const probes = [
    {
      name: "latest-entry-desc",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$orderby": "Entry_No desc"
      }
    },
    {
      name: "recent-2026",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "Posting_Date ge 2026-01-01",
        "$orderby": "Posting_Date desc"
      }
    },
    {
      name: "document-spk",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "startswith(Document_No,'SPK')"
      }
    },
    {
      name: "machine-center-not-blank",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "Machine_Center_No ne ''"
      }
    },
    {
      name: "prod-line-no-not-blank",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "gProdOrRotLine_No ne ''"
      }
    },
    {
      name: "machine-desc-not-blank",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "gProdOrRotLine_Description ne ''"
      }
    },
    {
      name: "jadi-printing",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "Item_Category_Code eq 'JADI-PRINTING'"
      }
    },
    {
      name: "reject-items",
      params: {
        "$top": "20",
        "$format": "json",
        "$select": select,
        "$filter": "startswith(Item_No,'RJ')"
      }
    }
  ];

  const summary = [];
  const allRowsByEntry = new Map();

  for (const probe of probes) {
    const url = buildUrl(ODATA_URL, probe.params);
    const res = await fetchJson(url, headers);

    fs.writeFileSync(path.join(outDir, `${safeName(probe.name)}.raw.txt`), res.text);

    if (!res.ok || !res.json) {
      summary.push({
        probe: probe.name,
        status: res.status,
        rows: 0,
        productionSignalRows: 0,
        note: "FAILED"
      });
      console.log(`[FAILED] ${probe.name} status=${res.status}`);
      continue;
    }

    const rows = rowsFrom(res.json).map(pick);
    const productionSignalRows = rows.filter(hasProductionSignal).length;

    for (const row of rows) {
      const key = row.Entry_No ?? JSON.stringify(row);
      if (!allRowsByEntry.has(key)) allRowsByEntry.set(key, { ...row, probe: probe.name });
    }

    fs.writeFileSync(path.join(outDir, `${safeName(probe.name)}.json`), JSON.stringify(rows, null, 2));

    fs.writeFileSync(
      path.join(outDir, `${safeName(probe.name)}.csv`),
      toCsv(rows, [
        "Entry_No",
        "Posting_Date",
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
      ])
    );

    summary.push({
      probe: probe.name,
      status: res.status,
      rows: rows.length,
      productionSignalRows,
      firstDocument: rows[0]?.Document_No || "",
      firstDate: rows[0]?.Posting_Date || "",
      firstMachineCenter: rows[0]?.Machine_Center_No || "",
      firstProdLineNo: rows[0]?.gProdOrRotLine_No || "",
      firstMachineDescription: rows[0]?.gProdOrRotLine_Description || "",
      firstCategory: rows[0]?.Item_Category_Code || ""
    });

    console.log(`[OK] ${probe.name}: rows=${rows.length}, productionSignalRows=${productionSignalRows}`);
  }

  const allRows = [...allRowsByEntry.values()];

  fs.writeFileSync(
    path.join(outDir, "probe-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  fs.writeFileSync(
    path.join(outDir, "probe-summary.csv"),
    toCsv(summary, [
      "probe",
      "status",
      "rows",
      "productionSignalRows",
      "firstDocument",
      "firstDate",
      "firstMachineCenter",
      "firstProdLineNo",
      "firstMachineDescription",
      "firstCategory",
      "note"
    ])
  );

  fs.writeFileSync(
    path.join(outDir, "all-probe-rows.csv"),
    toCsv(allRows, [
      "probe",
      "Entry_No",
      "Posting_Date",
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
    ])
  );

  console.log("");
  console.log("Output:");
  console.log(".tmp/odata-probe/probe-summary.csv");
  console.log(".tmp/odata-probe/all-probe-rows.csv");
  console.log("");
  console.log("Upload probe-summary.csv dan all-probe-rows.csv ke ChatGPT.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
