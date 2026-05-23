import type { DryScore } from "#lib/score-import/framework/common/types";
import type { S3Score } from "#lib/score-import/import-types/file/solid-state-squad/types";
import type {
	BarbatosScore,
	BarbatosSDVX6Score,
} from "#lib/score-import/import-types/ir/barbatos/types";
import type { FervidexScore } from "#lib/score-import/import-types/ir/fervidex/types";
import type { KsHookSV6CScore } from "#lib/score-import/import-types/ir/kshook-sv6c/types";
import type { KsHookSV6CStaticScore } from "#lib/score-import/import-types/ir/kshook-sv6c-static/types";
import type { LR2HookScore } from "#lib/score-import/import-types/ir/lr2hook/types";
import type { USCClientScore } from "#server/router/ir/usc/_playtype/types";

import {
	USC_DEFAULT_HOLD,
	USC_DEFAULT_MISS,
	USC_DEFAULT_NEAR,
	USC_DEFAULT_PERFECT,
	USC_DEFAULT_SLAM,
} from "#lib/constants/usc-ir";
import { ApplyNTimes, RFA } from "#utils/misc";
import fs from "fs";
import path from "path";
import {
	type ChartDocument,
	CHUNITHM_CLEAR_LAMPS,
	CHUNITHM_GRADES,
	CHUNITHM_NOTE_LAMPS,
	type FolderDocument,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type ImportDocument,
	type NotificationDocument,
	type PBScoreDocument,
	type QuestDocument,
	type QuestSubscriptionDocument,
	type ScoreDocument,
	type SongDocument,
	type UGPTSettingsDocument,
	type UserDocument,
} from "tachi-common";

import { dmf } from "./misc";

const file = (name: string) => path.join(__dirname, "/test-data", name);

export const GetKTDataJSON = (name: string) =>
	JSON.parse(fs.readFileSync(file(name), "utf-8")) as unknown;

export const GetKTDataBuffer = (name: string) => fs.readFileSync(file(name));

export const TestingIIDXSPDryScore: DryScore<"iidx-sp"> = {
	service: "e-amusement",
	game: "iidx-sp",
	scoreData: {
		score: 786,
		lamp: "CLEAR",
		judgements: {
			pgreat: 50,
			great: 10,
		},
		optional: {},
	},
	scoreMeta: {},
	timeAchieved: null,
	comment: null,
	importType: "file/eamusement-iidx-csv",
};

export const TestingIIDXSPScorePB: PBScoreDocument<"iidx-sp"> = {
	chartID: "c2311194e3897ddb5745b1760d2c0141f933e683",
	userID: 1,
	calculatedData: {
		BPI: 10.1,
		ktLampRating: 0,
		ktLampRatingHC: 0,
		ktLampRatingEXHC: 0,
	},
	composedFrom: [{ name: "Best Score", scoreID: "TESTING_SCORE_ID" }],
	highlight: false,
	isPrimary: true,
	scoreData: {
		score: 1479,
		percent: 94.08396946564885,
		grade: "AAA",
		lamp: "EX HARD CLEAR",
		enumIndexes: {
			grade: 7,
			lamp: 6,
		},
		judgements: {
			pgreat: 697,
			great: 85,
		},
		optional: {
			bp: 2,
			enumIndexes: {},
		},
	},
	rankingData: {
		rank: 1,
		outOf: 2,
		rivalRank: null,
	},
	songID: "s1",
	game: "iidx-sp",
	timeAchieved: 10000,
};

export const TestingDDRSPScorePB: PBScoreDocument<"ddr-sp"> = {
	calculatedData: {
		flareSkill: 545,
	},
	chartID: "f14bc72ad8336625ce64fc42571192e1ec168113",
	composedFrom: [
		{
			name: "Best Score",
			scoreID: "Te065000f08b49458f8b0aa3eabf0b857b79c562d7cf9eb34f6dabd7a1c3c3fa6",
		},
	],
	game: "ddr-sp",
	highlight: false,
	isPrimary: true,
	rankingData: {
		rank: 1,
		outOf: 1,
		rivalRank: null,
	},
	scoreData: {
		score: 914400,
		lamp: "CLEAR",
		judgements: {},
		optional: {
			enumIndexes: {},
		},
		grade: "AA",
		enumIndexes: {
			lamp: 2,
			grade: 13,
		},
	},
	songID: "s37691",
	timeAchieved: null,
	userID: 1,
};

export const TestingJubeatPB: PBScoreDocument<"jubeat"> = {
	chartID: "b90a319f18d1a746b330b8f4cd6f74874f664421",
	userID: 1,
	calculatedData: {
		jubility: 5,
	},
	composedFrom: [{ name: "Best Score", scoreID: "TESTING_SCORE_ID" }],
	highlight: false,
	isPrimary: true,
	scoreData: {
		score: 986_000,
		musicRate: 94.11,
		grade: "A",
		lamp: "CLEAR",
		enumIndexes: {
			grade: 7,
			lamp: 6,
		},
		judgements: {},
		optional: {
			enumIndexes: {},
		},
	},
	rankingData: {
		rank: 1,
		outOf: 2,
		rivalRank: null,
	},
	songID: "s1",
	game: "jubeat",
	timeAchieved: 10000,
};

export const TestingIIDXSPScore: ScoreDocument<"iidx-sp"> = {
	service: "foo (DIRECT-MANUAL)",
	game: "iidx-sp",
	userID: 1,
	scoreData: {
		score: 786,
		lamp: "CLEAR",
		percent: 50,
		grade: "C",
		enumIndexes: {
			grade: 3,
			lamp: 4,
		},
		judgements: {
			pgreat: 50,
			great: 10,
		},
		optional: {
			enumIndexes: {},
		},
	},
	scoreMeta: {},
	calculatedData: {
		BPI: null,
		ktLampRating: 10,
		ktLampRatingHC: 0,
		ktLampRatingEXHC: 0,
	},
	timeAchieved: 1619454485988,
	songID: "s1",
	chartID: "c2311194e3897ddb5745b1760d2c0141f933e683",
	highlight: false,
	isPrimary: true,
	comment: null,
	timeAdded: 1,
	scoreID: "TESTING_SCORE_ID",
	sessionID: null,
	importType: "ir/direct-manual",
};

export const TestingDDRSPScore: ScoreDocument<"ddr-sp"> = {
	calculatedData: {
		flareSkill: 545,
	},
	chartID: "2fc2e0cfdda42addb7840b58be1df1f545310d66",
	comment: null,
	game: "ddr-sp",
	highlight: false,
	importType: "file/batch-manual",
	isPrimary: true,
	scoreData: {
		score: 914400,
		lamp: "CLEAR",
		judgements: {},
		optional: {
			enumIndexes: {},
		},
		grade: "AA",
		enumIndexes: {
			lamp: 2,
			grade: 13,
		},
	},
	scoreID: "Te065000f08b49458f8b0aa3eabf0b857b79c562d7cf9eb34f6dabd7a1c3c3fa6",
	sessionID: null,
	scoreMeta: {},
	service: "History (BATCH-MANUAL)",
	songID: "s10",
	timeAchieved: null,
	timeAdded: 1722084133807,
	userID: 1,
};

export const TestingSDVXScore: ScoreDocument<"sdvx"> = {
	service: "foo (DIRECT-MANUAL)",
	game: "sdvx",
	userID: 1,
	scoreData: {
		score: 786,
		lamp: "CLEAR",
		grade: "C",
		enumIndexes: {
			grade: 3,
			lamp: 4,
		},
		judgements: {},
		optional: {
			enumIndexes: {},
		},
	},
	scoreMeta: {},
	calculatedData: {},
	timeAchieved: 1619454485988,
	songID: "s1",

	// albida adv
	chartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	highlight: false,
	isPrimary: true,
	comment: null,
	timeAdded: 1,
	scoreID: "TESTING_SCORE_SDVX_ID",
	sessionID: null,
	importType: "ir/direct-manual",
};

export const TestingSDVXPB: PBScoreDocument<"sdvx"> = {
	game: "sdvx",
	userID: 1,
	scoreData: {
		score: 786,
		lamp: "CLEAR",
		grade: "C",
		enumIndexes: {
			grade: 3,
			lamp: 4,
		},
		judgements: {},
		optional: {
			enumIndexes: {},
		},
	},
	calculatedData: {},
	timeAchieved: 1619454485988,
	songID: "s1",

	// albida adv
	chartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	highlight: false,
	isPrimary: true,
	composedFrom: [{ name: "Best Score", scoreID: "score_1 " }],
	rankingData: {
		outOf: 1,
		rank: 1,
		rivalRank: null,
	},
};

export const TestingSDVXAlbidaSong: SongDocument<"sdvx"> = {
	title: "ALBIDA Powerless Mix",
	artist: "無力P",
	id: "s1",
	altTitles: [],
	searchTerms: ["albida_muryoku", "ｱﾙﾋﾞﾀﾞﾊﾟﾜｰﾚｽﾐｯｸｽ"],
	data: {
		displayVersion: "booth",
	},
};

export const TestingSDVXAlbidaChart: ChartDocument<"sdvx"> = {
	game: "sdvx",
	chartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	legacyChartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	difficulty: "ADV",
	song: TestingSDVXAlbidaSong,
	levelNum: 10,
	level: "10",
	data: {
		inGameID: 1,
		clearTier: null,
	},
	isPrimary: true,
	versions: ["booth", "inf", "gw", "heaven", "vivid", "exceed", "konaste"],
};

export const TestingKsHookSV6CScore: KsHookSV6CScore = {
	clear: "CLEAR_EXCESSIVE",
	critical: 1184,
	difficulty: "DIFFICULTY_ADVANCED",
	error: 30,
	gauge: 71,
	grade: "GRADE_AA_PLUS",
	max_chain: 158,
	music_id: 1,
	near: 46,
	rate: "RATE_EXCESSIVE",
	score: 9579365,
	track_no: 0,
	ex_score: 1334,
	retry_count: 0,
};

export const TestingKsHookSV6CStaticScore: KsHookSV6CStaticScore = {
	clear: "CLEAR_EXCESSIVE",
	difficulty: "DIFFICULTY_ADVANCED",
	grade: "GRADE_AA_PLUS",
	max_chain: 158,
	music_id: 1,
	score: 9579365,
	ex_score: 1334,
	timestamp: 1000,
};

export const TestingBMS7KScore: ScoreDocument<"bms-7k"> = {
	calculatedData: {
		sieglinde: 20,
	},
	chartID: "88eb6cc5683e2740cbd07f588a5f3db1db8d467b",
	songID: "s27339",
	comment: null,
	game: "bms-7k",
	highlight: false,
	importType: "ir/beatoraja",
	isPrimary: true,
	scoreData: {
		grade: "A",
		judgements: {},
		lamp: "HARD CLEAR",
		percent: 40,
		score: 1030,
		enumIndexes: {
			lamp: 4,
			grade: 5,
		},
		optional: {
			enumIndexes: {},
		},
	},
	scoreID: "test_bms_score",
	sessionID: null,
	scoreMeta: {},
	service: "foo",
	timeAchieved: null,
	timeAdded: 100,
	userID: 1,
};

export const TestingLR2HookScore: LR2HookScore = {
	md5: "38616b85332037cc12924f2ae2840262",
	playerData: {
		autoScr: 0,
		gameMode: "7K",
		random: "RAN",
		gauge: "GROOVE",
		rseed: undefined,
	},
	scoreData: {
		pgreat: 1100,
		great: 900,
		good: 200,
		bad: 50,
		poor: 6,
		exScore: 2500,
		maxCombo: 50,
		moneyScore: 150_000,
		notesTotal: 2256,
		notesPlayed: 2256,
		lamp: "HARD",
		hpGraph: ApplyNTimes(1000, () => RFA([100, 50, 80, 0])),
		extendedJudgements: undefined,
		extendedHpGraphs: undefined,
	},
	unixTimestamp: undefined,
};

export const TestingJubeatSong: SongDocument<"jubeat"> = {
	altTitles: [],
	artist: "Ryu☆",
	data: {
		displayVersion: "jubeat",
	},
	id: "S19d35e0ca47f0639c3b",
	searchTerms: [],
	title: "bass 2 bass",
};

export const TestingJubeatChart: ChartDocument<"jubeat"> = {
	game: "jubeat",
	chartID: "b90a319f18d1a746b330b8f4cd6f74874f664421",
	legacyChartID: "b90a319f18d1a746b330b8f4cd6f74874f664421",
	song: TestingJubeatSong,
	level: "6",
	levelNum: 6,
	difficulty: "ADV",
	isPrimary: true,
	data: {
		inGameID: 10000001,
		noteCount: 100,
		musicBar: [0, 1, 2, 3],
	},
	versions: ["festo"],
};

export const TestingGitadoraSong: SongDocument<"gitadora"> = {
	altTitles: [],
	artist: "ELIZABETH DOBBS",
	data: {},
	id: "S19d35e0c4eebf35c1d0",
	searchTerms: ["I THINK ABOUT Y"],
	title: "I think about you",
};

export const TestingGitadoraChart: ChartDocument<"gitadora-dora"> = {
	game: "gitadora-dora",
	chartID: "bf62dd6c78afaf6b4f95cce70b5b08af193c0c57",
	legacyChartID: "bf62dd6c78afaf6b4f95cce70b5b08af193c0c57",
	data: {
		inGameID: 0,
	},
	difficulty: "ADVANCED",
	isPrimary: true,
	level: "4.75",
	levelNum: 4.75,
	song: TestingGitadoraSong,
	versions: ["konaste"],
};

export const TestingMaimaiSong: SongDocument<"maimai"> = {
	altTitles: [],
	artist: "Kai/classical “Air on the G String”",
	data: {
		artistJP: "Kai/クラシック「G線上のアリア」",
		displayVersion: "maimai",
		titleJP: "True Love Song",
	},
	id: "S19d35e0cf682287eabb",
	searchTerms: [],
	title: "True Love Song",
};

export const TestingMaimaiChart: ChartDocument<"maimai"> = {
	game: "maimai",
	chartID: "6e087e5f58519a2697374b9bff776a004046e952",
	legacyChartID: "6e087e5f58519a2697374b9bff776a004046e952",
	data: {
		inGameID: 834,
		inGameStrID: "pandora_paradoxxx",
		maxPercent: 100.78,
	},
	difficulty: "Master",
	isPrimary: true,
	level: "13+",
	levelNum: 13.9,
	song: TestingMaimaiSong,
	versions: ["finale"],
};

export const TestingMaimaiDXSong: SongDocument<"maimaidx"> = {
	altTitles: [],
	artist: "Kai/クラシック「G線上のアリア」",
	data: {
		duration: 97.6,
		genre: "maimai",
	},
	id: "S19d35e0d483de1de978",
	searchTerms: [],
	title: "True Love Song",
};

export const TestingMaimaiDXChart: ChartDocument<"maimaidx"> = {
	game: "maimaidx",
	chartID: "fbde73d543f93cbad9ec67052a7165700c5c8df6",
	legacyChartID: "fbde73d543f93cbad9ec67052a7165700c5c8df6",
	data: {
		displayVersion: "maimai",
		inGameID: 1,
	},
	difficulty: "Advanced",
	isPrimary: true,
	level: "7",
	levelNum: 7,
	song: TestingMaimaiDXSong,
	versions: ["universeplus", "festival"],
};

export const TestingMusecaSong: SongDocument<"museca"> = {
	altTitles: [],
	artist: "Last Note. feat. GUMI",
	data: {
		artistJP: "ﾗｽﾄﾉｰﾄﾌｨｰﾁｬﾘﾝｸﾞｸﾞﾐ",
		displayVersion: "1",
		titleJP: "ｾﾂﾅﾄﾘｯﾌﾟ",
	},
	id: "S19d35e0b424a871d843",
	searchTerms: [],
	title: "セツナトリップ",
};

export const TestingMusecaChart: ChartDocument<"museca"> = {
	game: "museca",
	chartID: "4f3a7bf907f7be54a0c531dd9077e58fd7b6bb9c",
	legacyChartID: "4f3a7bf907f7be54a0c531dd9077e58fd7b6bb9c",
	data: {
		inGameID: 1,
	},
	difficulty: "Red",
	isPrimary: true,
	level: "13",
	levelNum: 13,
	song: TestingMusecaSong,
	versions: ["1.5", "1.5-b"],
};

export const TestingPopnSong: SongDocument<"popn"> = {
	altTitles: [],
	artist: "SUGI & REO",
	data: {
		displayVersion: null,
		genre: "ポップス",
		genreEN: "POPS",
	},
	id: "S19d35e0d9d5fa4f67e0",
	searchTerms: [],
	title: "I REALLY WANT TO HURT YOU",
};

export const TestingPopnChart: ChartDocument<"popn"> = {
	game: "popn",
	chartID: "7489166ddfb6ec780249823d5bda255611fbc528",
	legacyChartID: "7489166ddfb6ec780249823d5bda255611fbc528",
	data: {
		hashSHA256: "83287260cb32c5c54b06b76967ba8620dd3735063959d9fbaf2cffc0dba8a049",
		inGameID: 0,
	},
	difficulty: "EX",
	isPrimary: true,
	level: "38",
	levelNum: 38,
	song: TestingPopnSong,
	versions: ["peace", "kaimei"],
};

export const Testing511Song: SongDocument<"iidx"> = {
	title: "5.1.1.",
	artist: "dj nagureo",
	id: "s1",
	altTitles: [],
	searchTerms: [],
	data: {
		genre: "PIANO AMBIENT",
		displayVersion: "1",
	},
};

export const Testing511SPA: ChartDocument<"iidx-sp"> = {
	game: "iidx-sp",
	chartID: "c2311194e3897ddb5745b1760d2c0141f933e683",
	legacyChartID: "c2311194e3897ddb5745b1760d2c0141f933e683",
	difficulty: "ANOTHER",
	song: Testing511Song,
	levelNum: 10,
	level: "10",
	data: {
		inGameID: 1000,
		notecount: 786,
		"2dxtraSet": null,
		hashSHA256: null,
		bpiCoefficient: null,
		kaidenAverage: null,
		worldRecord: null,
		exhcTier: null,
		hcTier: null,
		ncTier: null,
	},
	isPrimary: true,
	versions: [
		"27-omni",
		"26-omni",
		"27",
		"26",
		"inf",
		"16-cs",
		"12-cs",
		"10-cs",
		"8-cs",
		"7-cs",
		"bmus",
	],
};

export const TestingDDRSong: SongDocument<"ddr"> = {
	altTitles: [],
	artist: "UZI-LAY",
	data: {
		flareCategory: "CLASSIC",
		inGameID: 10,
	},
	id: "s10",
	searchTerms: [],
	title: "PUT YOUR FAITH IN ME",
};

export const TestingDDRSP: ChartDocument<"ddr-sp"> = {
	game: "ddr-sp",
	chartID: "2fc2e0cfdda42addb7840b58be1df1f545310d66",
	legacyChartID: "2fc2e0cfdda42addb7840b58be1df1f545310d66",
	data: {
		inGameID: 10,
	},
	difficulty: "BASIC",
	isPrimary: true,
	level: "6",
	levelNum: 6,
	song: TestingDDRSong,
	versions: ["a3"],
};

export const TestingAlbidaADV: ChartDocument<"sdvx"> = {
	game: "sdvx",
	chartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	legacyChartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
	difficulty: "ADV",
	song: TestingSDVXAlbidaSong,
	levelNum: 10,
	level: "10",
	data: {
		inGameID: 1,
		clearTier: null,
	},
	isPrimary: true,
	versions: ["booth", "inf", "gw", "heaven", "vivid", "exceed", "konaste"],
};

export const BMSGazerSong: SongDocument<"bms"> = {
	id: "s27339",
	title: "gazer [MANIAQ]",
	artist: "scytheleg / obj.siokaze",
	data: {
		subtitle: null,
		subartist: null,
		genre: "ELECTRANCE",
		tableString: null,
	},
	searchTerms: [],
	altTitles: [],
};

export const BMSGazerChart: ChartDocument<"bms-7k"> = {
	game: "bms-7k",
	song: BMSGazerSong,
	chartID: "88eb6cc5683e2740cbd07f588a5f3db1db8d467b",
	legacyChartID: "88eb6cc5683e2740cbd07f588a5f3db1db8d467b",
	data: {
		aiLevel: "0",
		notecount: 2256,
		hashMD5: "38616b85332037cc12924f2ae2840262",
		hashSHA256: "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d",
		tableFolders: {
			"★": "17",
		},
		sglEC: null,
		sglHC: null,
	},
	level: "?",
	levelNum: 0,
	difficulty: "CHART",
	isPrimary: true,
	versions: [],
};

export const CHUNITHMBBKKSong: SongDocument<"chunithm"> = {
	altTitles: [],
	artist: "nora2r",
	data: {
		genre: "VARIETY",
		duration: 128.541,
	},
	id: "S19d35e0b935765ded25",
	searchTerms: [],
	title: "B.B.K.K.B.K.K.",
};

export const CHUNITHMBBKKChart: ChartDocument<"chunithm"> = {
	game: "chunithm",
	chartID: "192b96bdb6150f80ba6412ce02df1249e16c0cb0",
	legacyChartID: "192b96bdb6150f80ba6412ce02df1249e16c0cb0",
	difficulty: "BASIC",
	song: CHUNITHMBBKKSong,
	levelNum: 3,
	level: "3",
	data: {
		displayVersion: "CHUNITHM",
		inGameID: 3,
	},
	isPrimary: true,
	versions: ["paradiselost"],
};

export const TestingChunithmScorePB: PBScoreDocument<"chunithm"> = {
	chartID: "192b96bdb6150f80ba6412ce02df1249e16c0cb0",
	userID: 1,
	calculatedData: {
		rating: 5,
	},
	composedFrom: [{ name: "Best Score", scoreID: "TESTING_SCORE_ID" }],
	highlight: false,
	isPrimary: true,
	scoreData: {
		score: 1010000,
		clearLamp: "BRAVE",
		noteLamp: "ALL JUSTICE CRITICAL",
		grade: "SSS+",
		enumIndexes: {
			grade: CHUNITHM_GRADES.SSS_PLUS,
			clearLamp: CHUNITHM_CLEAR_LAMPS.BRAVE,
			noteLamp: CHUNITHM_NOTE_LAMPS.ALL_JUSTICE_CRITICAL,
		},
		judgements: {},
		optional: {
			enumIndexes: {},
		},
	},
	rankingData: {
		rank: 1,
		outOf: 1,
		rivalRank: null,
	},
	songID: "s3",
	game: "chunithm",
	timeAchieved: 10000,
};

export const TestingDoraChart: ChartDocument<"gitadora-dora"> = {
	game: "gitadora-dora",
	song: TestingGitadoraSong,
	chartID: "29f0bfab357ba54e3fd0176fb3cbc578c9ec8df5",
	legacyChartID: "29f0bfab357ba54e3fd0176fb3cbc578c9ec8df5",
	difficulty: "BASIC",
	levelNum: 1.6,
	level: "1.60",
	data: {
		inGameID: 0,
	},
	isPrimary: true,
	versions: ["konaste"],
};

export const TestingWaccaPupaSong: SongDocument<"wacca"> = {
	id: "s77",
	title: "PUPA",
	artist: "モリモリあつし",
	data: {
		displayVersion: "lilyr",
		genre: "バラエティ",
	},
	searchTerms: [],
	altTitles: [],
};

export const TestingWaccaPupaExp: ChartDocument<"wacca"> = {
	game: "wacca",
	song: TestingWaccaPupaSong,
	chartID: "2abcf2da86f3d968dbe07695ab7ebf6b79cb0841",
	legacyChartID: "2abcf2da86f3d968dbe07695ab7ebf6b79cb0841",
	difficulty: "EXPERT",
	levelNum: 13.7,
	level: "13+",
	data: {
		inGameID: 2085,
	},
	isPrimary: true,
	versions: ["reverse"],
};

export const TestingSDVXSingleDryScore: DryScore<"sdvx"> = {
	service: "e-amusement",
	game: "sdvx",
	scoreData: {
		score: 9_500_000,
		lamp: "EXCESSIVE CLEAR",
		judgements: {},
		optional: {},
	},
	scoreMeta: {},
	timeAchieved: null,
	comment: null,
	importType: "file/batch-manual",
};

export const TestingGITADORADoraDryScore: DryScore<"gitadora-dora"> = {
	service: "fake-service",
	game: "gitadora-dora",
	scoreData: {
		lamp: "CLEAR",
		percent: 70.76,
		judgements: {},
		optional: {},
	},
	scoreMeta: {},
	timeAchieved: null,
	comment: null,
	importType: "file/batch-manual",
};

export const TestingIIDXEamusementCSV26 = GetKTDataBuffer(
	"./eamusement-iidx-csv/pre-leggendaria.csv",
);
export const TestingIIDXEamusementCSV27 = GetKTDataBuffer(
	"./eamusement-iidx-csv/post-leggendaria.csv",
);

export const TestingSDVXEamusementCSV = GetKTDataBuffer(
	"./eamusement-sdvx-csv/exceed-gear-score.csv",
);

export const TestingWaccaMyPageScraperRecordsCSV = GetKTDataBuffer(
	"./wacca-mypage-scraper/records.csv",
);

export const TestingBarbatosScore: BarbatosScore = {
	difficulty: 1,
	level: 10,
	song_id: 1,
	max_chain: 50,
	critical: 50,
	near_total: 30,
	near_fast: 20,
	near_slow: 10,
	score: 9500000,
	error: 5,
	percent: 81,
	did_fail: false,
	clear_type: 2,
	gauge_type: 1,
	is_skill_analyzer: false,
};

export const HC511Goal: GoalDocument = {
	charts: {
		type: "single",
		data: Testing511SPA.chartID,
	},
	game: "iidx-sp",
	goalID: "mock_goalID",
	name: "HC 5.1.1. SPA",
	criteria: {
		mode: "single",
		value: 5,
		key: "lamp",
	},
};

export const HC511UserGoal: GoalSubscriptionDocument = {
	achieved: false,
	wasInstantlyAchieved: false,
	timeAchieved: null,
	game: "iidx-sp",
	goalID: "mock_goalID",
	lastInteraction: null,
	outOf: 5,
	outOfHuman: "HARD CLEAR",
	progress: null,
	progressHuman: "NO DATA",
	userID: 1,
	wasAssignedStandalone: false,
};

export const TestingIIDXFolderSP10: FolderDocument = {
	title: "Level 10",
	game: "iidx-sp",
	folderID: "ed9d8c734447ce67d7135c0067441a98cc81aeaf",
	slug: "level-10",
	searchTerms: [],
	inactive: false,
};

export const TestingIIDXSPQuest: QuestDocument = {
	desc: "testing quest",
	game: "iidx-sp",
	questID: "example_quest_id",
	name: "Example Quest",
	questData: [
		{
			title: "Group1",
			desc: "Foo",
			goals: [
				{
					goalID: "eg_goal_1",
				},
				{
					goalID: "eg_goal_2",
				},
			],
		},
		{
			title: "Group2",
			desc: "Bar",
			goals: [
				{
					goalID: "eg_goal_3",
				},
				{
					goalID: "eg_goal_4",
				},
			],
		},
	],
};

export const IIDXSPQuestGoals: Array<GoalDocument> = [
	dmf(HC511Goal, { goalID: "eg_goal_1" }) as GoalDocument,
	dmf(HC511Goal, { goalID: "eg_goal_2", criteria: { value: 2 } }),
	dmf(HC511Goal, { goalID: "eg_goal_3", criteria: { key: "score", value: 300 } }),
	dmf(HC511Goal, { goalID: "eg_goal_4", criteria: { key: "score", value: 1100 } }),
];

export const IIDXSPQuestGoalSubs: Array<GoalSubscriptionDocument> = [
	dmf(HC511UserGoal, { goalID: "eg_goal_1" }) as GoalSubscriptionDocument,
	dmf(HC511UserGoal, { goalID: "eg_goal_2" }) as GoalSubscriptionDocument,
	dmf(HC511UserGoal, { goalID: "eg_goal_3" }) as GoalSubscriptionDocument,
	dmf(HC511UserGoal, { goalID: "eg_goal_4" }) as GoalSubscriptionDocument,
];

export const TestingIIDXSPQuestSub: QuestSubscriptionDocument = {
	userID: 1,
	achieved: false,
	game: "iidx-sp",
	lastInteraction: null,
	questID: "example_quest_id",
	progress: 4,
	timeAchieved: null,
	wasInstantlyAchieved: false,
};

export const MockBarbatosScore: BarbatosScore = {
	clear_type: 2,
	did_fail: false,
	difficulty: 1,
	critical: 100,
	error: 5,
	near_total: 50,
	near_fast: 40,
	near_slow: 10,
	gauge_type: 1,
	is_skill_analyzer: false,
	level: 10,
	max_chain: 100,
	percent: 90,
	score: 9_000_000,
	song_id: 1,
};

export const MockBarbatosSDVX6Score: BarbatosSDVX6Score = {
	clear_type: 2,
	difficulty: 1,
	level: 10,
	max_chain: 100,
	percent: 90,
	score: 9_000_000,
	song_id: 1,

	chip_s_crit: 4,
	chip_crit: 3,
	chip_near: 2,
	chip_error: 1,

	early_crit: 5,
	early_near: 6,
	early_error: 7,

	ex_score: 1234,

	gauge_type: 1,

	grade: "whocares",

	late_crit: 8,
	late_near: 9,
	late_error: 10,

	long_crit: 11,
	long_error: 12,

	s_crit: 13,
	vol_crit: 14,
	vol_error: 15,
};

export const TestingUSCSong: SongDocument<"usc"> = {
	altTitles: [],
	artist: "IDEA+RHYTHM",
	data: {},
	id: "S19d35e0e4396423789f",
	searchTerms: ["59 idearhythm"],
	title: ".59 -BOOTH BOOST REMIX-",
};

export const TestingUSCChart: ChartDocument<"usc-keyboard"> = {
	game: "usc-keyboard",
	chartID: "USC_CHART_ID",
	legacyChartID: "0000000000000000000000000000000000000001",
	difficulty: "NOV",
	song: TestingUSCSong,
	levelNum: 1,
	level: "1",
	data: {
		hashSHA1: "USC_CHART_HASH",
		isOfficial: false,
		effector: "foo",
		tableFolders: {},
	},
	isPrimary: true,
	versions: [],
};

export const uscScore: USCClientScore = {
	crit: 100,
	error: 5,
	near: 50,
	gauge: 0.8,
	early: 50,
	late: 20,
	combo: 5,
	options: {
		autoFlags: 0,
		gaugeOpt: 0,
		gaugeType: 1,
		mirror: true,
		random: false,
	},
	score: 9_000_000,
	timestamp: 0,
	windows: {
		good: USC_DEFAULT_NEAR,
		perfect: USC_DEFAULT_PERFECT,
		hold: USC_DEFAULT_HOLD,
		miss: USC_DEFAULT_MISS,
		slam: USC_DEFAULT_SLAM,
	},
};

export const FakeOtherUser: UserDocument = {
	id: 2,
	username: "other_user",
	about: "",
	authLevel: 0,
	badges: [],
	customBannerLocation: null,
	customPfpLocation: null,
	joinDate: 0,
	lastSeen: 0,
	socialMedia: {},
	status: null,
	usernameLowercase: "other_user",
};

export const FakeGameSettings: UGPTSettingsDocument = {
	game: "iidx-sp",
	preferences: {
		defaultTable: null,
		gameSpecific: {
			bpiTarget: 0,
			display2DXTra: false,
		},
		preferredProfileAlg: null,
		preferredScoreAlg: null,
		preferredSessionAlg: null,
		preferredDefaultEnum: null,
		preferredRanking: null,
		stats: [],
	},
	rivals: [],
	userID: 1,
};

export const FakeImport: ImportDocument = {
	classDeltas: [],
	createdSessions: [],
	errors: [],
	gameGroup: "iidx",
	goalInfo: [],
	games: ["iidx-sp"],
	importID: "fake_import",
	importType: "ir/direct-manual",
	questInfo: [],
	scoreIDs: [TestingIIDXSPScore.scoreID],
	timeFinished: 1000,
	timeStarted: 100,
	userID: 1,
	userIntent: false,
};

export const FakeNotification: NotificationDocument = {
	title: "fake notif",
	notifID: "fake_notif",
	read: false,
	sentAt: 1000,
	sentTo: 1,
	body: {
		type: "QUEST_CHANGED",
		content: {
			questID: "a",
			game: "iidx-sp",
		},
	},
};

export const FervidexStaticBase = {
	name: "AIXXE",
	qpro: {
		body: 189,
		face: 138,
		hair: 76,
		hand: 145,
		head: 0,
	},
	scores: {
		1000: {
			spa: {
				clear_type: 4,
				ex_score: 1180,
				miss_count: 40,
			},
			spn: {
				clear_type: 7,
				ex_score: 158,
				miss_count: 0,
			},
		},
		1001: {
			dph: {
				clear_type: 3,
				ex_score: 15,
				miss_count: 1,
			},
		},
	},
	sp_dan: 15,
};

export const FervidexBaseScore: FervidexScore = {
	bad: 0,
	chart: "spa",
	clear_type: 1,
	combo_break: 6,
	custom: false,
	chart_sha256: "asdfasdf",
	entry_id: 1000,
	ex_score: 68,
	fast: 0,
	gauge: [100, 50],
	ghost: [0, 2],
	good: 0,
	great: 0,
	max_combo: 34,
	option: {
		gauge: "HARD",
		range: "SUDDEN_PLUS",
		style: "RANDOM",
	},
	pacemaker: {
		name: "",
		score: 363,
		type: "PACEMAKER_A",
	},
	pgreat: 34,
	poor: 6,
	slow: 0,
};

export const FervidexBaseGSMScore: FervidexScore = {
	bad: 0,
	chart: "spa",
	clear_type: 1,
	combo_break: 6,
	dead: {
		measure: 18,
		note: 40,
	},
	entry_id: 1000,
	custom: false,
	chart_sha256: "asdfasdf",
	ex_score: 68,
	fast: 0,
	gauge: [100, 50],
	ghost: [0, 2],
	good: 0,
	great: 0,
	max_combo: 34,
	option: {
		gauge: "HARD",
		range: "SUDDEN_PLUS",
		style: "RANDOM",
	},
	pacemaker: {
		name: "",
		score: 363,
		type: "PACEMAKER_A",
	},
	pgreat: 34,
	poor: 6,
	slow: 0,
	"2dx-gsm": {
		EASY: [0, 10],
		NORMAL: [0, 20],
		HARD: [20, 0],
		EX_HARD: [10, 0],
	},
};

export const MockBeatorajaBMSScore = {
	chart: {
		md5: "38616b85332037cc12924f2ae2840262",
		sha256: "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d",
		title: "GAZER [MANIAQ]",
		subtitle: "",
		genre: "TRANCE",
		artist: "the dude who made gazer",
		subartist: "",
		url: "",
		appendurl: "",
		level: 8,
		total: 220,
		mode: "BEAT_7K",
		lntype: 0,
		judge: 100,
		minbpm: 135,
		maxbpm: 135,
		notes: 568,
		hasUndefinedLN: false,
		hasLN: false,
		hasCN: false,
		hasHCN: false,
		hasMine: false,
		hasRandom: false,
		hasStop: false,
		values: {},
	},
	score: {
		sha256: "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d",
		lntype: 0,
		player: "unknown",
		clear: "Easy",
		date: 0,
		epg: 332,
		lpg: 127,
		egr: 65,
		lgr: 21,
		egd: 2,
		lgd: 2,
		ebd: 1,
		lbd: 0,
		epr: 7,
		lpr: 11,
		ems: 1,
		lms: 0,
		maxcombo: 223,
		notes: 568,
		passnotes: 568,
		minbp: 20,
		option: 2,
		assist: 0,
		gauge: -1,
		deviceType: "BM_CONTROLLER",
		judgeAlgorithm: "Combo",
		rule: "LR2",
		exscore: 1004,
	},
	client: "LR2oraja 0.8.0",
};

export const MockBeatorajaPMSScore = {
	chart: {
		md5: "d1253dd56bb2087d0b0d474f0d562aae",
		sha256: "a10193f7ae05ce839292dc716f182fda0b1cc6ac5382c2056f37e22ffba87b7d",
		title: "GPMSAZER [MANIAQ]",
		subtitle: "",
		genre: "Annihilate the living",
		artist: "Rocky",
		subartist: "",
		url: "",
		appendurl: "",
		level: 8,
		total: 220,
		mode: "POPN_9K",
		lntype: 0,
		judge: 100,
		minbpm: 135,
		maxbpm: 135,
		notes: 568,
		hasUndefinedLN: false,
		hasLN: false,
		hasCN: false,
		hasHCN: false,
		hasMine: false,
		hasRandom: false,
		hasStop: false,
		values: {},
	},
	score: {
		sha256: "a10193f7ae05ce839292dc716f182fda0b1cc6ac5382c2056f37e22ffba87b7d",
		lntype: 0,
		player: "unknown",
		clear: "Easy",
		date: 0,
		epg: 332,
		lpg: 127,
		egr: 65,
		lgr: 21,
		egd: 2,
		lgd: 2,
		ebd: 1,
		lbd: 0,
		epr: 7,
		lpr: 11,
		ems: 1,
		lms: 0,
		maxcombo: 223,
		notes: 568,
		passnotes: 568,
		minbp: 20,
		option: 2,
		assist: 0,
		gauge: -1,
		deviceType: "BM_CONTROLLER",
		judgeAlgorithm: "Combo",
		rule: "LR2",
		exscore: 1004,
	},
	client: "beatoraja 0.8.0",
};

export const MockParsedS3Score: S3Score = {
	id: 187,
	diff: "A",
	songname: "5.1.1.",
	styles: "7th",
	exscore: 100,
	scorebreakdown: {
		justgreats: 25,
		greats: 50,
		good: 0,
		bad: 0,
		poor: 4,
	},
	mods: {},
	cleartype: "perfect",
	date: "2010-10-19 04:54:22",
};

export const FakeSmallBatchManual = {
	meta: {
		game: "iidx",
		playtype: "SP",
		service: "foobar",
	},
	scores: [
		{
			score: 500,
			lamp: "HARD CLEAR",
			matchType: "songTitle",
			identifier: "5.1.1.",
			difficulty: "ANOTHER",
		},
	],
};

export const FakeChunitachiBatchManual = {
	meta: {
		game: "chunithm",
		playtype: "Single",
		service: "ChunItachi",
	},
	scores: [
		{
			score: 900000,
			clearLamp: "CLEAR",
			noteLamp: "NONE",
			matchType: "songTitle",
			identifier: "B.B.K.K.B.K.K.",
			difficulty: "BASIC",
		},
	],
};

export const TestingArcaeaSheriruthSong: SongDocument<"arcaea"> = {
	altTitles: [],
	artist: "Team Grimoire",
	data: {
		songPack: "Eternal Core",
	},
	id: "s19",
	searchTerms: [
		"しぇりだー",
		"しぇりるす",
		"셰리다",
		"셰리루스",
		"셰리루트",
		"셰루트",
		"셰루스",
		"셰리더",
	],
	title: "Sheriruth",
};

export const TestingArcaeaSheriruthFTR: ChartDocument<"arcaea"> = {
	game: "arcaea",
	chartID: "48de13e0be17a282eed6ef97e6e1478eb59bc55e",
	legacyChartID: "48de13e0be17a282eed6ef97e6e1478eb59bc55e",
	data: {
		displayVersion: "1.0",
		inGameStrID: "sheriruth",
		notecount: 1151,
	},
	difficulty: "Future",
	isPrimary: true,
	level: "10",
	levelNum: 10.1,
	song: TestingArcaeaSheriruthSong,
	versions: ["mobile"],
};

export const TestingArcaeaSheriruthPST: ChartDocument<"arcaea"> = {
	game: "arcaea",
	chartID: "48de13e0be17a282eed6ef97e6e1478eb59bc55f",
	legacyChartID: "48de13e0be17a282eed6ef97e6e1478eb59bc55f",
	data: {
		displayVersion: "1.0",
		inGameStrID: "sheriruth",
	},
	difficulty: "Past",
	isPrimary: true,
	level: "1",
	levelNum: 1,
	song: TestingArcaeaSheriruthSong,
	versions: ["mobile"],
};

export const TestingOngekiSong: SongDocument<"ongeki"> = {
	altTitles: ["SENOTETOHETSUTEITSUTENNO"],
	artist: "本城香澄（CV：岩橋由佳）「Re:ステージ！プリズムステップ」",
	data: {
		genre: "POPS＆ANIME",
		duration: 120,
	},
	id: "s683",
	searchTerms: [],
	title: "せーので跳べって言ってんの！",
};

export const TestingOngekiChart: ChartDocument<"ongeki"> = {
	game: "ongeki",
	chartID: "213796bdb6150f80ba6412ce69df1249e16c0cb0",
	legacyChartID: "213796bdb6150f80ba6412ce69df1249e16c0cb0",
	data: {
		displayVersion: "オンゲキ bright MEMORY Act.3",
		inGameID: 2137,
		maxPlatScore: 1000,
		isBonusTrack: false,
	},
	difficulty: "MASTER",
	isPrimary: true,
	level: "10",
	levelNum: 10.5,
	song: TestingOngekiSong,
	versions: ["brightMemory3", "brightMemory3Omni"],
};

export const TestingOngekiScorePB: PBScoreDocument<"ongeki"> = {
	chartID: "213796bdb6150f80ba6412ce69df1249e16c0cb0",
	userID: 1,
	calculatedData: {
		rating: 17,
	},
	composedFrom: [{ name: "Best Score", scoreID: "TESTING_SCORE_ID" }],
	highlight: false,
	isPrimary: true,
	scoreData: {
		score: 1010000,
		noteLamp: "ALL BREAK+",
		bellLamp: "FULL BELL",
		platinumScore: 1000,
		platinumStars: "R-star",
		grade: "SSS+",
		enumIndexes: {
			grade: 11,
			noteLamp: 4,
			bellLamp: 1,
			platinumStars: 6,
		},
		judgements: {},
		optional: {
			enumIndexes: {},
		},
	},
	rankingData: {
		rank: 1,
		outOf: 1,
		rivalRank: null,
	},
	songID: "s19",
	game: "ongeki",
	timeAchieved: 10000,
};

export const TestingOngekiChartConverter: ChartDocument<"ongeki"> = {
	game: "ongeki",
	chartID: "e5e4ee3d4feb233c399751b3ba3daf8ba149c9e6",
	legacyChartID: "e5e4ee3d4feb233c399751b3ba3daf8ba149c9e6",
	data: {
		displayVersion: "オンゲキ bright",
		inGameID: 678,
		maxPlatScore: 2768,
		isBonusTrack: false,
	},
	difficulty: "MASTER",
	isPrimary: true,
	level: "13+",
	levelNum: 13.7,
	song: TestingOngekiSong,
	versions: ["brightMemory3Omni", "brightMemory3"],
};

export const TestingChunithmSongConverter: SongDocument<"chunithm"> = {
	altTitles: [],
	artist: "分島花音「selector infected WIXOSS」",
	data: {
		genre: "POPS & ANIME",
		duration: 120,
	},
	id: "s956",
	searchTerms: [],
	title: "killy killy JOKER",
};

export const TestingChunithmChartConverter: ChartDocument<"chunithm"> = {
	game: "chunithm",
	chartID: "fbba26a6a223b1dd0bf8ef139cfee83114b91086",
	legacyChartID: "fbba26a6a223b1dd0bf8ef139cfee83114b91086",
	data: {
		displayVersion: "CHUNITHM CRYSTAL PLUS",
		inGameID: 956,
	},
	difficulty: "MASTER",
	isPrimary: true,
	level: "12",
	levelNum: 12,
	song: TestingChunithmSongConverter,
	versions: ["paradiselost", "sun", "sun-omni", "sunplus-omni", "luminous-omni"],
};

export const TestingChunithmWESongConverter: SongDocument<"chunithm"> = {
	altTitles: [],
	artist: "from PACA PACA PASSION Special",
	data: {
		duration: 135.275,
		genre: "VARIETY",
	},
	id: "S19d35e0c127c7e441ce",
	searchTerms: ["xl techno more dance"],
	title: "XL TECHNO -More Dance Remix-",
};

export const TestingChunithmWEChartConverter: ChartDocument<"chunithm"> = {
	game: "chunithm",
	data: {
		displayVersion: "CHUNITHM NEW PLUS",
		inGameID: 8235,
	},
	difficulty: "割☆4",
	chartID: "C19e10e7a402af3865b8",
	legacyChartID: "e5e4ee3d4feb233c399751b3ba3daf8ba149c9e6",
	isPrimary: true,
	level: "",
	levelNum: 0,
	song: TestingChunithmWESongConverter,
	versions: ["verse-omni", "xverse-omni", "xversex-omni"],
};

export const TestingMaimaiDXSongConverter: SongDocument<"maimaidx"> = {
	altTitles: [],
	artist: "suzu",
	data: {
		genre: "オンゲキ＆CHUNITHM",
	},
	id: "s844",
	searchTerms: ["Shukusei", "Shukusei Shinpan", "Syukusei Shinpan"],
	title: "宿星審判",
};

export const TestingMaimaiDXChartConverter: ChartDocument<"maimaidx"> = {
	game: "maimaidx",
	chartID: "fab3d632610b9b98ee1e4f68e9ecf0161f9cb8cd",
	legacyChartID: "fab3d632610b9b98ee1e4f68e9ecf0161f9cb8cd",
	data: {
		displayVersion: "maimaiでらっくす UNiVERSE",
		inGameID: 11294,
	},
	difficulty: "DX Expert",
	isPrimary: true,
	level: "12",
	levelNum: 12.2,
	song: TestingMaimaiDXSongConverter,
	versions: ["universeplus", "festival", "festivalplus", "buddies", "buddiesplus"],
};
