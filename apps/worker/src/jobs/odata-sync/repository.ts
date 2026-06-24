import { createDatabase, dataQualityIssues, masterEntities, masterEntityAliases, productionOutputStaging, productionOutputs, productionTargets, syncCheckpoints, syncRuns } from "@poip/db";
import { createDuplicateEntryIssue, nextSyncCheckpoint, type DataQualitySignal } from "@poip/domain";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDatabaseUrl } from "../../common/env.js";
import type {
  ODataSyncJobPayload,
  PreparedSyncRun,
  StagedOutputRow,
  SyncCheckpointSnapshot,
  SyncCommitInput,
  SyncCommitResult,
  SyncRunRepository
} from "./types.js";

interface EntityLookup {
  readonly entityByCode: ReadonlyMap<string, string>;
  readonly entityByAlias: ReadonlyMap<string, string>;
  readonly targetKeys: ReadonlySet<string>;
}

function normalizedLookupKey(value: string | null | undefined): string | null {
  const compact = value?.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (!compact) return null;
  return compact;
}

function legacyMachineFamilyKey(value: string | null | undefined): string | null {
  const compact = normalizedLookupKey(value);
  if (!compact) return null;
  if (compact.startsWith("LONGSUNG")) return "LONGSUN";
  if (compact.startsWith("BORCH")) return "BORCHE";
  if (compact.startsWith("HENGFENG") || /^HF\d*/.test(compact)) return "HENGFENG";
  if (compact.startsWith("TF") || compact.startsWith("ILLIG")) return "ILLIG";
  if (compact.startsWith("VFINE") || compact.startsWith("VF")) return "VFINE";
  if (compact.startsWith("CHUMPOWER") || /^CP\d*/.test(compact)) return "CHUMPOWER";
  if (compact.startsWith("POLY")) return "POLYPRINT";
  if (compact.startsWith("NEWDO")) return "NEWDO";
  if (compact.startsWith("OMSO")) return "OMSO";
  return compact;
}

function addEntityLookupKey(map: Map<string, string>, key: string | null | undefined, entityId: string): void {
  const exact = key?.trim().toUpperCase();
  if (exact && !map.has(exact)) map.set(exact, entityId);
  const normalized = normalizedLookupKey(key);
  if (normalized && !map.has(normalized)) map.set(normalized, entityId);
}

function addLegacyMachineFamilyLookupKey(
  map: Map<string, string>,
  key: string | null | undefined,
  entityId: string
): void {
  const family = legacyMachineFamilyKey(key);
  if (family && !map.has(family)) map.set(family, entityId);
}

function checkpointToJson(checkpoint: SyncCheckpointSnapshot) {
  return {
    lastEntryNo: checkpoint.lastEntryNo?.toString() ?? null,
    lastPostingDate: checkpoint.lastPostingDate
  };
}

function checkpointFromJson(value: unknown): SyncCheckpointSnapshot {
  if (!value || typeof value !== "object") return { lastEntryNo: null, lastPostingDate: null };
  const record = value as Record<string, unknown>;
  const rawEntryNo = record.lastEntryNo;
  const rawPostingDate = record.lastPostingDate;
  return {
    lastEntryNo:
      typeof rawEntryNo === "string" && /^-?\d+$/.test(rawEntryNo) ? BigInt(rawEntryNo) : null,
    lastPostingDate: typeof rawPostingDate === "string" ? rawPostingDate : null
  };
}

function syncRunMetadata(payload: ODataSyncJobPayload): Record<string, unknown> {
  return {
    ...(payload.range ? { range: payload.range } : {}),
    ...(payload.backfill
      ? {
          backfill: {
            from: payload.backfill.from,
            ...(payload.backfill.to ? { to: payload.backfill.to } : {}),
            dateField: payload.backfill.dateField,
            ...(payload.backfill.afterEntryNo !== undefined
              ? { afterEntryNo: payload.backfill.afterEntryNo.toString() }
              : {}),
            ...(payload.backfill.pageSize ? { pageSize: payload.backfill.pageSize } : {}),
            ...(payload.backfill.maxPages ? { maxPages: payload.backfill.maxPages } : {})
          }
        }
      : {})
  };
}

function sourceRef(row: StagedOutputRow): string {
  return row.normalized.entryNo?.toString() ?? row.normalized.fallbackNaturalKey;
}

function numeric(value: number | null): string | null {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : null;
}

function decimal(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}

function hasCriticalIssue(issues: readonly DataQualitySignal[]): boolean {
  return issues.some((issue) => issue.severity === "CRITICAL");
}

function serializeIssue(issue: DataQualitySignal) {
  return {
    code: issue.code,
    severity: issue.severity,
    description: issue.description
  };
}

function metadataSql(metadata: Record<string, unknown> | undefined) {
  return sql`${syncRuns.metadata} || ${JSON.stringify(metadata ?? {})}::jsonb`;
}

export class DrizzleSyncRunRepository implements SyncRunRepository {
  private readonly database = createDatabase({ connectionString: getDatabaseUrl() });

  async close() {
    await this.database.pool.end();
  }

  async getLatestLocalEntryNo(sourceSystem: string): Promise<bigint | null> {
    const [row] = await this.database.db
      .select({ latestEntryNo: sql<bigint | null>`max(${productionOutputs.entryNo})` })
      .from(productionOutputs)
      .where(eq(productionOutputs.sourceSystem, sourceSystem));
    return row?.latestEntryNo ?? null;
  }

  async prepareRun(payload: ODataSyncJobPayload, sourceUrl: string | null): Promise<PreparedSyncRun> {
    const checkpoint = await this.getCheckpoint(payload.sourceSystem);
    const checkpointJson = checkpointToJson(checkpoint);
    const metadata = syncRunMetadata(payload);

    if (payload.syncRunId) {
      const [existingRun] = await this.database.db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.id, payload.syncRunId))
        .limit(1);
      if (existingRun?.status === "SUCCESS") {
        return {
          id: existingRun.id,
          sourceSystem: existingRun.sourceSystem,
          mode: existingRun.mode as ODataSyncJobPayload["mode"],
          checkpointBefore: checkpointFromJson(existingRun.checkpointBefore),
          completedResult: {
            runId: existingRun.id,
            status: "SUCCESS",
            rowsFetched: existingRun.rowsFetched,
            rowsInserted: existingRun.rowsInserted,
            rowsUpdated: existingRun.rowsUpdated,
            rowsSkipped: existingRun.rowsSkipped,
            maxEntryNo: checkpointFromJson(existingRun.checkpointAfter).lastEntryNo?.toString() ?? null,
            checkpointAfter: checkpointToJson(checkpointFromJson(existingRun.checkpointAfter))
          }
        };
      }
      await this.database.db
        .update(syncRuns)
        .set({
          status: "RUNNING",
          sourceUrl,
          startedAt: sql`now()`,
          checkpointBefore: checkpointJson
        })
        .where(eq(syncRuns.id, payload.syncRunId));
      return {
        id: payload.syncRunId,
        sourceSystem: payload.sourceSystem,
        mode: payload.mode,
        checkpointBefore: checkpoint
      };
    }

    const [run] = await this.database.db
      .insert(syncRuns)
      .values({
        sourceSystem: payload.sourceSystem,
        sourceUrl,
        mode: payload.mode,
        status: "RUNNING",
        checkpointBefore: checkpointJson,
        triggeredBy: payload.requestedBy ?? null,
        metadata
      })
      .returning();
    if (!run) throw new Error("Unable to create sync run");
    return {
      id: run.id,
      sourceSystem: payload.sourceSystem,
      mode: payload.mode,
      checkpointBefore: checkpoint
    };
  }

  async commitSuccessfulRun(input: SyncCommitInput): Promise<SyncCommitResult> {
    return this.database.db.transaction(async (tx) => {
      const context = await this.loadEntityLookup(tx);
      const committedEntryNos = input.rows
        .map((row) => row.normalized.entryNo)
        .filter((entryNo): entryNo is bigint => entryNo !== null);
      const existingRows =
        committedEntryNos.length > 0
          ? await tx
              .select({ entryNo: productionOutputs.entryNo, rowHash: productionOutputs.rowHash })
              .from(productionOutputs)
              .where(
                and(
                  eq(productionOutputs.sourceSystem, input.run.sourceSystem),
                  inArray(productionOutputs.entryNo, committedEntryNos)
                )
              )
          : [];
      const existingHashByEntry = new Map(
        existingRows.flatMap((row) => (row.entryNo ? [[row.entryNo.toString(), row.rowHash] as const] : []))
      );
      const seenHashByEntry = new Map<string, string>();

      let rowsInserted = 0;
      let rowsUpdated = 0;
      let rowsSkipped = 0;
      let maxSeenEntryNo: bigint | null = null;
      let maxCommittedEntryNo: bigint | null = null;
      let maxCommittedPostingDate: string | null = null;
      const issueCandidates: {
        readonly row: StagedOutputRow;
        readonly entityId: string | null;
        readonly issues: readonly DataQualitySignal[];
      }[] = [];

      for (const row of input.rows) {
        const entityId = this.resolveEntityId(row, context);
        const issues = [...row.issues];
        if (row.normalized.entryNo !== null && (!maxSeenEntryNo || row.normalized.entryNo > maxSeenEntryNo)) {
          maxSeenEntryNo = row.normalized.entryNo;
        }
        const pendingEntryKey = row.normalized.entryNo?.toString() ?? null;
        if (pendingEntryKey) {
          const previousHash =
            existingHashByEntry.get(pendingEntryKey) ?? seenHashByEntry.get(pendingEntryKey);
          if (previousHash && previousHash !== row.rowHash) issues.push(createDuplicateEntryIssue());
          seenHashByEntry.set(pendingEntryKey, row.rowHash);
        }
        if (row.normalized.machineCenterNo && !entityId) {
          issues.push({
            code: "UNKNOWN_MACHINE",
            severity: "WARNING",
            description: `Machine ${row.normalized.machineCenterNo} is not mapped to a master entity`
          });
        }
        if (entityId && row.normalized.postingDate && !this.hasTarget(entityId, row.normalized.postingDate, context)) {
          issues.push({
            code: "MISSING_TARGET",
            severity: "WARNING",
            description: "No active production target exists for the entity and posting date"
          });
        }

        await tx.insert(productionOutputStaging).values({
          syncRunId: input.run.id,
          sourceSystem: input.run.sourceSystem,
          rawPayload: row.rawPayload,
          rowHash: row.rowHash,
          validationStatus: hasCriticalIssue(issues) ? "INVALID" : "VALID",
          validationErrors: issues.map(serializeIssue)
        });

        issueCandidates.push({ row, entityId, issues });
        if (hasCriticalIssue(issues) || !row.canCommit) {
          rowsSkipped += 1;
          continue;
        }
        if (!row.normalized.entryNo || !row.normalized.postingDate || !row.normalized.itemNo) {
          rowsSkipped += 1;
          continue;
        }

        const committedEntryKey = row.normalized.entryNo.toString();
        const existingHash = existingHashByEntry.get(committedEntryKey);
        if (existingHash === row.rowHash) {
          rowsSkipped += 1;
        } else {
          await tx
            .insert(productionOutputs)
            .values({
              sourceSystem: input.run.sourceSystem,
              entryNo: row.normalized.entryNo,
              postingDate: row.normalized.postingDate,
              documentDate: row.normalized.documentDate,
              documentNo: row.normalized.documentNo,
              externalDocumentNo: row.normalized.externalDocumentNo,
              entryType: row.normalized.entryType,
              normalizedOutputType: row.normalized.normalizedOutputType,
              itemNo: row.normalized.itemNo,
              itemDescription: row.normalized.itemDescription,
              itemCategoryCode: row.normalized.itemCategoryCode,
              machineCenterNo: row.normalized.machineCenterNo,
              entityId,
              prodLineNo: row.normalized.prodLineNo,
              prodLineDescription: row.normalized.prodLineDescription,
              shiftCode: row.normalized.shiftCode,
              operatorName: row.normalized.operatorName,
              quantity: decimal(row.normalized.quantity),
              uom: row.normalized.uom,
              grossWeightPerPcs: numeric(row.normalized.grossWeightPerPcs),
              rejectKg: decimal(row.normalized.rejectKg),
              rejectPcsEq: numeric(row.normalized.rejectPcsEq),
              rowHash: row.rowHash,
              rawPayload: row.rawPayload,
              syncRunId: input.run.id
            })
            .onConflictDoUpdate({
              target: [productionOutputs.sourceSystem, productionOutputs.entryNo],
              set: {
                postingDate: row.normalized.postingDate,
                documentDate: row.normalized.documentDate,
                documentNo: row.normalized.documentNo,
                externalDocumentNo: row.normalized.externalDocumentNo,
                entryType: row.normalized.entryType,
                normalizedOutputType: row.normalized.normalizedOutputType,
                itemNo: row.normalized.itemNo,
                itemDescription: row.normalized.itemDescription,
                itemCategoryCode: row.normalized.itemCategoryCode,
                machineCenterNo: row.normalized.machineCenterNo,
                entityId,
                prodLineNo: row.normalized.prodLineNo,
                prodLineDescription: row.normalized.prodLineDescription,
                shiftCode: row.normalized.shiftCode,
                operatorName: row.normalized.operatorName,
                quantity: decimal(row.normalized.quantity),
                uom: row.normalized.uom,
                grossWeightPerPcs: numeric(row.normalized.grossWeightPerPcs),
                rejectKg: decimal(row.normalized.rejectKg),
                rejectPcsEq: numeric(row.normalized.rejectPcsEq),
                rowHash: row.rowHash,
                rawPayload: row.rawPayload,
                syncRunId: input.run.id,
                updatedAt: sql`now()`
              }
            });
          if (existingHash) rowsUpdated += 1;
          else rowsInserted += 1;
        }

        if (!maxCommittedEntryNo || row.normalized.entryNo > maxCommittedEntryNo) {
          maxCommittedEntryNo = row.normalized.entryNo;
          maxCommittedPostingDate = row.normalized.postingDate;
        }
      }

      await this.insertMissingIssues(tx, input.run.sourceSystem, issueCandidates);
      const checkpointAfter = nextSyncCheckpoint({
        mode: input.run.mode,
        status: "SUCCESS",
        current: input.run.checkpointBefore,
        maxCommittedEntryNo,
        maxCommittedPostingDate
      });

      if (input.run.mode === "incremental" && maxCommittedEntryNo) {
        await tx
          .insert(syncCheckpoints)
          .values({
            sourceSystem: input.run.sourceSystem,
            lastEntryNo: checkpointAfter.lastEntryNo,
            lastPostingDate: checkpointAfter.lastPostingDate,
            lastSuccessfulSyncRunId: input.run.id
          })
          .onConflictDoUpdate({
            target: syncCheckpoints.sourceSystem,
            set: {
              lastEntryNo: checkpointAfter.lastEntryNo,
              lastPostingDate: checkpointAfter.lastPostingDate,
              lastSuccessfulSyncRunId: input.run.id,
              updatedAt: sql`now()`
            }
          });
      }

      await tx
        .update(syncRuns)
        .set({
          status: "SUCCESS",
          finishedAt: sql`now()`,
          sourceUrl: input.sourceUrl,
          checkpointAfter: checkpointToJson(checkpointAfter),
          rowsFetched: input.rows.length,
          rowsInserted,
          rowsUpdated,
          rowsSkipped,
          metadata: metadataSql(input.metadata)
        })
        .where(eq(syncRuns.id, input.run.id));

      return {
        runId: input.run.id,
        status: "SUCCESS",
        rowsFetched: input.rows.length,
        rowsInserted,
        rowsUpdated,
        rowsSkipped,
        maxEntryNo: maxSeenEntryNo?.toString() ?? null,
        checkpointAfter: checkpointToJson(checkpointAfter)
      };
    });
  }

  async markRunFailed(input: {
    readonly runId: string;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly metadata?: Record<string, unknown>;
  }) {
    await this.database.db
      .update(syncRuns)
      .set({
        status: "FAILED",
        finishedAt: sql`now()`,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: metadataSql(input.metadata)
      })
      .where(eq(syncRuns.id, input.runId));
  }

  private async getCheckpoint(sourceSystem: string): Promise<SyncCheckpointSnapshot> {
    const [checkpoint] = await this.database.db
      .select({
        lastEntryNo: syncCheckpoints.lastEntryNo,
        lastPostingDate: syncCheckpoints.lastPostingDate
      })
      .from(syncCheckpoints)
      .where(eq(syncCheckpoints.sourceSystem, sourceSystem))
      .limit(1);
    return {
      lastEntryNo: checkpoint?.lastEntryNo ?? null,
      lastPostingDate: checkpoint?.lastPostingDate ?? null
    };
  }

  private async loadEntityLookup(tx: Parameters<Parameters<typeof this.database.db.transaction>[0]>[0]): Promise<EntityLookup> {
    const entities = await tx
      .select({
        id: masterEntities.id,
        code: masterEntities.entityCode,
        displayName: masterEntities.displayName,
        lineCode: masterEntities.lineCode,
        reportGroup: masterEntities.reportGroup
      })
      .from(masterEntities)
      .where(eq(masterEntities.isActive, true));
    const aliases = await tx
      .select({ entityId: masterEntityAliases.entityId, alias: masterEntityAliases.alias })
      .from(masterEntityAliases)
      .where(eq(masterEntityAliases.isActive, true));
    const targets = await tx
      .select({
        entityId: productionTargets.entityId,
        effectiveFrom: productionTargets.effectiveFrom,
        effectiveTo: productionTargets.effectiveTo
      })
      .from(productionTargets)
      .where(or(eq(productionTargets.status, "APPROVED"), eq(productionTargets.status, "ACTIVE")));

    const entityByCode = new Map<string, string>();
    const entityByAlias = new Map<string, string>();
    for (const entity of entities) {
      addEntityLookupKey(entityByCode, entity.code, entity.id);
      addEntityLookupKey(entityByAlias, entity.displayName, entity.id);
      addEntityLookupKey(entityByAlias, entity.lineCode, entity.id);
      addEntityLookupKey(entityByAlias, entity.reportGroup, entity.id);
      addLegacyMachineFamilyLookupKey(entityByAlias, entity.code, entity.id);
      addLegacyMachineFamilyLookupKey(entityByAlias, entity.displayName, entity.id);
    }
    for (const alias of aliases) {
      addEntityLookupKey(entityByAlias, alias.alias, alias.entityId);
      addLegacyMachineFamilyLookupKey(entityByAlias, alias.alias, alias.entityId);
    }

    return {
      entityByCode,
      entityByAlias,
      targetKeys: new Set(
        targets.map((target) => `${target.entityId}|${target.effectiveFrom}|${target.effectiveTo ?? ""}`)
      )
    };
  }

  private resolveEntityId(row: StagedOutputRow, context: EntityLookup): string | null {
    const machine = row.normalized.machineCenterNo;
    if (!machine) return null;
    const exact = machine.trim().toUpperCase();
    const normalized = normalizedLookupKey(machine);
    const family = legacyMachineFamilyKey(machine);
    return (
      context.entityByCode.get(exact) ??
      (normalized ? context.entityByCode.get(normalized) : null) ??
      context.entityByAlias.get(exact) ??
      (normalized ? context.entityByAlias.get(normalized) : null) ??
      (family ? context.entityByAlias.get(family) : null) ??
      null
    );
  }

  private hasTarget(entityId: string, postingDate: string, context: EntityLookup): boolean {
    for (const key of context.targetKeys) {
      const [targetEntityId, effectiveFrom, effectiveTo] = key.split("|");
      if (targetEntityId !== entityId) continue;
      if (effectiveFrom && effectiveFrom > postingDate) continue;
      if (effectiveTo && effectiveTo < postingDate) continue;
      return true;
    }
    return false;
  }

  private async insertMissingIssues(
    tx: Parameters<Parameters<typeof this.database.db.transaction>[0]>[0],
    sourceSystem: string,
    candidates: readonly {
      readonly row: StagedOutputRow;
      readonly entityId: string | null;
      readonly issues: readonly DataQualitySignal[];
    }[]
  ): Promise<void> {
    for (const candidate of candidates) {
      const ref = sourceRef(candidate.row);
      for (const issue of candidate.issues) {
        const [existing] = await tx
          .select({ id: dataQualityIssues.id })
          .from(dataQualityIssues)
          .where(
            and(
              eq(dataQualityIssues.issueCode, issue.code),
              eq(dataQualityIssues.sourceSystem, sourceSystem),
              eq(dataQualityIssues.sourceRef, ref),
              eq(dataQualityIssues.status, "OPEN")
            )
          )
          .limit(1);
        if (existing) continue;

        await tx.insert(dataQualityIssues).values({
          issueCode: issue.code,
          severity: issue.severity,
          entityType: "production_output",
          entityId: candidate.entityId,
          sourceSystem,
          sourceRef: ref,
          description: issue.description,
          payload: {
            rawPayload: candidate.row.rawPayload,
            normalized: {
              entryNo: candidate.row.normalized.entryNo?.toString() ?? null,
              postingDate: candidate.row.normalized.postingDate,
              itemNo: candidate.row.normalized.itemNo,
              machineCenterNo: candidate.row.normalized.machineCenterNo
            }
          }
        });
      }
    }
  }
}
