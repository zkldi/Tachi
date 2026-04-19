import { ReadCollection } from "../../util";
import { ChartDocument, SongDocument } from "tachi-common";

type OngekiSong = SongDocument<"ongeki">;
type OngekiChart = ChartDocument<"ongeki:Single">;

const hasCJK = (str: string) =>
	str.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/u);

const main = () => {
	const songs: OngekiSong[] = ReadCollection("songs-ongeki.json");
	const charts: OngekiChart[] = ReadCollection("charts-ongeki.json");

	const missingDurations: OngekiSong[] = [];
	const missingTerms: OngekiSong[] = [];
	const missingChartViews: OngekiSong[] = [];
	const missingIDs: Map<OngekiSong, number> = new Map();

	for (const song of songs) {
		if (song.data.duration === null) {
			missingDurations.push(song);
		}
		if (hasCJK(song.title) && song.searchTerms.length === 0) {
			missingTerms.push(song);
		}
	}

	for (const chart of charts) {
		const song = songs.find((s) => s.id === chart.songID);
		if (song === undefined) {
			throw new Error(`Unable to find song ${chart.songID}`);
		}
		if (
			(chart.levelNum >= 12.7 || chart.levelNum === 0) &&
			chart.data.chartViewURL === undefined
		) {
			missingChartViews.push(song);
		}
		if (chart.data.inGameID === null) {
			missingIDs.set(song, (missingIDs.get(song) ?? 0) + 1);
		}
	}

	console.log(
		`Missing chart views (${missingChartViews.length} total):\n${missingChartViews
			.map((s) => `\t ${s.id} ${s.title}`)
			.join("\n")}`
	);

	console.log(
		`Missing search terms (${missingTerms.length} total):\n${missingTerms
			.map((s) => `\t ${s.id} ${s.title}`)
			.join("\n")}`
	);

	console.log(
		`Missing durations (${missingDurations.length} total):\n${missingDurations
			.map((s) => `\t ${s.id} ${s.title}`)
			.join("\n")}`
	);

	console.log(
		`Missing IDs (${missingIDs.size} total):\n${[...missingIDs]
			.map(([song, count]) => `\t ${song.id} ${song.title} [${count}]`)
			.join("\n")}`
	);
};

main();
