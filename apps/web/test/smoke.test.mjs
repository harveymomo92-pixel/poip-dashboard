import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("web test placeholder", () => {
  assert.equal("PPIC".length, 4);
});

test("Milestone 10 pages are present", async () => {
  await Promise.all([
    access(new URL("../src/app/data-quality/page.tsx", import.meta.url)),
    access(new URL("../src/app/settings/audit/page.tsx", import.meta.url)),
    access(new URL("../src/app/settings/health/page.tsx", import.meta.url))
  ]);
});

test("Milestone 10 navigation entries are present", async () => {
  const shell = await readFile(new URL("../src/components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /Data Quality/);
  assert.match(shell, /Audit Viewer/);
  assert.match(shell, /System Health/);
});

test("overview resume renders reject attachment details under OK row", async () => {
  const overview = await readFile(new URL("../src/app/overview/DashboardPageClient.tsx", import.meta.url), "utf8");
  assert.match(overview, /rejectAttachmentStatus/);
  assert.match(overview, /Reject only/);
  assert.match(overview, /Ambiguous reject/);
  assert.match(overview, /rows=\{row\.rejectDetails\}/);
  assert.match(overview, /<RejectDetail row=\{row\} \/>/);
  assert.doesNotMatch(overview, /\$<RejectDetail/);
});
