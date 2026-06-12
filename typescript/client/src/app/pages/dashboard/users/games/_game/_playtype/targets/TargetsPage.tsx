import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import SelectLinkButton from "#components/util/SelectLinkButton";
import useUserGameBase from "#components/util/useUserGameBase";
import { type GameProfileProps } from "#types/react";
import { Col, Row } from "react-bootstrap";
import { Route, Switch } from "react-router-dom";
import { FormatGame, GameToGameGroup, GetGameGroupConfig } from "tachi-common";

import UserGameGoalsPage from "./UserGameGoalsPage";
import UserGameQuestsPage from "./UserGameQuestsPage";

export default function TargetsPage({ reqUser, game }: GameProfileProps) {
	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Goals & Quests",
		],
		[reqUser, game],
		`${reqUser.username}'s ${FormatGame(game)} Goals & Quests`,
	);

	const base = useUserGameBase({ reqUser, game });

	return (
		<Row>
			<Col className="text-center" xs={12}>
				<div className="btn-group d-flex justify-content-center">
					<SelectLinkButton to={`${base}/targets`}>
						<Icon type="scroll" /> Quests
					</SelectLinkButton>
					<SelectLinkButton to={`${base}/targets/goals`}>
						<Icon type="bullseye" /> Goals
					</SelectLinkButton>
				</div>
				<Divider />
			</Col>
			<Col xs={12}>
				<Switch>
					<Route exact path="/u/:userID/games/:game/targets/goals">
						<UserGameGoalsPage {...{ reqUser, game }} />
					</Route>
					<Route exact path="/u/:userID/games/:game/targets">
						<UserGameQuestsPage {...{ reqUser, game }} />
					</Route>
				</Switch>
			</Col>
		</Row>
	);
}
