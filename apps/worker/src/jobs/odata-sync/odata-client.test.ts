import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackfillFilter,
  buildODataRequestUrl,
  BusinessCentralODataClient,
  createODataAuthorizationHeader
} from "./odata-client.js";

const incrementalRequest = {
  mode: "incremental" as const,
  sourceSystem: "business-central",
  lastEntryNo: 42n
};

function requireCaptured<T>(value: T | null): NonNullable<T> {
  assert.notEqual(value, null);
  return value as NonNullable<T>;
}

test("createODataAuthorizationHeader creates UTF-8 Basic Auth credentials", () => {
  assert.equal(
    createODataAuthorizationHeader({
      mode: "basic",
      username: "odata-user",
      password: "unit-test-password"
    }),
    `Basic ${Buffer.from("odata-user:unit-test-password", "utf8").toString("base64")}`
  );
});

test("BusinessCentralODataClient preserves complex endpoint paths and builds safe OData request config", async () => {
  const captured: { url?: URL; headers?: Headers } = {};
  const endpoint =
    "http://100.64.0.10:7048/BC/ODataV4/Company('TAILSCALE%20TEST')/Production_Output" +
    "?tenant=default&$select=Entry_No%2CItem_No&$filter=Machine_Center_No%20eq%20'MC-01'";
  const client = new BusinessCentralODataClient(
    endpoint,
    { mode: "basic", username: "odata-user", password: "unit-test-password" },
    async (input, init) => {
      captured.url = new URL(input instanceof Request ? input.url : input.toString());
      captured.headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ value: [{ Entry_No: 43 }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );

  const rows = await client.fetchProductionOutputs(incrementalRequest);

  assert.equal(rows.length, 1);
  const requestUrl = requireCaptured(captured.url ?? null);
  const requestHeaders = requireCaptured(captured.headers ?? null);
  assert.match(requestUrl.pathname, /Company\('TAILSCALE%20TEST'\)/);
  assert.equal(requestUrl.searchParams.get("tenant"), "default");
  assert.equal(requestUrl.searchParams.get("$select"), "Entry_No,Item_No");
  assert.equal(requestUrl.searchParams.get("$orderby"), "Entry_No asc");
  assert.equal(requestUrl.searchParams.get("$top"), "1000");
  assert.equal(
    requestUrl.searchParams.get("$filter"),
    "(Machine_Center_No eq 'MC-01') and (Entry_No gt 42)"
  );
  assert.equal(requestHeaders.get("accept"), "application/json");
  assert.equal(
    requestHeaders.get("authorization"),
    `Basic ${Buffer.from("odata-user:unit-test-password", "utf8").toString("base64")}`
  );
});

test("buildODataRequestUrl preserves percent encoding and existing query parameters", () => {
  const url = buildODataRequestUrl(
    "http://tailscale-host:7048/ODataV4/Company('A%2FB')/Output?custom=a%2Fb",
    {
      mode: "resync-range",
      sourceSystem: "business-central",
      lastEntryNo: null,
      range: { from: "2026-06-01", to: "2026-06-24" }
    },
    "25"
  );

  assert.match(url.pathname, /Company\('A%2FB'\)/);
  assert.equal(url.searchParams.get("custom"), "a/b");
  assert.equal(url.searchParams.get("$top"), "25");
  assert.equal(
    url.searchParams.get("$filter"),
    "Posting_Date ge 2026-06-01 and Posting_Date le 2026-06-24"
  );
});

test("buildBackfillFilter supports BACKFILL_FROM only", () => {
  assert.equal(
    buildBackfillFilter({ from: "2026-01-01", dateField: "Posting_Date" }),
    "Posting_Date ge 2026-01-01"
  );
});

test("buildBackfillFilter supports BACKFILL_FROM and BACKFILL_TO", () => {
  assert.equal(
    buildBackfillFilter({
      from: "2026-01-01",
      to: "2026-02-01",
      dateField: "Posting_Date"
    }),
    "Posting_Date ge 2026-01-01 and Posting_Date lt 2026-02-01"
  );
});

test("buildODataRequestUrl combines an existing filter with a backfill filter", () => {
  const url = buildODataRequestUrl(
    "http://tailscale-host:7048/ODataV4/Company('A')/Output?$filter=Entry_Type%20eq%20'Output'&$select=Entry_No,Posting_Date&$top=500&$orderby=Posting_Date%20asc",
    {
      mode: "backfill",
      sourceSystem: "business-central",
      lastEntryNo: null,
      backfill: {
        from: "2026-01-01",
        to: "2026-02-01",
        dateField: "Posting_Date",
        pageSize: "25"
      }
    }
  );

  assert.equal(url.searchParams.get("$select"), "Entry_No,Posting_Date");
  assert.equal(url.searchParams.get("$top"), "500");
  assert.equal(url.searchParams.get("$orderby"), "Posting_Date asc");
  assert.equal(
    url.searchParams.get("$filter"),
    "(Entry_Type eq 'Output') and (Posting_Date ge 2026-01-01 and Posting_Date lt 2026-02-01)"
  );
});

test("BusinessCentralODataClient follows OData nextLink pagination", async () => {
  const requestedUrls: string[] = [];
  const client = new BusinessCentralODataClient(
    "https://businesscentral.example.test/odata/output",
    { mode: "none" },
    async (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      requestedUrls.push(url);
      if (requestedUrls.length === 1) {
        return new Response(
          JSON.stringify({
            value: [{ Entry_No: 1 }],
            "@odata.nextLink": "https://businesscentral.example.test/odata/output?$skiptoken=abc"
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ value: [{ Entry_No: 2 }] }), { status: 200 });
    }
  );

  const rows = await client.fetchProductionOutputs({
    mode: "backfill",
    sourceSystem: "business-central",
    lastEntryNo: null,
    backfill: { from: "2026-01-01", dateField: "Posting_Date" }
  });

  assert.equal(rows.length, 2);
  assert.equal(requestedUrls.length, 2);
  assert.equal(new URL(requireCaptured(requestedUrls[1] ?? null)).searchParams.get("$skiptoken"), "abc");
  assert.deepEqual(client.lastFetchStats(), {
    pagesFetched: 2,
    rowsFetched: 2,
    nextLinkUsed: true,
    keysetPaginationUsed: false,
    truncatedByMaxPages: false
  });
});

test("BusinessCentralODataClient uses Entry_No keyset pagination when nextLink is absent", async () => {
  const requestedFilters: Array<string | null> = [];
  const client = new BusinessCentralODataClient(
    "https://businesscentral.example.test/odata/output",
    { mode: "none" },
    async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requestedFilters.push(url.searchParams.get("$filter"));
      if (requestedFilters.length === 1) {
        return new Response(JSON.stringify({ value: [{ Entry_No: 10 }, { Entry_No: 11 }] }), {
          status: 200
        });
      }
      return new Response(JSON.stringify({ value: [{ Entry_No: 12 }] }), { status: 200 });
    }
  );

  const rows = await client.fetchProductionOutputs({
    mode: "backfill",
    sourceSystem: "business-central",
    lastEntryNo: null,
    backfill: {
      from: "2026-01-01",
      dateField: "Posting_Date",
      pageSize: "2"
    }
  });

  assert.equal(rows.length, 3);
  assert.equal(requestedFilters.length, 2);
  assert.equal(requestedFilters[0], "Posting_Date ge 2026-01-01");
  assert.equal(requestedFilters[1], "(Posting_Date ge 2026-01-01) and (Entry_No gt 11)");
  assert.deepEqual(client.lastFetchStats(), {
    pagesFetched: 2,
    rowsFetched: 3,
    nextLinkUsed: false,
    keysetPaginationUsed: true,
    truncatedByMaxPages: false
  });
});

test("BusinessCentralODataClient preserves bearer auth behavior", async () => {
  let authorization: string | null = null;
  const client = new BusinessCentralODataClient(
    "https://businesscentral.example.test/odata/output",
    { mode: "bearer", token: "unit-test-bearer-token" },
    async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    }
  );

  await client.fetchProductionOutputs(incrementalRequest);
  assert.equal(authorization, "Bearer unit-test-bearer-token");
});

test("OData network errors and source URLs do not leak credentials or query values", async () => {
  const username = "private-user";
  const password = "private-password";
  const client = new BusinessCentralODataClient(
    "http://tailscale-host:7048/ODataV4/Company('PRIVATE')/Output?access_token=query-secret",
    { mode: "basic", username, password },
    async () => {
      throw new Error(`connect failed for ${username}:${password}`);
    }
  );

  await assert.rejects(
    () => client.fetchProductionOutputs(incrementalRequest),
    (error: Error) => {
      assert.equal(error.message, "OData request failed before receiving a response");
      assert.doesNotMatch(error.message, /private-user|private-password/);
      return true;
    }
  );
  assert.doesNotMatch(client.sourceUrl(), /private-user|private-password|query-secret/);
});
