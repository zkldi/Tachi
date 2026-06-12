import { ONE_HOUR } from "#lib/constants/time";
import DB from "#services/pg/db";
import { sql } from "kysely";
import NodeCache from "node-cache";
import { type Classes, type integer, type V3Game } from "tachi-common";

const classDistCache = new NodeCache();

export async function GetClassDistribution(game: V3Game, className: Classes[V3Game]) {
	const cacheKey = `${game}:${className}`;
	const cache = classDistCache.get<Record<string, integer>>(cacheKey);

	if (!cache) {
		const rows = await sql<{ cls: string | null; count: number }>`
			SELECT jsonb_extract_path_text(game_profile.classes::jsonb, ${sql.lit(className)}) AS cls,
				count(*)::int AS count
			FROM game_profile
			WHERE game_profile.game = ${game}
			GROUP BY jsonb_extract_path_text(game_profile.classes::jsonb, ${sql.lit(className)})
		`.execute(DB);

		const convert = Object.fromEntries(
			rows.rows.map((e) => [e.cls ?? "null", e.count]),
		) as Record<string, integer>;

		classDistCache.set(cacheKey, convert, ONE_HOUR);

		return convert;
	}

	return cache;
}
