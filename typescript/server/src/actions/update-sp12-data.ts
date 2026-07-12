import type { ChartDocument, Difficulties, integer } from "tachi-common";

/* eslint-disable no-await-in-loop */
import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";
import { FindChartWithSongDifficulty } from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { p } from "prudence";

interface SP12Data {
	id: integer;
	title: string;
	n_clear: integer;
	hard: integer;
	exh: integer;
	n_clear_string: string;
	hard_string: string;
	exh_string: string;
	version: integer;
}

export async function updateSp12DataCore() {
	const unvalidatedRJ: unknown = await fetch("https://sp12.iidx.app/api/v1/sheets").then((r) =>
		r.json(),
	);

	const err = p(unvalidatedRJ, {
		sheets: [
			{
				id: p.isPositiveNonZeroInteger,
				title: "string",
				n_clear: p.isPositiveInteger,
				hard: p.isPositiveInteger,
				exh: p.isPositiveInteger,
				n_clear_string: "string",
				hard_string: "string",
				exh_string: "string",
				version: p.isPositiveInteger,
			},
		],
	});

	if (err) {
		log.error({ unvalidatedRJ }, `Got invalid/unexpected content from sp12.`);
		throw new Error(`Got invalid/unexpected content from sp12.`);
	}

	const rj = unvalidatedRJ as {
		sheets: Array<SP12Data>;
	};

	const updatedChartIDs: Array<string> = [];

	for (const sh of rj.sheets) {
		let chart: ChartDocument<"iidx-sp">;

		try {
			chart = await HumanisedTitleLookup(sh.title);
		} catch (e) {
			log.error((e as Error).message);
			continue;
		}

		let chartData = { ...chart.data };

		for (const key of ["n_clear", "hard", "exh"] as const) {
			let val: number;

			switch (key) {
				case "n_clear": {
					const v = Math.floor(sh[key] / 2);

					if (v === 9) {
						val = 11.8;
					} else if (v === 8) {
						val = 12.0;
					} else if (v === 7) {
						val = 12.2;
					} else if (v === 6) {
						val = 12.4;
					} else if (v === 5) {
						val = 12.6;
					} else if (v < 0) {
						continue;
					} else {
						val = 12.6 + (5 - v) * 0.1;
					}

					break;
				}

				case "hard": {
					const v2 = Math.floor(sh[key] / 2);

					if (v2 === 9) {
						val = 11.9;
					} else if (v2 === 8) {
						val = 12.1;
					} else if (v2 === 7) {
						val = 12.3;
					} else if (v2 === 6) {
						val = 12.5;
					} else if (v2 === 5) {
						val = 12.7;
					} else if (v2 < 0) {
						continue;
					} else {
						val = 12.7 + (5 - v2) * 0.1;
					}

					break;
				}

				case "exh": {
					const v3 = sh[key];

					if (v3 >= 12 || v3 <= 0) {
						continue;
					}

					val = 12.4 + (12 - v3) * 0.1;

					break;
				}

				default:
					throw new Error("??");
			}

			const stringVal = sh[`${key}_string` as const];

			if (stringVal === "難易度未定") {
				continue;
			}

			val = parseFloat(val.toFixed(2));

			let ktKey: "exhcTier" | "hcTier" | "ncTier";

			if (key === "exh") {
				ktKey = "exhcTier";
			} else if (key === "hard") {
				ktKey = "hcTier";
			} else {
				ktKey = "ncTier";
			}

			const text =
				ktKey === "exhcTier"
					? val.toFixed(2)
					: `12${stringVal.replace(/(個人差|地力)/u, "")}`;

			const idvDiff = stringVal.includes("個人差");

			const existingTlInfo = chartData[ktKey];

			if (
				existingTlInfo &&
				existingTlInfo.text === text &&
				existingTlInfo.value === val &&
				existingTlInfo.individualDifference === idvDiff
			) {
				continue;
			}

			updatedChartIDs.push(chart.chartID);

			chartData = {
				...chartData,
				[ktKey]: {
					text,
					value: val,
					individualDifference: idvDiff,
				},
			};

			const updatedChart = { ...chart, data: chartData } as ChartDocument;
			const checksum = ComputeChartStabilityChecksum("iidx-sp", updatedChart);

			await DB.updateTable("chart")
				.set({
					data: chartData as object,
					derivation_checksum: checksum,
				})
				.where("id", "=", chart.chartID)
				.execute();

			log.info(`Saved ${sh.title} value ${key} = ${val} (${text}).`);
		}
	}

	if (updatedChartIDs.length !== 0) {
		log.info(
			`Finished applying SP12 changes (${updatedChartIDs.length} charts). ` +
				`Score re-derivation will be handled by the score_rederive queue.`,
		);
	}

	return { chartsUpdated: updatedChartIDs.length };
}

async function HumanisedTitleLookup(originalTitle: string) {
	let difficulty: Difficulties["iidx-sp"] = "ANOTHER";

	let title: string | undefined = originalTitle;

	if (/(†|†LEGGENDARIA)$/u.exec(title)) {
		difficulty = "LEGGENDARIA";
		title = title.split(/(†|†LEGGENDARIA)$/u)[0];
	} else if (/\[H\]$/u.exec(title)) {
		difficulty = "HYPER";
		title = title.split("[")[0];
	} else if (/\[A\]$/u.exec(title)) {
		difficulty = "ANOTHER";
		title = title.split("[")[0];
	}

	if (title === undefined) {
		throw new Error(
			`Unexpected title of undefined converted from song title: ${originalTitle}. Was there a faulty split? Was the chart literally called †LEGGENDARIA?`,
		);
	}

	const song = await FindSongOnTitle("iidx", title);

	if (!song) {
		throw new Error(
			`Could not resolve song ${title} (${difficulty}) (Original ${originalTitle}).`,
		);
	}

	const chart = await FindChartWithSongDifficulty("iidx-sp", song.id, difficulty);

	if (!chart) {
		throw new Error(
			`Could not resolve chart ${title} ${difficulty} (Original ${originalTitle}).`,
		);
	}

	return chart as ChartDocument<"iidx-sp">;
}

export const ACTION_UpdateSp12Data = MakeAction("UPDATE_SP12_DATA", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	return updateSp12DataCore();
});
