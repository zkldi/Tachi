import ApiError from "#components/util/ApiError";
import DebugContent from "#components/util/DebugContent";
import HasDevModeOn from "#components/util/HasDevModeOn";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import { UserContext } from "#context/UserContext";
import { type GoalsOnChartReturn, type UserGameChartPBComposition } from "#types/api-returns";
import { type GameProps } from "#types/react";
import { useContext, useMemo, useReducer, useState } from "react";
import {
	type ChartDocument,
	type integer,
	type PBScoreDocument,
	type ScoreDocument,
	type SongDocument,
} from "tachi-common";

import DocComponentCreator, {
	type DocumentComponentType,
	type ScoreState,
} from "./components/DocumentComponent";
import DropdownStructure from "./components/DropdownStructure";
import PlayHistory from "./components/PlayHistory";
import RivalCompare from "./components/RivalCompare";
import TargetInfo from "./components/TargetInfo";
import { GameDropdownSettings } from "./GameDropdownSettings";

export interface ScoreDropdownProps {
	score: PBScoreDocument | ScoreDocument;
	scoreState: ScoreState;
	pbData: UserGameChartPBComposition;
	chart: ChartDocument;
}

export default function PBDropdown({
	game,
	chart,
	scoreState,
	defaultView = "pb",
	userID,
	song,
}: {
	chart: ChartDocument;
	defaultView?: "debug" | "history" | "pb" | "rivals" | "targets" | `otherPB::${string}`;
	scoreState: ScoreState;
	song: SongDocument;
	userID: integer;
} & GameProps) {
	const { user: currentUser } = useContext(UserContext);

	const DocComponent: DocumentComponentType = (props) =>
		DocComponentCreator({ ...props, ...GameDropdownSettings(game) });

	const [view, setView] = useState(defaultView);

	const { data, error } = useApiQuery<UserGameChartPBComposition>(
		`/users/${userID}/games/${game}/pbs/${chart.chartID}?getComposition=true`,
	);

	const { error: histError, data: histData } = useApiQuery<ScoreDocument[]>(
		`/users/${userID}/games/${game}/scores/${chart.chartID}`,
	);

	const [shouldRefresh, forceRefresh] = useReducer((state) => state + 1, 0);

	// when a user isn't logged in, skip ever making this request.
	const { error: targetError, data: targetData } = useApiQuery<GoalsOnChartReturn>(
		`/users/${currentUser?.id ?? ""}/games/${game}/targets/on-chart/${chart.chartID}`,
		undefined,
		[shouldRefresh],
		currentUser === null,
	);

	const currentScoreDoc: PBScoreDocument | ScoreDocument | null = useMemo(() => {
		if (!data) {
			// dont worry about this null, it never gets below the rquery checks
			return null;
		}

		if (view === "pb") {
			if (data.pb.composedFrom.length === 1) {
				// scores have more information than PBs.
				// In this case, the PB is only composed of one score,
				// so we should default to this instead.
				return data.scores.find((e) => e.scoreID === data.pb.composedFrom[0]!.scoreID)!;
			}

			return data.pb;
		} else if (view.startsWith("otherPB::")) {
			const scoreID = view.split("otherPB::")[1];

			return data.scores.filter((e) => e.scoreID === scoreID)[0];
		}

		return null;
	}, [view, data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return (
			<div className="d-flex align-items-center" style={{ height: "200px" }}>
				<Loading />
			</div>
		);
	}

	const isComposedFromSingleScore = data.pb.composedFrom.length === 1;

	let body;

	if (view === "history") {
		body = <PlayHistory chart={chart} data={histData} error={histError} game={game} />;
	} else if (view === "debug") {
		body = <DebugContent data={data} />;
	} else if (view === "rivals") {
		body = <RivalCompare chart={chart} game={game} />;
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
	} else {
		body = (
			<DocComponent
				chart={chart}
				pbData={data}
				score={currentScoreDoc!}
				scoreState={scoreState}
				showSingleScoreNote={isComposedFromSingleScore}
			/>
		);
	}

	return (
		<DropdownStructure
			buttons={
				<>
					<SelectButton id="pb" setValue={setView} value={view}>
						<Icon type="trophy" /> PB Info
					</SelectButton>
					{!isComposedFromSingleScore && (
						<>
							{data.pb.composedFrom.map((e) => (
								<SelectButton
									id={`otherPB::${e.scoreID}`}
									key={e.scoreID}
									setValue={setView}
									value={view}
								>
									<Icon type="star-half-alt" /> {e.name}
								</SelectButton>
							))}
						</>
					)}
					<SelectButton id="history" setValue={setView} value={view}>
						<Icon type="history" /> Play History{histData && ` (${histData.length})`}
					</SelectButton>
					{currentUser?.id === userID && (
						<SelectButton id="targets" setValue={setView} value={view}>
							<Icon type="scroll" /> Goals & Quests
							{targetData && ` (${targetData.goals.length})`}
						</SelectButton>
					)}
					{currentUser && (
						<SelectButton id="rivals" setValue={setView} value={view}>
							<Icon type="users" /> Rivals
						</SelectButton>
					)}
					<HasDevModeOn>
						<SelectButton id="debug" setValue={setView} value={view}>
							<Icon type="bug" /> Debug Info
						</SelectButton>
					</HasDevModeOn>
				</>
			}
		>
			{body}
		</DropdownStructure>
	);
}
