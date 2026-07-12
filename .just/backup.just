# Postgres backup/restore via Docker (host only). Requires `docker` on PATH - not available
# inside the devcontainer, so these recipes fail fast there.

POSTGRES_CONTAINER := "tachi-postgres"
PG_USER := "tachi"

[private]
assert-docker-host:
	#!/usr/bin/env bash
	set -euo pipefail
	if ! command -v docker >/dev/null 2>&1; then
		echo "error: docker not found in PATH; run this on the host (not inside the devcontainer)." >&2
		exit 1
	fi

# Dump POSTGRES_DB to ~/Documents/tachi-postgres-backup-<timestamp>.sql.gz
# Usage: just postgres-backup
#        just postgres-backup tachi
postgres-backup POSTGRES_DB='tachi_dev': assert-docker-host
	#!/usr/bin/env bash
	set -euo pipefail
	out="${HOME}/Documents/tachi-postgres-backup-$(date +%Y%m%d-%H%M%S).sql.gz"
	mkdir -p "${HOME}/Documents"
	echo "Writing $out"
	docker exec -t "{{POSTGRES_CONTAINER}}" pg_dump -U "{{PG_USER}}" -d "{{POSTGRES_DB}}" --no-owner --no-acl | gzip -c > "$out"
	ls -lh "$out"
	gzip -t "$out"

# Restore a gzipped pg_dump into POSTGRES_DB (overwrites existing objects in that DB).
# Usage: just postgres-restore ~/Documents/tachi-postgres-backup-....sql.gz
#        just postgres-restore ~/backup.sql.gz tachi
postgres-restore backup_file POSTGRES_DB='tachi_dev': assert-docker-host
	#!/usr/bin/env bash
	set -euo pipefail
	if ! test -f "{{backup_file}}"; then
		echo "error: backup file not found: {{backup_file}}" >&2
		exit 1
	fi
	echo "Restoring {{backup_file}} into database {{POSTGRES_DB}}..."
	gunzip -c "{{backup_file}}" | docker exec -i "{{POSTGRES_CONTAINER}}" psql -U "{{PG_USER}}" -d "{{POSTGRES_DB}}"
