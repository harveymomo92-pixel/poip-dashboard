import type { ODataBackfillOptions, ODataClient, ODataFetchRequest, ODataFetchStats } from "./types.js";
import { optionalEnv, requireEnv } from "../../common/env.js";

export type ODataAuthConfig =
  | { readonly mode: "none" }
  | { readonly mode: "bearer"; readonly token: string }
  | { readonly mode: "basic"; readonly username: string; readonly password: string };

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

const emptyFetchStats: ODataFetchStats = {
  pagesAttempted: 0,
  pagesFetched: 0,
  rowsFetched: 0,
  nextLinkUsed: false,
  keysetPaginationUsed: false,
  truncatedByMaxPages: false
};

function parsePositiveInteger(value: string | undefined | null, name: string): number | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function safeHeaderValue(value: string | null): string {
  if (!value) return "unknown";
  return value.replace(/[^\w!#$%&'*+.^`|~-]+/g, " ").slice(0, 80);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }
  return value;
}

function validateDateField(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("BACKFILL_DATE_FIELD must be a simple OData field name");
  }
  return value;
}

function validateODataFieldName(value: string, name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${name} must be a simple OData field name`);
  }
  return value;
}

function validateEntryNo(value: bigint): bigint {
  if (value < 0n) throw new Error("BACKFILL_AFTER_ENTRY_NO must be a positive integer");
  return value;
}

function stripSecretUrlParts(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return value.split("?")[0] ?? value;
  }
}

function ensureSafeEndpointUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      throw new Error("OData URL must not contain embedded credentials");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message === "OData URL must not contain embedded credentials") {
      throw error;
    }
    throw new Error("OData URL is invalid");
  }
}

function resolveEndpointUrl(fullUrl: string | null, baseUrl: string | null, endpoint: string | null): string {
  if (fullUrl) return ensureSafeEndpointUrl(fullUrl);
  if (!baseUrl || !endpoint) {
    throw new Error(
      "Live OData sync requires BC_ODATA_URL or BC_ODATA_BASE_URL with BC_ODATA_OUTPUT_ENDPOINT"
    );
  }
  try {
    return ensureSafeEndpointUrl(new URL(endpoint, baseUrl).toString());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OData URL")) throw error;
    throw new Error("OData URL is invalid");
  }
}

function authConfigFromEnv(): ODataAuthConfig {
  const configuredMode = optionalEnv("BC_ODATA_AUTH_MODE")?.toLowerCase();
  if (configuredMode === "basic") {
    return {
      mode: "basic",
      username: requireEnv("BC_ODATA_USERNAME"),
      password: requireEnv("BC_ODATA_PASSWORD")
    };
  }
  if (configuredMode === "bearer") {
    return { mode: "bearer", token: requireEnv("BC_ODATA_BEARER_TOKEN") };
  }
  if (configuredMode && configuredMode !== "none") {
    throw new Error("BC_ODATA_AUTH_MODE must be basic, bearer, or none");
  }

  const existingBearerToken = optionalEnv("BC_ODATA_BEARER_TOKEN");
  return existingBearerToken
    ? { mode: "bearer", token: existingBearerToken }
    : { mode: "none" };
}

export function createODataAuthorizationHeader(auth: ODataAuthConfig): string | null {
  if (auth.mode === "basic") {
    return `Basic ${Buffer.from(`${auth.username}:${auth.password}`, "utf8").toString("base64")}`;
  }
  if (auth.mode === "bearer") return `Bearer ${auth.token}`;
  return null;
}

export function buildBackfillFilter(backfill: ODataBackfillOptions): string {
  const dateField = validateDateField(backfill.dateField);
  const from = validateDate(backfill.from, "BACKFILL_FROM");
  const filters = [`${dateField} ge ${from}`];
  if (backfill.to) {
    const to = validateDate(backfill.to, "BACKFILL_TO");
    if (to <= from) throw new Error("BACKFILL_TO must be after BACKFILL_FROM");
    filters.push(`${dateField} lt ${to}`);
  }
  if (backfill.afterEntryNo !== undefined) {
    filters.push(`Entry_No gt ${validateEntryNo(backfill.afterEntryNo).toString()}`);
  }
  return filters.join(" and ");
}

function combineODataFilters(existingFilter: string | null, filters: readonly string[]): string | null {
  if (filters.length === 0) return existingFilter;
  const syncFilter = filters.join(" and ");
  return existingFilter ? `(${existingFilter}) and (${syncFilter})` : syncFilter;
}

export function buildODataRequestUrl(
  endpointUrl: string,
  request: ODataFetchRequest,
  pageSize = process.env.BC_ODATA_PAGE_SIZE ?? "1000"
): URL {
  const url = new URL(endpointUrl);
  if (!url.searchParams.has("$orderby")) {
    url.searchParams.set("$orderby", "Entry_No asc");
  }
  const effectivePageSize =
    request.backfill?.pageSize ??
    (request.mode === "incremental" ? (process.env.BC_ODATA_INCREMENTAL_PAGE_SIZE ?? pageSize) : pageSize);
  if (!url.searchParams.has("$top") || request.backfill?.forcePageSize) {
    url.searchParams.set("$top", effectivePageSize);
  }

  const filters: string[] = [];
  if (request.mode === "incremental" && request.lastEntryNo) {
    filters.push(`Entry_No gt ${request.lastEntryNo.toString()}`);
  }
  if (request.range) {
    filters.push(`Posting_Date ge ${request.range.from}`);
    filters.push(`Posting_Date le ${request.range.to}`);
  }
  if (request.backfill) {
    filters.push(buildBackfillFilter(request.backfill));
  }
  const combinedFilter = combineODataFilters(url.searchParams.get("$filter"), filters);
  if (combinedFilter) {
    const existingFilter = url.searchParams.get("$filter");
    url.searchParams.set("$filter", existingFilter === combinedFilter ? existingFilter : combinedFilter);
  }
  return url;
}

function appendSelectField(url: URL, fieldName: string): void {
  const currentSelect = url.searchParams.get("$select");
  if (!currentSelect || currentSelect.includes("*")) {
    url.searchParams.set("$select", fieldName);
    return;
  }
  const fields = currentSelect.split(",").map((field) => field.trim()).filter(Boolean);
  if (!fields.some((field) => field.toLowerCase() === fieldName.toLowerCase())) {
    url.searchParams.set("$select", [...fields, fieldName].join(","));
  }
}

export function buildLatestEntryNoRequestUrl(
  endpointUrl: string,
  request: {
    readonly sourceSystem: string;
    readonly range?: { readonly from: string; readonly to: string };
  },
  entryNoField = process.env.BC_ODATA_INCREMENTAL_FIELD ?? "Entry_No"
): URL {
  const fieldName = validateODataFieldName(entryNoField, "BC_ODATA_INCREMENTAL_FIELD");
  const url = buildODataRequestUrl(
    endpointUrl,
    {
      mode: "resync-range",
      sourceSystem: request.sourceSystem,
      lastEntryNo: null,
      ...(request.range ? { range: request.range } : {})
    },
    "1"
  );
  url.searchParams.set("$orderby", `${fieldName} desc`);
  url.searchParams.set("$top", "1");
  appendSelectField(url, fieldName);
  return url;
}

function nextLinkUrl(currentUrl: URL, nextLink: unknown): URL | null {
  if (typeof nextLink !== "string" || !nextLink.trim()) return null;
  try {
    const url = new URL(nextLink, currentUrl);
    if (url.username || url.password) {
      throw new Error("OData nextLink must not contain embedded credentials");
    }
    return url;
  } catch (error) {
    if (error instanceof Error && error.message === "OData nextLink must not contain embedded credentials") {
      throw error;
    }
    throw new Error("OData nextLink is invalid");
  }
}

function appendODataFilter(url: URL, filter: string): URL {
  const next = new URL(url.toString());
  const existingFilter = next.searchParams.get("$filter");
  next.searchParams.set("$filter", existingFilter ? `(${existingFilter}) and (${filter})` : filter);
  return next;
}

function pageSizeFromUrl(url: URL): number | null {
  return parsePositiveInteger(url.searchParams.get("$top"), "$top") ?? null;
}

function canUseEntryNoKeyset(url: URL): boolean {
  const orderBy = url.searchParams.get("$orderby");
  return !orderBy || /\bEntry_No\b/i.test(orderBy);
}

function readEntryNo(row: unknown): bigint | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const rawValue = record.Entry_No ?? record.EntryNo ?? record.entryNo;
  if (typeof rawValue === "bigint") return rawValue;
  if (typeof rawValue === "number" && Number.isSafeInteger(rawValue)) return BigInt(rawValue);
  if (typeof rawValue === "string" && /^-?\d+$/.test(rawValue.trim())) return BigInt(rawValue.trim());
  return null;
}

function readBigintField(row: unknown, fieldName: string): bigint | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const rawValue = record[fieldName] ?? record.Entry_No ?? record.EntryNo ?? record.entryNo;
  if (typeof rawValue === "bigint") return rawValue;
  if (typeof rawValue === "number" && Number.isSafeInteger(rawValue)) return BigInt(rawValue);
  if (typeof rawValue === "string" && /^-?\d+$/.test(rawValue.trim())) return BigInt(rawValue.trim());
  return null;
}

function maxEntryNo(rows: readonly Record<string, unknown>[]): bigint | null {
  let maxValue: bigint | null = null;
  for (const row of rows) {
    const entryNo = readEntryNo(row);
    if (entryNo !== null && (maxValue === null || entryNo > maxValue)) {
      maxValue = entryNo;
    }
  }
  return maxValue;
}

export class MockBusinessCentralODataClient implements ODataClient {
  fetchProductionOutputs(request: ODataFetchRequest) {
    const baseEntry = request.lastEntryNo ? Number(request.lastEntryNo) + 1 : 1001;
    const rows = [
      {
        Entry_No: baseEntry,
        Posting_Date: request.range?.from ?? "2026-06-22",
        Document_Date: request.range?.from ?? "2026-06-22",
        Document_No: `MOCK-${baseEntry}`,
        Entry_Type: "Output",
        Item_No: "FG-MOCK-001",
        Description: "Mock finished good",
        Machine_Center_No: "MC-MOCK-01",
        Prod_Order_Line_No: "10",
        Prod_Line_Description: "Mock line",
        Quantity: "120",
        Unit_of_Measure_Code: "PCS",
        Gross_Weight: "0.25",
        Reject_KG: "0",
        Shift: "A",
        Operator: "Local Mock"
      },
      {
        Entry_No: baseEntry + 1,
        Posting_Date: request.range?.to ?? "2026-06-22",
        Document_No: `MOCK-${baseEntry + 1}`,
        Entry_Type: "Reject",
        Item_No: "FG-MOCK-001",
        Machine_Center_No: "MC-MOCK-01",
        Quantity: "0",
        Unit_of_Measure_Code: "PCS",
        Reject_KG: "2"
      }
    ];
    return Promise.resolve(rows);
  }

  sourceUrl() {
    return "mock://business-central/production-output";
  }

  fetchLatestEntryNo() {
    return Promise.resolve(1002n);
  }
}

export class BusinessCentralODataClient implements ODataClient {
  private fetchStats: ODataFetchStats = emptyFetchStats;

  constructor(
    private readonly endpointUrl: string,
    private readonly auth: ODataAuthConfig,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  private async fetchJson(url: URL) {
    const authorization = createODataAuthorizationHeader(this.auth);
    const timeoutMs = parsePositiveInteger(
      process.env.BC_ODATA_REQUEST_TIMEOUT_MS ?? process.env.BC_ODATA_TIMEOUT_MS ?? "30000",
      "BC_ODATA_REQUEST_TIMEOUT_MS"
    );
    const retryAttempts =
      parsePositiveInteger(process.env.BC_ODATA_RETRY_ATTEMPTS ?? "2", "BC_ODATA_RETRY_ATTEMPTS") ?? 2;
    const retryDelayMs =
      parsePositiveInteger(process.env.BC_ODATA_RETRY_DELAY_MS ?? "250", "BC_ODATA_RETRY_DELAY_MS") ?? 250;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        const response = await this.fetchImplementation(url, {
          headers: {
            Accept: "application/json",
            ...(authorization ? { Authorization: authorization } : {})
          },
          signal: AbortSignal.timeout(timeoutMs ?? 30_000)
        });
        if (!response.ok) {
          throw new Error(`OData request failed with status ${response.status}`);
        }
        try {
          return (await response.json()) as {
            value?: unknown;
            "@odata.nextLink"?: unknown;
            "odata.nextLink"?: unknown;
          };
        } catch {
          throw new Error(
            `OData response is not valid JSON (content-type: ${safeHeaderValue(response.headers.get("content-type"))})`
          );
        }
      } catch (error) {
        const safeError =
          error instanceof Error && error.message.startsWith("OData ")
            ? error
            : new Error("OData request failed before receiving a response");
        if (attempt >= retryAttempts) throw safeError;
        await sleep(retryDelayMs * attempt);
      }
    }
    return {};
  }

  async fetchLatestEntryNo(request: { readonly sourceSystem: string; readonly range?: { readonly from: string; readonly to: string } }) {
    const fieldName = validateODataFieldName(
      process.env.BC_ODATA_INCREMENTAL_FIELD ?? "Entry_No",
      "BC_ODATA_INCREMENTAL_FIELD"
    );
    const url = buildLatestEntryNoRequestUrl(this.endpointUrl, request, fieldName);
    const payload = await this.fetchJson(url);
    if (!Array.isArray(payload.value) || !payload.value[0]) return null;
    return readBigintField(payload.value[0], fieldName);
  }

  async fetchProductionOutputs(request: ODataFetchRequest) {
    let url = buildODataRequestUrl(this.endpointUrl, request);
    this.fetchStats = { ...emptyFetchStats };
    const maxPages =
      request.backfill?.maxPages ?? parsePositiveInteger(process.env.BC_ODATA_MAX_PAGES, "BC_ODATA_MAX_PAGES");
    const rows: Record<string, unknown>[] = [];
    let pagesAttempted = 0;
    let pagesFetched = 0;
    let nextLinkUsed = false;
    let keysetPaginationUsed = false;
    let truncatedByMaxPages = false;
    let lastKeysetEntryNo: bigint | null = null;
    const firstPageUrl = new URL(url.toString());
    const updateStats = () => {
      this.fetchStats = {
        pagesAttempted,
        pagesFetched,
        rowsFetched: rows.length,
        nextLinkUsed,
        keysetPaginationUsed,
        truncatedByMaxPages
      };
    };

    while (true) {
      if (lastKeysetEntryNo !== null) {
        url = appendODataFilter(firstPageUrl, `Entry_No gt ${lastKeysetEntryNo.toString()}`);
      }
      pagesAttempted += 1;
      updateStats();
      let payload: { value?: unknown; "@odata.nextLink"?: unknown; "odata.nextLink"?: unknown };
      payload = await this.fetchJson(url);
      payload ??= {};
      if (!Array.isArray(payload.value)) {
        throw new Error("OData response missing value array");
      }
      const pageRows = payload.value.filter((row): row is Record<string, unknown> =>
        Boolean(row && typeof row === "object")
      );
      rows.push(...pageRows);
      pagesFetched += 1;
      updateStats();

      const nextUrl = nextLinkUrl(url, payload["@odata.nextLink"] ?? payload["odata.nextLink"]);
      if (nextUrl) {
        if (maxPages && pagesFetched >= maxPages) {
          truncatedByMaxPages = true;
          updateStats();
          break;
        }
        nextLinkUsed = true;
        updateStats();
        url = nextUrl;
        continue;
      }

      const pageSize = pageSizeFromUrl(url);
      const entryNo = maxEntryNo(pageRows);
      if (
        !pageSize ||
        pageRows.length < pageSize ||
        !canUseEntryNoKeyset(firstPageUrl) ||
        entryNo === null ||
        (lastKeysetEntryNo !== null && entryNo <= lastKeysetEntryNo)
      ) {
        break;
      }
      if (maxPages && pagesFetched >= maxPages) {
        truncatedByMaxPages = true;
        updateStats();
        break;
      }
      lastKeysetEntryNo = entryNo;
      keysetPaginationUsed = true;
      updateStats();
    }
    updateStats();
    return rows;
  }

  lastFetchStats(): ODataFetchStats {
    return this.fetchStats;
  }

  sourceUrl() {
    return stripSecretUrlParts(this.endpointUrl);
  }
}

export function createODataClientFromEnv(): ODataClient {
  const mode = process.env.ODATA_SYNC_MODE ?? "mock";
  if (mode === "mock") return new MockBusinessCentralODataClient();

  const fullUrl = optionalEnv("BC_ODATA_URL");
  const baseUrl = optionalEnv("BC_ODATA_BASE_URL");
  const endpoint = optionalEnv("BC_ODATA_OUTPUT_ENDPOINT");
  const endpointUrl = resolveEndpointUrl(fullUrl, baseUrl, endpoint);

  return new BusinessCentralODataClient(endpointUrl, authConfigFromEnv());
}
