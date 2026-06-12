import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TachiConfig } from "#lib/config";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { ToAPIURL } from "#util/api";
import { Col, Row } from "react-bootstrap";

function Component({ game, reqUser }: GameProfileProps) {
	const { data, error } = useApiQuery<
		Array<{
			description: string;
			forSpecificUser?: boolean;
			playlistName: string;
			urlName: string;
		}>
	>(`/games/${game}/playlists`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<Row>
			<Col xs={12}>
				<Card
					footer={
						<div className="w-100 d-flex justify-content-center align-items-center">
							<div>
								Just drop this file into your <code>playlists/</code> folder.
							</div>
							<a
								className="btn btn-outline-primary ms-4"
								download={`tachi-playlists.json`}
								href={`data:text/plain,${encodeURIComponent(
									JSON.stringify(
										data.map((e) =>
											ToAPIURL(
												`${
													e.forSpecificUser
														? `/users/${reqUser.username}`
														: ""
												}/games/${game}/playlists/${e.urlName}`,
											),
										),
									),
								)}`}
							>
								Download
							</a>
						</div>
					}
					header="Supported Playlists"
				>
					<ul>
						{data.map((e) => (
							<li key={e.urlName}>
								{e.playlistName} <br />
								{e.description}
							</li>
						))}
					</ul>
				</Card>
			</Col>
		</Row>
	);
}

export const IIDXPlaylistsTool: GameUtility = {
	name: `${TachiConfig.NAME} IIDX Playlists`,
	urlPath: "playlists",
	description: `${TachiConfig.NAME} has its own IIDX playlists that you can use in-game via playlister!`,
	component: Component,
	personalUseOnly: true,
};
