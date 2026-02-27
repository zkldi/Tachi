import { FormatTables } from "util/misc";
import React from "react";
import { ChartDocument, FormatDifficulty, Game, SongDocument } from "tachi-common";

export default function IIDXStyleSongChartInfoFormat({
	song,
	chart,
	game,
}: {
	song: SongDocument;
	chart: ChartDocument | null;
	game: Game;
}) {
	const genre =
		"flavorGenre" in song.data
			? song.data.flavorGenre
			: "genre" in song.data
			? song.data.genre
			: "";
	return (
		<>
			<h4>{genre}</h4>
			<h4 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{song.title}</h4>
			<h4>{song.artist}</h4>
			{chart && <h5>({LevelText(chart, game)})</h5>}
		</>
	);
}

function LevelText(chart: ChartDocument, game: Game) {
	if ("tableFolders" in chart.data) {
		const hasLevel = chart.data.tableFolders.length > 0;
		return hasLevel ? FormatTables(chart.data.tableFolders) : "No Level";
	}
	return FormatDifficulty(chart, game);
}
