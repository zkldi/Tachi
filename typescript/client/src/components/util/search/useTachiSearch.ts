import { APIFetchV1, type UnsuccessfulAPIFetchResponse } from "#util/api";
import { useEffect, useState } from "react";
import {
	type ChartDocument,
	type FolderDocument,
	type integer,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

type SearchResults = {
	charts: {
		[TGame in V3Game]?: Array<{
			chart: ChartDocument;
			playcount: integer;
			song: SongDocument;
		}>;
	};
	folders: Array<FolderDocument>;
	users: Array<UserDocument>;
};

type ChartHashSearchReturns = {
	charts: {
		[TGame in V3Game]?: Array<{
			chart: ChartDocument;
			playcount: integer;
			song: SongDocument;
		}>;
	};
};

export function useTachiSearch(
	search: string,
	hasPlayedGame = false,
): {
	data: SearchResults | null;
	error: UnsuccessfulAPIFetchResponse | null;
} {
	const [data, setData] = useState<SearchResults | null>(null);
	const [error, setError] = useState<UnsuccessfulAPIFetchResponse | null>(null);

	useEffect(() => {
		if (search === "") {
			setData({
				charts: {},
				folders: [],
				users: [],
			});
			return;
		}

		// loadin...
		setData(null);

		const searches = [];

		searches.push(
			APIFetchV1<SearchResults>(
				`/search?search=${encodeURIComponent(search)}${
					hasPlayedGame ? "&hasPlayedGame=true" : ""
				}`,
			),
		);

		searches.push(
			APIFetchV1<ChartHashSearchReturns>(
				`/search/chart-hash?search=${encodeURIComponent(search)}`,
			),
		);

		Promise.all(searches)
			.then((results) => {
				const setValue: SearchResults = {
					users: [],
					charts: {},
					folders: [],
				};

				for (const result of results) {
					if (result.success === false) {
						console.error(result);
						return;
					}

					for (const [g, charts] of Object.entries(result.body.charts)) {
						const game = g as V3Game;

						if (setValue.charts[game]) {
							setValue.charts[game]!.push(...charts);
						} else {
							setValue.charts[game] = charts;
						}
					}

					if ("users" in result.body) {
						setValue.users.push(...(result.body.users as Array<UserDocument>));
					}
				}

				setData(setValue);
			})
			.catch((err) => {
				console.error(err);
				setData(null);
				setError({
					statusCode: 500,
					description: "Failed to reach the API.",
					success: false,
				});
			});
	}, [search, hasPlayedGame]);

	return { data, error };
}
