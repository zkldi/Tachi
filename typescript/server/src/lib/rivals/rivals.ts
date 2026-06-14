import type { Game } from "tachi-db";

import { SetRivalsFailReasons } from "#lib/constants/err-codes";
import { log } from "#lib/log/log";
import { SendSetRivalNotification } from "#lib/notifications/notification-wrappers";
import { ServerConfig } from "#lib/setup/config";
import { pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { ArrayDiff } from "#utils/misc";
import { GetUsersWithIDs, GetUserWithIDGuaranteed } from "#utils/user";
import { GetGameConfig, type integer, type PgScoreData, type V3Game } from "tachi-common";

/**
 * Retrieve all of a user's set rival IDs.
 * Throws if the user hasn't played the GPT in question.
 */
export async function GetRivalIDs(userID: integer, game: V3Game) {
	const profile = await DB.selectFrom("game_profile")
		.select("game_profile.user_id")
		.where("game_profile.user_id", "=", userID)
		.where("game_profile.game", "=", game)
		.executeTakeFirst();

	if (!profile) {
		throw new Error(`User ${userID} has not played ${game}. Cannot retrieve rivals.`);
	}

	const rivalRows = await DB.selectFrom("game_rival")
		.select("rival")
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.execute();

	return rivalRows.map((r) => r.rival);
}

/**
 * Get the user documents of the rivals for this UGPT.
 * Throws if the user hasn't played the GPT in question.
 */
export async function GetRivalUsers(userID: integer, game: V3Game) {
	const rivalIDs = await GetRivalIDs(userID, game);

	const rivals = await GetUsersWithIDs(rivalIDs);

	return rivals;
}

/**
 * Retrieve *all* rival IDs for people on this game. Used to recalculate rival movements on charts,
 * since that is stored and cached.
 */
export async function GetEveryonesRivalIDs(game: V3Game): Promise<Record<number, Array<number>>> {
	const rows = await DB.selectFrom("game_rival")
		.select(["user_id", "rival"])
		.where("game", "=", game)
		.execute();

	const lookupTable: Record<integer, Array<integer>> = {};

	for (const r of rows) {
		const list = lookupTable[r.user_id] ?? [];
		list.push(r.rival);
		lookupTable[r.user_id] = list;
	}

	return lookupTable;
}

function metricValueFromPbRow(
	v3Game: Game,
	data: unknown,
	derivedData: unknown,
	judgements: unknown,
	metricKey: string,
): number | null {
	const scoreData = pgScoreDataToAPI(v3Game, {
		data,
		derived: derivedData,
		judgements,
	} as PgScoreData<Game>);
	const v = (scoreData as Record<string, unknown>)[metricKey];
	return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/**
 * Sets an array of userIDs to be this user's rivals. Performs validation on all of the
 * rivals being players of the game, and not being duplicates. The maximum amount of rivals
 * a player can have is ServerConfig.MAX_RIVALS (defaults to 5).
 *
 * @returns `null` on success, or a {@link SetRivalsFailReasons} code on validation failure.
 */
export async function setRivalsWithResult(
	userID: integer,
	game: V3Game,
	newRivals: Array<integer>,
): Promise<SetRivalsFailReasons | null> {
	if (newRivals.length === 0) {
		await DB.deleteFrom("game_rival")
			.where("user_id", "=", userID)
			.where("game", "=", game)
			.execute();

		await UpdatePlayersRivalRankings(userID, game);

		return null;
	}

	if (newRivals.length > ServerConfig.MAX_RIVALS) {
		return SetRivalsFailReasons.TOO_MANY;
	}

	if (newRivals.some((e) => e === userID)) {
		return SetRivalsFailReasons.RIVALED_SELF;
	}

	const { count } = await DB.selectFrom("game_profile")
		.select(DB.fn.countAll().as("count"))
		.where("game_profile.game", "=", game)
		.where("game_profile.user_id", "in", newRivals)
		.executeTakeFirstOrThrow();

	const playedGPTCount = Number(count);

	if (playedGPTCount !== newRivals.length) {
		return SetRivalsFailReasons.RIVALS_HAVENT_PLAYED_GPT;
	}

	const currentGameProfile = await DB.selectFrom("game_profile")
		.select("game_profile.user_id")
		.where("game_profile.user_id", "=", userID)
		.where("game_profile.game", "=", game)
		.executeTakeFirst();

	if (!currentGameProfile) {
		log.error(
			`User ${userID} attempted to set rivals for ${game}, but doesn't have a game profile. Was their account deleted in midair?`,
		);

		throw new Error(
			`User ${userID} attempted to set rivals for ${game}, but doesn't have a game profile. Was their account deleted in midair?`,
		);
	}

	const currentRivalIDs = await GetRivalIDs(userID, game);
	const newSubs = ArrayDiff(currentRivalIDs, newRivals);

	const user = await GetUserWithIDGuaranteed(userID);

	await Promise.all(newSubs.map((toUserID) => SendSetRivalNotification(toUserID, user, game)));

	await DB.transaction().execute(async (trx) => {
		await trx
			.deleteFrom("game_rival")
			.where("user_id", "=", userID)
			.where("game", "=", game)
			.execute();

		if (newRivals.length > 0) {
			await trx
				.insertInto("game_rival")
				.values(
					newRivals.map((rival) => ({
						user_id: userID,
						game,
						rival,
					})),
				)
				.execute();
		}
	});

	await UpdatePlayersRivalRankings(userID, game);

	return null;
}

export function SetRivals(
	userID: integer,
	game: V3Game,
	newRivals: Array<integer>,
): Promise<SetRivalsFailReasons | null> {
	return setRivalsWithResult(userID, game, newRivals);
}

/**
 * Add a single new rival by their userID.
 */
export async function AddRival(userID: integer, game: V3Game, newRival: integer) {
	const rivalIDs = await GetRivalIDs(userID, game);

	rivalIDs.push(newRival);

	return setRivalsWithResult(userID, game, rivalIDs);
}

/**
 * Remove a single rival by their userID.
 *
 * @returns null if this UGPT is not rivals with the user, and therefore there is
 * nothing to change.
 */
export async function RemoveRival(userID: integer, game: V3Game, toRemove: integer) {
	const rivalIDs = await GetRivalIDs(userID, game);

	const filteredRivals = rivalIDs.filter((e) => e !== toRemove);

	if (filteredRivals.length === rivalIDs.length) {
		return null;
	}

	return setRivalsWithResult(userID, game, filteredRivals);
}

/**
 * Get all of the userIDs of people who rival the userID for this GPT.
 */
export async function GetChallengerIDs(userID: integer, game: V3Game) {
	const result = await DB.selectFrom("game_rival")
		.select("user_id")
		.where("game", "=", game)
		.where("rival", "=", userID)
		.execute();

	return result.map((e) => e.user_id);
}

/**
 * Get the user documents of everyone who is rivalling this userID for this GPT.
 */
export async function GetChallengerUsers(userID: integer, game: V3Game) {
	const challengerIDs = await GetChallengerIDs(userID, game);

	return GetUsersWithIDs(challengerIDs);
}

/**
 * Given a UGPT, update their rival rankings.
 *
 * @warn Horrifically race-condition insensitive. This method for updating rankings
 * on PBs is just absolutely horrifically misguided, and will break.
 *
 * As I said to blake, this is "eventually consistent", in the sense that "eventually"
 * someone will get a score on the chart in question and it will fix itself.
 *
 * this sucks though.
 */
export async function UpdatePlayersRivalRankings(userID: integer, game: V3Game) {
	const gameConfig = GetGameConfig(game);
	const metricKey = String(gameConfig.defaultMetric);
	const rivalIDs = await GetRivalIDs(userID, game);

	const userPBs = await DB.selectFrom("pb")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.select([
			"pb.row_id",
			"pb.chart_id",
			"pb.data",
			"pb.derived_data",
			"pb.calculated_data",
			"pb.judgements",
		])
		.where("pb.user_id", "=", userID)
		.where("chart.game", "=", game)
		.where("pb.lens", "is", null)
		.execute();

	if (userPBs.length === 0) {
		return;
	}

	const chartIds = [...new Set(userPBs.map((p) => p.chart_id))];

	let rivalPBs: Array<{
		chart_id: string;
		data: unknown;
		derived_data: unknown;
		judgements: unknown;
		user_id: number;
	}> = [];

	if (rivalIDs.length > 0) {
		rivalPBs = await DB.selectFrom("pb")
			.select(["pb.user_id", "pb.chart_id", "pb.data", "pb.derived_data", "pb.judgements"])
			.where("pb.user_id", "in", rivalIDs)
			.where("pb.chart_id", "in", chartIds)
			.where("pb.lens", "is", null)
			.execute();
	}

	await Promise.all(
		userPBs.map(async (pb) => {
			const userVal = metricValueFromPbRow(
				game,
				pb.data,
				pb.derived_data,
				pb.judgements,
				metricKey,
			);
			if (userVal === null) {
				return;
			}

			let betterCount = 0;
			for (const r of rivalPBs) {
				if (r.chart_id !== pb.chart_id) {
					continue;
				}
				const rivalVal = metricValueFromPbRow(
					game,
					r.data,
					r.derived_data,
					r.judgements,
					metricKey,
				);
				if (rivalVal !== null && rivalVal > userVal) {
					betterCount++;
				}
			}

			const rivalRank = betterCount + 1;

			const raw = pb.calculated_data;
			const cd =
				typeof raw === "string"
					? (JSON.parse(raw) as Record<string, unknown>)
					: ((raw ?? {}) as Record<string, unknown>);
			delete cd.rank;
			delete cd.outOf;

			await DB.updateTable("pb")
				.set({
					calculated_data: JSON.stringify({
						...cd,
						rivalRank,
					}),
				})
				.where("row_id", "=", pb.row_id)
				.execute();
		}),
	);
}
