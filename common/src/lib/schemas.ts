// Schemas for some objects in tachi. These are exported in a record that maps
// their name in the database to the object they schemaify.
// The schemas themselves are wrapped in functions that throw on error.

import {
	GetGPTString,
	GetGameConfig,
	GetGamePTConfig,
	GetScoreMetrics,
	allGPTStrings,
	allSupportedGames,
} from "../config/config";
import { allImportTypes } from "../constants/import-types";
import { ALL_PERMISSIONS } from "../constants/permissions";
import { UserAuthLevels } from "../types";
import { PrudenceZodShim } from "../utils/util";
import { p } from "prudence";
import type { Game, Playtype, Playtypes } from "../types/game-config";
import type { INTERNAL_GAME_PT_CONFIG } from "../types/internals";
import type { ConfScoreMetric } from "../types/metrics";
import type { NotificationBody } from "../types/notifications";
import type {
	PrudenceSchema,
	ValidSchemaValue,
	ValidationFunctionParentOptionsKeychain,
} from "prudence";

export const optNull = (v: ValidSchemaValue): ValidationFunctionParentOptionsKeychain =>
	p.optional(p.nullable(v));

export const optNullFluffStrField = optNull(p.isBoundedString(3, 140));

/**
 * Wrap a prudence schema in a callable function that takes an unknown item and attempts
 * to validate it.
 */
function prSchemaFnWrap(schema: PrudenceSchema) {
	return (s: unknown): true => {
		const err = p(s, schema);

		if (err) {
			throw err;
		}

		return true;
	};
}

const PR_GAME_STATS = (
	game: Game,
	playtype: Playtypes[Game],
	gptConfig: INTERNAL_GAME_PT_CONFIG
) => ({
	userID: p.isPositiveNonZeroInteger,
	game: p.is(game),
	playtype: p.is(playtype),
	ratings: Object.fromEntries(Object.keys(gptConfig.scoreRatingAlgs).map((s) => [s, "*number"])),
	classes: Object.fromEntries(
		Object.keys(gptConfig.classes).map((e) => [e, p.optional(p.isInteger)])
	),
});

const PR_GOAL_INFO = {
	progress: "?number",
	progressHuman: "string",
	outOf: "number",
	outOfHuman: "string",
	achieved: "boolean",
};

const extractGPTIDString = (self: unknown) => {
	if (typeof self !== "object" || !self) {
		throw new Error("Expected an object.");
	}

	const s = self as Record<string, unknown>;

	if (typeof s.gptString !== "string") {
		throw new Error(`Expected a string where self.gptString is. Got ${s.gptString}`);
	}

	// if there's no ":" in the string, this returns only one element.
	const [game, playtype] = s.gptString.split(":") as [string, string | undefined];

	if (!IsValidGame(game)) {
		throw new Error(`Expected valid game -- got ${game} from gptString ${s.gptString}.`);
	}

	// Playtype might be undefined in the case where the string contains no colon.
	if (playtype === undefined || !IsValidPlaytype(game, playtype)) {
		throw new Error(
			`Expected valid playtype -- got ${playtype} from gptString ${s.gptString}.`
		);
	}

	return { game, playtype };
};

const extractGPT = (self: unknown) => {
	if (typeof self !== "object" || !self) {
		throw new Error("Expected an object.");
	}

	const s = self as Record<string, unknown>;

	if (typeof s.game !== "string") {
		throw new Error(`Expected a string where self.game is. Got ${s.game}`);
	}

	if (typeof s.playtype !== "string") {
		throw new Error(`Expected a string where self.playtype is. Got ${s.playtype}`);
	}

	if (!IsValidGame(s.game)) {
		throw new Error(`Expected valid game -- got ${s.game}.`);
	}

	if (!IsValidPlaytype(s.game, s.playtype)) {
		throw new Error(`Expected valid playtype -- got ${s.playtype}.`);
	}

	return { game: s.game, playtype: s.playtype };
};

function IsValidPlaytype(game: Game, str: string): str is Playtypes[Game] {
	return GetGameConfig(game).playtypes.includes(str as Playtypes[Game]);
}

function IsValidGame(str: string): str is Game {
	return allSupportedGames.includes(str as Game);
}

const getPlaytype = (game: Game, self: unknown): Playtypes[Game] => {
	if (self === null || typeof self !== "object") {
		throw new Error("Expected an object.");
	}

	const gameConfig = GetGameConfig(game);

	const s = self as Record<string, unknown>;

	const playtype = s.playtype as string;

	if (!IsValidPlaytype(game, playtype)) {
		throw new Error(`Expected any of ${gameConfig.playtypes.join(", ")}`);
	}

	return playtype;
};

const games = allSupportedGames;

const isValidPlaytype = (self: unknown, parent: Record<string, unknown>) => {
	if (typeof parent.game !== "string" || !IsValidGame(parent.game)) {
		throw new Error(`Invalid Schema, need game to base IsValidPlaytype off of.`);
	}

	if (typeof self !== "string") {
		return "Expected a string.";
	}

	if (!IsValidPlaytype(parent.game, self)) {
		return `Expected a valid playtype for ${parent.game}`;
	}

	return true;
};

export const PR_GOAL_SCHEMA = (self: unknown) => {
	const { game, playtype } = extractGPT(self);

	return prSchemaFnWrap({
		game: p.isIn(games),
		playtype: isValidPlaytype,
		name: "string",
		goalID: "string",
		criteria: p.or(
			{
				mode: p.is("single"),
				key: (self) => {
					const gptConfig = GetGamePTConfig(game, playtype);
					const metrics = GetScoreMetrics(gptConfig);

					return p.isIn(metrics)(self);
				},
				value: "number",
			},
			{
				mode: p.isIn("absolute", "proportion"),
				countNum: p.isPositive,
				key: (self) => {
					const gptConfig = GetGamePTConfig(game, playtype);
					const metrics = GetScoreMetrics(gptConfig);

					return p.isIn(metrics)(self);
				},
				value: "number",
			}
		),
		charts: p.or(
			{
				type: p.is("folder"),
				data: "string",
			},
			{
				type: p.is("multi"),
				data: ["string"],
			},
			{
				type: p.is("single"),
				data: "string",
			}
		),
	})(self);
};

const PR_SONG_DOCUMENT = (game: Game): PrudenceSchema => {
	const conf = GetGameConfig(game);

	return {
		id: p.isPositiveInteger,
		title: "string",
		artist: "string",
		searchTerms: ["string"],
		altTitles: ["string"],
		data: PrudenceZodShim(conf.songData),
	};
};

const PR_CHART_DOCUMENT = (game: Game) => (self: unknown) => {
	const playtype = getPlaytype(game, self);

	const gptConfig = GetGamePTConfig(game, playtype);

	return prSchemaFnWrap({
		songID: p.isPositiveInteger,
		chartID: "string",

		// TODO REMOVE
		level: "string",
		levelNum: "number",

		isPrimary: "boolean",
		playtype: p.is(playtype),

		difficulty:
			gptConfig.difficulties.type === "DYNAMIC"
				? "string"
				: p.isIn(gptConfig.difficulties.order),

		data: PrudenceZodShim(gptConfig.chartData),

		versions: (self) => {
			if (!Array.isArray(self)) {
				return "Expected an array";
			}

			const versions = Object.keys(gptConfig.versions);

			if (self.find((k) => !versions.includes(k))) {
				return "Array contained invalid versions";
			}

			// yeah, so versions array *shouldn't* be empty, and yet we've ended up
			// in a real, unignorable situation in which a chart has no versions.
			//
			// just allow this, for now.

			// const gameUsesVersions = versions.length > 0;
			//
			// if (gameUsesVersions && self.length === 0) {
			// 	return "Versions array should not be empty as this game uses versions";
			// }

			if (new Set(self).size !== self.length) {
				return "Versions array shouldn't contain the same version twice";
			}

			return true;
		},
	})(self);
};

// Returns true on success, throws on failure.
export type SchemaValidatorFunction = (self: unknown) => true;

type GameSchemas = Record<`${"charts" | "songs"}-${Game}`, SchemaValidatorFunction>;

function CreateGameSchemas() {
	const obj: Partial<GameSchemas> = {};

	for (const game of games) {
		obj[`songs-${game}`] = prSchemaFnWrap(PR_SONG_DOCUMENT(game));
		obj[`charts-${game}`] = PR_CHART_DOCUMENT(game);
	}

	// guaranteed to no longer be partial
	return obj as GameSchemas;
}

const GAME_SCHEMAS = CreateGameSchemas();

const PRE_SCHEMAS = {
	"bms-course-lookup": prSchemaFnWrap({
		title: "string",

		// Must be comprised of 4 md5 hashes, which are 32 chars long.
		md5sums: (self) => {
			if (typeof self !== "string") {
				return "Expected a string";
			}

			if (self.length < 32 * 2) {
				return "Expected at least 2 md5 hashes in a course";
			}

			if (self.length % 32 !== 0) {
				return "Expected mod32 characters (an md5 hash is 32 chars long).";
			}

			if (!/^[a-z0-9]*$/u.exec(self)) {
				return "Expected all chars to be in the range of a-z0-9.";
			}

			return true;
		},
		set: (self, pa) => {
			const parent = pa as any;
			const config = GetGamePTConfig("bms", parent.playtype);

			return p.isIn(Object.keys(config.classes))(self);
		},
		playtype: p.isIn("7K", "14K"),
		value: (self, pa) => {
			const parent = pa as any;
			const config = GetGamePTConfig("bms", parent.playtype);

			return p.isIn(config.classes[parent.set]?.values.map((e) => e.id) ?? [])(self);
		},
	}),
	folders: prSchemaFnWrap({
		title: "string",
		game: p.isIn(games),
		playtype: isValidPlaytype,
		folderID: "string",
		inactive: "boolean",
		searchTerms: ["string"],
		type: p.isIn("songs", "charts", "static"),
		data: (self, parent) => {
			if (parent.type === "songs") {
				return true; // temp. should be a song.
			} else if (parent.type === "charts") {
				return true; // temp. should be a chart.
			}

			return (
				(Array.isArray(self) && self.every((r) => typeof r === "string")) ||
				"Expected an array of only strings."
			);
		},
	}),
	tables: prSchemaFnWrap({
		tableID: "string",
		game: p.isIn(games),
		playtype: isValidPlaytype,
		title: "string",
		default: "boolean",
		description: "string",
		folders: ["string"],
		inactive: "boolean",
	}),
	...GAME_SCHEMAS,
	questlines: prSchemaFnWrap({
		questlineID: "string",
		game: p.isIn(games),
		playtype: isValidPlaytype,
		quests: ["string"],
		name: "string",
		desc: "string",
	}),
	quests: prSchemaFnWrap({
		game: p.isIn(games),
		playtype: isValidPlaytype,
		name: "string",
		desc: "string",
		questID: "string",
		questData: [
			{
				title: "string",
				desc: "*string",
				goals: [{ goalID: "string", note: "*string" }],
			},
		],
	}),
	"goal-subs": prSchemaFnWrap({
		goalID: "string",
		userID: p.isPositiveNonZeroInteger,
		game: p.isIn(games),
		playtype: isValidPlaytype,
		achieved: "boolean",
		timeAchieved: p.nullable(p.isPositive),
		lastInteraction: p.nullable(p.isPositive),
		progress: "?number",
		progressHuman: "string",
		outOf: "number",
		outOfHuman: "string",
		wasInstantlyAchieved: "boolean",
		wasAssignedStandalone: "boolean",
	}),
	"quest-subs": prSchemaFnWrap({
		questID: "string",
		userID: p.isPositiveNonZeroInteger,
		game: p.isIn(games),
		playtype: isValidPlaytype,
		achieved: "boolean",
		timeAchieved: p.nullable(p.isPositive),
		progress: p.isInteger,
	}),
	"recent-folder-views": prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		game: p.isIn(games),
		playtype: isValidPlaytype,
		folderID: "string",
		lastViewed: "number",
	}),
	goals: PR_GOAL_SCHEMA,
	scores: (self: unknown) => {
		const { game, playtype } = extractGPT(self);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap({
			service: "string",
			game: p.is(game),
			playtype: p.is(playtype),
			userID: p.isPositiveNonZeroInteger,
			songID: p.isPositiveInteger,
			chartID: "string",
			isPrimary: "boolean",
			highlight: "boolean",
			comment: "?string",
			timeAdded: p.isInteger,
			scoreID: "string",
			importType: p.nullable(p.isIn(allImportTypes)),
			timeAchieved: p.nullable(p.isPositive),
			scoreData: {
				...PR_METRICS(gptConfig.providedMetrics),
				...PR_METRICS(gptConfig.derivedMetrics),

				judgements: Object.fromEntries(
					gptConfig.orderedJudgements.map((j) => [j, optNull(p.isInteger)])
				),

				optional: PR_METRICS(gptConfig.optionalMetrics, true),
			},

			scoreMeta: PrudenceZodShim(gptConfig.scoreMeta),

			calculatedData: Object.fromEntries(
				Object.keys(gptConfig.scoreRatingAlgs).map((a) => [a, "*?number"])
			),
		})(self);
	},
	"personal-bests": (self: unknown) => {
		const { game, playtype } = extractGPT(self);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap({
			composedFrom: [{ name: "string", scoreID: "string" }],
			rankingData: {
				rank: p.isPositiveNonZeroInteger,
				outOf: p.isPositiveNonZeroInteger,
			},
			userID: p.isPositiveNonZeroInteger,
			chartID: "string",
			game: p.is(game),
			playtype: p.is(playtype),
			songID: p.isPositiveNonZeroInteger,
			highlight: "boolean",
			isPrimary: "boolean",
			timeAchieved: p.nullable(p.isPositive),
			scoreData: {
				...PR_METRICS(gptConfig.providedMetrics),
				...PR_METRICS(gptConfig.derivedMetrics),

				// TODO ENUMINDEXES

				judgements: Object.fromEntries(
					gptConfig.orderedJudgements.map((j) => [j, optNull(p.isInteger)])
				),
				optional: PR_METRICS(gptConfig.optionalMetrics, true),
			},
			calculatedData: Object.fromEntries(
				Object.keys(gptConfig.scoreRatingAlgs).map((a) => [a, "*?number"])
			),
		})(self);
	},
	"user-settings": prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		following: [p.isPositiveNonZeroInteger],
		preferences: {
			invisible: "boolean",
			developerMode: "boolean",
			advancedMode: "boolean",
			contentiousContent: "boolean",
			deletableScores: "boolean",
		},
	}),
	sessions: (self: unknown) => {
		const { game, playtype } = extractGPT(self);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap({
			userID: p.isPositiveNonZeroInteger,
			sessionID: "string",
			name: "string",
			desc: "?string",
			game: p.is(game),
			playtype: isValidPlaytype,
			timeInserted: p.isPositiveInteger,
			timeEnded: p.isPositiveInteger,
			timeStarted: p.isPositiveInteger,
			highlight: "boolean",
			calculatedData: Object.fromEntries(
				Object.keys(gptConfig.sessionRatingAlgs).map((k) => [k, "*?number"])
			),
			scoreIDs: ["string"],
		})(self);
	},
	imports: prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		timeStarted: p.isPositive,
		timeFinished: p.isPositive,
		gptStrings: [p.isIn(allGPTStrings)],
		importID: "string",
		scoreIDs: ["string"],
		game: p.isIn(games),

		// @ts-expect-error We've asserted this is definitely a game.
		playtypes: [(self) => p.isIn(GetGameConfig(self.game).playtypes)(self)],
		errors: [
			{
				type: "string",
				message: "?string",
			},
		],
		createdSessions: [
			{
				sessionID: "string",
				type: p.isIn("Created", "Appended"),
			},
		],
		importType: p.nullable(p.isIn(allImportTypes)),
		classDeltas: [
			{
				game: p.isIn(games),
				playtype: isValidPlaytype,
				set: "string", // Technically false, but the validation is a pain.
				old: p.nullable(p.isInteger),
				new: p.isInteger,
			},
		],
		goalInfo: [
			{
				goalID: "string",
				old: PR_GOAL_INFO,
				new: PR_GOAL_INFO,
			},
		],
		questInfo: [
			{
				questID: "string",
				old: { progress: p.isInteger, achieved: "boolean" },
				new: { progress: p.isInteger, achieved: "boolean" },
			},
		],
		userIntent: "boolean",
	}),
	counters: prSchemaFnWrap({
		counterName: "string",
		value: p.isPositiveInteger,
	}),
	"score-blacklist": prSchemaFnWrap({
		scoreID: "string",
		userID: p.isPositiveNonZeroInteger,
		score: p.any,
	}),
	"game-stats": (self: unknown) => {
		const { game, playtype } = extractGPT(self);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap(PR_GAME_STATS(game, playtype, gptConfig))(self);
	},
	"game-stats-snapshots": (self: unknown) => {
		const { game, playtype } = extractGPT(self);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap(
			Object.assign(PR_GAME_STATS(game, playtype, gptConfig), {
				rankings: Object.fromEntries(
					Object.keys(gptConfig.profileRatingAlgs).map((e) => [
						e,
						{ outOf: p.isPositiveNonZeroInteger, ranking: p.isPositiveNonZeroInteger },
					])
				),
				playcount: p.isPositiveInteger,
				timestamp: p.isPositive,
			})
		)(self);
	},
	"game-settings": (s: unknown) => {
		const { game, playtype } = extractGPT(s);

		const gptConfig = GetGamePTConfig(game, playtype);

		return prSchemaFnWrap({
			userID: p.isPositiveNonZeroInteger,
			game: p.is(game),
			playtype: p.is(playtype),
			rivals: [p.isPositiveNonZeroInteger],
			preferences: {
				preferredScoreAlg: p.nullable(p.isIn(Object.keys(gptConfig.scoreRatingAlgs))),
				preferredSessionAlg: p.nullable(p.isIn(Object.keys(gptConfig.sessionRatingAlgs))),
				preferredProfileAlg: p.nullable(p.isIn(Object.keys(gptConfig.profileRatingAlgs))),

				// ouch
				stats: p.and(
					[
						p.or(
							{
								mode: p.is("chart"),
								chartID: "string",
								property: p.isIn("score", "percent", "grade", "lamp", "playcount"),
							},
							{
								mode: p.is("folder"),
								folderID: p.or("string", ["string"]),
								property: p.isIn("score", "percent", "grade", "lamp"),
								gte: p.isPositive,
							}
						),
					],
					(self) => Array.isArray(self) && self.length <= 6
				),
				preferredDefaultEnum: p.isIn(null, "grade", "lamp"),
				defaultTable: p.nullable("string"),
				preferredRanking: p.isIn("global", "rival", null),

				gameSpecific: PrudenceZodShim(gptConfig.preferences),
			},
		})(s);
	},
	"folder-chart-lookup": prSchemaFnWrap({
		chartID: "string",
		folderID: "string",
	}),
	"class-achievements": prSchemaFnWrap({
		game: p.isIn(games),
		playtype: isValidPlaytype,
		classSet: (self, parent) => {
			const gptConfig = GetGamePTConfig(
				parent.game as Game,
				parent.playtype as Playtypes[Game]
			);

			const keys = Object.keys(gptConfig.classes);

			if (typeof self !== "string") {
				return "Expected a string.";
			}

			if (!keys.includes(self)) {
				return `Expected any of ${keys.join(", ")}`;
			}

			return true;
		},
		classOldValue: p.nullable(p.isInteger),
		classValue: p.isInteger,
		timeAchieved: p.isPositive,
		userID: p.isPositiveNonZeroInteger,
	}),
	"fer-settings": prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		cards: p.nullable(
			(self) =>
				Array.isArray(self) && self.length <= 6 && self.every((t) => typeof t === "string")
		),
		forceStaticImport: "boolean",
	}),
	"kshook-sv6c-settings": prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		forceStaticImport: "boolean",
	}),
	users: prSchemaFnWrap({
		username: p.regex(/^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u),
		usernameLowercase: (self, parent) => self === (parent.username as string).toLowerCase(),
		id: p.isPositiveInteger,
		socialMedia: {
			discord: "*?string",
			twitter: "*?string",
			github: "*?string",
			steam: "*?string",
			youtube: "*?string",
			twitch: "*?string",
		},
		joinDate: p.isPositiveInteger,
		about: p.isBoundedString(0, 2000),
		status: p.nullable(p.isBoundedString(3, 140)),
		customPfpLocation: "?string",
		customBannerLocation: "?string",
		lastSeen: p.isPositiveInteger,
		badges: [p.isIn("beta", "alpha", "dev-team")],
		authLevel: p.isBoundedInteger(UserAuthLevels.BANNED, UserAuthLevels.ADMIN),
	}),
	"api-tokens": prSchemaFnWrap({
		userID: p.nullable(p.isPositiveNonZeroInteger),
		token: "?string",
		identifier: "string",
		permissions: (self) => {
			if (typeof self !== "object" || !self) {
				return `Invalid permissions - expected an object.`;
			}

			// Typescript moment...
			const s = self as Record<string, unknown>;

			for (const key of Object.keys(ALL_PERMISSIONS)) {
				if (s[key] !== undefined && typeof s[key] !== "boolean") {
					return `Invalid permission value of ${s[key]} at ${key}.`;
				}
			}

			return true;
		},
		fromOAuth2Client: "*string",
	}),
	"user-private-information": prSchemaFnWrap({
		userID: p.isPositiveNonZeroInteger,
		password: "string",
		email: "string",
	}),
	"orphan-chart-queue": (self: unknown) => {
		const { game } = extractGPTIDString(self);

		return prSchemaFnWrap({
			gptString: p.isIn(allGPTStrings),
			chartDoc: PR_CHART_DOCUMENT(game),
			songDoc: PR_SONG_DOCUMENT(game),
			userIDs: [p.isPositiveNonZeroInteger],
		})(self);
	},
	"api-clients": prSchemaFnWrap({
		clientID: "string",
		clientSecret: "string",
		name: "string",
		author: p.isPositiveNonZeroInteger,
		requestedPermissions: [p.isIn(Object.keys(ALL_PERMISSIONS))],
		redirectUri: "?string",
		webhookUri: "?string",
		apiKeyTemplate: p.nullable((self) => {
			if (typeof self !== "string") {
				return "Expected a string.";
			}

			if (!self.includes("%%TACHI_KEY%%")) {
				return "Template must include %%TACHI_KEY%%.";
			}

			return true;
		}),
		apiKeyFilename: "?string",
	}),
	"import-timings": prSchemaFnWrap({
		importID: "string",
		timestamp: p.isPositive,
		total: p.isPositive,
		rel: Object.fromEntries(
			["import", "importParse", "session", "pb"].map((k) => [k, p.isPositive])
		),
		abs: Object.fromEntries(
			["parse", "import", "importParse", "session", "pb", "ugs", "goal", "quest"].map((k) => [
				k,
				p.isPositive,
			])
		),
	}),
	invites: prSchemaFnWrap({
		createdBy: p.isPositiveInteger,
		code: "string",
		createdAt: p.isPositive,
		consumed: "boolean",
		consumedBy: (self, parent) => {
			if (parent.consumed === true) {
				return self === null;
			}

			return p.isPositiveInteger(self);
		},
		consumedAt: (self, parent) => {
			if (parent.consumed === true) {
				return self === null;
			}

			return p.isPositive(self);
		},
	}),

	notifications: prSchemaFnWrap({
		title: "string",
		notifID: "string",
		sentTo: p.isPositiveNonZeroInteger,
		sentAt: p.isPositive,
		read: "boolean",
		body: {
			type: p.isIn("RIVALED_BY", "QUEST_CHANGED"),
			content: (self, parent) => {
				const type = parent.type as NotificationBody["type"];

				let subSchema = {};

				switch (type) {
					case "RIVALED_BY": {
						subSchema = {
							userID: p.isPositiveNonZeroInteger,
							game: p.isIn(games),
							playtype: isValidPlaytype,
						};
						break;
					}

					case "QUEST_CHANGED": {
						subSchema = {
							questID: "string",
						};
						break;
					}

					case "SITE_ANNOUNCEMENT": {
						subSchema = {};
						break;
					}
				}

				const err = p(self, subSchema);

				if (err) {
					return "Invalid notification.body";
				}

				return true;
			},
		},
	}),
} as const satisfies Record<string, SchemaValidatorFunction>;

export const SCHEMAS: Record<keyof typeof PRE_SCHEMAS, SchemaValidatorFunction> = PRE_SCHEMAS;

const PR_BATCH_MANUAL_SCORE = (game: Game, playtype: Playtype): PrudenceSchema => {
	const gptConfig = GetGamePTConfig(game, playtype);

	return {
		...PR_METRICS(gptConfig.providedMetrics),

		matchType: p.isIn(
			"songTitle",
			"tachiSongID",
			"bmsChartHash",
			"itgChartHash",
			"sdvxInGameID",
			"inGameID",
			"inGameStrID",
			"uscChartHash",
			"popnChartHash",
			"ddrSongHash"
		),
		identifier: "string",
		comment: optNull(p.isBoundedString(3, 240)),
		difficulty: "*?string",
		artist: "*?string",

		// this is checked in converting instead
		// the lowest acceptable time is september 9th 2001 - this check saves people who dont
		// read any documentation and would otherwise submit garbage.
		timeAchieved: optNull(
			(self) =>
				(typeof self === "number" && self > 1_000_000_000_000) ||
				self === 0 ||
				"Expected a number greater than 1 Trillion - did you pass unix seconds instead of milliseconds?"
		),
		judgements: optNull((self) => {
			if (typeof self !== "object" || self === null) {
				return "Not a valid object.";
			}

			for (const [key, v] of Object.entries(self)) {
				if (!gptConfig.orderedJudgements.includes(key)) {
					return `Invalid Key ${key}. Expected any of ${gptConfig.orderedJudgements.join(
						", "
					)}`;
				}

				if ((!Number.isSafeInteger(v) || v < 0) && v !== null) {
					return `Key ${key} had an invalid value of ${v} [type: ${typeof v}]`;
				}
			}

			return true;
		}),
		optional: optNull(PR_METRICS(gptConfig.optionalMetrics, true)),
		hitMeta: optNull(PR_METRICS(gptConfig.optionalMetrics, true)),
		scoreMeta: optNull(PrudenceZodShim(gptConfig.scoreMeta)),
	};
};

function PR_METRIC(metric: ConfScoreMetric): ValidSchemaValue {
	switch (metric.type) {
		case "DECIMAL":
			return "number";

		case "INTEGER":
			return p.isInteger;

		case "GRAPH":
			return ["number"];

		case "ENUM":
			return p.isIn(metric.values);

		case "NULLABLE_GRAPH":
			return ["?number"];
	}
}

function PR_METRICS(metrics: Record<string, ConfScoreMetric>, shouldAllBeOptNull?: boolean) {
	const schema: PrudenceSchema = {};

	for (const [key, value] of Object.entries(metrics)) {
		let prValidator = PR_METRIC(value);

		if ("validate" in value) {
			switch (value.type) {
				case "DECIMAL":
				case "INTEGER": {
					prValidator = p.and(
						prValidator,
						(self) => typeof self === "number" && value.validate(self)
					);
					break;
				}

				case "GRAPH": {
					prValidator = p.and(prValidator, [
						(self) => typeof self === "number" && value.validate(self),
					]);
					break;
				}

				case "NULLABLE_GRAPH":
					prValidator = p.and(prValidator, [
						(self) =>
							self === null || (typeof self === "number" && value.validate(self)),
					]);
			}
		}

		if (shouldAllBeOptNull === true) {
			schema[key] = optNull(prValidator);
		} else {
			schema[key] = prValidator;
		}
	}

	return schema;
}

const PR_BATCH_MANUAL_CLASSES = (game: Game, playtype: Playtype): PrudenceSchema => {
	const config = GetGamePTConfig(game, playtype);

	const schema: PrudenceSchema = {};

	// for all classes this GPT supports
	// if `canBeBatchManualSubmitted` is true, allow it to be batchManualSubmitted.
	for (const [s, v] of Object.entries(config.classes)) {
		if (v.type === "PROVIDED") {
			schema[s] = optNull(p.isIn(v.values.map((e) => e.id)));
		}
	}

	return schema;
};

export const PR_BATCH_MANUAL = (game: Game, playtype: Playtype): PrudenceSchema => ({
	meta: {
		service: p.isBoundedString(3, 60),
		game: p.isIn(allSupportedGames),
		playtype: p.is(playtype),
		version: "*?string",
	},
	scores: [PR_BATCH_MANUAL_SCORE(game, playtype)],
	classes: optNull(PR_BATCH_MANUAL_CLASSES(game, playtype)),
});

export const PR_RESOLVER: PrudenceSchema = {
	matchType: p.isIn(
		"songTitle",
		"tachiSongID",
		"bmsChartHash",
		"itgChartHash",
		"sdvxInGameID",
		"inGameID",
		"inGameStrID",
		"uscChartHash",
		"popnChartHash",
		"ddrSongHash"
	),
	identifier: "string",
	comment: optNull(p.isBoundedString(3, 240)),

	// extra disambiguators
	difficulty: "*?string",
	artist: "*?string",
	version: "*?string",
};
