const { MutateCollection } = require("../../util");

const CURRENT_INTL_VERSION = "xverse-intl";

// Go to https://chunithm-net-eng.com/mobile/record/musicGenre/master (requires an account)
// and enter in the console:
//    copy([].map.call(document.querySelectorAll("input[name=idx]"), (x) => Number(x.value)))
// then paste the result into this array.
const IN_GAME_IDS_TO_MAKE_AVAILABLE = [];

// Same thing as above, but the URL is https://chunithm-net-eng.com/mobile/record/musicGenre/ultima
// This is here because a song can have B/A/E/M but doesn't have ULTIMA until later on.
const IN_GAME_IDS_TO_MAKE_AVAILABLE_ULTIMA = [];

MutateCollection("charts-chunithm.json", (charts) => {
	for (const chart of charts) {
		const makeAvailableIDs =
			chart.difficulty === "ULTIMA"
				? IN_GAME_IDS_TO_MAKE_AVAILABLE_ULTIMA
				: IN_GAME_IDS_TO_MAKE_AVAILABLE;

		if (!makeAvailableIDs.includes(chart.data.inGameID)) {
			continue;
		}

		if (!chart.versions.includes(CURRENT_INTL_VERSION)) {
			chart.versions.push(CURRENT_INTL_VERSION);
		}
	}

	return charts;
});
