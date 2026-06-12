import DebugContent from "#components/util/DebugContent";
import HasDevModeOn from "#components/util/HasDevModeOn";
import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { UserContext } from "#context/UserContext";
import { type GoalsOnChartReturn, type UserGameChartPBComposition } from "#types/api-returns";
import { type GameProps, type SetState } from "#types/react";
import { useContext, useReducer, useState } from "react";
import {
	type ChartDocument,
	type PBScoreDocument,
	type ScoreDocument,
	type SongDocument,
	type UserDocument,
} from "tachi-common";

import DocComponentCreator, { type DocumentComponentType } from "./components/DocumentComponent";
import DropdownStructure from "./components/DropdownStructure";
import PBCompare from "./components/PBCompare";
import PlayHistory from "./components/PlayHistory";
import RivalCompare from "./components/RivalCompare";
import TargetInfo from "./components/TargetInfo";
import { GameDropdownSettings } from "./GameDropdownSettings";

export interface ScoreState {
	highlight: boolean;
	setHighlight: SetState<boolean>;
}

export interface ScoreDropdownProps {
	score: PBScoreDocument | ScoreDocument;
	scoreState: ScoreState;
}

export default function ScoreDropdown({
	game,
	user,
	chart,
	song,
	scoreState,
	thisScore,
	defaultView = "moreInfo",
	onScoreUpdate,
}: {
	chart: ChartDocument;
	defaultView?: "debug" | "history" | "moreInfo" | "rivals" | "targets" | "vsPB";
	onScoreUpdate?: (sc: ScoreDocument) => void;
	scoreState: ScoreState;
	song: SongDocument;
	thisScore: ScoreDocument;
	user: UserDocument;
} & GameProps) {
	const DocComponent: DocumentComponentType = (props) =>
		DocComponentCreator({
			renderScoreInfo: false,
			...props,
			...GameDropdownSettings(game),
		});

	const [view, setView] = useState(defaultView);
	const { user: currentUser } = useContext(UserContext);
	const { settings } = useLoggedInUserGameSettings();

	const { data, error } = useApiQuery<UserGameChartPBComposition>(
		`/users/${user.id}/games/${game}/pbs/${chart.chartID}?getComposition=true`,
	);

	const { error: histError, data: histData } = useApiQuery<ScoreDocument[]>(
		`/users/${user.id}/games/${game}/scores/${chart.chartID}`,
	);

	const [shouldRefresh, forceRefresh] = useReducer((state) => state + 1, 0);

	const { error: targetError, data: targetData } = useApiQuery<GoalsOnChartReturn>(
		`/users/${currentUser?.id ?? ""}/games/${game}/targets/on-chart/${chart.chartID}`,
		undefined,
		[shouldRefresh],
		// when a user isn't logged in, skip ever making this request.
		currentUser === null,
	);

	if (error) {
		return <>An error has occurred. Whoops.</>;
	}

	if (!data) {
		return (
			<div className="d-flex align-items-center" style={{ height: "200px" }}>
				<Loading />
			</div>
		);
	}

	let body;

	if (view === "history") {
		body = <PlayHistory chart={chart} data={histData} error={histError} game={game} />;
	} else if (view === "debug") {
		body = <DebugContent data={data} />;
	} else if (view === "moreInfo") {
		body = (
			<DocComponent
				chart={chart}
				onScoreUpdate={onScoreUpdate}
				pbData={data}
				score={thisScore as any}
				scoreState={scoreState}
			/>
		);
	} else if (view === "vsPB") {
		body = <PBCompare data={data} DocComponent={DocComponent} scoreState={scoreState} />;
	} else if (view === "targets") {
		if (currentUser) {
			body = (
				<TargetInfo
					chart={chart}
					data={targetData}
					error={targetError}
					game={game}
					onGoalSet={forceRefresh}
					reqUser={currentUser}
					song={song}
				/>
			);
		} else {
			body = <>not possible, shouldn't've got here.</>;
		}
	} else if (view === "rivals") {
		body = <RivalCompare chart={chart} game={game} />;
	}

	return (
		<DropdownStructure
			buttons={
				<>
					<SelectButton id="moreInfo" setValue={setView} value={view}>
						<Icon type="chart-bar" /> This Score
					</SelectButton>
					<SelectButton id="vsPB" setValue={setView} value={view}>
						<Icon type="trophy" /> Chart PB
					</SelectButton>
					<SelectButton id="history" setValue={setView} value={view}>
						<Icon type="history" /> Play History{histData && ` (${histData.length})`}
					</SelectButton>
					{currentUser?.id === user.id && (
						<SelectButton id="targets" setValue={setView} value={view}>
							<Icon type="scroll" /> Goals & Quests
							{targetData && ` (${targetData.goals.length})`}
						</SelectButton>
					)}
					{currentUser?.id === user.id && settings?.rivals && (
						<SelectButton id="rivals" setValue={setView} value={view}>
							<Icon type="users" /> Rivals
						</SelectButton>
					)}
					<HasDevModeOn>
						<SelectButton id="debug" setValue={setView} value={view}>
							<Icon type="bug" /> Debug Info
						</SelectButton>
					</HasDevModeOn>
					{thisScore.sessionID && (
						<LinkButton
							className="text-body text-light-hover text-light-focus"
							to={`/u/${user.username}/games/${thisScore.game}/sessions/${thisScore.sessionID}`}
							variant="outline-secondary"
						>
							<Icon type="stream" /> Go to session
						</LinkButton>
					)}
				</>
			}
		>
			{body}
		</DropdownStructure>
	);
}
