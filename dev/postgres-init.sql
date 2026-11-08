SELECT 'CREATE DATABASE tachi_dev' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tachi_dev')\gexec
GRANT ALL PRIVILEGES ON DATABASE tachi_dev TO tachi;

-- Match genesis: pg_stat_statements (requires shared_preload_libraries in docker-compose).
\connect tachi_dev
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;
