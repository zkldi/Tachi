import { ErrorPage } from "#app/pages/ErrorPage";
import ClassBadge from "#components/game/ClassBadge";
import ImportStateRenderer from "#components/imports/ImportStateRenderer";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import ApiError from "#components/util/ApiError";
import useImport from "#components/util/import/useImport";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { type UGPTStatsReturn } from "#types/api-returns";
import { UppercaseFirst } from "#util/misc";
import React, { useContext, useEffect, useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import {
	type Classes,
	FormatGame,
	type GameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	GetGamesWithProvidedClasses,
	GetProvidedClassSetsForGame,
	type V3Game,
} from "tachi-common";

export default function ImportClassPage() {
	useSetSubheader(["Dashboard", "Import Scores", "Import Class"]);

	const { user } = useContext(UserContext);
	const history = useHistory();
	const queryGame = new URLSearchParams(window.location.search).get("game") as GameGroup | null;

	if (!user) {
		return <ErrorPage statusCode={401} />;
	}

	if (!queryGame) {
		return (
			<Alert variant="warning">
				Please select a game from the{" "}
				<Button onClick={() => history.push("/import")} variant="link">
					import page
				</Button>
				.
			</Alert>
		);
	}

	const gamesWithProvidedClasses = GetGamesWithProvidedClasses(queryGame);

	if (
		gamesWithProvidedClasses.length === 0 ||
		!GetGameGroupConfig(queryGame).games.some((g) => GetProvidedClassSetsForGame(g).length > 0)
	) {
		return (
			<Alert variant="warning">
				{GetGameGroupConfig(queryGame).name} does not support manual class imports.
			</Alert>
		);
	}

	if (user.canImportProvidedClass === false) {
		return (
			<Alert variant="danger">
				You have been banned from manually importing classes on this instance.
			</Alert>
		);
	}

	return <InnerImportClassPage games={gamesWithProvidedClasses} userID={user.id} />;
}

function InnerImportClassPage({ games, userID }: { games: V3Game[]; userID: number }) {
	const [selectedGame, setSelectedGame] = useState<V3Game>(games[0]!);
	const [classValues, setClassValues] = useState<Partial<Record<Classes[V3Game], string>>>({});

	const { data, error } = useApiQuery<UGPTStatsReturn>(`/users/${userID}/games/${selectedGame}`);

	const providedClassSets = GetProvidedClassSetsForGame(selectedGame) as Classes[V3Game][];
	const gameConfig = GetGameConfig(selectedGame);

	const { importState, runImport } = useImport("/import/class", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});

	useEffect(() => {
		setClassValues({});
	}, [selectedGame]);

	useEffect(() => {
		if (data?.gameStats.classes) {
			const initial: Partial<Record<Classes[V3Game], string>> = {};
			for (const classSet of providedClassSets) {
				const val = data.gameStats.classes[classSet];
				if (val) {
					initial[classSet] = val;
				}
			}
			setClassValues(initial);
		}
	}, [data, providedClassSets]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<>
			<Alert variant="info">
				<strong>Self-reported classes.</strong> Values you set here are stored as{" "}
				<strong>manually set</strong> and appear that way in your activity feed. You can
				upgrade or downgrade PROVIDED classes (such as dans) — unlike score imports.
			</Alert>

			{games.length > 1 && (
				<Form.Group className="mb-3">
					<Form.Label>Playtype</Form.Label>
					<Form.Select
						onChange={(e) => setSelectedGame(e.target.value as V3Game)}
						value={selectedGame}
					>
						{games.map((game) => (
							<option key={game} value={game}>
								{FormatGame(game)}
							</option>
						))}
					</Form.Select>
				</Form.Group>
			)}

			<Row>
				{providedClassSets.map((classSet) => (
					<Col className="mb-3" key={classSet} lg={6} xs={12}>
						<Form.Group>
							<Form.Label>{UppercaseFirst(classSet)}</Form.Label>
							<Form.Select
								onChange={(e) =>
									setClassValues((prev) => ({
										...prev,
										[classSet]: e.target.value,
									}))
								}
								value={classValues[classSet] ?? ""}
							>
								<option value="">Select a value...</option>
								{gameConfig.classes[classSet]!.values.map((classInfo) => (
									<option key={classInfo.id} value={classInfo.id}>
										{classInfo.display}
									</option>
								))}
							</Form.Select>
							{classValues[classSet] && (
								<div className="mt-2">
									Preview:{" "}
									<ClassBadge
										classSet={classSet}
										classValue={classValues[classSet]!}
										game={selectedGame}
										showSetOnHover={false}
									/>
								</div>
							)}
						</Form.Group>
					</Col>
				))}
			</Row>

			<ImportStateRenderer state={importState} />

			<Button
				disabled={
					importState.state !== "not_started" ||
					Object.keys(classValues).length === 0 ||
					Object.values(classValues).some((v) => !v)
				}
				onClick={() =>
					runImport({
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ game: selectedGame, classes: classValues }),
					})
				}
				variant="primary"
			>
				Import Class
			</Button>
		</>
	);
}
