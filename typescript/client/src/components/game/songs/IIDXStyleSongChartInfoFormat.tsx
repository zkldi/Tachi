import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { FormatTables } from "#util/misc";
import {
	type ChartDocument,
	FormatDifficultyLong,
	type SongDocument,
	type V3Game,
} from "tachi-common";

export default function IIDXStyleSongChartInfoFormat({
	song,
	chart,
	game,
}: {
	chart: ChartDocument | null;
	game: V3Game;
	song: SongDocument<
		"arcaea" | "bms" | "chunithm" | "iidx" | "maimaidx" | "ongeki" | "pms" | "popn"
	>;
}) {
	let genre: string;
	if (game === "ongeki") {
		genre =
			(song as SongDocument<"ongeki">).data.flavorGenre ??
			(song as SongDocument<"ongeki">).data.genre;
	} else if (game === "arcaea") {
		genre = (song as SongDocument<"arcaea">).data.songPack;
	} else {
		genre = (song as any).data.genre;
	}

	return (
		<>
			<h4>{genre}</h4>
			<SongTitle game={game} song={song} />
			<h4>{song.artist}</h4>
			{chart && <h5>({LevelText(chart)})</h5>}
		</>
	);
}

function SongTitle({ game, song }: { game: V3Game; song: SongDocument }) {
	if (game === "ongeki" && "titleEn" in song.data) {
		return (
			<QuickTooltip
				tooltipContent={<h4 style={{ fontWeight: "bold" }}>{song.data.titleEn}</h4>}
				wide
			>
				<h4 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{song.title}</h4>
			</QuickTooltip>
		);
	}

	return <h4 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{song.title}</h4>;
}

function LevelText(chart: ChartDocument) {
	if ("tableFolders" in chart.data) {
		const hasLevel = Object.keys(chart.data.tableFolders).length > 0;
		return hasLevel ? FormatTables(chart.data.tableFolders) : "No Level";
	}
	return FormatDifficultyLong(chart);
}
