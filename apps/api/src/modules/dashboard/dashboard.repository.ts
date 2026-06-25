import type { DashboardKpiSummary } from "@poip/domain";
import {
  PRODUCTION_ENTRY_TYPE,
  buildDashboardKpiSummary
} from "@poip/domain";
import type { DatabaseConnection } from "../database/database.module.js";
import {
  buildDailyItemResume,
  dailyItemResumeGroupKey,
  type DailyItemResumeSourceRow,
  type DailyItemResumeTarget
} from "./daily-item-resume.js";
import type {
  BreakdownRow,
  DailyItemResumeFilters,
  DashboardFilters,
  DashboardSummaryDto,
  DataQualitySummaryDto,
  DowntimeSummaryDto,
  OutputListFilters,
  OutputListResult,
  OutputRowDto,
  TrendRow
} from "./dashboard.types.js";

interface SqlParts {
  readonly where: string;
  readonly params: unknown[];
}

interface AggregateRow {
  readonly output_ok_qty: string | number | null;
  readonly reject_kg: string | number | null;
  readonly reject_pcs_equivalent: string | number | null;
  readonly incomplete_reject_conversion_count: string | number | null;
  readonly active_days: string | number | null;
  readonly row_count: string | number | null;
}

interface ActiveEntityDayRow {
  readonly entity_id: string;
  readonly posting_date: string;
}

interface TargetRow {
  readonly entity_id: string;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly daily_target_qty: string | number;
  readonly min_achievement_pct: string | number;
  readonly max_achievement_pct: string | number;
  readonly status?: string | null;
}

function numberValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function machineLabelSql(outputAlias = "po", entityAlias = "me"): string {
  return `coalesce(${entityAlias}.display_name, ${entityAlias}.entity_code, ${outputAlias}.machine_center_no, ${outputAlias}.prod_line_no, ${outputAlias}.prod_line_description, 'Unmapped')`;
}

function buildWhere(filters: DashboardFilters): SqlParts {
  const clauses = [
    "po.source_system = $1",
    "upper(coalesce(po.entry_type, '')) = $2",
    "po.posting_date >= $3",
    "po.posting_date <= $4"
  ];
  const params: unknown[] = [
    filters.sourceSystem,
    PRODUCTION_ENTRY_TYPE.toUpperCase(),
    filters.from,
    filters.to
  ];

  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`po.entity_id = $${params.length}`);
  }
  if (filters.machineCenterNo) {
    params.push(filters.machineCenterNo);
    clauses.push(`po.machine_center_no = $${params.length}`);
  }
  if (filters.itemNo) {
    params.push(filters.itemNo);
    clauses.push(`po.item_no = $${params.length}`);
  }
  if (filters.shiftCode) {
    params.push(filters.shiftCode);
    clauses.push(`po.shift_code = $${params.length}`);
  }

  return {
    where: clauses.join(" and "),
    params
  };
}

function buildDailyItemResumeWhere(filters: DailyItemResumeFilters): SqlParts {
  const base = buildWhere(filters);
  const clauses = [base.where];
  const params = [...base.params];
  if (filters.machine) {
    params.push(`%${filters.machine.toUpperCase()}%`);
    clauses.push(`upper(${machineLabelSql()}) like $${params.length}`);
  }
  return { where: clauses.join(" and "), params };
}

function groupSearchSql(paramIndex: number): string {
  return `searchable_text like $${paramIndex}`;
}

function dailyItemResumeSortSql(sort: DailyItemResumeFilters["sort"]): string {
  const stableSort = "machine_label asc, item_no asc, reject_only asc";
  if (sort === "postingDate.asc") return `posting_date asc, ${stableSort}`;
  if (sort === "netOutputQty.desc") return `net_output_qty desc, posting_date desc, ${stableSort}`;
  if (sort === "netOutputQty.asc") return `net_output_qty asc, posting_date desc, ${stableSort}`;
  return `posting_date desc, ${stableSort}`;
}

function buildDowntimeWhere(filters: DashboardFilters): SqlParts {
  const clauses = ["de.deleted_at is null", "de.event_date >= $1", "de.event_date <= $2"];
  const params: unknown[] = [filters.from, filters.to];

  if (filters.entityId) {
    params.push(filters.entityId);
    clauses.push(`de.entity_id = $${params.length}`);
  }
  if (filters.machineCenterNo) {
    params.push(filters.machineCenterNo);
    clauses.push(`de.machine_code = $${params.length}`);
  }
  if (filters.shiftCode) {
    params.push(filters.shiftCode);
    clauses.push(`de.shift_code = $${params.length}`);
  }

  return { where: clauses.join(" and "), params };
}

function targetForDate(targets: readonly TargetRow[], entityId: string, postingDate: string): TargetRow | null {
  const candidates = targets
    .filter((target) => {
      if (target.entity_id !== entityId) return false;
      if (dateText(target.effective_from) > postingDate) return false;
      if (target.effective_to && dateText(target.effective_to) < postingDate) return false;
      return true;
    })
    .sort((a, b) => dateText(b.effective_from).localeCompare(dateText(a.effective_from)));
  return candidates[0] ?? null;
}

function computeTargetCoverage(
  activeDays: readonly ActiveEntityDayRow[],
  targets: readonly TargetRow[]
) {
  let prorataTarget = 0;
  let missingTargetEntityDays = 0;
  const minValues: number[] = [];
  const maxValues: number[] = [];

  for (const activeDay of activeDays) {
    const target = targetForDate(targets, activeDay.entity_id, dateText(activeDay.posting_date));
    if (!target) {
      missingTargetEntityDays += 1;
      continue;
    }
    prorataTarget += numberValue(target.daily_target_qty);
    minValues.push(numberValue(target.min_achievement_pct));
    maxValues.push(numberValue(target.max_achievement_pct));
  }

  return {
    prorataTarget,
    missingTargetEntityDays,
    activeEntityDays: activeDays.length,
    hasTarget: activeDays.length > 0 && missingTargetEntityDays === 0,
    minAchievementPct:
      minValues.length > 0 ? minValues.reduce((total, value) => total + value, 0) / minValues.length : undefined,
    maxAchievementPct:
      maxValues.length > 0 ? maxValues.reduce((total, value) => total + value, 0) / maxValues.length : undefined
  };
}

function serializeKpis(kpis: DashboardKpiSummary) {
  return {
    outputOkQty: kpis.outputOkQty,
    prorataTarget: kpis.prorataTarget,
    achievementPct: kpis.achievementPct,
    targetStatus: kpis.targetStatus,
    targetStatusReason: kpis.targetStatusReason,
    rejectKg: kpis.rejectKg,
    rejectPcsEquivalent: kpis.rejectPcsEquivalent,
    rejectConversionStatus: kpis.rejectConversionStatus,
    rejectRatePct: kpis.rejectRatePct,
    activeDays: kpis.activeDays,
    incompleteRejectConversionCount: kpis.incompleteRejectConversionCount
  };
}

export class DashboardReadRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getSummary(filters: DashboardFilters): Promise<DashboardSummaryDto> {
    const where = buildWhere(filters);
    const [aggregate, activeEntityDays, targets, latestSync, dataQuality, downtime] = await Promise.all([
      this.queryAggregate(where),
      this.queryActiveEntityDays(where),
      this.queryTargets(filters),
      this.queryLatestSuccessfulSync(filters.sourceSystem),
      this.getDataQualitySummary(filters),
      this.queryDowntimeSummary(filters)
    ]);
    const coverage = computeTargetCoverage(activeEntityDays, targets);
    const kpis = buildDashboardKpiSummary({
      outputOkQty: numberValue(aggregate.output_ok_qty),
      rejectKg: numberValue(aggregate.reject_kg),
      rejectPcsEquivalent: numberValue(aggregate.reject_pcs_equivalent),
      prorataTarget: coverage.prorataTarget,
      hasTarget: coverage.hasTarget,
      activeDays: numberValue(aggregate.active_days),
      incompleteRejectConversionCount: numberValue(aggregate.incomplete_reject_conversion_count),
      latestSuccessfulSyncFinishedAt: latestSync,
      now: new Date(),
      ...(coverage.minAchievementPct ? { minAchievementPct: coverage.minAchievementPct } : {}),
      ...(coverage.maxAchievementPct ? { maxAchievementPct: coverage.maxAchievementPct } : {})
    });

    return {
      filters,
      kpis: serializeKpis(kpis),
      dataFreshness: {
        status: kpis.dataFreshnessStatus,
        freshnessMinutes: kpis.freshnessMinutes,
        latestSuccessfulSyncFinishedAt: latestSync?.toISOString() ?? null
      },
      targetCoverage: {
        activeEntityDays: coverage.activeEntityDays,
        missingTargetEntityDays: coverage.missingTargetEntityDays
      },
      dataQuality,
      downtime
    };
  }

  async getTrends(filters: DashboardFilters): Promise<readonly TrendRow[]> {
    const where = buildWhere(filters);
    const result = await this.database.pool.query<{
      posting_date: string;
      output_ok_qty: string | number | null;
      reject_kg: string | number | null;
      reject_pcs_equivalent: string | number | null;
    }>(
      `
        select
          po.posting_date::text,
          coalesce(sum(case when po.normalized_output_type = 'OK' then po.quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(case when po.reject_kg > 0 then po.reject_kg else 0 end), 0) as reject_kg,
          coalesce(sum(case when po.reject_pcs_eq > 0 then po.reject_pcs_eq else 0 end), 0) as reject_pcs_equivalent
        from production_outputs po
        where ${where.where}
        group by po.posting_date
        order by po.posting_date asc
      `,
      where.params
    );
    const activeDays = await this.queryActiveEntityDays(where);
    const targets = await this.queryTargets(filters);

    return result.rows.map((row) => {
      const date = dateText(row.posting_date);
      const dayCoverage = computeTargetCoverage(
        activeDays.filter((activeDay) => dateText(activeDay.posting_date) === date),
        targets
      );
      const outputOkQty = numberValue(row.output_ok_qty);
      const achievementPct =
        dayCoverage.prorataTarget > 0 ? (outputOkQty / dayCoverage.prorataTarget) * 100 : null;
      return {
        postingDate: date,
        outputOkQty,
        rejectKg: numberValue(row.reject_kg),
        rejectPcsEquivalent: numberValue(row.reject_pcs_equivalent),
        prorataTarget: dayCoverage.prorataTarget,
        achievementPct
      };
    });
  }

  async getBreakdowns(input: {
    readonly filters: DashboardFilters;
    readonly groupBy: "machine" | "entity" | "item" | "shift";
    readonly limit: number;
  }): Promise<readonly BreakdownRow[]> {
    const where = buildWhere(input.filters);
    const groupExpressions = {
      machine: {
        key: "coalesce(po.machine_center_no, 'UNMAPPED')",
        label: "coalesce(po.machine_center_no, 'Unmapped')"
      },
      entity: {
        key: "coalesce(po.entity_id::text, 'UNMAPPED')",
        label: "coalesce(me.display_name, po.machine_center_no, 'Unmapped')"
      },
      item: {
        key: "po.item_no",
        label: "po.item_no"
      },
      shift: {
        key: "coalesce(po.shift_code, 'UNMAPPED')",
        label: "coalesce(po.shift_code, 'Unmapped')"
      }
    } as const;
    const group = groupExpressions[input.groupBy];
    const result = await this.database.pool.query<{
      key: string;
      label: string;
      output_ok_qty: string | number | null;
      reject_kg: string | number | null;
      reject_pcs_equivalent: string | number | null;
      row_count: string | number | null;
    }>(
      `
        select
          ${group.key} as key,
          ${group.label} as label,
          coalesce(sum(case when po.normalized_output_type = 'OK' then po.quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(case when po.reject_kg > 0 then po.reject_kg else 0 end), 0) as reject_kg,
          coalesce(sum(case when po.reject_pcs_eq > 0 then po.reject_pcs_eq else 0 end), 0) as reject_pcs_equivalent,
          count(*) as row_count
        from production_outputs po
        left join master_entities me on me.id = po.entity_id
        where ${where.where}
        group by ${group.key}, ${group.label}
        order by output_ok_qty desc
        limit $${where.params.length + 1}
      `,
      [...where.params, input.limit]
    );

    return result.rows.map((row) => ({
      key: row.key,
      label: row.label,
      outputOkQty: numberValue(row.output_ok_qty),
      rejectKg: numberValue(row.reject_kg),
      rejectPcsEquivalent: numberValue(row.reject_pcs_equivalent),
      rowCount: numberValue(row.row_count)
    }));
  }

  async listOutputs(filters: OutputListFilters): Promise<OutputListResult> {
    const where = buildWhere(filters);
    const sortColumns = {
      postingDate: "po.posting_date",
      entryNo: "po.entry_no",
      itemNo: "po.item_no",
      machineCenterNo: "po.machine_center_no",
      quantity: "po.quantity"
    } as const;
    const offset = (filters.page - 1) * filters.pageSize;
    const countResult = await this.database.pool.query<{ total: string | number }>(
      `select count(*) as total from production_outputs po where ${where.where}`,
      where.params
    );
    const totalRows = numberValue(countResult.rows[0]?.total);
    const result = await this.database.pool.query<{
      id: string;
      source_system: string;
      entry_no: string | number | null;
      posting_date: string;
      document_no: string | null;
      normalized_output_type: string;
      item_no: string;
      item_description: string | null;
      machine_center_no: string | null;
      entity_id: string | null;
      entity_name: string | null;
      shift_code: string | null;
      quantity: string | number;
      uom: string | null;
      reject_kg: string | number;
      reject_pcs_eq: string | number | null;
      sync_run_id: string | null;
    }>(
      `
        select
          po.id,
          po.source_system,
          po.entry_no::text,
          po.posting_date::text,
          po.document_no,
          po.normalized_output_type,
          po.item_no,
          po.item_description,
          po.machine_center_no,
          po.entity_id,
          me.display_name as entity_name,
          po.shift_code,
          po.quantity,
          po.uom,
          po.reject_kg,
          po.reject_pcs_eq,
          po.sync_run_id
        from production_outputs po
        left join master_entities me on me.id = po.entity_id
        where ${where.where}
        order by ${sortColumns[filters.sortBy]} ${filters.sortDir}, po.id asc
        limit $${where.params.length + 1}
        offset $${where.params.length + 2}
      `,
      [...where.params, filters.pageSize, offset]
    );

    return {
      rows: result.rows.map((row) => this.serializeOutput(row)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async listDailyItemResume(filters: DailyItemResumeFilters) {
    const where = buildDailyItemResumeWhere(filters);
    const groupParams = [...where.params];
    const searchClause = filters.search
      ? (() => {
          groupParams.push(`%${filters.search.toLowerCase()}%`);
          return `where ${groupSearchSql(groupParams.length)}`;
        })()
      : "";
    const groupedSql = `
      with base as (
        select
          po.id,
          po.posting_date::date as posting_date,
          po.document_no,
          po.external_document_no,
          po.normalized_output_type,
          po.item_no,
          po.item_description,
          po.item_category_code,
          po.shift_code,
          po.operator_name,
          po.quantity,
          po.reject_kg,
          ${machineLabelSql()} as machine_label
        from production_outputs po
        left join master_entities me on me.id = po.entity_id
        where ${where.where}
      ),
      ok_groups as (
        select
          posting_date,
          machine_label,
          item_no,
          false as reject_only,
          coalesce(sum(quantity), 0) as net_output_qty,
          lower(concat_ws(' ',
            posting_date::text,
            machine_label,
            item_no,
            string_agg(distinct coalesce(item_description, ''), ' '),
            string_agg(distinct coalesce(document_no, ''), ' '),
            string_agg(distinct coalesce(external_document_no, ''), ' '),
            string_agg(distinct coalesce(operator_name, ''), ' '),
            string_agg(distinct coalesce(shift_code, ''), ' ')
          )) as searchable_text
        from base
        where normalized_output_type = 'OK'
        group by posting_date, machine_label, item_no
      ),
      reject_only_groups as (
        select
          b.posting_date,
          b.machine_label,
          b.item_no,
          true as reject_only,
          0::numeric as net_output_qty,
          lower(concat_ws(' ',
            b.posting_date::text,
            b.machine_label,
            b.item_no,
            string_agg(distinct coalesce(b.item_description, ''), ' '),
            string_agg(distinct coalesce(b.document_no, ''), ' '),
            string_agg(distinct coalesce(b.external_document_no, ''), ' '),
            string_agg(distinct coalesce(b.operator_name, ''), ' '),
            string_agg(distinct coalesce(b.shift_code, ''), ' ')
          )) as searchable_text
        from base b
        where (b.normalized_output_type = 'REJECT' or b.reject_kg > 0)
          and not exists (
            select 1
            from base ok
            where ok.posting_date = b.posting_date
              and ok.machine_label = b.machine_label
              and ok.normalized_output_type = 'OK'
          )
        group by b.posting_date, b.machine_label, b.item_no
      ),
      grouped as (
        select * from ok_groups
        union all
        select * from reject_only_groups
      )
    `;
    const offset = (filters.page - 1) * filters.pageSize;
    const [countResult, groupResult] = await Promise.all([
      this.database.pool.query<{ total: string | number }>(
        `${groupedSql} select count(*) as total from grouped ${searchClause}`,
        groupParams
      ),
      this.database.pool.query<{
        posting_date: string;
        machine_label: string;
        item_no: string;
        reject_only: boolean;
        net_output_qty: string | number;
      }>(
        `${groupedSql}
         select posting_date::text, machine_label, item_no, reject_only, net_output_qty
         from grouped
         ${searchClause}
         order by ${dailyItemResumeSortSql(filters.sort)}
         limit $${groupParams.length + 1}
         offset $${groupParams.length + 2}`,
        [...groupParams, filters.pageSize, offset]
      )
    ]);
    const totalRows = numberValue(countResult.rows[0]?.total);
    if (groupResult.rows.length === 0) {
      return {
        rows: [],
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          totalRows,
          totalPages: Math.ceil(totalRows / filters.pageSize)
        }
      };
    }

    const sourceWhere = buildDailyItemResumeWhere(filters);
    const dateMachinePairs = [
      ...new Map(groupResult.rows.map((row) => [`${dateText(row.posting_date)}|${row.machine_label}`, {
        postingDate: dateText(row.posting_date),
        machineLabel: row.machine_label
      }])).values()
    ];
    const sourceParams = [...sourceWhere.params];
    const pairValuesSql = dateMachinePairs.map((pair) => {
      sourceParams.push(pair.postingDate, pair.machineLabel);
      return `($${sourceParams.length - 1}::date, $${sourceParams.length}::text)`;
    }).join(", ");
    const [rowsResult, targetsResult] = await Promise.all([
      this.database.pool.query<{
        id: string;
        posting_date: string;
        document_no: string | null;
        external_document_no: string | null;
        normalized_output_type: string;
        item_no: string;
        item_description: string | null;
        item_category_code: string | null;
        machine_center_no: string | null;
        prod_line_no: string | null;
        prod_line_description: string | null;
        entity_id: string | null;
        entity_code: string | null;
        entity_display_name: string | null;
        planned_runtime_hours: string | number | null;
        shift_code: string | null;
        operator_name: string | null;
        quantity: string | number;
        uom: string | null;
        gross_weight_per_pcs: string | number | null;
        reject_kg: string | number;
        reject_pcs_eq: string | number | null;
      }>(
        `
          select
            po.id,
            po.posting_date::text,
            po.document_no,
            po.external_document_no,
            po.normalized_output_type,
            po.item_no,
            po.item_description,
            po.item_category_code,
            po.machine_center_no,
            po.prod_line_no,
            po.prod_line_description,
            po.entity_id,
            me.entity_code,
            me.display_name as entity_display_name,
            me.planned_runtime_hours,
            po.shift_code,
            po.operator_name,
            po.quantity,
            po.uom,
            po.gross_weight_per_pcs,
            po.reject_kg,
            po.reject_pcs_eq
          from production_outputs po
          left join master_entities me on me.id = po.entity_id
          where ${sourceWhere.where}
            and exists (
              select 1
              from (values ${pairValuesSql}) as selected(posting_date, machine_label)
              where selected.posting_date = po.posting_date
                and selected.machine_label = ${machineLabelSql()}
            )
          order by po.posting_date desc, po.id asc
        `,
        sourceParams
      ),
      this.queryDailyItemResumeTargets(filters)
    ]);
    const sourceRows: DailyItemResumeSourceRow[] = rowsResult.rows.map((row) => ({
      id: row.id,
      postingDate: dateText(row.posting_date),
      documentNo: row.document_no,
      externalDocumentNo: row.external_document_no,
      normalizedOutputType: row.normalized_output_type,
      itemNo: row.item_no,
      itemDescription: row.item_description,
      itemCategoryCode: row.item_category_code,
      machineCenterNo: row.machine_center_no,
      prodLineNo: row.prod_line_no,
      prodLineDescription: row.prod_line_description,
      entityId: row.entity_id,
      entityCode: row.entity_code,
      entityDisplayName: row.entity_display_name,
      plannedRuntimeHours: row.planned_runtime_hours === null ? null : numberValue(row.planned_runtime_hours),
      shiftCode: row.shift_code,
      operatorName: row.operator_name,
      quantity: numberValue(row.quantity),
      uom: row.uom,
      grossWeightPerPcs: row.gross_weight_per_pcs === null ? null : numberValue(row.gross_weight_per_pcs),
      rejectKg: numberValue(row.reject_kg),
      rejectPcsEq: row.reject_pcs_eq === null ? null : numberValue(row.reject_pcs_eq)
    }));
    const selectedKeys = groupResult.rows.map((row) => dailyItemResumeGroupKey({
      postingDate: dateText(row.posting_date),
      machineLabel: row.machine_label,
      itemNo: row.item_no,
      rejectOnly: row.reject_only
    }));
    const selectedKeySet = new Set(selectedKeys);
    const { search: _search, ...filtersWithoutSearch } = filters;
    const builtRows = buildDailyItemResume(sourceRows, targetsResult, {
      ...filtersWithoutSearch,
      page: 1,
      pageSize: Math.max(sourceRows.length + selectedKeys.length, 1)
    }).rows;
    const byKey = new Map(builtRows.map((row) => [String(row.drilldown.groupKey), row]));
    const rows = selectedKeys.flatMap((key) => {
      const row = byKey.get(key);
      if (!row || !selectedKeySet.has(key)) return [];
      return [row];
    });
    return {
      rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / filters.pageSize)
      }
    };
  }

  async getOutputById(id: string): Promise<OutputRowDto | null> {
    const result = await this.database.pool.query<Parameters<typeof this.serializeOutput>[0]>(
      `
        select
          po.id,
          po.source_system,
          po.entry_no::text,
          po.posting_date::text,
          po.document_no,
          po.normalized_output_type,
          po.item_no,
          po.item_description,
          po.machine_center_no,
          po.entity_id,
          me.display_name as entity_name,
          po.shift_code,
          po.quantity,
          po.uom,
          po.reject_kg,
          po.reject_pcs_eq,
          po.sync_run_id
        from production_outputs po
        left join master_entities me on me.id = po.entity_id
        where po.id = $1
        limit 1
      `,
      [id]
    );
    return result.rows[0] ? this.serializeOutput(result.rows[0]) : null;
  }

  async getDataQualitySummary(filters?: DashboardFilters): Promise<DataQualitySummaryDto> {
    const params: unknown[] = [];
    const clauses = ["status = 'OPEN'"];
    if (filters?.sourceSystem) {
      params.push(filters.sourceSystem);
      clauses.push(`source_system = $${params.length}`);
    }
    const where = clauses.join(" and ");
    const [summary, byCode] = await Promise.all([
      this.database.pool.query<{
        open_issues: string | number;
        critical_issues: string | number;
        warning_issues: string | number;
        info_issues: string | number;
      }>(
        `
          select
            count(*) as open_issues,
            count(*) filter (where severity = 'CRITICAL') as critical_issues,
            count(*) filter (where severity = 'WARNING') as warning_issues,
            count(*) filter (where severity = 'INFO') as info_issues
          from data_quality_issues
          where ${where}
        `,
        params
      ),
      this.database.pool.query<{ issue_code: string; count: string | number }>(
        `
          select issue_code, count(*) as count
          from data_quality_issues
          where ${where}
          group by issue_code
          order by count desc, issue_code asc
          limit 10
        `,
        params
      )
    ]);
    const row = summary.rows[0];
    return {
      openIssues: numberValue(row?.open_issues),
      criticalIssues: numberValue(row?.critical_issues),
      warningIssues: numberValue(row?.warning_issues),
      infoIssues: numberValue(row?.info_issues),
      byCode: byCode.rows.map((item) => ({
        issueCode: item.issue_code,
        count: numberValue(item.count)
      }))
    };
  }

  private async queryDowntimeSummary(filters: DashboardFilters): Promise<DowntimeSummaryDto> {
    const where = buildDowntimeWhere(filters);
    const durationExpression = `
      case
        when de.status = 'CLOSED' then coalesce(de.duration_minutes, 0)
        else greatest(0, floor(extract(epoch from (now() - de.start_time)) / 60))::int
      end
    `;
    const [summary, topCategories, topEntities] = await Promise.all([
      this.database.pool.query<{
        total_duration_minutes: string | number | null;
        open_event_count: string | number | null;
        event_count: string | number | null;
      }>(
        `
          select
            coalesce(sum(${durationExpression}), 0) as total_duration_minutes,
            count(*) filter (where de.status = 'OPEN') as open_event_count,
            count(*) as event_count
          from downtime_events de
          where ${where.where}
        `,
        where.params
      ),
      this.database.pool.query<{
        category: string;
        duration_minutes: string | number | null;
        event_count: string | number | null;
      }>(
        `
          select
            de.category,
            coalesce(sum(${durationExpression}), 0) as duration_minutes,
            count(*) as event_count
          from downtime_events de
          where ${where.where}
          group by de.category
          order by duration_minutes desc, de.category asc
          limit 5
        `,
        where.params
      ),
      this.database.pool.query<{
        label: string;
        duration_minutes: string | number | null;
        event_count: string | number | null;
      }>(
        `
          select
            coalesce(me.display_name, de.machine_code, 'Unmapped') as label,
            coalesce(sum(${durationExpression}), 0) as duration_minutes,
            count(*) as event_count
          from downtime_events de
          left join master_entities me on me.id = de.entity_id
          where ${where.where}
          group by coalesce(me.display_name, de.machine_code, 'Unmapped')
          order by duration_minutes desc, label asc
          limit 5
        `,
        where.params
      )
    ]);
    const row = summary.rows[0];
    return {
      totalDurationMinutes: numberValue(row?.total_duration_minutes),
      openEventCount: numberValue(row?.open_event_count),
      eventCount: numberValue(row?.event_count),
      topCategories: topCategories.rows.map((item) => ({
        category: item.category,
        durationMinutes: numberValue(item.duration_minutes),
        eventCount: numberValue(item.event_count)
      })),
      topEntities: topEntities.rows.map((item) => ({
        label: item.label,
        durationMinutes: numberValue(item.duration_minutes),
        eventCount: numberValue(item.event_count)
      }))
    };
  }

  private async queryAggregate(where: SqlParts): Promise<AggregateRow> {
    const result = await this.database.pool.query<AggregateRow>(
      `
        select
          coalesce(sum(case when po.normalized_output_type = 'OK' then po.quantity else 0 end), 0) as output_ok_qty,
          coalesce(sum(case when po.reject_kg > 0 then po.reject_kg else 0 end), 0) as reject_kg,
          coalesce(sum(case when po.reject_pcs_eq > 0 then po.reject_pcs_eq else 0 end), 0) as reject_pcs_equivalent,
          count(*) filter (where po.reject_kg > 0 and po.reject_pcs_eq is null) as incomplete_reject_conversion_count,
          count(distinct po.posting_date) filter (where po.normalized_output_type = 'OK') as active_days,
          count(*) as row_count
        from production_outputs po
        where ${where.where}
      `,
      where.params
    );
    return (
      result.rows[0] ?? {
        output_ok_qty: 0,
        reject_kg: 0,
        reject_pcs_equivalent: 0,
        incomplete_reject_conversion_count: 0,
        active_days: 0,
        row_count: 0
      }
    );
  }

  private async queryActiveEntityDays(where: SqlParts): Promise<readonly ActiveEntityDayRow[]> {
    const result = await this.database.pool.query<ActiveEntityDayRow>(
      `
        select po.entity_id, po.posting_date::text
        from production_outputs po
        where ${where.where}
          and po.entity_id is not null
          and po.normalized_output_type = 'OK'
        group by po.entity_id, po.posting_date
      `,
      where.params
    );
    return result.rows;
  }

  private async queryTargets(filters: DashboardFilters): Promise<readonly TargetRow[]> {
    const params: unknown[] = [filters.to, filters.from];
    const clauses = [
      "pt.effective_from <= $1",
      "(pt.effective_to is null or pt.effective_to >= $2)",
      "pt.status in ('APPROVED', 'ACTIVE')"
    ];
    if (filters.entityId) {
      params.push(filters.entityId);
      clauses.push(`pt.entity_id = $${params.length}`);
    }
    const result = await this.database.pool.query<TargetRow>(
      `
        select
          pt.entity_id,
          pt.effective_from::text,
          pt.effective_to::text,
          pt.daily_target_qty,
          pt.min_achievement_pct,
          pt.max_achievement_pct,
          pt.status
        from production_targets pt
        where ${clauses.join(" and ")}
      `,
      params
    );
    return result.rows;
  }

  private async queryDailyItemResumeTargets(filters: DashboardFilters): Promise<readonly DailyItemResumeTarget[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (filters.entityId) {
      params.push(filters.entityId);
      clauses.push(`pt.entity_id = $${params.length}`);
    }
    const result = await this.database.pool.query<{
      entity_id: string;
      effective_from: string;
      effective_to: string | null;
      daily_target_qty: string | number;
      status: string | null;
    }>(
      `
        select
          pt.entity_id,
          pt.effective_from::text,
          pt.effective_to::text,
          pt.daily_target_qty,
          pt.status
        from production_targets pt
        ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
        order by pt.entity_id, pt.effective_from desc
      `,
      params
    );
    const rows = result.rows;
    return rows.map((row) => ({
      entityId: row.entity_id,
      effectiveFrom: dateText(row.effective_from),
      effectiveTo: row.effective_to ? dateText(row.effective_to) : null,
      dailyTargetQty: numberValue(row.daily_target_qty),
      status: row.status
    }));
  }

  private async queryLatestSuccessfulSync(sourceSystem: string): Promise<Date | null> {
    const requireLiveSource = process.env.ODATA_SYNC_MODE === "live";
    const result = await this.database.pool.query<{ finished_at: Date | null }>(
      `
        select finished_at
        from sync_runs
        where source_system = $1
          and status = 'SUCCESS'
          and (
            $2::boolean = false
            or (source_url is not null and source_url not like 'mock://%')
          )
        order by finished_at desc
        limit 1
      `,
      [sourceSystem, requireLiveSource]
    );
    return result.rows[0]?.finished_at ?? null;
  }

  private serializeOutput(row: {
    readonly id: string;
    readonly source_system: string;
    readonly entry_no: string | number | null;
    readonly posting_date: string;
    readonly document_no: string | null;
    readonly normalized_output_type: string;
    readonly item_no: string;
    readonly item_description: string | null;
    readonly machine_center_no: string | null;
    readonly entity_id: string | null;
    readonly entity_name: string | null;
    readonly shift_code: string | null;
    readonly quantity: string | number;
    readonly uom: string | null;
    readonly reject_kg: string | number;
    readonly reject_pcs_eq: string | number | null;
    readonly sync_run_id: string | null;
  }): OutputRowDto {
    return {
      id: row.id,
      sourceSystem: row.source_system,
      entryNo: row.entry_no === null ? null : String(row.entry_no),
      postingDate: dateText(row.posting_date),
      documentNo: row.document_no,
      normalizedOutputType: row.normalized_output_type,
      itemNo: row.item_no,
      itemDescription: row.item_description,
      machineCenterNo: row.machine_center_no,
      entityId: row.entity_id,
      entityName: row.entity_name,
      shiftCode: row.shift_code,
      quantity: numberValue(row.quantity),
      uom: row.uom,
      rejectKg: numberValue(row.reject_kg),
      rejectPcsEq: row.reject_pcs_eq === null ? null : numberValue(row.reject_pcs_eq),
      syncRunId: row.sync_run_id
    };
  }
}
