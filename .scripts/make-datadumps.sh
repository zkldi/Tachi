#!/usr/bin/env bash
# make-datadumps.sh — produce anonymised Tachi dataset dumps for distribution.
#
# For each named instance (e.g. "kamai", "boku") this script:
#   1. Creates a temporary database anon-$instance on the local server
#   2. Clones the source database (tachi_$instance) into it via pg_dump | pg_restore
#   3. Runs the TypeScript anonymiser to strip PII in place
#   4. Dumps the anonymised copy to a gzip-compressed SQL file
#   5. Drops the temporary database
#
# The resulting .sql.gz files can be loaded with:
#   gunzip -c tachi-kamai-2026-05.sql.gz | psql -d <target-db>
#
# ── Required configuration ──────────────────────────────────────────────────
#
#   LOCAL_BASE_URL   Base Postgres URL of the server where tachi_$instance
#                    databases already exist, without a database name.
#                    Example: postgresql://tachi:tachi@tachi-postgres:5432
#
# ── Optional configuration ──────────────────────────────────────────────────
#
#   INSTANCES        Space-separated list of instance names to process.
#                    The source database is expected to be named tachi_$instance.
#                    Default: "kamai boku"
#
#   TARGET_DIR       Directory to write the .sql.gz files into.
#                    Default: <repo-root>/datasets
#
# ── Example ─────────────────────────────────────────────────────────────────
#
#   LOCAL_BASE_URL=postgresql://tachi:tachi@tachi-postgres:5432 \
#   INSTANCES=kamai \
#   .scripts/make-datadumps.sh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
SERVER_DIR="$SCRIPT_DIR/../typescript/server"

if [[ -z "${LOCAL_BASE_URL:-}" ]]; then
	echo "make-datadumps: LOCAL_BASE_URL is required." >&2
	echo "  Example: LOCAL_BASE_URL=postgresql://tachi:tachi@tachi-postgres:5432" >&2
	exit 1
fi

INSTANCES="${INSTANCES:-kamai boku}"
TARGET_DIR="${TARGET_DIR:-$SCRIPT_DIR/../datasets}"

DATESTAMP="$(date +%Y-%m)"

mkdir -p "$TARGET_DIR"

for instance in $INSTANCES; do
	anon_db="anon-$instance"
	source_url="${LOCAL_BASE_URL}/tachi_${instance}"
	anon_url="${LOCAL_BASE_URL}/${anon_db}"
	maintenance_url="${LOCAL_BASE_URL}/postgres"
	output="$TARGET_DIR/tachi-$instance-$DATESTAMP.sql.gz"

	echo "==> [$instance] Starting dataset dump pipeline"

	# 1. Create a fresh anon copy database
	echo "  -> Creating $anon_db"
	psql "$maintenance_url" -c "DROP DATABASE IF EXISTS \"$anon_db\""
	psql "$maintenance_url" -c "CREATE DATABASE \"$anon_db\""

	# 2. Clone the local source database into the anon copy
	echo "  -> Cloning tachi_${instance} into ${anon_db}"
	pg_dump --format=custom "$source_url" \
		| pg_restore --dbname="$anon_url" --no-owner --no-acl

	# 3. Anonymise the copy in place
	echo "  -> Anonymising $anon_db"
	(cd "$SERVER_DIR" && bun run src/scripts/anonymise-db.ts -- --url "$anon_url")

	# 4. Dump to a gzip-compressed plain SQL file
	echo "  -> Dumping to $output"
	pg_dump --format=plain --compress=9 --no-owner --no-acl "$anon_url" >"$output"

	# 5. Drop the temporary anon database
	echo "  -> Dropping $anon_db"
	psql "$maintenance_url" -c "DROP DATABASE \"$anon_db\""

	echo "  -> Done: $output ($(du -sh "$output" | cut -f1))"
done

echo ""
echo "All dataset dumps complete. Files written to $TARGET_DIR:"
ls -lh "$TARGET_DIR"/tachi-*-"$DATESTAMP".sql.gz
