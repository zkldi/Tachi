import ScoreLeaderboard from "#components/game/ScoreLeaderboard";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import SelectLinkButton from "#components/util/SelectLinkButton";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import useUserGameBase from "#components/util/useUserGameBase";
import { Col, Row } from "react-bootstrap";
import { Route, Switch } from "react-router-dom";
import {
	FormatGame,
	GameToGameGroup,
	GetGameGroupConfig,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import RivalsActivityPage from "./RivalsActivityPage";
import RivalsManagePage from "./RivalsManagePage";

export default function RivalsMainPage({ reqUser, game }: { game: V3Game; reqUser: UserDocument }) {
	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Rivals",
		],
		[reqUser, game],
		`${reqUser.username}'s ${FormatGame(game)} Rivals`,
	);

	const base = useUserGameBase({ reqUser, game });

	const { settings } = useLoggedInUserGameSettings();

	if (!settings) {
		return <div>You have no settings set. How did you cause this?</div>;
	}

	return (
		<Row>
			<Col className="text-center" xs={12}>
				<div className="btn-group d-flex justify-content-center">
					<SelectLinkButton to={`${base}/rivals`}>
						<Icon type="list" /> Rival Activity
					</SelectLinkButton>
					<SelectLinkButton to={`${base}/rivals/manage`}>
						<Icon type="users" /> Manage Rivals
					</SelectLinkButton>
				</div>
				<Divider />
			</Col>
			<Col xs={12}>
				<Switch>
					<Route exact path="/u/:userID/games/:game/rivals">
						<RivalsActivityPage game={game} reqUser={reqUser} />
					</Route>

					<Route exact path="/u/:userID/games/:game/rivals/manage">
						<RivalsManagePage game={game} reqUser={reqUser} />
					</Route>

					<Route exact path="/u/:userID/games/:game/rivals/pb-leaderboard">
						<ScoreLeaderboard
							game={game}
							refreshDeps={[`rivals-pb-leaderboard-${settings.rivals.join(",")}`]}
							url={`/users/${reqUser.id}/games/${game}/rivals/pb-leaderboard`}
						/>
					</Route>
				</Switch>
			</Col>
		</Row>
	);
}
