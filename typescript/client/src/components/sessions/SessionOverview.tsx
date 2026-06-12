import Card from "#components/layout/page/Card";
import ScoreTable from "#components/tables/scores/ScoreTable";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectLinkButton from "#components/util/SelectLinkButton";
import useUserGameBase from "#components/util/useUserGameBase";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type SessionReturns } from "#types/api-returns";
import { type SetState } from "#types/react";
import { type ScoreDataset } from "#types/tables";
import { FormatGameSessionRatingName, FormatSessionRating } from "#util/misc";
import { FormatDuration } from "#util/time";
import { useEffect, useState } from "react";
import { Badge, Col, Row } from "react-bootstrap";
import { Route, Switch } from "react-router-dom";
import {
	type AnySessionRatingAlg,
	GetGameConfig,
	type PBScoreDocument,
	type ScoreDocument,
	type SessionDocument,
	type UserDocument,
} from "tachi-common";

import SessionFolderRaiseBreakdown from "./SessionFolderRaiseBreakdown";
import SessionRaiseBreakdown from "./SessionRaiseBreakdown";

type PBsData = { pbs: Array<PBScoreDocument> };

export default function SessionOverview({
	sessionData,
	setSessionData,
	scoreDataset,
	reqUser,
}: {
	reqUser: UserDocument;
	scoreDataset: ScoreDataset;
	sessionData: SessionReturns;
	setSessionData: SetState<SessionReturns>;
}) {
	const { scores, session } = sessionData;
	const game = session.game;
	const gameConfig = GetGameConfig(game);
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];
	const MAX_SCORES = gptImpl.sessionImportantScoreCount;

	const setScores = (scores: ScoreDocument[]) => {
		setSessionData({
			...sessionData,
			scores,
		});
	};

	const [importantScores, setImportantScores] = useState<ScoreDataset | null>(null);

	const scoreRatingAlgsKeys = Object.keys(gameConfig.scoreRatingAlgs);

	const query =
		scoreRatingAlgsKeys.length === 1
			? `/users/${reqUser.id}/games/${game}/pbs/best?alg=${scoreRatingAlgsKeys[0]}`
			: scoreRatingAlgsKeys.map(
					(alg) => `/users/${reqUser.id}/games/${game}/pbs/best?alg=${alg}`,
				);

	const { data } = useApiQuery<PBsData | PBsData[]>(query);

	useEffect(() => {
		if (!data) {
			setImportantScores(null);
			return;
		}

		const important: Array<string> = [];

		const findImportant = (data: PBsData) => {
			for (const pb of data.pbs.slice(0, MAX_SCORES)) {
				const didFind = pb.composedFrom.find((e) => session.scoreIDs.includes(e.scoreID));

				if (didFind) {
					important.push(didFind.scoreID);
				}
			}
		};

		if (Array.isArray(data)) {
			for (const d of data) {
				findImportant(d);
			}
		} else {
			findImportant(data);
		}

		setImportantScores(scoreDataset.filter((e) => important.includes(e.scoreID)));
	}, [data]);

	const base = useUserGameBase({ game, reqUser });
	const baseUrl = `${base}/sessions/${session.sessionID}`;

	const highlightedScores = scoreDataset.filter((e) => e.highlight);

	return (
		<>
			<Row className="p-0 row-gap-4" lg={{ cols: 3 }} xs={{ cols: 1 }}>
				<StatThing name="Scores" value={session.scoreIDs.length} />
				<StatThing
					name="Duration"
					value={FormatDuration(session.timeEnded - session.timeStarted)}
				/>
				<StatThing name="Highlights" value={scores.filter((e) => e.highlight).length} />
			</Row>

			<div className="p-4">
				<RatingsOverview session={session} />
			</div>

			<Row xs={12}>
				<Divider />

				<Col className="text-center">
					<div className="btn-group d-flex justify-content-center mb-4">
						<SelectLinkButton to={`${baseUrl}`}>
							<Icon type="chart-line" /> Raises
						</SelectLinkButton>
						<SelectLinkButton to={`${baseUrl}/folders`}>
							<Icon type="sort-numeric-up-alt" /> Folder Stats
						</SelectLinkButton>
						<SelectLinkButton to={`${baseUrl}/important`}>
							<Icon type="star" /> Important Scores{" "}
							{importantScores && importantScores.length > 0 && (
								<Badge bg="primary" style={{ marginLeft: "5px" }}>
									{importantScores.length} new top {MAX_SCORES}
									{importantScores.length === 1 ? "" : "s"}!
								</Badge>
							)}
						</SelectLinkButton>
						<SelectLinkButton to={`${baseUrl}/scores`}>
							<Icon type="database" /> All Scores
						</SelectLinkButton>
					</div>
				</Col>
			</Row>

			<Col xs={12}>
				<Divider />
			</Col>

			<Col xs={12}>
				<Switch>
					<Route exact path="/u/:userID/games/:game/sessions/:sessionID">
						<Card header="Raise Breakdown">
							<Row>
								<SessionRaiseBreakdown
									sessionData={sessionData}
									setScores={setScores}
								/>
							</Row>
						</Card>
					</Route>

					<Route exact path="/u/:userID/games/:game/sessions/:sessionID/folders">
						<SessionFolderRaiseBreakdown sessionData={sessionData} />
					</Route>

					<Route exact path="/u/:userID/games/:game/sessions/:sessionID/important">
						{importantScores && importantScores.length > 0 && (
							<Card header={`Scores in ${reqUser.username}'s top ${MAX_SCORES}!`}>
								<ScoreTable dataset={importantScores} game={game} />
							</Card>
						)}
						{importantScores &&
							importantScores?.length > 0 &&
							highlightedScores.length > 0 && <Divider />}
						<Card header="Highlighted Scores">
							<ScoreTable dataset={highlightedScores} game={game} />
						</Card>
					</Route>

					<Route exact path="/u/:userID/games/:game/sessions/:sessionID/scores">
						<ScoreTable
							dataset={scoreDataset}
							game={game}
							onScoreUpdate={(sc) => {
								const newScores = [
									...sessionData.scores.filter((e) => e.scoreID !== sc.scoreID),
									sc,
								];

								setSessionData({
									...sessionData,
									scores: newScores,
								});
							}}
						/>
					</Route>
				</Switch>
			</Col>
		</>
	);
}

// Temporarily shoved to the bottom, as it needs to be significantly improved,
// but we can't really just remove it lol.
function RatingsOverview({ session }: { session: SessionDocument }) {
	const game = session.game;
	const gameConfig = GetGameConfig(game);

	function Thing({ value, name }: { name: string; value: number | string }) {
		return (
			<div className="d-flex" style={{ flexGrow: 1 }}>
				<div className="card" style={{ flexGrow: 1 }}>
					<div className="card-body">
						<div className="display-4">{value}</div>
						<div style={{ fontSize: "1.2rem" }}>{name}</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="d-flex text-center" style={{ justifyContent: "space-evenly", gap: "1rem" }}>
			{Object.keys(gameConfig.sessionRatingAlgs).map((e) => (
				<Thing
					key={e}
					name={`Average ${FormatGameSessionRatingName(game, e)}`}
					value={FormatSessionRating(
						game,
						e as AnySessionRatingAlg,
						session.calculatedData[e as AnySessionRatingAlg],
					)}
				/>
			))}
		</div>
	);
}

function StatThing({ value, name }: { name: string; value: number | string }) {
	return (
		<Col>
			<div className="card">
				<div className="card-body">
					<div className="display-4">{value}</div>
					<div style={{ fontSize: "1.2rem" }}>{name}</div>
				</div>
			</div>
		</Col>
	);
}
