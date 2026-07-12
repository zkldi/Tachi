SELECT 'CREATE DATABASE tachi_dev' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tachi_dev')\gexec
GRANT ALL PRIVILEGES ON DATABASE tachi_dev TO tachi;

-- Match genesis: pg_stat_statements (requires shared_preload_libraries in docker-compose).
\connect tachi_dev
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- Read-only user for Grafana dashboards.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_ro') THEN
    CREATE ROLE grafana_ro WITH LOGIN PASSWORD 'grafana_ro';
  END IF;
END$$;
GRANT CONNECT ON DATABASE tachi_dev TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_ro;
GRANT pg_read_all_stats TO grafana_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE tachi IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE tachi IN SCHEMA public GRANT SELECT ON SEQUENCES TO grafana_ro;
