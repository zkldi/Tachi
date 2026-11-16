-- Preserve users' selected tables before removing their old identifiers.
UPDATE game_profile AS profile
SET pf_default_table = t.id
FROM "table" AS t
WHERE profile.game = t.game AND profile.pf_default_table = t.legacy_id;

-- Match the one-off seed conversion: strip the game/playtype prefix and normalise.
UPDATE "table"
SET slug = trim(BOTH '-' FROM regexp_replace(
	lower(regexp_replace(legacy_id, '^[^-]+-[^-]+-', '')),
	'[^a-z0-9]+', '-', 'g'
))
WHERE slug IS NULL OR slug = '';

DROP INDEX table_unique_slug_game;

ALTER TABLE "table"
	ALTER COLUMN slug SET NOT NULL,
	ADD CONSTRAINT table_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	ADD CONSTRAINT table_game_slug_key UNIQUE (game, slug),
	DROP COLUMN legacy_id;
