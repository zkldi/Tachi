import DB from "#services/pg/db";

export async function GetBlacklist() {
	const rows = await DB.selectFrom("score_blacklist").select("score_id").execute();

	return rows.map((e) => e.score_id);
}
