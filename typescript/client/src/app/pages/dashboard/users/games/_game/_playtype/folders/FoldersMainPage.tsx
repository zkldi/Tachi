import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import { type GameProfileProps } from "#types/react";
import { Redirect, Route, Switch } from "react-router-dom";
import { FormatGame, GameToGameGroup, GetGameGroupConfig } from "tachi-common";

import FolderTablePage from "./FolderTablePage";
import SpecificFolderPage from "./SpecificFolderPage";

export default function FoldersMainPage({ reqUser, game }: GameProfileProps) {
	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Folders",
		],
		[reqUser, game],
		`${reqUser.username}'s ${FormatGame(game)} Folders`,
	);

	return (
		<div className="row">
			<div className="col-12">
				<Switch>
					<Route
						exact
						path="/u/:userID/games/:game/folders/search"
						render={({ match }) => (
							<Redirect
								to={`/u/${match.params.userID}/games/${match.params.game}/folders`}
							/>
						)}
					/>
					<Route
						exact
						path="/u/:userID/games/:game/folders/recent"
						render={({ match }) => (
							<Redirect
								to={`/u/${match.params.userID}/games/${match.params.game}/folders`}
							/>
						)}
					/>
					<Route path="/u/:userID/games/:game/folders">
						<>
							<FolderTablePage {...{ reqUser, game }} />
							<Route path="/u/:userID/games/:game/folders/:folderSlug">
								<>
									<Divider className="border-2 mb-4 mt-5" />
									<SpecificFolderPage {...{ reqUser, game }} />
								</>
							</Route>
						</>
					</Route>
				</Switch>
			</div>
		</div>
	);
}
