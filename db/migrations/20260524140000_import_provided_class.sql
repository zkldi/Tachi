-- Manual self-reported PROVIDED class imports (dan, emblem, BMS dan sets, etc.)

ALTER TYPE import_type ADD VALUE 'file/import-class';

ALTER TABLE account ADD COLUMN can_import_provided_class BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE class_achievement ADD COLUMN source TEXT NOT NULL DEFAULT 'import';
