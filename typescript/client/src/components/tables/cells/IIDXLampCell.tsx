import { GetEnumColour } from "#lib/game-implementations";
import { IsScore } from "#util/asserts";
import { ChangeOpacity } from "#util/color-opacity";
import { IsNotNullish } from "#util/misc";
import {
	type ChartDocument,
	type GamesForGroup,
	type PBScoreDocument,
	type ScoreDocument,
} from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

export default function IIDXLampCell({
	sc,
	chart,
}: {
	chart: ChartDocument<GamesForGroup["iidx"]>;
	sc: PBScoreDocument<GamesForGroup["iidx"]> | ScoreDocument<GamesForGroup["iidx"]>;
}) {
	let gaugeText = null;

	if (
		sc.scoreData.optional.gsmEXHard &&
		sc.scoreData.optional.gsmHard &&
		sc.scoreData.optional.gsmNormal &&
		sc.scoreData.optional.gsmEasy
	) {
		gaugeText = `EC: ${
			sc.scoreData.optional.gsmEasy[sc.scoreData.optional.gsmEasy.length - 1]
		}%, NC: ${sc.scoreData.optional.gsmNormal[sc.scoreData.optional.gsmNormal.length - 1]}%`;
	} else if (IsScore(sc)) {
		if (sc.scoreMeta.gauge === "EASY") {
			gaugeText = `EC: ${sc.scoreData.optional.gauge}%`;
		} else if (sc.scoreMeta.gauge === "NORMAL") {
			gaugeText = `NC: ${sc.scoreData.optional.gauge}%`;
		}
	}

	let bpText;

	if (IsNotNullish(sc.scoreData.optional.bp)) {
		bpText = `[BP: ${sc.scoreData.optional.bp}]`;
	}

	let cbrkCount;
	let cbrkText;

	if (IsNotNullish(sc.scoreData.optional.comboBreak)) {
		cbrkCount = sc.scoreData.optional.comboBreak;
	} else if (
		IsNotNullish(sc.scoreData.judgements.pgreat) &&
		IsNotNullish(sc.scoreData.judgements.great) &&
		IsNotNullish(sc.scoreData.judgements.good)
	) {
		cbrkCount =
			chart.data.notecount -
			sc.scoreData.judgements.pgreat! -
			sc.scoreData.judgements.great! -
			sc.scoreData.judgements.good!;
	}

	if (IsNotNullish(cbrkCount) && cbrkCount !== 0) {
		cbrkText = `[CB: ${cbrkCount}]`;
	}

	const titleTooltip = [
		sc.scoreData.lamp,
		bpText,
		cbrkText,
		sc.scoreData.lamp === "FAILED" && gaugeText ? gaugeText : null,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<td
			style={{
				...constrainedLampTdStyle,
				backgroundColor: ChangeOpacity(GetEnumColour(sc, "lamp"), 0.2),
			}}
			title={titleTooltip}
		>
			<div className={truncLine} style={{ minWidth: 0 }}>
				<strong>{sc.scoreData.lamp}</strong>
			</div>

			{bpText && (
				<small className={truncLine} style={{ minWidth: 0 }}>
					{bpText}
				</small>
			)}

			{cbrkText && (
				<small className={truncLine} style={{ minWidth: 0 }}>
					{cbrkText}
				</small>
			)}

			{sc.scoreData.lamp === "FAILED" && gaugeText && (
				<small className={`${truncLine} text-body-secondary`} style={{ minWidth: 0 }}>
					{gaugeText}
				</small>
			)}
		</td>
	);
}
