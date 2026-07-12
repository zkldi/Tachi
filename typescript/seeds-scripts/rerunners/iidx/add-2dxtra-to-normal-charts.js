import { MutateCollection } from "../../util.js";

// this script will add "newVersion" to all charts that are in "baseVersion"

const baseVersion = "31-omni";
const newVersion = "31-2dxtra";

MutateCollection("charts-iidx.json", (charts) => {
	for (const chart of charts) {
		if (chart.versions.includes(baseVersion) && !chart.versions.includes(newVersion)) {
			chart.versions.push(newVersion);
		}
	}

	return charts;
});
