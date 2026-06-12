import useSetSubheader from "#components/layout/header/useSetSubheader";
import Questline from "#components/targets/Questline";
import Quest from "#components/targets/quests/Quest";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { type QuestlineReturn } from "#types/api-returns";
import { type GameProps } from "#types/react";
import { CreateGoalMap } from "#util/data";
import { CreateQuestMap } from "#util/misc";
import { Col, Row } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { FormatGame } from "tachi-common";

export default function QuestlinePage({ game }: GameProps) {
	const { questlineID } = useParams<{ questlineID: string }>();

	const { data, error } = useApiQuery<QuestlineReturn>(
		`/games/${game}/targets/questlines/${questlineID}`,
	);

	useSetSubheader(
		["Games", FormatGame(game), "Quests", data ? data.questline.name : "Loading..."],
		[game, data],
		data ? data.questline.name : "Loading...",
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const goalMap = CreateGoalMap(data.goals);
	const questMap = CreateQuestMap(data.quests);

	return (
		<Row>
			<Col xs={12}>
				<Link to={`/games/${game}/quests`}>← Back to all questlines</Link>
				<Divider />
				{/* Summary card with timeline — the Questline component renders the
				    vertical timeline nodes when a quests map is provided. */}
				<Questline questline={data.questline} quests={questMap} />
				<Divider />
			</Col>

			{/* Full quest cards below, anchored so timeline links scroll to them */}
			{data.questline.quests.map((questID) => {
				const quest = questMap.get(questID);

				if (!quest) {
					return null;
				}

				return (
					<Col
						className="offset-lg-2 my-4 quest-anchor"
						id={quest.questID}
						key={quest.questID}
						lg={8}
						xs={12}
					>
						<Quest collapsible goals={goalMap} quest={quest} />
					</Col>
				);
			})}
		</Row>
	);
}
