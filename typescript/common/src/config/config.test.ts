import { describe, expect, it } from "vitest";

import { IsValidGame } from "../utils/util";
import {
	ALL_GAMES,
	allSupportedGameGroups,
	GetGameGroupConfig,
	LEGACY_GetGamePTConfig,
} from "./config";

describe("#IsValidGame", () => {
	it("accepts games and rejects unknown strings", () => {
		expect(IsValidGame("iidx-sp")).toBe(true);
		expect(IsValidGame("not-a-real-game")).toBe(false);
		expect(IsValidGame("")).toBe(false);
	});
});

describe("ALL_GAMES", () => {
	it("lists games in each game group's games order (BMS 7K before 14K)", () => {
		const bmsGames = GetGameGroupConfig("bms").games;
		const bmsIndex = ALL_GAMES.indexOf("bms-7k");
		const bms14Index = ALL_GAMES.indexOf("bms-14k");

		expect(bmsGames).toEqual(["bms-7k", "bms-14k"]);
		expect(bmsIndex).toBeGreaterThanOrEqual(0);
		expect(bms14Index).toBeGreaterThan(bmsIndex);
	});

	it("includes every configured V3 game exactly once", () => {
		expect(new Set(ALL_GAMES).size).toBe(ALL_GAMES.length);

		for (const group of allSupportedGameGroups) {
			for (const game of GetGameGroupConfig(group).games) {
				expect(ALL_GAMES).toContain(game);
			}
		}
	});
});

describe("#GetGameGroupConfig", () => {
	it("defines configs for every supported game group with valid IDs", () => {
		for (const game of allSupportedGameGroups) {
			// i don't feel *that* strongly about this restriction, but game IDs *definitely*
			// can't have things like `:` in them.
			expect(game).toMatch(/^[a-z]+$/u);

			const conf = GetGameGroupConfig(game);

			expect(conf, `'${game}' should have a config defined.`).toBeDefined();
		}
	});
});

const BANNED_METRIC_NAMES = [
	"enumIndexes", // haha
	"optional", // used for optional metrics
	"playcount", // used by showcase stats
	"scoreID",
	"userID",

	// lazily hacked onto folder stat metrics
	"folderID",
	"chartCount",
];

describe("#GetGamePTConfig", () => {
	it("defines playtype configs with consistent rating algs and metrics", () => {
		for (const game of allSupportedGameGroups) {
			const gameConfig = GetGameGroupConfig(game);

			for (const playtype of gameConfig.playtypes) {
				const conf = LEGACY_GetGamePTConfig(game, playtype);

				expect(conf, `'${game}:${playtype}' should have a config defined.`).toBeDefined();
				if (!conf) {
					continue;
				}

				expect(
					conf.scoreRatingAlgs[conf.defaultScoreRatingAlg],
					"The default score rating alg should have an implementation.",
				).toBeTruthy();

				expect(
					conf.sessionRatingAlgs[conf.defaultSessionRatingAlg],
					"The default session rating alg should have an implementation.",
				).toBeTruthy();

				expect(
					conf.profileRatingAlgs[conf.defaultProfileRatingAlg],
					"The default profile rating alg should have an implementation.",
				).toBeTruthy();

				if (conf.difficulties.type === "FIXED") {
					expect(
						conf.difficulties.order.includes(conf.difficulties.default),
						"The default difficulty should be part of difficultyOrder.",
					).toBe(true);
				}

				for (const metric of Object.keys(conf.scoreRatingAlgs)) {
					expect(
						BANNED_METRIC_NAMES.includes(metric),
						`Cannot have a metric called ${metric}. This is a banned metric name.`,
					).toBe(false);

					expect(metric, `Should be alphanumeric.`).toMatch(/^[a-zA-Z][a-zA-Z0-9]+$/u);
				}
			}
		}
	});
});
