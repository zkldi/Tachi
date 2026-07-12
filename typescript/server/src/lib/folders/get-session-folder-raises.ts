import { LoadFolderDocumentsByIds } from "#lib/db-formats/folders";
import { GetEnumDistForFolderAsOf, GetFolderIDsForChartId } from "#lib/folders/folders";
import { GetSessionData } from "#utils/queries/sessions";
import {
	type FolderDocument,
	GetGameConfig,
	GetScoreEnumConfs,
	type integer,
	type SessionDocument,
	type V3Game,
} from "tachi-common";

export type SessionFolderRaisesPayload = {
	folder: FolderDocument;
	previousCount: integer;
	raisedCharts: Array<string>;
	totalCharts: integer;
	type: string;
	value: string;
};

function bucketKey(folderId: string, metric: string, value: string): string {
	return JSON.stringify([folderId, metric, value]);
}

function parseBucketKey(key: string): [string, string, string] {
	const parsed = JSON.parse(key) as [string, string, string];
	return parsed;
}

/**
 * Per-chart folder ids (lookup is identical for all scores on the same chart).
 */
async function folderIdsForChartCached(
	chartId: string,
	cache: Map<string, Array<string>>,
): Promise<Array<string>> {
	let ids = cache.get(chartId);

	if (!ids) {
		ids = await GetFolderIDsForChartId(chartId);
		cache.set(chartId, ids);
	}

	return ids;
}

/**
 * Folder raise rows for the session view: which folders gained which enum
 * values on which charts, and the user's exact folder distribution before
 * {@link SessionDocument.timeStarted}.
 */
export async function GetSessionFolderRaises(
	session: SessionDocument,
): Promise<Array<SessionFolderRaisesPayload>> {
	const { scores, scoreInfo } = await GetSessionData(session);
	const scoreMap = new Map(scores.map((s) => [s.scoreID, s]));
	const gameConfig = GetGameConfig(session.game as V3Game);
	const enumMetrics = GetScoreEnumConfs(gameConfig);

	const chartFolderCache = new Map<string, Array<string>>();
	const bucket = new Map<string, Set<string>>();

	for (const info of scoreInfo) {
		const score = scoreMap.get(info.scoreID);

		if (!score) {
			continue;
		}

		for (const [metric, conf] of Object.entries(enumMetrics)) {
			const enumIndexes = score.scoreData.enumIndexes;
			const newIdx = enumIndexes?.[metric as keyof typeof enumIndexes];

			if (newIdx === undefined) {
				continue;
			}

			// Index of this metric before this score. New scores had no previous
			// PB, so they crossed every threshold from the bottom.
			let oldIdx: number;

			if (info.isNewScore) {
				oldIdx = -1;
			} else {
				const delta = info.deltas[metric];

				if (delta === undefined || delta <= 0) {
					continue;
				}

				oldIdx = newIdx - delta;
			}

			const minIdx = conf.values.indexOf(conf.minimumRelevantValue);

			// This view is cumulative: reaching e.g. EX HARD CLEAR also counts as
			// a HARD CLEAR (and CLEAR, ...). So this score raised every enum
			// value-or-better bucket it crossed, i.e. every threshold in
			// (oldIdx, newIdx]. Only surface thresholds above the
			// minimum-relevant value (so we don't show NO PLAY / FAILED rows).
			const startIdx = Math.max(oldIdx, minIdx) + 1;

			if (startIdx > newIdx) {
				continue;
			}

			const folderIds = await folderIdsForChartCached(score.chartID, chartFolderCache);

			for (let vi = startIdx; vi <= newIdx; vi++) {
				const value = conf.values[vi];

				if (value === undefined) {
					continue;
				}

				for (const folderId of folderIds) {
					const key = bucketKey(folderId, metric, value);
					let set = bucket.get(key);

					if (!set) {
						set = new Set();
						bucket.set(key, set);
					}

					set.add(score.chartID);
				}
			}
		}
	}

	if (bucket.size === 0) {
		return [];
	}

	const folderIds = [...new Set([...bucket.keys()].map((k) => parseBucketKey(k)[0]))];
	const folderDocs = await LoadFolderDocumentsByIds(folderIds);

	const distCache = new Map<string, Awaited<ReturnType<typeof GetEnumDistForFolderAsOf>>>();

	await Promise.all(
		folderIds.map(async (fid) => {
			const dist = await GetEnumDistForFolderAsOf(session.userID, fid, session.timeStarted);

			distCache.set(fid, dist);
		}),
	);

	const out: Array<SessionFolderRaisesPayload> = [];

	for (const [key, chartSet] of bucket) {
		const [folderId, metric, value] = parseBucketKey(key);
		const folder = folderDocs.get(folderId);

		if (!folder || folder.game !== session.game) {
			continue;
		}

		const dist = distCache.get(folderId);

		if (!dist) {
			continue;
		}

		// Cumulative: how many charts were already at this value-or-better before
		// the session. Pairs with the cumulative raise buckets above so that
		// `previousCount + raisedCharts.length` is the true value-or-better total.
		const previousCount = dist.cumulativeEnumDist[metric]?.[value] ?? 0;

		out.push({
			folder,
			previousCount,
			raisedCharts: [...chartSet],
			totalCharts: dist.chartIDs.length,
			type: metric,
			value,
		});
	}

	return out;
}
