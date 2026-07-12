CREATE TYPE import_status AS ENUM ('in_progress', 'completed');

ALTER TABLE "import" ADD COLUMN status import_status NOT NULL DEFAULT 'completed';
