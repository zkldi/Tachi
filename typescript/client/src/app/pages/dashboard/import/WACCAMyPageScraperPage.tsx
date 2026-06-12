import ImportFileInfo from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";

function RecordsParseFunction(data: string) {
	if (
		!data.startsWith(
			"music_id,music_title,music_artist,music_genre,music_levels,music_play_counts,music_scores,music_achieves",
		)
	) {
		throw new Error(
			"The first line of the CSV doesn't have the right headers. Are you sure this is the records.csv file?",
		);
	}

	return {
		valid: true,
		info: {
			// Note: Most other file import types provide a number of scores. It
			// doesn't make sense for this import type since we always expect
			// all the songs to be present - the only indicator for an unplayed
			// song/chart is that the score is 0, so to provide this would would
			// need to basically parse the whole file anyway.
		},
	};
}

function PlayerParseFunction(data: string) {
	if (
		!data.startsWith(
			"player_name,player_level,player_rate,player_stage,player_play_count,player_play_count_versus,player_play_count_coop,player_total_rp_earned,player_total_rp_spent",
		)
	) {
		throw new Error(
			"The first line of the CSV doesn't have the right headers. Are you sure this is the player.csv file?",
		);
	}

	return {
		valid: true,
		info: {},
	};
}
export default function WACCASiteImportPage() {
	useSetSubheader(["Import Scores", "WaccaMyPageScraperImporter"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is WaccaMyPageScraper?</h1>
			<div>
				<ExternalLink href="https://github.com/XezolesS/WaccaMyPageScraper/">
					WaccaMyPageScraper
				</ExternalLink>{" "}
				is a scraper for the official WACCA MyPage service site. Since the site is offline
				as of September 1, 2022, this is only useful if you have used the scraper before
				then.
			</div>
			<h1 className="text-center my-4">What can I import?</h1>
			<div>
				Based on the data saved from the scraper, your <b>PBs</b> and{" "}
				<b>maximum Stage Up rank</b> can be imported. WaccaMyPageScraper doesn't record any
				recent plays, so if you have played a chart multiple times, only the PB will be
				imported.
			</div>
			<h1 className="text-center my-4">How does it work?</h1>
			<div>
				Within the WaccaMyPageScraper directory there is a "data" directory, which contains
				two files we care about:
				<ul>
					<li>
						<b>records/records.csv</b> contains all your personal bests.
					</li>
					<li>
						<b>player/player.csv</b> contains your player info, including your Stage Up
						rank.
					</li>
				</ul>
				Both of these can be imported below in the corresponding sections.
			</div>
			<Divider />
			<h1 className="text-center my-4">Import PBs</h1>
			<ImportFileInfo
				acceptMime="text/csv"
				importType="file/mypagescraper-records-csv"
				name="data/records/records.csv"
				parseFunction={RecordsParseFunction}
			/>
			<Divider />
			<h1 className="text-center my-4">Import Stage Up</h1>
			<ImportFileInfo
				acceptMime="text/csv"
				importType="file/mypagescraper-player-csv"
				name="data/player/player.csv"
				parseFunction={PlayerParseFunction}
			/>
		</div>
	);
}
