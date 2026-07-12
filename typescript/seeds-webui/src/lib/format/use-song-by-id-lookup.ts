import type { V3Game } from "tachi-common/types";

import { type Row } from "#lib/diff/row-primary-key";
import { fetchCollection } from "#lib/transport/collection-cache";
import { useMemo } from "react";
import { useQuery } from "react-query";
import { GameToGameGroup } from "tachi-common/config/config";

/**
 * Loads `songs-${group}.json` (working tree) and indexes by song `id`, for
 * chart rows that need a song join to format with {@link prettySeedDocSummary}.
 */
export function useSongByIdLookup(collectionName: string | undefined) {
	const songFile = useMemo(() => {
		if (!collectionName?.startsWith("charts-")) {
			return null;
		}
		const game = collectionName.replace(/^charts-/u, "").replace(/\.json$/u, "") as V3Game;
		return `songs-${GameToGameGroup(game)}.json`;
	}, [collectionName]);

	return useQuery(
		["song-by-id-lookup", songFile],
		async () => {
			const data = await fetchCollection(songFile!);
			const m = new Map<string, Row>();
			for (const r of data as Record<string, unknown>[]) {
				if (typeof r.id === "string") {
					m.set(r.id, r as Row);
				}
			}
			return m;
		},
		{ enabled: !!songFile, staleTime: 60_000 },
	);
}
