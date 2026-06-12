import { type UserGameChartPBComposition } from "#types/api-returns";
import { type ChartDocument, type PBScoreDocument, type ScoreDocument } from "tachi-common";

import { type ScoreState } from "../ScoreDropdown";

export default function PBCompare({
	data,
	scoreState,
	DocComponent,
}: {
	data: UserGameChartPBComposition;
	DocComponent: (props: {
		chart: ChartDocument;
		forceScoreData: boolean;
		pbData: UserGameChartPBComposition;
		score: PBScoreDocument | ScoreDocument;
		scoreState: ScoreState;
	}) => JSX.Element;
	scoreState: ScoreState;
}) {
	return (
		<DocComponent
			chart={data.chart}
			forceScoreData
			pbData={data}
			score={data.pb}
			scoreState={scoreState}
		/>
	);
}
