import { type SEEDS_ChartDocument, type integer } from "tachi-common";
import { MutateCollection } from "../../util";

const CURRENT_INTL_VERSION = "xversex-intl";

// Go to https://chunithm-net-eng.com/mobile/record/musicGenre/master (requires an account)
// and enter in the console:
//    copy([].map.call(document.querySelectorAll("input[name=idx]"), (x) => Number(x.value)))
// then paste the result into this array.
const IN_GAME_IDS_TO_MAKE_AVAILABLE: Array<integer> = [];

// Same thing as above, but the URL is https://chunithm-net-eng.com/mobile/record/musicGenre/ultima
// This is here because a song can have B/A/E/M but doesn't have ULTIMA until later on.
const IN_GAME_IDS_TO_MAKE_AVAILABLE_ULTIMA: Array<integer> = [];

const IN_GAME_IDS_TO_MAKE_AVAILABLE_WORLDS_END: Array<integer> = [];

MutateCollection("charts-chunithm.json", (charts: Array<SEEDS_ChartDocument<"chunithm">>) => {
	for (const chart of charts) {
		let makeAvailableIDs: Array<integer>;

		if (
			(Array.isArray(chart.data.inGameID) &&
				chart.data.inGameID.some((igid) => igid >= 8000)) ||
			(!Array.isArray(chart.data.inGameID) && chart.data.inGameID >= 8000)
		) {
			makeAvailableIDs = IN_GAME_IDS_TO_MAKE_AVAILABLE_WORLDS_END;
		} else if (chart.difficulty === "ULTIMA") {
			makeAvailableIDs = IN_GAME_IDS_TO_MAKE_AVAILABLE_ULTIMA;
		} else {
			makeAvailableIDs = IN_GAME_IDS_TO_MAKE_AVAILABLE;
		}

		if (
			(Array.isArray(chart.data.inGameID) &&
				chart.data.inGameID.every((igid) => !makeAvailableIDs.includes(igid))) ||
			(!Array.isArray(chart.data.inGameID) && !makeAvailableIDs.includes(chart.data.inGameID))
		) {
			continue;
		}

		if (!chart.versions.includes(CURRENT_INTL_VERSION)) {
			chart.versions.push(CURRENT_INTL_VERSION);
		}
	}

	return charts;
});
