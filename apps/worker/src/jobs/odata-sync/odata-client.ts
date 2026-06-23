import type { ODataClient, ODataFetchRequest } from "./types.js";
import { optionalEnv } from "../../common/env.js";

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
}

export class BusinessCentralODataClient implements ODataClient {
  constructor(
    private readonly baseUrl: string,
    private readonly outputEndpoint: string,
    private readonly bearerToken: string | null
  ) {}

  async fetchProductionOutputs(request: ODataFetchRequest) {
    const url = new URL(this.outputEndpoint, this.baseUrl);
    url.searchParams.set("$orderby", "Entry_No asc");
    url.searchParams.set("$top", process.env.BC_ODATA_PAGE_SIZE ?? "1000");

    const filters: string[] = [];
    if (request.mode === "incremental" && request.lastEntryNo) {
      filters.push(`Entry_No gt ${request.lastEntryNo.toString()}`);
    }
    if (request.range) {
      filters.push(`Posting_Date ge ${request.range.from}`);
      filters.push(`Posting_Date le ${request.range.to}`);
    }
    if (filters.length > 0) url.searchParams.set("$filter", filters.join(" and "));

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(this.bearerToken ? { authorization: `Bearer ${this.bearerToken}` } : {})
      }
    });
    if (!response.ok) {
      throw new Error(`OData request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { value?: unknown };
    if (!Array.isArray(payload.value)) {
      throw new Error("OData response missing value array");
    }
    return payload.value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  }

  sourceUrl() {
    return stripSecretUrlParts(new URL(this.outputEndpoint, this.baseUrl).toString());
  }
}

export function createODataClientFromEnv(): ODataClient {
  const mode = process.env.ODATA_SYNC_MODE ?? "mock";
  const baseUrl = optionalEnv("BC_ODATA_BASE_URL");
  const endpoint = optionalEnv("BC_ODATA_OUTPUT_ENDPOINT") ?? "";
  if (mode === "mock" || !baseUrl || !endpoint) return new MockBusinessCentralODataClient();

  return new BusinessCentralODataClient(baseUrl, endpoint, optionalEnv("BC_ODATA_BEARER_TOKEN"));
}
