import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBcLedgerEntry,
  determineBcLedgerIdentity,
  determineBcLedgerMapping
} from "./bc-ledger.js";

test("classifyBcLedgerEntry separates production output and future-use movement domains", () => {
  assert.equal(
    classifyBcLedgerEntry({
      entryType: "Output",
      normalizedOutputType: "OK",
      itemDescription: "BOTOL JADI 600 ML",
      uom: "PCS"
    }).bcDomain,
    "PRODUCTION_OUTPUT"
  );
  assert.equal(classifyBcLedgerEntry({ entryType: "Transfer" }).bcDomain, "TRANSFER_OR_INVENTORY");
  assert.equal(classifyBcLedgerEntry({ entryType: "Sale" }).bcDomain, "SALES");
  assert.equal(classifyBcLedgerEntry({ entryType: "Purchase" }).bcDomain, "PURCHASE_OR_RECEIVING");
  assert.equal(classifyBcLedgerEntry({ entryType: "Consumption" }).bcDomain, "CONSUMPTION_OR_MATERIAL_USAGE");
});

test("reject and scrap evidence is not classified as OK production output", () => {
  assert.equal(
    classifyBcLedgerEntry({
      entryType: "Output",
      normalizedOutputType: "OK",
      itemNo: "RJ-BTL-001",
      itemDescription: "Reject botol",
      rawPayload: { Location_Code: "REJECT" }
    }).bcDomain,
    "REJECT_ATTACHMENT"
  );
  assert.equal(
    classifyBcLedgerEntry({
      entryType: "Output",
      normalizedOutputType: "OK",
      itemDescription: "AVALAN GUMPALAN"
    }).bcDomain,
    "SCRAP_OR_WASTE"
  );
});

test("determineBcLedgerIdentity uses production line description before line no and machine fallback", () => {
  assert.deepEqual(
    determineBcLedgerIdentity({
      prodLineDescription: "LINE A",
      prodLineNo: "ROT-A",
      machineCenterNo: "MC-A"
    }),
    {
      sourceIdentityField: "prod_line_description",
      sourceIdentityValue: "LINE A"
    }
  );
});

test("machine_center_no identity is fallback review and not dashboard ready", () => {
  const classification = classifyBcLedgerEntry({
    entryType: "Output",
    normalizedOutputType: "OK",
    itemDescription: "JADI CUP"
  });
  const identity = determineBcLedgerIdentity({ machineCenterNo: "MC-01" });
  const mapping = determineBcLedgerMapping({
    ...classification,
    ...identity,
    resolvedEntityId: "entity-1"
  });

  assert.equal(mapping.mappingStatus, "MAPPED_FALLBACK_REVIEW");
  assert.equal(mapping.dashboardReady, false);
  assert.equal(mapping.entityId, "entity-1");
});

test("exact production line identity match maps to dashboard-ready production output", () => {
  const classification = classifyBcLedgerEntry({
    entryType: "Output",
    normalizedOutputType: "OK",
    itemDescription: "JADI PREFORM"
  });
  const identity = determineBcLedgerIdentity({ prodLineDescription: "PREFORM A" });
  const mapping = determineBcLedgerMapping({
    ...classification,
    ...identity,
    resolvedEntityId: "entity-1"
  });

  assert.equal(mapping.mappingStatus, "MAPPED_READY");
  assert.equal(mapping.dashboardReady, true);
  assert.equal(mapping.entityId, "entity-1");
});

test("unmapped production output and future-use rows receive safe statuses", () => {
  const production = classifyBcLedgerEntry({
    entryType: "Output",
    normalizedOutputType: "OK",
    itemDescription: "JADI BOTOL"
  });
  assert.equal(
    determineBcLedgerMapping({
      ...production,
      ...determineBcLedgerIdentity({ prodLineDescription: "UNKNOWN LINE" }),
      resolvedEntityId: null
    }).mappingStatus,
    "UNMAPPED_NEEDS_REVIEW"
  );

  const transfer = classifyBcLedgerEntry({ entryType: "Transfer" });
  const transferMapping = determineBcLedgerMapping({
    ...transfer,
    ...determineBcLedgerIdentity({ prodLineDescription: "LINE A" }),
    resolvedEntityId: "entity-1"
  });
  assert.equal(transferMapping.mappingStatus, "FUTURE_USE_ONLY");
  assert.equal(transferMapping.dashboardReady, false);
});

test("blank source evidence becomes source data gap", () => {
  const classification = classifyBcLedgerEntry({});
  const mapping = determineBcLedgerMapping({
    ...classification,
    ...determineBcLedgerIdentity({})
  });

  assert.equal(classification.bcDomain, "SOURCE_DATA_GAP");
  assert.equal(mapping.mappingStatus, "UNMAPPED_SOURCE_GAP");
  assert.equal(mapping.dashboardReady, false);
});
