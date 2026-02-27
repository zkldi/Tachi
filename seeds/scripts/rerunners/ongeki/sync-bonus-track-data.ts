import { ReadCollection, WriteCollection } from "../../util";
import { ChartDocument, SongDocument } from "tachi-common";

type OngekiSong = SongDocument<"ongeki">;
type OngekiChart = ChartDocument<"ongeki:Single">;

const characters = {
	"星咲 あかり": "Hoshizaki Akari",
	"藤沢 柚子": "Fujisawa Yuzu",
	"三角 葵": "Misumi Aoi",
	"高瀬 梨緒": "Takase Rio",
	"結城 莉玖": "Yūki Riku",
	"藍原 椿": "Aihara Tsubaki",
	"早乙女 彩華": "Saotome Ayaka",
	"桜井 春菜": "Sakurai Haruna",
	"柏木 咲姫": "Kashiwagi Saki",
	"井之原 小星": "Inohara Koboshi",
	"逢坂 茜": "Ōsaka Akane",
	"九條 楓": "Kujō Kaede",
	"珠洲島 有栖": "Suzushima Arisu",
	"日向 千夏": "Hinata Chinatsu",
	"柏木 美亜": "Kashiwagi Mia",
	"東雲 つむぎ": "Shinonome Tsumugi",
	"皇城 セツナ": "Sumeragi Setsuna",
	"式宮 舞菜": "Shikimiya Mana",
	"式宮 碧音": "Shikimiya Aone",
};

// Songs that have search terms and don't need a romanization
const searchTermBlacklist = ["Iudicium “Apocalypsis Mix”"];

const isBonusTrack = (song: OngekiSong, charts: OngekiChart[]) => {
	const chart = charts.find((ch) => ch.songID === song.id);
	return chart?.data.isBonusTrack;
};

const splitTitle = (song: OngekiSong) => {
	const match = song.title.match(/(.+) +-(.+)ソロver\.-/u);
	if (match === null || match.length !== 3) {
		throw new Error(`Invalid bonus track title: ${song.title}`);
	}
	const [, title, character] = match;
	return {
		title: title!.trim(),
		character: character!,
	};
};

const findOriginalSong = (originalTitle: string, songs: OngekiSong[]) => {
	const results = songs.filter(
		// The song Dramatic uses a different question mark in the OG title and bonus titles
		(s) => s.title.replace("？", "?") === originalTitle.replace("？", "?")
	);
	if (results.length !== 1) {
		throw new Error(`Invalid bonus track: ${originalTitle}`);
	}
	return results[0]!;
};

const main = () => {
	const songs: OngekiSong[] = ReadCollection("songs-ongeki.json");
	const charts: OngekiChart[] = ReadCollection("charts-ongeki.json");

	for (const bonusSong of songs) {
		if (!isBonusTrack(bonusSong, charts)) {
			continue;
		}

		const { title, character } = splitTitle(bonusSong);
		const originalSong = findOriginalSong(title, songs);

		bonusSong.data.flavorGenre = originalSong.data.flavorGenre;

		if (characters[character] === undefined) {
			throw new Error(`Unknown character: ${character}`);
		}

		const fixedTitle = title.replace(/？/gu, "?").replace(/…/gu, "...").replace(/！/gu, "!");

		if (originalSong.searchTerms.length > 0 && !searchTermBlacklist.includes(title)) {
			bonusSong.searchTerms = [
				`${originalSong.searchTerms[0]} -${characters[character]} Solo ver.-`,
				...originalSong.searchTerms.slice(1),
			];
		} else {
			bonusSong.searchTerms = [
				`${fixedTitle} -${characters[character]} Solo ver.-`,
				...originalSong.searchTerms,
			];
		}

		for (const chart of charts.filter((ch) => ch.songID === bonusSong.id)) {
			const originalChart = charts.find(
				(ch) => ch.songID === originalSong.id && ch.difficulty === chart.difficulty
			);
			if (originalChart === undefined) {
				throw new Error(`Cannot find ${originalSong.title} ${chart.difficulty}`);
			}
			chart.data.chartViewURL = originalChart.data.chartViewURL;
		}
	}

	WriteCollection(`songs-ongeki.json`, songs);
	WriteCollection(`charts-ongeki.json`, charts);
};

main();
