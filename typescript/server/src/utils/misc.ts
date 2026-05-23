import type { KtLogger } from "#lib/log/log";

import { ONE_MEGABYTE } from "#lib/constants/filesize";
import { ONE_HOUR, ONE_SECOND } from "#lib/constants/time";
import { AllEnabledGames as AllEnabledGames, TachiConfig } from "#lib/setup/config";
import { exec } from "child_process";
import crypto from "crypto";
import {
	type GameConfig,
	type GameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	type integer,
	type LEGACY_Playtype,
	type V3Game,
	type Versions,
} from "tachi-common";
import { URL } from "url";

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

export function EscapeForILIKE(str: string): string {
	// Escape special characters used in ILIKE patterns
	return str
		.replaceAll("\\", "\\\\") // Escape backslashes first
		.replaceAll("%", "\\%") // Escape % wildcard
		.replaceAll("_", "\\_"); // Escape _ wildcard
}

/**
 * Stick this in the "default" branch of switch exprs to statically typecheck that your
 * switch is exhaustive.
 *
 * This works because the argument to this function should be "never" because all of its
 * variants should be exhausted.
 */
export function staticAssertUnreachable(_: never): never {
	throw new Error(`unreachable (Got ${JSON.stringify(_)})`);
}

/**
 * Takes a process.hrtime.bigint(), and returns the milliseconds elapsed since it.
 * This function will not work if more than 100(ish) days have passed since the first reference.
 */
export function GetMillisecondsSince(ref: bigint) {
	return Number(process.hrtime.bigint() - ref) / 1e6;
}

export function Random20Hex() {
	return crypto.randomBytes(20).toString("hex");
}

export function MStoS(ms: number) {
	return Math.floor(ms / 1000);
}

/**
 * Random From Array - Selects a random value from an array.
 */
export function RFA<T>(arr: Array<T>): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

/**
 * Splits an Authorization header into the token and the type.
 */
export function SplitAuthorizationHeader(authHeader: string) {
	const parts = authHeader.split(" ");

	return { type: parts[0], token: parts.slice(1).join(" ") };
}

/**
 * Utility Type Predicate.
 * Determines whether a key is an ownProperty on an object.
 *
 * @returns True if the object contains that key, and changes the type of
 * key to keyof T.
 * False if the object doesn't.
 */
export function HasOwnProperty<T>(obj: T, key: number | string | symbol): key is keyof T {
	return Object.prototype.hasOwnProperty.call(obj, key);
}

export function IsEnabledGame(str: string): str is V3Game {
	return AllEnabledGames().includes(str as V3Game);
}

export function IsEnabledGameGroup(str: string): str is GameGroup {
	return !!TachiConfig.GAME_GROUPS.includes(str as GameGroup);
}

export function IsValidPlaytype(gameGroup: GameGroup, str: string): str is LEGACY_Playtype {
	return GetGameGroupConfig(gameGroup).playtypes.includes(str as LEGACY_Playtype);
}

export function IsValidScoreAlg(
	gameConfig: GameConfig,
	str: unknown,
): str is GameConfig["scoreRatingAlgs"][0] {
	// @ts-expect-error i hate this feature
	return Object.keys(gameConfig.scoreRatingAlgs).includes(str);
}

export function IsString(val: unknown): val is string {
	return typeof val === "string";
}

export function DedupeArr<T>(arr: Array<T>): Array<T> {
	return [...new Set(arr)];
}

export function StripUrl(url: string, userInput: string) {
	if (userInput.toLowerCase().includes(url)) {
		return userInput.split(url)[1]!;
	}

	return userInput;
}

// It's really hard to type this properly because iterating over
// object keys and then accessing the objects properties is a pain
// in typescript. My initial approach was to just use
// Record<string, unknown>, but then it mandates everything passed
// to it has string indexing.
// Since this is not possible, I've set it to any and just use
// runtime validation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DeleteUndefinedProps(record: any) {
	if (typeof record !== "object" || record === null || Array.isArray(record)) {
		throw new Error(`Non-object passed to DeleteUndefinedProps.`);
	}

	// asserted above
	const rec = record as Record<string, unknown>;

	for (const key of Object.keys(rec)) {
		if (rec[key] === undefined) {
			delete rec[key];
		} else if (rec[key] && typeof rec[key] === "object" && !Array.isArray(rec[key])) {
			// Recurse.
			DeleteUndefinedProps(rec[key]);
		}
	}
}

export function IsValidURL(string: string) {
	try {
		const url = new URL(string);

		return (
			url.protocol === "http:" ||
			url.protocol === "https:" ||
			/^tachi-[a-z0-9]+:$/u.exec(url.protocol)
		);
	} catch (_err) {
		return false;
	}
}

export function Sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}

export function GetTimeXHoursAgo(hours: integer) {
	return Date.now() - ONE_HOUR * hours;
}

export function ApplyNTimes<T>(n: integer, fn: (i: integer) => T): Array<T> {
	const arr = [];

	for (let i = 0; i < n; i++) {
		arr.push(fn(i));
	}

	return arr;
}

export function RoundToNDecimalPlaces(value: number, n: integer) {
	return Number(value.toFixed(n));
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

export function OmitUndefinedKeys<T>(obj: Partial<T>): Partial<T> {
	const omittedObj: Partial<T> = {};

	for (const k of Object.keys(obj)) {
		const key = k as keyof T;

		// This looks to be a bug in the no-unnecessary-condition rule.

		if (obj[key] !== undefined) {
			omittedObj[key] = obj[key];
		}
	}

	return omittedObj;
}

/**
 * Exec shellcode asynchronously.
 *
 * **DO NOT PASS USER INPUT INTO THIS FUNCTION!**
 * **THIS EVALS A STRING AS BASH!**
 * @param command A bash command to execute on the system.
 * @returns stdout and stderr as strings.
 */
export function asyncExec(command: string, cwd?: string) {
	return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
		// note: We set the maximum possible stdout to 1G. We probably won't ever hit
		// this, since the most expensive thing we do is like, read charts-bms.json
		// which is ~40mb at the time of writing.
		// I'm not sure why maxBuffer exists to be honest.
		exec(command, { maxBuffer: ONE_MEGABYTE * 1024, cwd }, (err, stdout, stderr) => {
			if (err) {
				// eslint-disable-next-line prefer-promise-reject-errors
				reject({ err, stdout, stderr });
				return;
			}

			resolve({ stdout, stderr });
		});
	});
}

export function FormatBMSTables(bmsTables: Record<string, string>) {
	if (Object.keys(bmsTables).length === 0) {
		return null;
	}

	return Object.entries(bmsTables)
		.map(([table, level]) => `${table}${level}`)
		.join(", ");
}

export function HumanisedJoinArray(arr: Array<string>, lastJoiner = "or") {
	if (arr.length === 1) {
		return arr[0];
	}

	return `${arr.slice(0, arr.length - 1).join(", ")} ${lastJoiner} ${arr[arr.length - 1]!}`;
}

export function NumToDP(num: number, points = 2) {
	return num.toFixed(points);
}

/**
 * If the input is a decimal, format it to N decimal places, otherwise,
 * format it to 0dp, i.e.
 *
 * 10.053 -> 10.05
 * 10 -> 10
 */
export function OnlyFloatToDP(num: number, points = 2) {
	if (Number.isInteger(num)) {
		return num.toFixed(0);
	}

	return num.toFixed(points);
}

/**
 * Returns whether this game is supported by this instance of tachi or not.
 */
export function IsSupported(game: GameGroup) {
	return TachiConfig.GAME_GROUPS.includes(game);
}

/**
 * Given two arrays, return all elements in arr2 that are not in arr1.
 * @param left - The array of original elements.
 * @param right - The right side of elements; everything in here not in left will be
 * returned.
 */
export function ArrayDiff<T>(left: Array<T>, right: Array<T>) {
	return right.filter((e) => !left.includes(e));
}

export function IsNonEmptyString(maybeStr: string | null | undefined): maybeStr is string {
	return maybeStr !== null && maybeStr !== undefined && maybeStr !== "";
}

export function IsNullishOrEmptyStr(
	maybeStr: string | null | undefined,
): maybeStr is "" | null | undefined {
	return maybeStr === null || maybeStr === undefined || maybeStr === "";
}

/**
 * Runtime non-null assertion.
 */
export function NotNullish<T>(maybeValue: T | null | undefined): T {
	if (maybeValue === null || maybeValue === undefined) {
		throw new Error(
			`NON-NULL ASSERTION FAILED: Expected Non-null/undefined value, got ${
				maybeValue as null | undefined
			}.`,
		);
	}

	return maybeValue;
}

export function IsNullish<T>(maybeValue: T | null | undefined): maybeValue is null | undefined {
	return maybeValue === null || maybeValue === undefined;
}

export function IsRecord(maybeRecord: unknown): maybeRecord is Record<string, unknown> {
	return typeof maybeRecord === "object" && maybeRecord !== null;
}

/**
 * Run a script-style async job, log outcome, then exit after a short delay so transports
 * can flush. Resolves when the work finishes (before the delayed `process.exit`).
 */
export async function WrapScriptPromise(promise: Promise<unknown>, log: KtLogger): Promise<void> {
	let exitCode = 0;
	try {
		await promise;
		log.info(`Finished executing.`);
	} catch (err: unknown) {
		exitCode = 1;
		log.error({ err }, `Failed executing.`);
	}

	setTimeout(() => {
		process.exit(exitCode);
	}, ONE_SECOND * 10);
}

/**
 * By default, winston won't serialise classes properly.
 *
 * This utility function ensures that an instance of a class becomes a json-valid
 * object, that can be logged.
 */
export function ClassToObject(cls: unknown) {
	return JSON.parse(JSON.stringify(cls)) as unknown;
}

export function StringIsGameVersion(game: V3Game, version: string): version is Versions[V3Game] {
	const gameConfig = GetGameConfig(game);

	return Object.keys(gameConfig.versions).includes(version);
}

/**
 * Adds this value to the set at this key if this key exists. If this key doesn't,
 * make a new set under that key and assign it there.
 */
export function AddToSetInRecord<T extends string, V>(
	key: T,
	obj: Partial<Record<T, Set<V>>>,
	toAdd: V,
) {
	if (obj[key] !== undefined) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore For some reason, this is not an error in the IDE but is an error in ci. I don't know why.
		obj[key].add(toAdd);
	} else {
		obj[key] = new Set([toAdd]);
	}
}

// This function can be used in places where we need a function that takes never
// as a parameter (for instance, an iterator over Array<never>). Such a function
// cannot ever be called. See lib/score-import/import-types/converters.ts for an
// example.
export function Never(_: never): never {
	throw new Error("Unreachable");
}
