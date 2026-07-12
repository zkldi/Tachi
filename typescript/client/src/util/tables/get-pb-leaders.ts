import { type Header } from "#components/tables/components/TachiTable";
import IndicatorHeader from "#components/tables/headers/IndicatorHeader";
import { type PBDataset } from "#types/tables";
import { StrSOV } from "#util/sorts";

type PBHeader = Header<PBDataset[0]>;

export function GetPBLeadingHeaders(
	showUser: boolean,
	showChart: boolean,
	chartHeader: PBHeader,
): PBHeader[] {
	const userHeader: PBHeader = ["User", "User", StrSOV((x) => x.__related.user!.username)];
	const songHeader: PBHeader = ["Song", "Song", StrSOV((x) => x.__related.song.title)];

	if (showUser && showChart) {
		return [userHeader, chartHeader, IndicatorHeader, songHeader];
	}
	if (showUser && !showChart) {
		return [IndicatorHeader, userHeader];
	}

	return [chartHeader, IndicatorHeader, songHeader];
}
