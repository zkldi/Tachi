import Quest from "#components/targets/quests/Quest";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import Select from "#components/util/Select";
import { type GameProfileProps } from "#types/react";
import { CreateGoalMap, GetGoalIDsFromQuest } from "#util/data";
import { CreateQuestSubMap } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import { useMemo, useState } from "react";
import { Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type GoalDocument,
	type QuestDocument,
	type QuestSubscriptionDocument,
} from "tachi-common";

export default function UserGameQuestsPage({ reqUser, game }: GameProfileProps) {
	const [show, setShow] = useState<"achieved" | "all" | "unachieved">("all");

	const { data, error } = useApiQuery<{
		goals: Array<GoalDocument>;
		quests: Array<QuestDocument>;
		questSubs: Array<QuestSubscriptionDocument>;
	}>(`/users/${reqUser.id}/games/${game}/targets/quests`);

	const questsToShow = useMemo(() => {
		if (!data || error) {
			return [];
		}

		const questSubMap = CreateQuestSubMap(data.questSubs);

		let base = data.quests.slice(0).sort(
			NumericSOV((quest) => {
				const sub = questSubMap.get(quest.questID);

				if (!sub) {
					return -Infinity;
				}

				if (sub.achieved) {
					return -100;
				}

				return sub.progress / GetGoalIDsFromQuest(quest).length;
			}, true),
		);

		switch (show) {
			case "all":
				break;
			case "achieved":
				base = base.filter((e) => questSubMap.get(e.questID)?.achieved === true);
				break;
			case "unachieved":
				base = base.filter((e) => questSubMap.get(e.questID)?.achieved === false);
				break;
		}

		return base;
	}, [data, show]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const goalMap = CreateGoalMap(data.goals);

	return (
		<Row>
			<Col xs={12}>
				<Divider />
				<div className="ps-6">
					<div className="d-flex w-100 justify-content-start">
						<Select name="What quests should we show?" setValue={setShow} value={show}>
							<option value="all">All</option>
							<option value="unachieved">Unachieved</option>
							<option value="achieved">Achieved</option>
						</Select>
					</div>
				</div>
				<Divider />
			</Col>
			{questsToShow.length === 0 && (
				<Col xs={12}>
					<div className="text-center">
						Looks like you have no quests set.
						<br />
						<Link to={`/games/${game}/quests`}>Go set some!</Link>
					</div>
				</Col>
			)}
			{questsToShow.map((quest) => (
				<Col className="mb-4" key={quest.questID} lg={6} xs={12}>
					<Quest goals={goalMap} quest={quest} />
				</Col>
			))}
		</Row>
	);
}
