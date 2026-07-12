import type { ChartDocument } from "tachi-common";

/* eslint-disable no-await-in-loop */
import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";
import { FindChartWithSongDifficultyVersion } from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { decode } from "html-entities";
import { parse } from "node-html-parser";

export async function updateDpTiersCore() {
	const rawHTML = await fetch("https://zasa.sakura.ne.jp/dp/run.php").then((r) => r.text());

	const data = parse(rawHTML);

	const rows = data.querySelectorAll("tr");

	const parsedData: Array<{
		ANOTHER: number | null;
		HYPER: number | null;
		LEGGENDARIA: number | null;
		songTitle: string;
	}> = [];

	for (const row of rows) {
		if (row.childNodes.length !== 4) {
			continue;
		}

		parsedData.push({
			HYPER: ParseTierStr(row.childNodes[0]!.innerText),
			ANOTHER: ParseTierStr(row.childNodes[1]!.innerText),
			LEGGENDARIA: ParseTierStr(row.childNodes[2]!.innerText),
			songTitle: decode(row.childNodes[3]!.innerText),
		});
	}

	log.info(`Got DP tier data. Applying it.`);

	const updatedSongIDs = new Set<string>();

	for (const d of parsedData) {
		const song = await FindSongOnTitle("iidx", d.songTitle);

		if (!song) {
			log.warn(`Couldn't find song with title ${d.songTitle}.`);
			continue;
		}

		for (const difficulty of ["HYPER", "ANOTHER", "LEGGENDARIA"] as const) {
			if (d[difficulty] === null) {
				continue;
			}

			const chart = await FindChartWithSongDifficultyVersion(
				"iidx-dp",
				song.id,
				difficulty,
				"29",
			);

			if (!chart) {
				log.warn(
					`Couldn't find DP chart for ${d.songTitle} (${song.id}) ${difficulty} on version 29.`,
				);
				continue;
			}

			const nextTier = {
				text: d[difficulty]!.toString(),
				value: d[difficulty]!,
				individualDifference: false,
			};

			const dpChart = chart as ChartDocument<"iidx-dp">;
			const prev = dpChart.data.dpTier;

			if (
				prev &&
				prev.text === nextTier.text &&
				prev.value === nextTier.value &&
				prev.individualDifference === nextTier.individualDifference
			) {
				continue;
			}

			const mergedData = {
				...dpChart.data,
				dpTier: nextTier,
			};

			const updatedChart = { ...chart, data: mergedData } as ChartDocument;
			const checksum = ComputeChartStabilityChecksum("iidx-dp", updatedChart);

			await DB.updateTable("chart")
				.set({
					data: mergedData as object,
					derivation_checksum: checksum,
				})
				.where("id", "=", chart.chartID)
				.execute();

			updatedSongIDs.add(song.id);
		}
	}

	if (updatedSongIDs.size !== 0) {
		log.info(
			`${updatedSongIDs.size} songs were changed. ` +
				`Score re-derivation will be handled by the score_rederive queue.`,
		);
	}

	log.info("Done.");

	return { songsTouched: updatedSongIDs.size };
}

function ParseTierStr(tierStr: string) {
	if (tierStr === "-") {
		return null;
	}

	const result = /\((.*)\)$/u.exec(tierStr);

	if (result?.[1]) {
		return Number(result[1]);
	}

	throw new Error(`Can't parse tierStr ${tierStr}.`);
}

export const ACTION_UpdateDpTiers = MakeAction("UPDATE_DP_TIERS", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	return updateDpTiersCore();
});
