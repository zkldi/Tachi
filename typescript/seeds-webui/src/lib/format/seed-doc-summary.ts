import type { V3Game } from "tachi-common/types";

import { primaryKey, type Row } from "#lib/diff/row-primary-key";
import { type Flavour, flavourFor } from "#lib/sqlite/schema";
import { FormatChart } from "tachi-common/utils/util";

export type SeedDocSummaryOpts = {
	/** Lookup by song `id` when `songDoc` is not provided (git diff / drafts). */
	songById?: Map<string, Row> | null;
	/** For `charts-*` collections, joined song document (e.g. from SQLite join). */
	songDoc?: Record<string, unknown> | null;
};

/**
 * Human-readable one-liner for a seeds row - same rules as the collection
 * browser list (FormatChart for charts with a song, title - artist for songs,
 * etc.).
 */
export function prettySeedDocSummary(
	collectionName: string,
	doc: Row,
	opts?: SeedDocSummaryOpts,
): string {
	let flav: Flavour;
	try {
		flav = flavourFor(collectionName);
	} catch {
		return primaryKey(doc) ?? "(unknown)";
	}

	const songFromOpts = opts?.songDoc;
	const songFromMap =
		opts?.songById && typeof doc.songID === "string"
			? opts.songById.get(doc.songID)
			: undefined;
	const songDoc = songFromOpts ?? songFromMap;

	switch (flav) {
		case "charts": {
			const game = collectionName.replace(/^charts-/u, "").replace(/\.json$/u, "") as V3Game;
			if (songDoc && game) {
				try {
					return FormatChart({ ...doc, game, song: songDoc } as unknown as Parameters<
						typeof FormatChart
					>[0]);
				} catch {
					// Fall through to simple format if FormatChart fails.
				}
			}
			return [doc.difficulty, doc.level ? `Lv.${doc.level}` : null].filter(Boolean).join(" ");
		}
		case "songs": {
			const title = str(doc.title);
			const artist = str(doc.artist);
			return artist ? `${title} - ${artist}` : title;
		}
		case "folders":
		case "tables": {
			const title = str(doc.title);
			const tag = [doc.game, doc.playtype].filter(Boolean).join(" ");
			return tag ? `${title} (${tag})` : title;
		}
		case "goals":
		case "quests":
		case "questlines": {
			const nm = str(doc.name);
			const tag = [doc.game, doc.playtype].filter(Boolean).join(" ");
			return tag ? `${nm} (${tag})` : nm;
		}
		case "bms-course-lookup": {
			const title = str(doc.title ?? doc.set);
			const set = doc.set ? ` [${doc.set}]` : "";
			return `${title}${set}`;
		}
		default:
			return pkSummary(doc);
	}
}

function str(v: unknown): string {
	return typeof v === "string" ? v : String(v ?? "");
}

function pkSummary(row: Row): string {
	const pk = primaryKey(row);
	return pk ?? "(unknown)";
}
