import { GetGameConfig } from "../../../common/src";

import { MutateCollection } from "../../util";

const versions = Object.keys(GetGameConfig("chunithm").versions);

MutateCollection("charts-chunithm.json", (charts) => {
	for (const chart of charts) {
		chart.versions = [...new Set(chart.versions)];

		chart.versions.sort((a, b) => versions.indexOf(a) - versions.indexOf(b));
	}

	return charts;
});
