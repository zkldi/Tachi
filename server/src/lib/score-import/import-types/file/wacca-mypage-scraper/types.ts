export interface MyPageRecordsRawCSVRecord {
	// eslint-disable-next-line lines-around-comment -- https://github.com/zkldi/Tachi/pull/673#discussion_r965947793
	// These are snake case in the CSV. The first line of the CSV is:
	// music_id,music_title,music_artist,music_genre,music_levels,music_play_counts,music_scores,music_achieves
	// We only care about these fields. Currently we use music_title but
	// we should switch to music_id once it's confirmed to match data.
	music_id: string;
	music_title: string;
	music_levels: string;
	music_scores: string;
	music_achieves: string;
}

export interface MyPageRecordsParsedPB {
	songId: number;
	songTitle: string;
	diffIndex: number;
	level: string;
	score: number;
	lamp: number;
}

export interface MyPagePlayerStage {
	// eslint-disable-next-line lines-around-comment -- https://github.com/zkldichi/pull/673#discussion_r965947793
	// https://github.com/XezolesS/WaccaMyPageScraper/blob/acebe4b655eb09b3ddbc15802dd948d5f9c5e0d3/WaccaMyPageScraper/Data/Stage.cs
	id: number;
	name: string;

	// Note: grade (blue/silver/gold) is currently ignored by Tachi.
	grade: number;
}
