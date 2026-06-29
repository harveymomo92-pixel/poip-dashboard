#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
[ -f .env ] && source .env
[ -f .env.local ] && source .env.local
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is empty. Please set DATABASE_URL or add it to .env/.env.local"
  exit 1
fi

OUT_DIR=".tmp/db-current-structure-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

echo "Inspecting DB structure..."
echo "Output folder: $OUT_DIR"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  now() AS inspected_at,
  current_database() AS database_name,
  current_user AS current_user,
  version() AS postgres_version;
" > "$OUT_DIR/00-database-info.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
" > "$OUT_DIR/01-tables.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -F ',' --no-align -c "
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
" > "$OUT_DIR/01-tables.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -F ',' --no-align -c "
SELECT
  table_schema,
  table_name,
  column_name,
  ordinal_position,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
" > "$OUT_DIR/02-columns.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  table_schema,
  table_name,
  column_name,
  ordinal_position,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
" > "$OUT_DIR/02-columns.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -F ',' --no-align -c "
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;
" > "$OUT_DIR/03-indexes.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -F ',' --no-align -c "
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;
" > "$OUT_DIR/04-constraints.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -F ',' --no-align -c "
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
    table_name ILIKE '%production%'
    OR table_name ILIKE '%output%'
    OR table_name ILIKE '%target%'
    OR table_name ILIKE '%entity%'
    OR table_name ILIKE '%alias%'
    OR table_name ILIKE '%mapping%'
    OR table_name ILIKE '%sync%'
    OR table_name ILIKE '%quality%'
    OR table_name ILIKE '%audit%'
    OR column_name ILIKE '%entity%'
    OR column_name ILIKE '%target%'
    OR column_name ILIKE '%mapping%'
    OR column_name ILIKE '%gProd%'
    OR column_name ILIKE '%machine%'
    OR column_name ILIKE '%item%'
    OR column_name ILIKE '%odata%'
  )
ORDER BY table_schema, table_name, ordinal_position;
" > "$OUT_DIR/05-relevant-columns.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE
  r record;
  row_count bigint;
BEGIN
  RAISE NOTICE '=== ROW COUNTS ===';

  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', r.table_schema, r.table_name)
    INTO row_count;

    RAISE NOTICE '%.% = % rows', r.table_schema, r.table_name, row_count;
  END LOOP;
END
\$\$;
" > "$OUT_DIR/06-row-counts.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
    table_name ILIKE '%production%'
    OR table_name ILIKE '%output%'
    OR table_name ILIKE '%target%'
    OR table_name ILIKE '%entity%'
    OR table_name ILIKE '%alias%'
    OR table_name ILIKE '%mapping%'
    OR table_name ILIKE '%sync%'
    OR table_name ILIKE '%quality%'
    OR table_name ILIKE '%audit%'
  )
ORDER BY table_schema, table_name;
" > "$OUT_DIR/07-relevant-tables.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
" > "$OUT_DIR/08-column-count-by-table.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'production_outputs',
    'production_targets',
    'target_profiles',
    'master_entities',
    'master_entity_aliases',
    'data_quality_issues',
    'audit_logs',
    'sync_runs'
  )
ORDER BY c.table_name, c.ordinal_position;
" > "$OUT_DIR/09-core-table-columns.txt"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  'production_outputs' AS table_name,
  COUNT(*) AS rows
FROM public.production_outputs
WHERE to_regclass('public.production_outputs') IS NOT NULL
UNION ALL
SELECT
  'production_targets' AS table_name,
  COUNT(*) AS rows
FROM public.production_targets
WHERE to_regclass('public.production_targets') IS NOT NULL
UNION ALL
SELECT
  'target_profiles' AS table_name,
  COUNT(*) AS rows
FROM public.target_profiles
WHERE to_regclass('public.target_profiles') IS NOT NULL;
" > "$OUT_DIR/10-core-row-counts.txt" || true

cat > "$OUT_DIR/README.md" <<EOF
# Current DB Structure Inspection

Generated at: $(date -Iseconds)

This folder contains read-only database structure inspection outputs.

Important files:
- 01-tables.csv
- 02-columns.csv
- 03-indexes.csv
- 04-constraints.csv
- 05-relevant-columns.csv
- 06-row-counts.txt
- 09-core-table-columns.txt
- 10-core-row-counts.txt

Safety:
- This script is read-only.
- It does not mutate DB.
- It does not update production_outputs, targets, aliases, mappings, or dashboard behavior.
EOF

echo ""
echo "Done."
echo "Output folder:"
echo "$OUT_DIR"
echo ""
echo "Quick files:"
ls -lah "$OUT_DIR"
