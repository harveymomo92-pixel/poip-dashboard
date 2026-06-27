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

function withQuery(rawUrl, params) {
  const url = new URL(rawUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function makeMetadataCandidates(rawUrl) {
  const url = new URL(rawUrl);
  const candidates = [];

  // Kandidat 1: sebelum /Company(...)
  const companyIndex = url.pathname.indexOf("/Company(");
  if (companyIndex !== -1) {
    const u = new URL(rawUrl);
    u.pathname = url.pathname.slice(0, companyIndex) + "/$metadata";
    u.search = "";
    candidates.push(u.toString());
  }

  // Kandidat 2: folder endpoint saat ini
  const u2 = new URL(rawUrl);
  const parts = u2.pathname.split("/");
  parts.pop();
  u2.pathname = parts.join("/") + "/$metadata";
  u2.search = "";
  candidates.push(u2.toString());

  // Kandidat 3: langsung tambah $metadata di root ODataV4 jika ada
  const odataIndex = url.pathname.indexOf("/ODataV4");
  if (odataIndex !== -1) {
    const u3 = new URL(rawUrl);
    u3.pathname = url.pathname.slice(0, odataIndex) + "/ODataV4/$metadata";
    u3.search = "";
    candidates.push(u3.toString());
  }

  return [...new Set(candidates)];
}

async function fetchText(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
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
    console.error("ERROR: BC_ODATA_USERNAME dan BC_ODATA_PASSWORD tidak ditemukan di .env");
    process.exit(1);
  }

  const outDir = ".tmp/odata-structure";
  fs.mkdirSync(outDir, { recursive: true });

  const headers = {
    Accept: "application/json",
    Authorization: "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")
  };

  console.log("1) Fetch sample top 3 dari endpoint OData...");
  const sampleUrl = withQuery(ODATA_URL, {
    "$top": "3",
    "$format": "json"
  });

  const sampleRes = await fetchText(sampleUrl, headers);

  fs.writeFileSync(path.join(outDir, "sample-response.raw.txt"), sampleRes.text);

  if (!sampleRes.ok) {
    console.error("Gagal fetch sample:", sampleRes.status);
    console.error(sampleRes.text.slice(0, 1000));
    process.exit(1);
  }

  let sampleJson;
  try {
    sampleJson = JSON.parse(sampleRes.text);
  } catch {
    console.error("Response bukan JSON. Cek file .tmp/odata-structure/sample-response.raw.txt");
    process.exit(1);
  }

  const rows = Array.isArray(sampleJson.value)
    ? sampleJson.value
    : Array.isArray(sampleJson)
      ? sampleJson
      : [sampleJson];

  fs.writeFileSync(
    path.join(outDir, "sample-top-3.json"),
    JSON.stringify(rows, null, 2)
  );

  const firstRow = rows[0] || {};
  const fields = Object.keys(firstRow).filter((key) => !key.startsWith("@odata."));

  const fieldLines = fields.map((field) => {
    const value = firstRow[field];
    const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const preview = value === null || value === undefined ? "" : String(value).slice(0, 150).replace(/\r?\n/g, " ");
    return `${field},${type},"${preview.replace(/"/g, '""')}"`;
  });

  fs.writeFileSync(
    path.join(outDir, "fields-from-sample.csv"),
    ["field,type,first_row_preview", ...fieldLines].join("\n") + "\n"
  );

  fs.writeFileSync(
    path.join(outDir, "fields-list.txt"),
    fields.join("\n") + "\n"
  );

  console.log(`Sample rows: ${rows.length}`);
  console.log(`Detected fields from first row: ${fields.length}`);
  console.log("");

  console.log("Fields:");
  for (const field of fields) {
    console.log("- " + field);
  }

  console.log("");
  console.log("2) Coba fetch $metadata...");
  const metadataCandidates = makeMetadataCandidates(ODATA_URL);

  let metadataSaved = false;

  for (const candidate of metadataCandidates) {
    const metadataHeaders = {
      Accept: "application/xml",
      Authorization: headers.Authorization
    };

    const res = await fetchText(candidate, metadataHeaders);
    fs.appendFileSync(
      path.join(outDir, "metadata-attempts.txt"),
      `URL: ${candidate}\nSTATUS: ${res.status}\nOK: ${res.ok}\n\n`
    );

    if (res.ok && res.text.includes("edmx:Edmx")) {
      fs.writeFileSync(path.join(outDir, "metadata.xml"), res.text);
      fs.writeFileSync(path.join(outDir, "metadata-url.txt"), candidate + "\n");
      console.log("Metadata ditemukan:");
      console.log(candidate);
      metadataSaved = true;
      break;
    }
  }

  if (!metadataSaved) {
    console.log("Metadata belum ketemu otomatis. Tidak apa-apa, fields dari sample sudah tersimpan.");
  }

  console.log("");
  console.log("Output dibuat di:");
  console.log(outDir);
  console.log("");
  console.log("Upload ke ChatGPT file ini dulu:");
  console.log("- .tmp/odata-structure/fields-list.txt");
  console.log("- .tmp/odata-structure/fields-from-sample.csv");
  console.log("- .tmp/odata-structure/sample-top-3.json");
  console.log("- .tmp/odata-structure/metadata.xml kalau ada");
  console.log("");
  console.log("JANGAN upload .env atau credential.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
