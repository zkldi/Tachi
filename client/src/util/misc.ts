import fjsh from "fast-json-stable-hash";
import { GPT_CLIENT_IMPLEMENTATIONS } from "lib/game-implementations";
import toast from "react-hot-toast";
import { useHistory } from "react-router-dom";
import {
	APIPermissions,
	AnyProfileRatingAlg,
	AnySessionRatingAlg,
	ChartDocument,
	Game,
	GamePTConfig,
	GetGPTString,
	GetGamePTConfig,
	Playtype,
	QuestDocument,
	QuestSubscriptionDocument,
	ScoreDocument,
	integer,
} from "tachi-common";

export function RFA<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export const NO_OP = () => void 0;

export const PREVENT_DEFAULT: React.FormEventHandler<HTMLFormElement> = (e) => e.preventDefault();

export function UppercaseFirst(str: string) {
	return str[0].toUpperCase() + str.substring(1);
}

export function IsNullish(value: unknown) {
	return value === null || value === undefined;
}

export function IsNotNullish(value: unknown) {
	return !IsNullish(value);
}

export function PartialArrayRecordAssign<K extends string | number | symbol, T>(
	record: Partial<Record<K, T[]>>,
	key: K,
	data: T
) {
	if (record[key]) {
		record[key]!.push(data);
	} else {
		record[key] = [data];
	}
}

export function FormatTables(tables: { table: string; level: string }[]) {
	return tables.map((e) => `${e.table}${e.level}`).join(", ");
}

export function FormatGPTProfileRating(
	game: Game,
	playtype: Playtype,
	key: AnyProfileRatingAlg,
	value: number | null
) {
	if (value === null) {
		return "No Data.";
	}

	const gptConfig = GetGamePTConfig(game, playtype);

	if (gptConfig.profileRatingAlgs[key].formatter) {
		return gptConfig.profileRatingAlgs[key].formatter!(value);
	}

	return ToFixedFloor(value, 2);
}

export function FormatGPTSessionRating(
	game: Game,
	playtype: Playtype,
	key: AnySessionRatingAlg,
	value: number | null | undefined
) {
	if (value === null || value === undefined) {
		return "No Data.";
	}

	const gptConfig = GetGamePTConfig(game, playtype);

	if (gptConfig.sessionRatingAlgs[key].formatter) {
		return gptConfig.sessionRatingAlgs[key].formatter!(value);
	}

	return value.toFixed(2);
}

export function FormatGPTProfileRatingName(game: Game, playtype: Playtype, key: string) {
	const gptConfig = GPT_CLIENT_IMPLEMENTATIONS[GetGPTString(game, playtype)];
	return gptConfig.ratingAlgNameOverrides?.profile?.[key] ?? UppercaseFirst(key);
}

export function FormatGPTSessionRatingName(game: Game, playtype: Playtype, key: string) {
	const gptConfig = GPT_CLIENT_IMPLEMENTATIONS[GetGPTString(game, playtype)];
	return gptConfig.ratingAlgNameOverrides?.session?.[key] ?? UppercaseFirst(key);
}

export function FormatGPTScoreRatingName(game: Game, playtype: Playtype, key: string) {
	const gptConfig = GPT_CLIENT_IMPLEMENTATIONS[GetGPTString(game, playtype)];
	return gptConfig.ratingAlgNameOverrides?.score?.[key] ?? UppercaseFirst(key);
}

export function ReverseStr(str: string) {
	return str.split("").reverse().join("");
}

export function FormatMillions(v: number) {
	return v.toLocaleString();
}

export function DelayedPageReload(delay = 300) {
	setTimeout(() => window.location.reload(), delay);
}

export function ShortDelayify(fn: () => void, delay = 300) {
	setTimeout(fn, delay);
}

export const FetchJSONBody = (json: unknown) => ({
	headers: {
		"Content-Type": "application/json",
	},
	body: JSON.stringify(json),
});

// https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
// the developer of this has migrated everything to Force ES6 style modules,
// which really really messes with a lot of the ecosystem.
// shim.

export function EscapeStringRegexp(string: string) {
	if (typeof string !== "string") {
		throw new TypeError("Expected a string");
	}

	// Escape characters with special meaning either inside or outside character sets.
	// Use a simple backslash escape when it's always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns' stricter grammar.
	return string.replace(/[|\\{}()[\]^$+*?.]/gu, "\\$&").replace(/-/gu, "\\x2d");
}

export function Reverse<T>(arr: readonly T[]): T[] {
	return arr.slice(0).reverse();
}

export function PercentFrom(num: number, denom: number) {
	return `${((100 * num) / denom).toFixed(2)}%`;
}

export function StepFromToMax(max: integer, step: integer = 50) {
	const arr = [];

	for (let i = 0; i < max; i += step) {
		if (max - i < 5) {
			// skip adding things like 500 -> 505(max) as it looks bad.
			break;
		}
		arr.push(i);
	}

	arr.push(max);
	return arr;
}

export function ComposeExpFn(pow: number) {
	return (x: number) => Math.pow(x, pow);
}

export function ComposeInverseExpFn(pow: number) {
	return (x: number) => Math.pow(x, 1 / pow);
}

export function ComposeLogFn(base: number) {
	return (x: number) => Math.log(x) / Math.log(base);
}

export function SelectRightChart(
	gptConfig: GamePTConfig,
	chartID: string,
	charts: ChartDocument[]
) {
	// try matching difficulty names, if it's not any of those, it's probably a chartID.
	for (const chart of charts) {
		if (chart.difficulty === chartID && chart.isPrimary) {
			return chart;
		}

		if (chartID === chart.chartID) {
			return chart;
		}
	}

	return null;
}

export function CopyToClipboard(data: unknown) {
	toast.success("Copied data to clipboard.");

	const str = typeof data === "string" ? data : JSON.stringify(data, null, "\t");

	navigator.clipboard.writeText(str);
}

export const allPermissions: APIPermissions[] = [
	"customise_profile",
	"customise_score",
	"customise_session",
	"delete_score",
	"submit_score",
];

export function WrapError<T>(fn: () => T, errMsg: string) {
	try {
		return fn();
	} catch (err) {
		throw new Error(errMsg);
	}
}

export function Sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export function HistorySafeGoBack(history: ReturnType<typeof useHistory>) {
	// if (history.length === 1) {
	history.replace("/");
	// } else {
	// history.goBack();
	// }
}
export function ToPercent(n1: number, n2: number) {
	return `${((100 * n1) / n2).toFixed(2)}%`;
}

export function CountElements<T>(data: T[], collector: (element: T) => string | null) {
	const counts: Record<string, number> = {};

	for (const element of data) {
		const key = collector(element);

		if (key === null) {
			continue;
		}

		if (!counts[key]) {
			counts[key] = 1;
		} else {
			counts[key]++;
		}
	}

	return counts;
}

export function FormatScoreRating(
	game: Game,
	playtype: Playtype,
	rating: keyof ScoreDocument["calculatedData"],
	value: number | null | undefined
) {
	if (value === null || value === undefined) {
		return "No Data.";
	}

	const formatter = GetGamePTConfig(game, playtype).scoreRatingAlgs[rating].formatter;

	if (!formatter) {
		return value.toFixed(2);
	}

	return formatter(value);
}

export function FormatSessionRating(
	game: Game,
	playtype: Playtype,
	rating: AnySessionRatingAlg,
	value: number | null | undefined
) {
	if (value === null || value === undefined) {
		return "No Data.";
	}

	const formatter = GetGamePTConfig(game, playtype).sessionRatingAlgs[rating].formatter;

	if (!formatter) {
		return value.toFixed(2);
	}

	return formatter(value);
}

export function ConditionalLeadingSpace(maybeStr: string | null) {
	if (maybeStr === null) {
		return "";
	}

	return ` ${maybeStr}`;
}

export function DistinctArr<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

export function TruncateString(string: string, len = 30) {
	if (string.length < len) {
		return string;
	}

	return `${string.substring(0, len - 3)}...`;
}

export enum Days {
	Sunday = 0,
	Monday,
	Tuesday,
	Wednesday,
	Thursday,
	Friday,
	Saturday,
}

export enum Months {
	January = 0,
	February,
	March,
	April,
	May,
	June,
	July,
	August,
	September,
	October,
	November,
	December,
}

/**
 * Converts a keyChain array into a javascript-like single string.
 *
 * Taken from Prudence.
 *
 * @param keyChain The keychain to stringify.
 */
export function StringifyKeyChain(keyChain: string[]): string | null {
	if (keyChain.length === 0) {
		return null;
	}

	let str = keyChain[0];

	if (str.includes(".")) {
		str = `["${str}"]`;
	} else if (str.match(/^[0-9]+$/u)) {
		// if only numbers
		str = `[${str}]`;
	} else if (str.match(/^[0-9]/u)) {
		// if starts with a number but is not only numbers
		str = `["${str}"]`;
	}

	for (let i = 1; i < keyChain.length; i++) {
		const key = keyChain[i];

		if (key.includes(".")) {
			str += `["${key}"]`;
		} else if (key.match(/^[0-9]/u)) {
			// if starts with a number
			str += `[${key}]`;
		} else {
			str += `.${key}`;
		}
	}

	return str;
}

function FlattenRecord(
	rec: Record<string, unknown>,
	keychain: string[] = []
): Array<{ keychain: string[]; value: unknown }> {
	const flatRec = [];

	for (const [key, value] of Object.entries(rec)) {
		const newChain = [...keychain, key];

		flatRec.push(...FlattenValue(value, newChain));
	}

	return flatRec;
}

export function FlattenValue(
	value: unknown,
	keychain: string[] = []
): Array<{ keychain: string[]; value: unknown }> {
	if (Array.isArray(value)) {
		// probably not a tuple, don't make this thing super long.
		if (value.length > 5) {
			return [{ keychain, value: value.join(", ") }];
		}

		return value.flatMap((e, i) => FlattenValue(e, [...keychain, i.toString()]));
	} else if (typeof value === "object" && value !== null) {
		return FlattenRecord(value as Record<string, unknown>, keychain);
	}

	return [
		{
			keychain,
			value,
		},
	];
}

export function ExtractGameFromFile(file: string): Game {
	const match = /-(.*?).json$/u.exec(file);

	if (match === null) {
		throw new Error(`Couldn't extract game from ${file}.`);
	}

	const [_, game] = match;

	return game as Game;
}

/**
 * Given an array, remove all duplicates in it.
 */
export function Dedupe<T>(arr: Array<T>): Array<T> {
	return [...new Set(arr)];
}

export function IsRecord(maybeRec: unknown): maybeRec is Record<string, unknown> {
	return typeof maybeRec === "object" && maybeRec !== null && !Array.isArray(maybeRec);
}

export type JSONAttributeDiff = {
	keychain: string[];
	beforeVal: unknown;
	afterVal: unknown;
};

/**
 * Given two JSON objects, diff them.
 *
 * This returns an array of keychains (stringpaths to the value)
 * and their state before and after. `undefined` implies that the property does not
 * exist anymore (or didn't exist).
 *
 * @note A and B **must** both be json OBJECTS or ARRAYS. They cannot be primitives.
 */
export function JSONCompare(before: object, after: object, keychain: string[] = []) {
	const diffs: JSONAttributeDiff[] = [];

	const bKeys = Object.keys(before);
	const aKeys = Object.keys(after);
	const allKeys = Dedupe([...bKeys, ...aKeys]);

	for (const key of allKeys) {
		const newKeychain = [...keychain, key];

		// @ts-expect-error JS ABUSE WARNING
		const bef = before[key];
		// @ts-expect-error JS ABUSE here
		// you can index arrays with strings as if they were numbers
		// this is because arrays are secretly objects.
		// lol!
		const aft = after[key];

		// -- OBJECT CASES
		// if both sides are objects, recurse.
		if (IsRecord(bef) && IsRecord(aft)) {
			diffs.push(...JSONCompare(bef, aft, newKeychain));
		} else if (IsRecord(bef) && !IsRecord(aft)) {
			// if one is an object and the other isn't
			// compare against the empty object so we still get nice diffs
			// instead of blubber like key went from 1 to -> {foo: "bar"}

			diffs.push(...JSONCompare(bef, {}, newKeychain));
		} else if (!IsRecord(bef) && IsRecord(aft)) {
			// converse of previous case
			diffs.push(...JSONCompare({}, aft, newKeychain));
		}
		// -- ARRAY CASES
		// we only need to handle the case of ARRAY->ARRAY.
		// otherwise, it's a guaranteed diff.
		else if (Array.isArray(bef) && Array.isArray(aft)) {
			if (fjsh.stringify(bef) !== fjsh.stringify(aft)) {
				diffs.push({
					afterVal: aft,
					beforeVal: bef,
					keychain: newKeychain,
				});
			}
		}

		// -- PRIMITIVE CASES
		else if (Object.is(bef, aft)) {
			// are these two things the same? if so, don't do anything.
			continue;
		} else {
			// these things are different, it's a diff.
			diffs.push({
				keychain: newKeychain,
				beforeVal: bef,
				afterVal: aft,
			});
		}
	}

	return diffs;
}

export function JoinJSX(elements: Array<JSX.Element>, joiner: JSX.Element): Array<JSX.Element> {
	const newArray: Array<JSX.Element> = [];

	for (let i = 0; i < elements.length; i++) {
		const element = elements[i]!;

		// if this is the last element, don't suffix with a joiner.
		if (i === elements.length - 1) {
			newArray.push(element);
		} else {
			newArray.push(element, joiner);
		}
	}

	return newArray;
}

export function clamp(a: number, low: number, up: number) {
	if (a < low) {
		return low;
	}

	if (a > up) {
		return up;
	}

	return a;
}

export function CreateQuestMap(quests: Array<QuestDocument>) {
	const map = new Map<string, QuestDocument>();

	for (const q of quests) {
		map.set(q.questID, q);
	}

	return map;
}

export function CreateQuestSubMap(questSubs: Array<QuestSubscriptionDocument>) {
	const map = new Map<string, QuestSubscriptionDocument>();

	for (const q of questSubs) {
		map.set(q.questID, q);
	}

	return map;
}

export function ChangeAtPosition<T>(elements: T[], element: T, i: integer) {
	return [...elements.slice(0, i), element, ...elements.slice(i + 1)];
}

export function DeleteInPosition<T>(elements: T[], i: integer) {
	return [...elements.slice(0, i), ...elements.slice(i + 1)];
}

export function HumanisedJoinArray(arr: Array<string>, lastJoiner = "or") {
	if (arr.length === 1) {
		return arr[0];
	}

	return `${arr.slice(0, arr.length - 1).join(", ")} ${lastJoiner} ${arr[arr.length - 1]!}`;
}

export function isCardIDValid(cardID: string) {
	if (cardID.startsWith("E004") || cardID.startsWith("012E")) {
		return false;
	}

	if (cardID.match(/^C[0-9]{12}$/u) !== null) {
		return true;
	}

	if (cardID.match(/^[0-9A-z]{14}[1|2][0-9A-z]$/u) !== null) {
		return true;
	}

	return false;
}

/**
 * Floor a number to N decimal places.
 *
 * @example `FloorToNDP(1.594, 1) -> 1.5`
 * @example `FloorToNDP(1.599, 2) -> 1.59`
 *
 * @param number - The number to floor.
 * @param dp - The amount of decimal places to floor to.
 */
export function FloorToNDP(number: number, dp: integer) {
	const mul = 10 ** dp;

	return Math.floor(number * mul) / mul;
}

/**
 * Format a number to this many decimal places, rounding down.
 */
export function ToFixedFloor(number: number, decimalPlaces: integer) {
	const floored = FloorToNDP(number, decimalPlaces);

	return floored.toFixed(decimalPlaces);
}
