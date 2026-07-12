import { type ZTableSearchFn } from "#components/util/table/useZTable";
import { SEARCH_DIRECTIVES } from "#util/constants/search-directives";

// This file sucks. Don't even attempt to understand it. Luckily, it works and
// never needs any extending, but should you want to change something here,
// it would genuinely be faster to just completely rewrite it.
// This is a parser that handles things like
// title="FREEDOM DIVE" level>12
// etc.
// This was written before I knew anything about how to implement a lexer or parser.
// Apologies.

export interface SearchDirective {
	key: string;
	option: string | null;
	value: string;
}

type DirectiveModes = "!=" | "<" | "<=" | "=" | "==" | ">" | ">=" | "~=";

export interface Directive {
	key: string;
	// == - EXACT
	// != - NOT
	// > - GREATER THAN
	// >= - GREATER THAN OR EQ
	// < - LESS THAN
	// <= - LESS THAN OR EQ
	// ~= - REGEXP
	mode: DirectiveModes;
	value: string;

	originalStr: string;
}

// Regex is an irritatingly write-only language, so i've split this one
// up.

// KEY   = /([^ ]+):/ - Parses the key name
// MODE  = /(>=|<=|!|>|<)?/ - parses the optional directive
// VALUE = /("(?:\\"|[^"])+"|[^ ]+)/ - Parses the value.

export function ParseDirectives(search: string): Directive[] {
	const parsedSearch = search.matchAll(
		/([a-zA-Z0-9]+)\s*(>=|<=|!=|==|>|<|~=|=)\s*("(?:\\"|[^"])+"|[^ ]+)/gu,
	);

	const searchDirectives = [];
	for (const ps of parsedSearch) {
		if (ps.length !== 4) {
			continue;
		}

		const [wholeMatch, key, mode, value] = ps;

		let v = value;

		// strip surrounding quotes from quoted values - since we don't want the quotes!
		// I tried doing this inside the regex but it proved awful, so, here we are!
		if (value.startsWith('"') && value.endsWith('"')) {
			v = value.substring(1, value.length - 1);
		}

		searchDirectives.push({
			key: key.toLowerCase(),
			mode: mode as Directive["mode"],
			value: v,
			originalStr: ps[0],
		});
	}

	return searchDirectives;
}

type MatchFn = (searchValue: string, dataValue: number | string) => boolean;

const Matchers: Record<Exclude<DirectiveModes, "=">, MatchFn> = {
	// Exact: Make sure this string is exactly the data value.
	"==": (sv, dv) => sv === dv.toString(),
	// Not: this value is not equal to the provided value. Case insensitive.
	"!=": (sv, dv) => sv.toLowerCase() !== dv.toString().toLowerCase(),
	// LT, LTE, GT, GTE: If the data value is a number, compare numerically. If the data value is a string
	// compare alphabetically.
	// equality for alphabetical is implemented as .startsWith case insensitively.
	"<": (sv, dv) => {
		if (typeof dv === "number") {
			return dv < Number(sv);
		}

		return dv.localeCompare(sv) < 0;
	},
	"<=": (sv, dv) => {
		if (typeof dv === "number") {
			return dv <= Number(sv);
		}

		return dv.localeCompare(sv) <= 0 || dv.toLowerCase().startsWith(sv.toLowerCase());
	},
	">": (sv, dv) => {
		if (typeof dv === "number") {
			return dv > Number(sv);
		}

		return dv.localeCompare(sv) > 0;
	},
	">=": (sv, dv) => {
		if (typeof dv === "number") {
			return dv >= Number(sv);
		}

		return dv.localeCompare(sv) > 0 || dv.toLowerCase().startsWith(sv.toLowerCase());
	},
	// Regex: run the contents of value as if it were a regex. Lol.
	"~=": (sv, dv) =>
		!!(Array.isArray(dv) ? dv[0] : dv).toString().match(new RegExp(sv, "u"))?.length,
};

const NeutralMatchLower = (svLower: string, dv: string) => dv.toLowerCase().includes(svLower);

const NeutralMatch = (sv: string, dv: string) => dv.toLowerCase().includes(sv.toLowerCase());

const BooleanMatch = (sv: string, dv: boolean) => {
	if (dv) {
		return ["yes", "true"].some((x) => x.startsWith(sv.toLowerCase()));
	}

	return ["no", "false"].some((x) => x.startsWith(sv.toLowerCase()));
};

function GetStrData(dataValue: number | string | [string, number]) {
	if (typeof dataValue === "string") {
		return dataValue;
	} else if (typeof dataValue === "number") {
		return dataValue.toString();
	}

	return dataValue[0];
}

function GetData(dataValue: number | string | [string, number]) {
	if (typeof dataValue === "string") {
		return dataValue;
	} else if (typeof dataValue === "number") {
		return dataValue;
	}

	return dataValue[0];
}

/**
 * Check whether the directive given matches the data.
 * @param directiveNumValue - If dataValue is hybrid, then this needs to be passed to compare numbers correctly.
 * @returns True if match, False if not.
 */
function DirectiveMatch(
	directive: Directive,
	dataValue: boolean | number | string | [string, number] | null,
	directiveNumValue?: number,
) {
	if (dataValue === undefined) {
		console.warn(`Unexpected undefined for dataValue ${directive}. Casting to null.`);

		dataValue = null;
	}

	if (dataValue === null) {
		return false;
	}

	if (typeof dataValue === "boolean") {
		return BooleanMatch(directive.value, dataValue);
	}

	if (directive.mode === "=") {
		return NeutralMatch(directive.value, GetStrData(dataValue));
	}

	if (directive.mode === SEARCH_DIRECTIVES.REGEX) {
		try {
			return Matchers[SEARCH_DIRECTIVES.REGEX](directive.value, GetStrData(dataValue));
		} catch {
			// handle nonsense regex
			return false;
		}
	}

	// use directiveNumValue if hybrid mode is on
	if (["<", "<=", ">", ">="].includes(directive.mode) && Array.isArray(dataValue)) {
		return Matchers[directive.mode](directiveNumValue!.toString(), dataValue[1]);
	}

	return Matchers[directive.mode](directive.value, GetData(dataValue));
}

/**
 * The job of a value getter is to retrieve either a number or a string from a document
 * in the dataset.
 *
 * The third confusing option is a hybrid type, where it works like a string externally but
 * a number for >= style comparisons. The value getter must return a tri-tuple of its string value,
 * its numerical value, and a function to convert the users string request to a number.
 */
export type ValueGetter<D> = (data: D) => boolean | number | string | null;

export type ValueGetterOrHybrid<D> =
	| ValueGetter<D>
	| {
			strToNum: (s: string) => number | null;
			valueGetter: (data: D) => [string, number] | null;
	  };

export type SearchFunctions<T> = Record<string, ValueGetterOrHybrid<T>>;

export function GetValueGetter<D>(v: ValueGetterOrHybrid<D>) {
	if (typeof v === "function") {
		return v;
	}

	return v.valueGetter;
}

function GetValueInsensitive<T>(record: Record<string, T>, key: string): T | undefined {
	for (const [recKey, value] of Object.entries(record)) {
		if (recKey.toLowerCase() === key.toLowerCase()) {
			return value;
		}
	}

	return undefined;
}

export function ComposeSearchFunction<D>(
	valueGetters: Record<string, ValueGetterOrHybrid<D>>,
): ZTableSearchFn<D> {
	const allGetters = Object.values(valueGetters);

	// `filter()` calls this once per row. Parsing directives is shared work; do it once per
	// search string per composed function instance (one synchronous filter pass), not O(rows).
	let parseCacheSearch = "";
	let parseCacheDirectives: Directive[] = [];
	let searchLowerCache = "";

	return (search, data) => {
		if (search !== parseCacheSearch) {
			parseCacheSearch = search;
			parseCacheDirectives = ParseDirectives(search);
			searchLowerCache = search.toLowerCase();
		}

		const directives = parseCacheDirectives;

		if (directives.length === 0) {
			return allGetters.some((vgOrHybrid) => {
				const v = GetValueGetter(vgOrHybrid)(data);

				if (v === undefined) {
					console.warn(
						`Unexpected undefined in directive ${vgOrHybrid}, casting to null.`,
					);
					return null;
				}

				if (v === null) {
					return null;
				}

				// These don't make sense for a neutral.
				if (typeof v === "boolean") {
					return null;
				}

				return NeutralMatchLower(searchLowerCache, GetStrData(v));
			});
		}

		const skippedDirectives: Directive[] = [];

		for (const directive of directives) {
			const vgOrHybrid = GetValueInsensitive(valueGetters, directive.key);

			if (!vgOrHybrid) {
				skippedDirectives.push(directive);
				continue;
			}

			const dataValue = GetValueGetter(vgOrHybrid)(data);

			let directiveNumValue;

			// is hybrid
			if (Array.isArray(dataValue) && typeof vgOrHybrid !== "function") {
				directiveNumValue = vgOrHybrid.strToNum(directive.value);

				if (directiveNumValue === null) {
					return false;
				}
			}

			if (!DirectiveMatch(directive, dataValue, directiveNumValue)) {
				return false;
			}
		}

		if (skippedDirectives.length > 0) {
			const skippedJoined = skippedDirectives.map((e) => e.originalStr).join(" ");
			const skippedJoinedLower = skippedJoined.toLowerCase();

			return allGetters.some((vgOrHybrid) => {
				const v = GetValueGetter(vgOrHybrid)(data);

				if (v === undefined) {
					console.warn(
						`Unexpected undefined in directive ${vgOrHybrid}, casting to null.`,
					);
					return null;
				}

				if (v === null) {
					return null;
				}

				// These don't make sense for a neutral.
				if (typeof v === "boolean") {
					return null;
				}

				return NeutralMatchLower(skippedJoinedLower, GetStrData(v));
			});
		}

		return true;
	};
}
