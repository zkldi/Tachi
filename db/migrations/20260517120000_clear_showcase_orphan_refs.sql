-- Remove showcase entries that reference deleted charts or folders (slug + game).
-- `game_profile.showcase` is a JSONB array; chart entries use mode "chart" + chartID;
-- folder entries use mode "folder" + slug, scoped to game_profile.game.

UPDATE game_profile AS gp
SET showcase = cleaned.new_showcase
FROM (
	SELECT
		gp_inner.user_id,
		gp_inner.game,
		COALESCE(
			(
				SELECT jsonb_agg(t.elem ORDER BY t.ordinality)
				FROM jsonb_array_elements(gp_inner.showcase) WITH ORDINALITY AS t(elem, ordinality)
				WHERE CASE t.elem->>'mode'
					WHEN 'chart' THEN EXISTS (
						SELECT 1
						FROM chart AS c
						WHERE c.id = t.elem->>'chartID'
					)
					WHEN 'folder' THEN EXISTS (
						SELECT 1
						FROM folder AS f
						WHERE f.game = gp_inner.game
							AND f.slug = t.elem->>'slug'
					)
					ELSE TRUE
				END
			),
			'[]'::jsonb
		) AS new_showcase
	FROM game_profile AS gp_inner
	WHERE jsonb_typeof(gp_inner.showcase) = 'array'
		AND jsonb_array_length(gp_inner.showcase) > 0
) AS cleaned
WHERE gp.user_id = cleaned.user_id
	AND gp.game = cleaned.game
	AND gp.showcase IS DISTINCT FROM cleaned.new_showcase;
