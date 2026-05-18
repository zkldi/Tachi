export function FindChartWithDFVersion(collection, songID, difficulty, version) {
	return collection.find(
		(chart) =>
			chart.songID === songID &&
			chart.difficulty === difficulty &&
			chart.versions.includes(version),
	);
}

export function FindSongWithTitle(collection, title) {
	return collection.find((e) => e.title === title || e.altTitles.includes(title));
}
