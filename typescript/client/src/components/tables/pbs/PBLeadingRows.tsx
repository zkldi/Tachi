import Muted from "#components/util/Muted";
import { type SetState } from "#types/react";
import { type PBDataset } from "#types/tables";

import DifficultyCell from "../cells/DifficultyCell";
import IndicatorsCell from "../cells/IndicatorsCell";
import TitleCell from "../cells/TitleCell";
import UserCell from "../cells/UserCell";

export default function PBLeadingRows({
	showUser,
	showChart,
	pb,
	scoreState,
	overrideDiffCell,
}: {
	overrideDiffCell?: JSX.Element;
	pb: PBDataset[0];
	scoreState: { highlight: boolean; setHighlight: SetState<boolean> };
	showChart: boolean;
	showUser: boolean;
}) {
	const game = pb.game;

	const diffCell = overrideDiffCell || <DifficultyCell chart={pb.__related.chart} game={game} />;

	return (
		<>
			{showUser && showChart && (
				<>
					<UserCell game={game} user={pb.__related.user!} />
					{diffCell}
					<IndicatorsCell highlight={scoreState.highlight} />
					<TitleCell chart={pb.__related.chart} game={game} song={pb.__related.song} />
				</>
			)}
			{showUser && !showChart && (
				<>
					<IndicatorsCell highlight={scoreState.highlight} />
					<UserCell game={game} user={pb.__related.user!} />
				</>
			)}
			{!showUser && showChart && (
				<>
					{diffCell}
					<IndicatorsCell highlight={scoreState.highlight} />
					<TitleCell chart={pb.__related.chart} game={game} song={pb.__related.song} />
				</>
			)}
			<td>
				<Muted>PB</Muted>
			</td>
		</>
	);
}
