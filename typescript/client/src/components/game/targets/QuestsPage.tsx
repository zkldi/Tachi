import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import Questline from "#components/targets/Questline";
import Quest from "#components/targets/quests/Quest";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TachiConfig } from "#lib/config";
import { type GameProps } from "#types/react";
import { CreateGoalMap } from "#util/data";
import { Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	FormatGame,
	type GoalDocument,
	type QuestDocument,
	type QuestlineDocument,
} from "tachi-common";

export default function QuestsPage({ game }: GameProps) {
	useSetSubheader(["Games", FormatGame(game), "Quests"], [game], `${FormatGame(game)} Quests`);

	return (
		<div>
			<QuestlineSelector game={game} />
		</div>
	);
}

function QuestlineSelector({ game }: GameProps) {
	const { data, error } = useApiQuery<{
		questlines: Array<QuestlineDocument>;
		standalone: Array<QuestDocument>;
		standaloneGoals: Array<GoalDocument>;
	}>(`/games/${game}/targets/questlines`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (data.questlines.length === 0 && data.standalone.length === 0) {
		return (
			<Row>
				<Col xs={12}>
					<div className="w-100 text-center">
						Looks like this game has no quests.
						{TachiConfig.QUEST_PROPOSALS_ENABLED ? (
							<>
								{" "}
								If you want, you could <Link to="/quests">create your own</Link>,
								and submit them in the discord!
							</>
						) : (
							<> You can suggest new quests in the discord!</>
						)}
					</div>
				</Col>
			</Row>
		);
	}

	const goalMap = CreateGoalMap(data.standaloneGoals);

	return (
		<Row>
			{data.questlines.map((e) => (
				<Col className="my-4" key={e.questlineID} xs={12}>
					<Questline questline={e} />
				</Col>
			))}
			{data.standalone.length !== 0 && (
				<Col className="my-4" xs={12}>
					<Card header="Standalone Quests">
						This game has {data.standalone.length}{" "}
						{data.standalone.length === 1 ? "quest" : "quests"} that don't belong to any
						questlines.
					</Card>

					<Divider />
					<Row>
						{data.standalone.map((e) => (
							<Col className="mb-4" key={e.questID} lg={6} xs={12}>
								<Quest collapsible goals={goalMap} quest={e} />
							</Col>
						))}
					</Row>
				</Col>
			)}
		</Row>
	);
}
