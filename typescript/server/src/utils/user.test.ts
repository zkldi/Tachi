import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { type UserDocument } from "tachi-common";
import { describe, expect, it } from "vitest";

import {
	FormatUserDoc,
	GetAllRankings,
	GetAllUserRivals,
	GetUserCaseInsensitive,
	GetUsersRanking,
	GetUsersRankingAndOutOf,
	GetUsersWithIDs,
} from "./user";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function seedGameStats(
	userId: number,
	ktLampRating: number | null,
	game: "iidx-sp" = "iidx-sp",
) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game,
			ratings: JSON.stringify({ ktLampRating }),
			classes: JSON.stringify({}),
		})
		.execute();
}

function makeStats(userId: number, ktLampRating: number | null) {
	return {
		userID: userId,
		game: "iidx-sp" as const,
		ratings: { ktLampRating },
		classes: {},
	};
}

// ─── GetUsersRankingAndOutOf ──────────────────────────────────────────────────

describe("GetUsersRankingAndOutOf", () => {
	it("returns ranking 1 and outOf 1 when user is the only player", async () => {
		const { id } = await seedUser();
		await seedGameStats(id, 10);

		const result = await GetUsersRankingAndOutOf(makeStats(id, 10));

		expect(result).toEqual({ ranking: 1, outOf: 1 });
	});

	it("returns ranking 1 when the user has the highest rating", async () => {
		const user1 = await seedUser({ username: "top_user" });
		const user2 = await seedUser({ username: "lower_user" });
		await seedGameStats(user1.id, 20);
		await seedGameStats(user2.id, 10);

		const result = await GetUsersRankingAndOutOf(makeStats(user1.id, 20));

		expect(result).toEqual({ ranking: 1, outOf: 2 });
	});

	it("returns ranking 2 when one user has a higher rating", async () => {
		const user1 = await seedUser({ username: "top_user" });
		const user2 = await seedUser({ username: "second_user" });
		await seedGameStats(user1.id, 20);
		await seedGameStats(user2.id, 10);

		const result = await GetUsersRankingAndOutOf(makeStats(user2.id, 10));

		expect(result).toEqual({ ranking: 2, outOf: 2 });
	});

	it("ranks correctly with many players", async () => {
		const ratings = [5, 10, 15, 20, 25];
		const users = await Promise.all(
			ratings.map((_, i) => seedUser({ username: `player_${i}` })),
		);
		await Promise.all(users.map((u, i) => seedGameStats(u.id, ratings[i]!)));

		// Player with rating 15 has 2 players above them (20, 25), so ranking = 3
		const result = await GetUsersRankingAndOutOf(makeStats(users[2]!.id, 15));

		expect(result).toEqual({ ranking: 3, outOf: 5 });
	});

	it("handles tied ratings - only strictly greater counts", async () => {
		const user1 = await seedUser({ username: "tied_a" });
		const user2 = await seedUser({ username: "tied_b" });
		const user3 = await seedUser({ username: "tied_c" });
		await seedGameStats(user1.id, 10);
		await seedGameStats(user2.id, 10);
		await seedGameStats(user3.id, 10);

		// No one is strictly greater than 10, so all rank #1
		const result = await GetUsersRankingAndOutOf(makeStats(user1.id, 10));

		expect(result).toEqual({ ranking: 1, outOf: 3 });
	});

	it("uses explicit alg parameter instead of default", async () => {
		const user1 = await seedUser({ username: "bpi_high" });
		const user2 = await seedUser({ username: "bpi_low" });

		await DB.insertInto("game_profile")
			.values({
				user_id: user1.id,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 5, BPI: 80 }),
				classes: JSON.stringify({}),
			})
			.execute();
		await DB.insertInto("game_profile")
			.values({
				user_id: user2.id,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 20, BPI: 30 }),
				classes: JSON.stringify({}),
			})
			.execute();

		// user2 has higher ktLampRating but lower BPI
		// Checking BPI ranking for user1: user1 BPI=80, user2 BPI=30, user1 is #1
		const result = await GetUsersRankingAndOutOf(
			{ userID: user1.id, game: "iidx-sp", ratings: { BPI: 80 }, classes: {} },
			"BPI" as never,
		);

		expect(result).toEqual({ ranking: 1, outOf: 2 });
	});

	it("returns worst ranking when user rating is null", async () => {
		const user1 = await seedUser({ username: "null_rater" });
		const user2 = await seedUser({ username: "other_player" });
		const user3 = await seedUser({ username: "other_better_player" });
		await seedGameStats(user1.id, null);
		await seedGameStats(user2.id, 0);
		await seedGameStats(user3.id, 10);

		const result = await GetUsersRankingAndOutOf(makeStats(user1.id, null));

		expect(result).toEqual({ ranking: 3, outOf: 3 });
	});

	it("does not include rows from different games in the count", async () => {
		const iidxUser = await seedUser({ username: "iidx_player" });
		const sdvxUser = await seedUser({ username: "sdvx_player" });

		await seedGameStats(iidxUser.id, 10, "iidx-sp");
		await DB.insertInto("game_profile")
			.values({
				user_id: sdvxUser.id,
				game: "sdvx",
				ratings: JSON.stringify({ VF6: 99 }),
				classes: JSON.stringify({}),
			})
			.execute();

		const result = await GetUsersRankingAndOutOf(makeStats(iidxUser.id, 10));

		// outOf should only count iidx-sp players
		expect(result).toEqual({ ranking: 1, outOf: 1 });
	});
});

describe("GetUsersRanking", () => {
	it("matches GetUsersRankingAndOutOf().ranking", async () => {
		const { id } = await seedUser({ username: `gr_${Date.now()}` });
		await seedGameStats(id, 12);

		const stats = makeStats(id, 12);
		const r = await GetUsersRanking(stats);
		const full = await GetUsersRankingAndOutOf(stats);

		expect(r).toBe(full.ranking);
	});
});

describe("GetAllUserRivals", () => {
	it("returns distinct rival ids from game_rival", async () => {
		const t = Date.now();
		const { id: me } = await seedUser({ username: `me_${t}` });
		const { id: rivalA } = await seedUser({ username: `rv_a_${t}` });
		const { id: rivalB } = await seedUser({ username: `rv_b_${t}` });

		await DB.insertInto("game_rival")
			.values({ game: "iidx-sp", rival: rivalA, user_id: me })
			.execute();
		await DB.insertInto("game_rival")
			.values({ game: "sdvx", rival: rivalB, user_id: me })
			.execute();
		await DB.insertInto("game_rival")
			.values({ game: "sdvx", rival: rivalA, user_id: me })
			.execute();

		const rivals = await GetAllUserRivals(me);
		expect(rivals.sort((a, b) => a - b)).toEqual([rivalA, rivalB].sort((a, b) => a - b));
	});
});

// ─── GetAllRankings ───────────────────────────────────────────────────────────

describe("GetAllRankings", () => {
	it("returns rankings for all profile rating algorithms", async () => {
		const user1 = await seedUser({ username: "top_player" });
		const user2 = await seedUser({ username: "bot_player" });

		await DB.insertInto("game_profile")
			.values({
				user_id: user1.id,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 20, BPI: 50 }),
				classes: JSON.stringify({}),
			})
			.execute();
		await DB.insertInto("game_profile")
			.values({
				user_id: user2.id,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 10, BPI: 25 }),
				classes: JSON.stringify({}),
			})
			.execute();

		const stats = {
			userID: user1.id,
			game: "iidx-sp" as const,
			ratings: { ktLampRating: 20, BPI: 50 },
			classes: {},
		};

		const result = await GetAllRankings(stats);

		// user1 is #1 in both algorithms
		expect(result.ktLampRating).toEqual({ ranking: 1, outOf: 2 });
		expect(result.BPI).toEqual({ ranking: 1, outOf: 2 });
	});
});

describe("GetUserCaseInsensitive", () => {
	it("returns the user for an exact username", async () => {
		await seedUser({ username: "case_test_user" });

		const result = await GetUserCaseInsensitive("case_test_user");

		expect(result).not.toBeNull();
		expect(result!.username).toBe("case_test_user");
		expect(result!).not.toHaveProperty("password");
		expect(result!).not.toHaveProperty("email");
	});

	it("returns the user for a differently cased username", async () => {
		await seedUser({ username: "case_test_user" });

		const result = await GetUserCaseInsensitive("CaSe_TeSt_UsEr");

		expect(result).not.toBeNull();
		expect(result!.username).toBe("case_test_user");
	});

	it("returns null when the username does not exist", async () => {
		const result = await GetUserCaseInsensitive("no_such_user_xyz");

		expect(result).toBeNull();
	});
});

describe("GetUsersWithIDs", () => {
	it("returns an empty array when given no ids", async () => {
		await expect(GetUsersWithIDs([])).resolves.toEqual([]);
	});

	it("returns users for the given ids", async () => {
		const u2 = await seedUser({ username: "gwid_two" });
		const u3 = await seedUser({ username: "gwid_three" });

		const res = await GetUsersWithIDs([u2.id, u3.id]);

		const byId = new Map(res.map((u) => [u.id, u]));
		expect(byId.get(u2.id)?.username).toBe("gwid_two");
		expect(byId.get(u3.id)?.username).toBe("gwid_three");
	});

	it("accepts duplicate user ids in the input", async () => {
		const u1 = await seedUser({ username: "gwid_dup_a" });
		const u2 = await seedUser({ username: "gwid_dup_b" });

		const res = await GetUsersWithIDs([u1.id, u2.id, u1.id]);

		expect(res.map((u) => u.id).sort((a, b) => a - b)).toEqual(
			[u1.id, u2.id].sort((a, b) => a - b),
		);
	});

	it("throws when some user ids do not exist", async () => {
		const u1 = await seedUser({ username: "gwid_missing_a" });
		const u2 = await seedUser({ username: "gwid_missing_b" });

		await expect(GetUsersWithIDs([u1.id, u2.id, 9_999_999])).rejects.toThrow(
			/given 3 userIDs, but only matched 2/u,
		);
	});
});

describe("FormatUserDoc", () => {
	it("formats username and id for logging", () => {
		expect(FormatUserDoc({ username: "zkldi", id: 123 } as UserDocument)).toBe("zkldi (#123)");
	});
});
