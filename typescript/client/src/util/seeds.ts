import { type Header } from "#components/tables/components/TachiTable";
import { EmptyHeader } from "#components/tables/headers/IndicatorHeader";
import { type ZTableSortFn } from "#components/util/table/useZTable";
import { type Branch, type GitCommit } from "#types/git";
import {
	type BMSCourseWithRelated,
	type ChartWithRelated,
	type QuestlineWithRelated,
	type QuestWithRelated,
	type DiffSeedsCollection as SeedsDiff,
	type TableWithRelated,
} from "#types/seeds";
import {
	type AllDatabaseSeeds,
	type ChartDocumentData,
	computeFolderSlug,
	CreateSongMap,
	DatabaseSeedNames,
	type GameGroup,
	type SeedFolderRow,
	type SEEDS_BMSCourseDocument,
	type SEEDS_ChartDocument,
	type SEEDS_FolderDocument,
	type SEEDS_GoalDocument,
	type SEEDS_QuestDocument,
	type SEEDS_QuestlineDocument,
	type SEEDS_TableDocument,
	type SongDocument,
} from "tachi-common";

import { APIFetchV1 } from "./api";
import { CreateGoalMap, GetGoalIDsFromQuest } from "./data";
import { CreateQuestMap, Dedupe, type JSONAttributeDiff, JSONCompare } from "./misc";
import { type ValueGetterOrHybrid } from "./ztable/search";

/**
 * Given a repo and a reference return the status of db/seeds
 * as of that commit.
 *
 * If "WORKING_DIRECTORY" is passed as a ref, and the repository is local, this will
 * be inferred as reading from the current state of collections on-disk.
 */
export async function LoadSeeds(repo: string, ref: string): Promise<Partial<AllDatabaseSeeds>> {
	if (repo === "local") {
		const params = new URLSearchParams();

		if (ref !== "WORKING_DIRECTORY") {
			params.set("revision", ref);
		}

		const res = await APIFetchV1<Partial<AllDatabaseSeeds>>(
			`/seeds/collections?${params.toString()}`,
		);

		if (!res.success) {
			throw new Error(
				`Failed to fetch collections @ ${ref}. ${res.statusCode}: ${res.description}`,
			);
		}

		return res.body;
	} else if (repo.startsWith("GitHub:")) {
		const data: Partial<AllDatabaseSeeds> = {};

		await Promise.all(
			DatabaseSeedNames.map(async (file) => {
				const res = await fetch(
					`https://raw.githubusercontent.com/${repo.substring(
						"GitHub:".length,
					)}/${ref}/db/seeds/${file}`,
				);

				if (res.status === 404) {
					data[file] = [];
				} else if (res.status === 200) {
					data[file] = await res.json();
				} else {
					throw new Error(
						`Failed to fetch collections @ ${repo} ${ref}. ${
							res.status
						} ${await res.text()}`,
					);
				}
			}),
		);

		return data;
	}

	throw new Error(`Unknown repository type '${repo}'.`);
}

export async function LoadCommit(repo: string, sha: string): Promise<GitCommit | null> {
	if (repo === "local") {
		if (sha === "WORKING_DIRECTORY") {
			const branchRes = await APIFetchV1<{ current: Branch }>(`/seeds/branches`);

			if (!branchRes.success) {
				throw new Error(`Failed to fetch branches, but was loading LOCAL_DIRECTORY?`);
			}

			const params = new URLSearchParams({ branch: branchRes.body.current.name });

			const res = await APIFetchV1<Array<GitCommit>>(`/seeds/commits?${params.toString()}`);

			if (!res.success) {
				throw new Error(`Failed to fetch commits, but was loading LOCAL_DIRECTORY?`);
			}

			return {
				sha: "WORKING_DIRECTORY",
				commit: {
					author: {
						name: "Not Committed Yet",
						date: "1970-01-01",
						email: "null@example.com",
					},
					committer: {
						name: "Not Committed Yet",
						date: "1970-01-01",
						email: "null@example.com",
					},
					message: "Uncommitted changes on your local disk.",
				},
				parents: [{ sha: res.body[0].sha! }],
			};
		}

		const params = new URLSearchParams({ sha });

		const res = await APIFetchV1<GitCommit>(`/seeds/commit?${params.toString()}`);

		if (!res.success) {
			throw new Error(`Failed to fetch info about commit ${sha}: ${res.description}.`);
		}

		return res.body;
	} else if (repo.startsWith("GitHub:")) {
		const repoName = repo.slice("GitHub:".length);

		try {
			const res = await fetch(`https://api.github.com/repos/${repoName}/commits/${sha}`);

			if (res.status !== 200) {
				throw new Error(`Failed to fetch commit`);
			}

			const c: GitCommit = await res.json();

			return c;
		} catch (err) {
			console.error(err);
			// return null anyway, invalid ref.
			return null;
		}
	}

	console.warn(`Unknown repo type ${repo}.`);
	return null;
}

type NotSongsChartsSeeds = Exclude<
	keyof AllDatabaseSeeds,
	`charts-${GameGroup}.json` | `songs-${GameGroup}.json`
>;

export function MakeDataset<K extends keyof AllDatabaseSeeds>(
	file: K,
	data: Partial<AllDatabaseSeeds>,
) /*: DatabaseSeedsWithRelated[K] */ {
	if (file.startsWith("songs-")) {
		return data[file] ?? [];
	} else if (file.startsWith("charts-")) {
		return RelateCharts(data, file);
	}

	const f = file as NotSongsChartsSeeds;

	switch (f) {
		case "bms-course-lookup.json":
			return RelateBMSCourses(data);

		case "folders.json":
			// folders don't need any extra data.
			return data["folders.json"] ?? [];

		case "goals.json":
			return data["goals.json"] ?? [];
		case "questlines.json":
			return RelateQuestlines(data);
		case "quests.json":
			return RelateQuests(data);
		case "tables.json":
			return RelateTables(data);
	}
}

function RelateBMSCourses(data: Partial<AllDatabaseSeeds>): BMSCourseWithRelated[] {
	const base = data["bms-course-lookup.json"];

	if (!base) {
		return [];
	}

	const bmsSongs = data["songs-bms.json"];
	const bms7kCharts = data["charts-bms-7k.json"] ?? [];
	const bms14kCharts = data["charts-bms-14k.json"] ?? [];
	const bmsCharts = [...bms7kCharts, ...bms14kCharts];

	if (!bmsSongs) {
		return [];
	}

	const songMap = CreateSongMap(bmsSongs);
	const chartMap = new Map<string, SEEDS_ChartDocument<"bms-7k" | "bms-14k">>();

	for (const chart of bmsCharts) {
		const d = chart.data as ChartDocumentData["bms-7k"] | ChartDocumentData["bms-14k"];
		chartMap.set(d.hashMD5, chart);
	}

	return base.map((course) => {
		// md5 hashes are 32 chars long; a bms course may be comprised of any amount of
		// md5s. This splits the string every 32 characters into an array.
		const md5s = course.md5sums.match(/.{32}/gu);

		if (!md5s) {
			throw new Error(`Invalid MD5s in BMS Course? Got ${md5s}.`);
		}

		const dwr: BMSCourseWithRelated = {
			...course,
			__related: {
				entries: md5s.map((e) => {
					if (!chartMap.has(e)) {
						return e;
					}

					return {
						chart: chartMap.get(e)!,
						song: songMap.get(chartMap.get(e)!.songID)! as SongDocument<"bms">,
					};
				}),
			},
		};

		return dwr;
	});
}

function RelateTables(data: Partial<AllDatabaseSeeds>): TableWithRelated[] {
	const base = data["tables.json"];

	if (!base) {
		return [];
	}

	const folderById = new Map<string, SEEDS_FolderDocument>();
	const folderByGameSlug = new Map<string, SEEDS_FolderDocument>();

	for (const folder of data["folders.json"] ?? []) {
		const raw = folder;
		const id = raw.id;

		if (id !== undefined) {
			folderById.set(id, folder);
		}

		const slug =
			typeof raw.slug === "string" && raw.slug !== ""
				? raw.slug
				: computeFolderSlug({
						game: String(raw.game),
						id: id ?? "",
						title: raw.title,
						where: raw.where ?? "",
						versionFilter: raw.versionFilter,
					} as SeedFolderRow);

		folderByGameSlug.set(`${String(raw.game)}:${slug}`, folder);
	}

	return base.map((e) => ({
		...e,
		__related: {
			// If the table refers to a folder that doesn't exist
			// (which is entirely possible and has happened before)
			// then when the table renderer goes to render its folders, it will get
			// undefined anyway.
			folders: Object.fromEntries(
				e.folders.map((ref) => {
					const bySlug = folderByGameSlug.get(`${e.game}:${ref}`);
					const byId = folderById.get(ref);
					const doc = bySlug ?? byId;

					return [ref, doc];
				}),
			),
		},
	}));
}

function RelateQuestlines(data: Partial<AllDatabaseSeeds>): QuestlineWithRelated[] {
	const base = data["questlines.json"];

	if (!base) {
		return [];
	}

	const questMap = CreateQuestMap(data["quests.json"] ?? []);

	return base.map((e) => ({
		...e,
		__related: {
			quests: Object.fromEntries(e.quests.map((e) => [e, questMap.get(e)])),
		},
	}));
}

function RelateQuests(data: Partial<AllDatabaseSeeds>): QuestWithRelated[] {
	const base = data["quests.json"];

	if (!base) {
		return [];
	}

	const goalMap = CreateGoalMap(data["goals.json"] ?? []);

	return base.map((e) => ({
		...e,
		__related: {
			goals: Object.fromEntries(GetGoalIDsFromQuest(e).map((e) => [e, goalMap.get(e)])),
		},
	}));
}

function RelateCharts(data: Partial<AllDatabaseSeeds>, file: string): ChartWithRelated[] {
	const [_, game] = /charts-(.*?)\.json/u.exec(file)!;

	const songs = data[`songs-${game}.json` as keyof AllDatabaseSeeds] as
		| Array<SongDocument>
		| undefined;
	const charts = data[`charts-${game}.json` as keyof AllDatabaseSeeds] as
		| Array<SEEDS_ChartDocument>
		| undefined;

	if (!charts) {
		return [];
	}

	if (!songs) {
		throw new Error(`Game ${game} has charts, but no songs?`);
	}

	const songMap = CreateSongMap(songs);

	return charts.map((e) => ({
		...e,
		__related: {
			song: songMap.get(e.songID),
		},
	}));
}

export type DBSeedsCollection = AllDatabaseSeeds[keyof AllDatabaseSeeds][0];

export interface DBSeedsDiffModified<T extends DBSeedsCollection> {
	type: "MODIFIED";
	base: T;
	diff: JSONAttributeDiff[];
	head: T;
}

export interface DBSeedsDiffNew<T extends DBSeedsCollection> {
	type: "ADDED";
	head: T;
}

export interface DBSeedsDiffDeleted<T extends DBSeedsCollection> {
	type: "DELETED";
	base: T;
}

/**
 * A diff may be any of three states:
 *
 * ADDED -> This did not exist in base, but now exists in HEAD
 * DELETED -> This existed in base, but does not exist in HEAD
 * MODIFIED -> This exists in both base and HEAD, but does not have equivalent checksums.
 */
export type DBSeedsDiff<T extends DBSeedsCollection> =
	| DBSeedsDiffDeleted<T>
	| DBSeedsDiffModified<T>
	| DBSeedsDiffNew<T>;

export type DBSeedsDiffs = Partial<{
	[K in keyof AllDatabaseSeeds]: Array<DBSeedsDiff<DBSeedsCollection>>;
}>;

/**
 * Given two full states of seeds, Return all the changes in each collection.
 *
 *
 */
export function DiffSeeds(
	base: Partial<AllDatabaseSeeds>,
	head: Partial<AllDatabaseSeeds>,
): DBSeedsDiffs {
	const diffs: DBSeedsDiffs = {};

	const baseCollections = Object.keys(base) as (keyof AllDatabaseSeeds)[];
	const headCollections = Object.keys(head) as (keyof AllDatabaseSeeds)[];

	// Base and HEAD might add new/remove collections. This allows us to iterate
	// over the union of both sets
	const allCollections = Dedupe([...baseCollections, ...headCollections]);

	for (const collection of allCollections) {
		const baseState = base[collection] as DBSeedsCollection[];
		const headState = head[collection] as DBSeedsCollection[];

		const colDiff = DiffCollection(collection, baseState, headState);

		diffs[collection] = colDiff;
	}

	return diffs as DBSeedsDiffs;
}

function DiffCollection<T extends DBSeedsCollection>(
	collection: keyof AllDatabaseSeeds,
	baseState: T[] | undefined,
	headState: T[] | undefined,
): Array<DBSeedsDiff<T>> {
	if (!headState && !baseState) {
		// this is a collection that exists,
		// but, neither head or base reports that it exists?
		// this should **never** happen, but we can recover.
		console.warn(
			`Collection ${collection} exists, but neither HEAD nor base have it as existing?`,
		);

		// return early with 0 diffs I guess? null to null is no diffs.
		return [];
	} else if (baseState && !headState) {
		// if this collection was deleted in head, then everything is a removal.

		// so, typescript has a bit of a moment here where it thinks that an
		// Array (A) of type T mapped to A' means that T and T'
		// - although being the same union type -
		// might be different members of that union via the mapping.
		// it's right. I know it's right, but god damnit it's wrong.
		return baseState.map((e) => ({
			type: "DELETED",
			base: e as any,
		}));
	} else if (!baseState && headState) {
		// if this collection didn't exist in base, but exists in head
		// then everything is an addition.

		return headState.map((e) => ({
			type: "ADDED",
			head: e as any,
		}));
	}

	// the above fail cases mean that both headState and baseState must be defined
	// however, TS cannot infer this.
	if (!headState || !baseState) {
		throw new Error(
			`INVARIANT FAILED: headState or baseState was undefined. This is not possible at this point in the program due to basic boolean logic, and only exists to prevent a TS error. How did this *ever* happen?`,
		);
	}

	// otherwise. lets get diffing...
	const diffs: Array<DBSeedsDiff<T>> = [];

	// create lookup tables on UNIQ(T) -> T for the entire set.
	const headMap = new Map<string, T>();
	for (const d of headState) {
		headMap.set(GetUniqID(collection, d)!, d);
	}

	const baseMap = new Map<string, T>();
	for (const d of baseState) {
		baseMap.set(GetUniqID(collection, d)!, d);
	}

	const allIds = Dedupe([...headMap.keys(), ...baseMap.keys()]);

	for (const id of allIds) {
		const base = baseMap.get(id);
		const head = headMap.get(id);

		// not possible. we check it anyway.
		if (!head && !base) {
			console.warn(`ID ${id} exists, but neither HEAD nor base have it as existing?`);
			continue;
		} else if (base && !head) {
			// not in head, but was in base.
			diffs.push({
				type: "DELETED",
				base,
			});
		} else if (head && !base) {
			// wasn't in base, but was in head
			diffs.push({
				type: "ADDED",
				head,
			});
		} else if (head && base) {
			// existed in both. We need to compare these two deeply.

			// these things *are* different. time to find out what.
			const objDiffs = JSONCompare(base, head);

			// shouldn't be possible, but we mightaswell handle it.
			if (objDiffs.length === 0) {
				continue;
			}

			diffs.push({
				type: "MODIFIED",
				diff: objDiffs,
				base,
				head,
			});
		}
	}

	return diffs;
}

/**
 * Given a value and what collection it's from, return it's unique identifier --
 * so songID, chartID, etc.
 *
 * We do this to detect when things have been modified.
 */
function GetUniqID<K extends keyof AllDatabaseSeeds>(collection: K, value: AllDatabaseSeeds[K][0]) {
	if (collection.startsWith("songs-")) {
		return (value as SongDocument).id.toString();
	} else if (collection.startsWith("charts-")) {
		return (value as SEEDS_ChartDocument).id;
	}

	const c = collection as NotSongsChartsSeeds;

	switch (c) {
		case "bms-course-lookup.json": {
			const v = value as SEEDS_BMSCourseDocument;
			return `${v.set}-${v.game}-${v.value}`;
		}
		case "folders.json": {
			const v = value as SEEDS_FolderDocument;
			return v.id;
		}
		case "tables.json": {
			const v = value as SEEDS_TableDocument;
			return v.id;
		}
		case "goals.json": {
			const v = value as SEEDS_GoalDocument;
			return v.goalID;
		}
		case "quests.json": {
			const v = value as SEEDS_QuestDocument;
			return v.questID;
		}
		case "questlines.json": {
			const v = value as SEEDS_QuestlineDocument;
			return v.questlineID;
		}
	}
}

/**
 * Given an array of headers upon T, return the headers for Diff<T>.
 */
export function HeadersToDiffHeaders<T>(headers: Header<T>[]): Header<SeedsDiff<T>>[] {
	const headHeaders = headers.map((e) => {
		const sortFn = e[2];

		if (sortFn) {
			// turn the sort function into sort(a.head, b.head);
			const newSortFn: ZTableSortFn<SeedsDiff<T>> = (a, b) => sortFn(a.head, b.head);

			return [e[0], e[1], newSortFn, e[3]];
		}

		return e;
	}) as Header<SeedsDiff<T>>[];

	const newHeaders: Header<SeedsDiff<T>>[] = [
		EmptyHeader, // diff indicator goes here
		...headHeaders, // new state
		["Diff", "Diff"], // raw diff showing
	];

	return newHeaders;
}

/**
 * Given a record of search functions, convert them into ${x}_new and ${x}_old functions.
 */
export function SearchFnsToDiffSearchFns<T>(
	searchFns: Record<string, ValueGetterOrHybrid<T>>,
): Record<string, ValueGetterOrHybrid<SeedsDiff<T>>> {
	const newSearches: Record<string, ValueGetterOrHybrid<SeedsDiff<T>>> = {};

	for (const [key, fn] of Object.entries(searchFns)) {
		if (typeof fn === "function") {
			newSearches[`${key}_old`] = (x) => fn(x.base);
			newSearches[key] = (x) => fn(x.head);
		} else {
			newSearches[`${key}_old`] = {
				strToNum: fn.strToNum,
				valueGetter: (x) => fn.valueGetter(x.base),
			};
			newSearches[key] = {
				strToNum: fn.strToNum,
				valueGetter: (x) => fn.valueGetter(x.head),
			};
		}
	}

	return newSearches;
}
