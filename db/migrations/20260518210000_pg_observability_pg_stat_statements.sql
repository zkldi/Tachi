-- Grafana SQL dashboards read pg_stat_statements (see tachi-deploy terraform/dashboards/postgres_pg_stat_statements.json).
--
-- Applied inside a migration transaction (see tachi-db-migration-engine): cannot use ALTER SYSTEM here.
-- Instance config: prod uses server-infra/docker-compose.infra.yml (shared_preload_libraries + track);
-- dev uses Tachi3/docker-compose-dev.yml. After changing preload, recreate / restart Postgres.
-- Genesis may have created the extension already; IF NOT EXISTS keeps this migration safe.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- SELECT on pg_stat_* views requires pg_read_all_stats (not covered by SELECT grants on public tables).
-- Dev/local uses grafana_ro (see dev/postgres-init.sql); prod compose uses grafana_readonly (tachi-deploy postgres-initdb).
DO $grant_stats$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
		EXECUTE 'GRANT pg_read_all_stats TO grafana_ro';
	END IF;

	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_readonly') THEN
		EXECUTE 'GRANT pg_read_all_stats TO grafana_readonly';
	END IF;
END
$grant_stats$;
