import { type SEEDS_ChartDocument } from "tachi-common";
import { MutateCollection } from "../../util";

const CURRENT_VERSION = "mate";
const CURRENT_OMNI_VERSION = `${CURRENT_VERSION}-omni`;

MutateCollection("charts-chunithm.json", (charts: Array<SEEDS_ChartDocument<"chunithm">>) => {
    for (const chart of charts) {
        if (!chart.versions.includes(CURRENT_OMNI_VERSION)) {
            chart.versions.push(CURRENT_OMNI_VERSION);
        }

        if (chart.data.levelHistory !== null && typeof chart.data.levelHistory[CURRENT_VERSION] === "undefined") {
            chart.data.levelHistory[CURRENT_VERSION] = null;
        }

        if (chart.data.levelHistory !== null && !chart.data.levelHistory[CURRENT_OMNI_VERSION]) {
			chart.data.levelHistory[CURRENT_OMNI_VERSION] = {
				level: chart.level,
				levelNum: chart.levelNum,
			};
		}
    }

    return charts;
});
