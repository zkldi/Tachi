import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameProps } from "#types/react";
import { type FolderDataset } from "#types/tables";
import { CountElements, Reverse } from "#util/misc";
import React, { useMemo } from "react";
import { GetGameConfig, GetScoreMetricConf } from "tachi-common";
import { type ConfEnumScoreMetric } from "tachi-common/types/metrics";

import FolderDistributionTable from "./FolderDistributionTable";

type Props = {
	folderDataset: FolderDataset;
	view: string;
} & GameProps;

export default function FolderScoreDistributionChart({ game, folderDataset, view: metric }: Props) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, metric) as ConfEnumScoreMetric<string>;

	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	const values = useMemo(
		// @ts-expect-error hack
		() => CountElements(folderDataset, (x) => x.__related.pb?.scoreData[metric] ?? null),
		[folderDataset, metric],
	);

	return (
		<div className="row">
			<div className="col-12 col-lg-6 offset-lg-3">
				<FolderDistributionTable
					// @ts-expect-error this will always work
					colours={gptImpl.enumColours[metric]}
					keys={Reverse(conf.values)}
					max={folderDataset.length}
					values={values}
				/>
			</div>
		</div>
	);
}
