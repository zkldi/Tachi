import useSetSubheader from "#components/layout/header/useSetSubheader";
import Quest from "#components/targets/quests/Quest";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { type QuestReturn } from "#types/api-returns";
import { type GameProps } from "#types/react";
import { CreateGoalMap } from "#util/data";
import { Col } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { FormatGame } from "tachi-common";

export default function QuestPage({ game }: GameProps) {
	const { questID } = useParams<{ questID: string }>();

	const { data, error } = useApiQuery<QuestReturn>(`/games/${game}/targets/quests/${questID}`);

	useSetSubheader(
		["Games", FormatGame(game), "Quests", data ? data.quest.name : "Loading..."],
		[game, data],
		data ? data.quest.name : "Loading...",
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const { quest, goals } = data;

	const goalMap = CreateGoalMap(goals);

	return (
		<div>
			<Col xs={12}>
				<Link to={`/games/${game}/quests`}>Go back to all quests...</Link>
				<Divider />
				<Quest goals={goalMap} quest={quest} />
			</Col>
		</div>
	);
}
