import fs from 'node:fs';
import path from 'node:path';

const inDir = '.tmp/bc-resolution-package';
const outDir = '.tmp/bc-scoped-blocker-package';

fs.mkdirSync(outDir, { recursive: true });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && quote && n === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quote = !quote;
    } else if (c === ',' && !quote) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell);
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((v) => v !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = r[i] ?? '';
    });
    return obj;
  });
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function writeCsv(file, rows, cols) {
  const lines = [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(',')),
  ];
  fs.writeFileSync(path.join(outDir, file), lines.join('\n') + '\n');
}

function readCsvIfExists(file) {
  const p = path.join(inDir, file);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

function readJsonIfExists(file) {
  const p = file.startsWith('.tmp/') ? file : path.join(inDir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function num(v) {
  const n = Number(String(v ?? '').replaceAll(',', ''));
  return Number.isFinite(n) ? n : 0;
}

function isTrue(v) {
  return String(v ?? '').toLowerCase() === 'true';
}

function inferAfterScope(row) {
  if ('blocks_p10_after_scope' in row) return isTrue(row.blocks_p10_after_scope);
  if ('blocks_p10' in row) return isTrue(row.blocks_p10);
  return false;
}

function normRow(row, sourceFile) {
  const after = inferAfterScope(row);
  const before = 'blocks_p10' in row ? isTrue(row.blocks_p10) : after;
  return {
    priority: row.priority || '',
    blocker_id: row.blocker_id || '',
    blocker_type: row.blocker_type || row.review_group_type || '',
    bc_current_kpi_scope: row.bc_current_kpi_scope || '',
    bc_future_use_domain: row.bc_future_use_domain || '',
    bc_scope_reason: row.bc_scope_reason || '',
    bc_entity_source_status: row.bc_entity_source_status || '',
    source_value: row.source_value || '',
    canonical_entity_code: row.canonical_entity_code || row.proposed_canonical_entity_code || '',
    current_entity_codes: row.current_entity_codes || '',
    target_bucket: row.target_bucket || '',
    machine_center_no: row.machine_center_no || '',
    rows: row.rows || '0',
    risk_level: row.risk_level || '',
    decision_needed: row.decision_needed || '',
    recommended_action: row.recommended_action || '',
    blocks_p10_before_scope: String(before),
    blocks_p10_after_scope: String(after),
    sample_documents: row.sample_documents || '',
    sample_items: row.sample_items || '',
    approval_status: row.approval_status || 'pending',
    reviewer: row.reviewer || '',
    reviewer_notes: row.reviewer_notes || '',
    source_file: sourceFile,
  };
}

const manual = readCsvIfExists('manual-approval-queue.csv').map((r) => normRow(r, 'manual-approval-queue.csv'));
const blocked = readCsvIfExists('blocked-groups-checklist.csv').map((r) => normRow(r, 'blocked-groups-checklist.csv'));
const aliasPlan = readCsvIfExists('alias-cleanup-review-plan.csv').map((r) => normRow(r, 'alias-cleanup-review-plan.csv'));
const canonicalPlan = readCsvIfExists('canonical-entity-creation-plan.csv').map((r) => normRow(r, 'canonical-entity-creation-plan.csv'));
const targetPlan = readCsvIfExists('target-profile-seed-draft-plan.csv').map((r) => normRow(r, 'target-profile-seed-draft-plan.csv'));

const all = [...manual, ...blocked, ...aliasPlan, ...canonicalPlan, ...targetPlan];

const byKey = new Map();
for (const r of all) {
  const key = [
    r.blocker_type,
    r.bc_current_kpi_scope,
    r.bc_future_use_domain,
    r.source_value,
    r.canonical_entity_code,
    r.current_entity_codes,
    r.target_bucket,
    r.machine_center_no,
  ].join('||');

  const existing = byKey.get(key);
  if (!existing || num(r.rows) > num(existing.rows)) byKey.set(key, r);
}

const rows = [...byKey.values()].sort((a, b) => num(b.rows) - num(a.rows));
const trueBlockers = rows.filter((r) => r.blocks_p10_after_scope === 'true');

const unknownScope = trueBlockers.filter((r) => r.bc_current_kpi_scope === 'UNKNOWN_SCOPE_REVIEW' || r.bc_future_use_domain === 'UNKNOWN_REVIEW');
const okOutput = trueBlockers.filter((r) => r.bc_current_kpi_scope === 'OUTPUT_KPI_OK_SCOPE');
const rejectScope = trueBlockers.filter((r) => r.bc_current_kpi_scope === 'OUTPUT_KPI_REJECT_SCOPE' || r.bc_future_use_domain === 'REJECT_ATTACHMENT');
const targetProfile = trueBlockers.filter((r) => /TARGET_PROFILE/i.test(r.blocker_type));

const aliasCleanup = trueBlockers.filter((r) => /ALIAS|ENTITY_HIGH_RISK/i.test(r.blocker_type) || /alias/i.test(r.decision_needed + r.recommended_action));
const canonicalEntity = trueBlockers.filter((r) => r.canonical_entity_code && /ENTITY/i.test(r.blocker_type));
const targetDecision = targetProfile;

const cols = [
  'priority',
  'blocker_id',
  'blocker_type',
  'bc_current_kpi_scope',
  'bc_future_use_domain',
  'bc_scope_reason',
  'bc_entity_source_status',
  'source_value',
  'canonical_entity_code',
  'current_entity_codes',
  'target_bucket',
  'machine_center_no',
  'rows',
  'risk_level',
  'decision_needed',
  'recommended_action',
  'blocks_p10_before_scope',
  'blocks_p10_after_scope',
  'sample_documents',
  'sample_items',
  'approval_status',
  'reviewer',
  'reviewer_notes',
  'source_file',
];

writeCsv('true-p10-blockers.csv', trueBlockers, cols);
writeCsv('unknown-scope-blockers.csv', unknownScope, cols);
writeCsv('ok-output-entity-blockers.csv', okOutput, cols);
writeCsv('reject-scope-blockers.csv', rejectScope, cols);
writeCsv('target-profile-blockers.csv', targetProfile, cols);
writeCsv('alias-cleanup-decision-template.csv', aliasCleanup, cols);
writeCsv('canonical-entity-decision-template.csv', canonicalEntity, cols);
writeCsv('target-profile-decision-template.csv', targetDecision, cols);

const sumRows = (xs) => xs.reduce((s, r) => s + num(r.rows), 0);

const summary = {
  generatedAt: new Date().toISOString(),
  sourceFolder: inDir,
  outputFolder: outDir,
  counts: {
    totalCandidateGroups: rows.length,
    trueP10BlockerGroups: trueBlockers.length,
    p10BlockingRowsAfterScope: sumRows(trueBlockers),
    unknownScopeBlockerRows: sumRows(unknownScope),
    okOutputEntityBlockerRows: sumRows(okOutput),
    rejectScopeBlockerRows: sumRows(rejectScope),
    targetProfileBlockerRows: sumRows(targetProfile),
    aliasCleanupNeededRows: sumRows(aliasCleanup),
    canonicalEntityNeededRows: sumRows(canonicalEntity),
    targetProfileNeededRows: sumRows(targetDecision),
    excludedFromP10ButRetainedRows: sumRows(rows.filter((r) => r.blocks_p10_after_scope !== 'true')),
  },
  topTrueP10Blockers: trueBlockers.slice(0, 15),
  topUnknownScopeBlockers: unknownScope.slice(0, 10),
  topOkOutputEntityBlockers: okOutput.slice(0, 10),
  topRejectScopeBlockers: rejectScope.slice(0, 10),
  topTargetProfileBlockers: targetProfile.slice(0, 10),
  p10Gate: {
    status: trueBlockers.length > 0 ? 'BLOCKED' : 'PASS_WITH_WARNINGS',
    reason: trueBlockers.length > 0
      ? `P1.0 remains blocked by ${sumRows(trueBlockers)} scoped blocker rows across ${trueBlockers.length} groups.`
      : 'No scoped blocker rows found in generated package.',
  },
  safety: {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
  },
};

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

fs.writeFileSync(path.join(outDir, 'README.md'), `# BC Scoped Blocker Package

Generated at: ${summary.generatedAt}

This package is reporting/export only.

## Files

- summary.json
- true-p10-blockers.csv
- unknown-scope-blockers.csv
- ok-output-entity-blockers.csv
- reject-scope-blockers.csv
- target-profile-blockers.csv
- alias-cleanup-decision-template.csv
- canonical-entity-decision-template.csv
- target-profile-decision-template.csv

## Gate

${summary.p10Gate.status}: ${summary.p10Gate.reason}

## Safety

No DB rows, aliases, target profiles, conditional rules, production output entity links, or dashboard behavior were changed.
`);

console.log('BC scoped blocker package written.');
console.log(`Output: ${outDir}`);
console.log(`P1.0 gate: ${summary.p10Gate.status}`);
console.log(summary.p10Gate.reason);
console.log(JSON.stringify(summary.counts, null, 2));
