/**
 * Computes URL-safe folder slugs for `db/seeds/folders.json` rows.
 * Slugs are lowercase ASCII [a-z0-9-] only.
 */

import { BMS_TABLES } from "../constants/bms-tables";

export type SeedFolderRow = {
	game: string;
	id: string;
	slug?: string;
	title: string;
	versionFilter?: Array<string>;
	where: string;
};

const CHART_LEVEL_EQ_RE = /^chart\.level = '([^']+)'$/u;

const LEVEL_NUM_GE_LT_RE = /chart\.level_num >= ([0-9.]+) AND chart\.level_num < ([0-9.]+)/u;

const LEVEL_NUM_GE_LE_RE = /chart\.level_num >= ([0-9.]+) AND chart\.level_num <= ([0-9.]+)/u;

const CHART_LEVEL_IN_RE = /chart\.level IN \(([^)]+)\)/u;

/** IIDX: maps `versionFilter[0]` → slug segment (see add-iidx-folder-slugs history). */
export const IIDX_VERSION_SLUG: Record<string, string> = {
	1: "1st",
	substream: "substream",
	2: "2nd",
	3: "3rd",
	4: "4th",
	5: "5th",
	6: "6th",
	7: "7th",
	8: "8th",
	9: "9th",
	10: "10th",

	11: "red",
	12: "happysky",
	13: "distorted",
	14: "gold",
	15: "djtroopers",
	16: "empress",
	17: "sirius",
	18: "resortanthem",
	19: "lincle",

	"3-cs": "3rd-cs",
	"4-cs": "4th-cs",
	"5-cs": "5th-cs",
	"6-cs": "6th-cs",
	"7-cs": "7th-cs",
	"8-cs": "8th-cs",
	"9-cs": "9th-cs",
	"10-cs": "10th-cs",
	"11-cs": "11th-cs",
	"12-cs": "12th-cs",
	"13-cs": "13th-cs",
	"14-cs": "14th-cs",
	"15-cs": "15th-cs",
	"16-cs": "16th-cs",

	20: "tricoro",
	21: "spada",
	22: "pendual",
	23: "copula",
	24: "sinobuz",
	25: "cannonballers",
	26: "rootage",
	"26-omni": "rootage-omni",
	27: "heroicverse",
	"27-2dxtra": "heroicverse-2dxtra",
	"27-omni": "heroicverse-omni",
	28: "bistrover",
	"28-omni": "bistrover-omni",
	29: "casthour",
	"29-omni": "casthour-omni",
	30: "resident",
	"30-omni": "resident-omni",
	31: "epolis",
	"31-omni": "epolis-omni",
	32: "pinkycrush",
	"32-omni": "pinkycrush-omni",
	33: "sparkleshower",

	bmus: "bmus",
	inf: "inf",
};

const ASCII_SLUG_RE = /^[a-z0-9-]+$/u;

export function assertAsciiSlug(slug: string, ctx: string): void {
	if (!ASCII_SLUG_RE.test(slug)) {
		throw new Error(`${ctx}: slug must match [a-z0-9-], got ${JSON.stringify(slug)}`);
	}
}

/** Collapses separators to single `-`; strips non-alphanumeric. */
export function asciiSlugSegment(input: string): string {
	const stripped = input
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/gu, "")
		.replace(/[^a-zA-Z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.replace(/-+/gu, "-")
		.toLowerCase();

	return stripped.length > 0 ? stripped : "x";
}

export function slugLevelPart(level: string): string {
	return level.replaceAll("+", "p").replaceAll(".", "p");
}

function expectSingleVersionFilter(folder: SeedFolderRow, label: string): string {
	const vf = folder.versionFilter;

	if (!vf || vf.length !== 1) {
		throw new Error(
			`${label} folder "${folder.title}" (${folder.id}): expected exactly one versionFilter entry, got ${JSON.stringify(vf)}`,
		);
	}

	return vf[0];
}

function slugLevelFromWhere(where: string, label: string, id: string, title: string): string {
	const eq = CHART_LEVEL_EQ_RE.exec(where);

	if (eq !== null) {
		return slugLevelPart(eq[1]);
	}

	const lt = LEVEL_NUM_GE_LT_RE.exec(where);

	if (lt !== null) {
		return `ge-${slugLevelPart(lt[1])}-lt-${slugLevelPart(lt[2])}`;
	}

	const le = LEVEL_NUM_GE_LE_RE.exec(where);

	if (le !== null) {
		return `ge-${slugLevelPart(le[1])}-le-${slugLevelPart(le[2])}`;
	}

	const mIn = CHART_LEVEL_IN_RE.exec(where);

	if (mIn !== null) {
		const vals = mIn[1].split(",").map((x) => x.trim().replace(/^'/u, "").replace(/'$/u, ""));

		return vals.map((v) => slugLevelPart(v)).join("-");
	}

	throw new Error(
		`${label} folder "${title}" (${id}): unhandled level predicate ${JSON.stringify(where)}`,
	);
}

/** `{level}-{version}` with slugified version token. */
function slugLevelPlusVersion(folder: SeedFolderRow, label: string): string {
	const rawVf = expectSingleVersionFilter(folder, label);
	const levelSeg = slugLevelFromWhere(folder.where, label, folder.id, folder.title);

	return `${levelSeg}-${asciiSlugSegment(rawVf)}`;
}

function slugIidx(folder: SeedFolderRow): string {
	const rawKey = expectSingleVersionFilter(folder, "IIDX");
	const versionSlug = IIDX_VERSION_SLUG[rawKey];

	if (versionSlug === undefined) {
		throw new Error(
			`IIDX folder "${folder.title}" (${folder.id}): unmapped versionFilter ${JSON.stringify(rawKey)}`,
		);
	}

	const match = CHART_LEVEL_EQ_RE.exec(folder.where);

	if (match === null) {
		throw new Error(
			`IIDX folder "${folder.title}" (${folder.id}): expected chart.level = '…', got ${JSON.stringify(folder.where)}`,
		);
	}

	return `${slugLevelPart(match[1])}-${versionSlug}`;
}

function slugChunithm(folder: SeedFolderRow): string {
	const rawVf = expectSingleVersionFilter(folder, "chunithm");
	const vfPart = asciiSlugSegment(rawVf);
	const w = folder.where;

	if (
		w ===
		"((jsonb_typeof(chart.data->'inGameID') = 'number' AND (chart.data->>'inGameID')::int >= 8000) OR (jsonb_typeof(chart.data->'inGameID') = 'array' AND jsonb_path_match(chart.data->'inGameID', '!exists($.* ? (@ < 8000))')))"
	) {
		return `worlds-end-${vfPart}`;
	}

	const mLv = CHART_LEVEL_EQ_RE.exec(w);

	if (mLv !== null) {
		return `${slugLevelPart(mLv[1])}-${vfPart}`;
	}

	const mDiff = /chart\.difficulty = '([^']+)'/u.exec(w);

	if (mDiff !== null) {
		return `${asciiSlugSegment(mDiff[1])}-${vfPart}`;
	}

	const mIn = /chart\.difficulty IN \(([^)]+)\)/u.exec(w);

	if (mIn !== null) {
		const parts = mIn[1].split(",").map((x) => x.trim().replace(/^'/u, "").replace(/'$/u, ""));

		return `${asciiSlugSegment(parts.join("-"))}-${vfPart}`;
	}

	throw new Error(
		`chunithm folder "${folder.title}" (${folder.id}): unhandled where ${JSON.stringify(w)}`,
	);
}

function slugOngeki(folder: SeedFolderRow): string {
	const w = folder.where;

	if (w.includes("song.data->>'genre'") && w.includes("'LUNATIC'")) {
		return "lunatic-only-songs";
	}

	/** Modern bonus folder: Mongo `data¬isBonusTrack: true` (no version scope). */
	if (w === "chart.data->>'isBonusTrack' = 'true'") {
		return "bonus-tracks-isbonus";
	}

	/** Legacy bonus definition: inGameID in [7000, 8000). */
	if (
		w ===
		"(chart.data->>'inGameID')::numeric >= 7000 AND (chart.data->>'inGameID')::numeric < 8000"
	) {
		return "bonus-tracks";
	}

	const rawVf = expectSingleVersionFilter(folder, "ongeki");
	const vfPart = asciiSlugSegment(rawVf);
	const isOld = folder.title.includes("(Old)");

	const mLv = /chart\.level = '([^']+)'/u.exec(w);

	if (mLv !== null) {
		let s = `${slugLevelPart(mLv[1])}-${vfPart}`;

		if (isOld) {
			s = `${s}-old`;
		}

		return s;
	}

	let remaster = "";

	if (/isReMaster' = 'true'/u.test(w)) {
		remaster = "-remaster";
	}

	const mD = /chart\.difficulty = '([^']+)'/u.exec(w);

	if (mD !== null) {
		let s = `${vfPart}-${asciiSlugSegment(mD[1])}${remaster}`;

		if (isOld) {
			s = `${s}-old`;
		}

		return s;
	}

	const mIn = /chart\.difficulty IN \(([^)]+)\)/u.exec(w);

	if (mIn !== null) {
		const parts = mIn[1].split(",").map((x) => x.trim().replace(/^'/u, "").replace(/'$/u, ""));

		let s = `${vfPart}-${asciiSlugSegment(parts.join("-"))}${remaster}`;

		if (isOld) {
			s = `${s}-old`;
		}

		return s;
	}

	throw new Error(
		`ongeki folder "${folder.title}" (${folder.id}): unhandled where ${JSON.stringify(w)}`,
	);
}

function slugJubeat(folder: SeedFolderRow): string {
	const rawVf = expectSingleVersionFilter(folder, "jubeat");
	const vfPart = asciiSlugSegment(rawVf);
	const w = folder.where;
	const hard = w.includes("HARD BSC");
	const mode = hard ? "hard" : "normal";

	const mLv = /chart\.level = '([^']+)'/u.exec(w);

	if (mLv !== null) {
		return `${slugLevelPart(mLv[1])}-${mode}-${vfPart}`;
	}

	const mRg = /chart\.level_num >= ([0-9.]+) AND chart\.level_num < ([0-9.]+)/u.exec(w);

	if (mRg !== null) {
		return `ge-${slugLevelPart(mRg[1])}-lt-${slugLevelPart(mRg[2])}-${mode}-${vfPart}`;
	}

	throw new Error(
		`jubeat folder "${folder.title}" (${folder.id}): unhandled where ${JSON.stringify(w)}`,
	);
}

function slugGitadora(folder: SeedFolderRow): string {
	const rawVf = expectSingleVersionFilter(folder, "gitadora");
	const vfPart = asciiSlugSegment(rawVf);
	const m = /chart\.level_num >= ([0-9.]+) AND chart\.level_num < ([0-9.]+)/u.exec(folder.where);

	if (m === null) {
		throw new Error(
			`gitadora folder "${folder.title}" (${folder.id}): expected level_num range, got ${JSON.stringify(folder.where)}`,
		);
	}

	const a = m[1].replaceAll(".", "p");
	const b = m[2].replaceAll(".", "p");

	return `${vfPart}-ge-${a}-lt-${b}`;
}

/** Non-official USC folders use the seed title as the slug (e.g. `os8`). */
function slugUscUnofficialTitle(title: string): string {
	// Match level-style `+` handling so `us17` vs `us17+` do not collide; `*` → `s` for titles like `us0*`.
	return asciiSlugSegment(title.replaceAll("+", "p").replaceAll("*", "s"));
}

function slugUsc(folder: SeedFolderRow): string {
	const w = folder.where;

	const mOfficial = /chart\.data->>'isOfficial' = 'true' AND chart\.level = '([^']+)'/u.exec(w);

	if (mOfficial !== null) {
		return `official-${slugLevelPart(mOfficial[1])}`;
	}

	return slugUscUnofficialTitle(folder.title);
}

function slugItgStamina(folder: SeedFolderRow): string {
	return asciiSlugSegment(folder.title);
}

/**
 * Maps a `tableFolders` JSON key to a slug segment using {@link BMS_TABLES} `asciiPrefix`
 * (ASCII-friendly identifier for the table `prefix`).
 */
function encodeBmsTableKey(game: string, key: string): string {
	const row = BMS_TABLES.find((e) => e.game === game && e.prefix === key);

	if (row !== undefined) {
		return asciiSlugSegment(row.asciiPrefix);
	}

	// USC and other non-BMS seeds: `os`, `us`, etc.
	if (/^[a-zA-Z0-9_]+$/u.test(key)) {
		return key.toLowerCase();
	}

	throw new Error(
		`No BMS_TABLES row for game=${JSON.stringify(game)} prefix=${JSON.stringify(key)} - add a BMSTableInfo entry or use an ascii-only prefix.`,
	);
}

function encodeBmsTableValue(value: string): string {
	const parts: Array<string> = [];
	let alphanumRun = "";

	for (const ch of value) {
		if (/[a-z0-9]/iu.test(ch)) {
			alphanumRun += ch.toLowerCase();
		} else {
			if (alphanumRun.length > 0) {
				parts.push(alphanumRun);
				alphanumRun = "";
			}

			if (ch === "+") {
				parts.push("p");
			} else if (ch === "?") {
				parts.push("q");
			} else if (ch === "-") {
				parts.push("dash");
			} else if (ch === "!") {
				parts.push("excl");
			} else {
				parts.push(`u${ch.codePointAt(0)?.toString(16) ?? "0"}`);
			}
		}
	}

	if (alphanumRun.length > 0) {
		parts.push(alphanumRun);
	}

	return parts.join("-");
}

function slugBmsLike(folder: SeedFolderRow, label: string): string {
	const w = folder.where;

	const mKv = /tableFolders'->>'((?:[^']|'')+)'\) = '((?:[^']|'')*)'/u.exec(w);

	if (mKv !== null) {
		const key = mKv[1].replaceAll("''", "'");
		const val = mKv[2].replaceAll("''", "'");

		return `${encodeBmsTableKey(folder.game, key)}-${encodeBmsTableValue(val)}`;
	}

	const mPr = /tableFolders'\) \? '((?:[^']|'')+)'/u.exec(w);

	if (mPr !== null) {
		const key = mPr[1].replaceAll("''", "'");

		return `${encodeBmsTableKey(folder.game, key)}-present`;
	}

	const mRg =
		/chart\.data->>'([a-zA-Z0-9_]+)'\)::numeric >= ([0-9.]+) AND \(chart\.data->>'\1'\)::numeric < ([0-9.]+)/u.exec(
			w,
		);

	if (mRg !== null) {
		return `${mRg[1].toLowerCase()}-ge-${mRg[2]}-lt-${mRg[3]}`;
	}

	throw new Error(
		`${label} folder "${folder.title}" (${folder.id}): unhandled where ${JSON.stringify(w)}`,
	);
}

export function computeFolderSlug(folder: SeedFolderRow): string {
	let slug: string;

	switch (folder.game) {
		case "iidx-dp":
		case "iidx-sp":
			slug = slugIidx(folder);
			break;

		case "arcaea":
		case "ddr-dp":
		case "ddr-sp":
		case "maimai":
		case "maimaidx":
		case "museca":
		case "popn":
		case "sdvx":
		case "wacca":
			slug = slugLevelPlusVersion(folder, folder.game);
			break;

		case "chunithm":
			slug = slugChunithm(folder);
			break;

		case "ongeki":
			slug = slugOngeki(folder);
			break;

		case "jubeat":
			slug = slugJubeat(folder);
			break;

		case "gitadora-dora":
		case "gitadora-gita":
			slug = slugGitadora(folder);
			break;

		case "usc-controller":
		case "usc-keyboard":
			slug = slugUsc(folder);
			break;

		case "itg-stamina":
			slug = slugItgStamina(folder);
			break;

		case "bms-14k":
		case "bms-7k":
		case "pms-controller":
		case "pms-keyboard":
			slug = slugBmsLike(folder, folder.game);
			break;

		default:
			throw new Error(`computeFolderSlug: unsupported game ${JSON.stringify(folder.game)}`);
	}

	assertAsciiSlug(slug, `folder "${folder.title}" (${folder.id})`);

	return slug;
}
