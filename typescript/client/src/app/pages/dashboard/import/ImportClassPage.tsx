import { ErrorPage } from "#app/pages/ErrorPage";
import ClassBadge from "#components/game/ClassBadge";
import ImportClassImportState from "#components/imports/ImportClassImportState";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import useImport from "#components/util/import/useImport";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { type UGPTStatsReturn } from "#types/api-returns";
import { UppercaseFirst } from "#util/misc";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import {
	ALL_GAMES,
	type Classes,
	FormatGame,
	GetGameConfig,
	GetProvidedClassSetsForGame,
	type V3Game,
} from "tachi-common";

/** `<select>` value mapped to JSON `null` when submitting Import Class. */
const IMPORT_CLASS_CLEAR_SELECT_VALUE = "__tachi_import_class_clear__";

export default function ImportClassPage() {
	useSetSubheader(["Dashboard", "Import Scores", "Import Class"]);

	const { user } = useContext(UserContext);
	const history = useHistory();
	const queryGame = new URLSearchParams(window.location.search).get("game");

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

	if (!ALL_GAMES.includes(queryGame as V3Game)) {
		return (
			<Alert variant="warning">
				Invalid game &quot;{queryGame}&quot;. Open Import Class from the import page for a
				supported game.
			</Alert>
		);
	}

	const game = queryGame as V3Game;

	if (GetProvidedClassSetsForGame(game).length === 0) {
		return (
			<Alert variant="warning">
				{FormatGame(game)} does not support manual class imports.
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

	return <InnerImportClassPage game={game} userID={user.id} />;
}

function InnerImportClassPage({ game, userID }: { game: V3Game; userID: number }) {
	useSetSubheader(["Dashboard", "Import Scores", "Import Class", FormatGame(game)], [game]);
	const [classValues, setClassValues] = useState<Partial<Record<Classes[V3Game], string | null>>>(
		{},
	);

	const { data, error, isLoading } = useApiQuery<UGPTStatsReturn>(
		`/users/${userID}/games/${game}`,
	);

	const providedClassSets = useMemo(
		() => GetProvidedClassSetsForGame(game) as Classes[V3Game][],
		[game],
	);
	const gameConfig = GetGameConfig(game);

	const { importState, runImport, resetImport } = useImport("/import/class", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});

	const handleClassChange = (classSet: Classes[V3Game], rawSelect: string) => {
		let next: string | null;
		if (rawSelect === "") {
			return;
		}
		if (rawSelect === IMPORT_CLASS_CLEAR_SELECT_VALUE) {
			next = null;
		} else {
			next = rawSelect;
		}
		setClassValues((prev) => ({
			...prev,
			[classSet]: next,
		}));
		if (importState.state === "done" || importState.state === "failed") {
			resetImport();
		}
	};

	useEffect(() => {
		if (!data?.gameStats.classes) {
			return;
		}

		const initial: Partial<Record<Classes[V3Game], string | null>> = {};
		for (const classSet of providedClassSets) {
			const val = data.gameStats.classes[classSet];
			initial[classSet] = val ?? null;
		}
		setClassValues(initial);
	}, [data, game, providedClassSets]);

	if (error) {
		return (
			<Alert variant="danger">
				{error.description ?? "Failed to load your profile for this game."}
			</Alert>
		);
	}

	if (isLoading) {
		return <Loading />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<>
			<div className="display-1 fw-bold text-break text-body-emphasis mb-4">
				{FormatGame(game)}
			</div>

			<Alert variant="info">
				<strong>Manually set classes for your profile.</strong>
				<br />
				<strong>
					Do not insert false information here, this is monitored and I will revoke access
					to it!
				</strong>
			</Alert>

			<Row>
				{providedClassSets.map((classSet) => {
					const savedValue = data.gameStats.classes[classSet];
					const chosen = classValues[classSet];
					const selectValue =
						chosen === undefined
							? ""
							: chosen === null
								? IMPORT_CLASS_CLEAR_SELECT_VALUE
								: chosen;
					const unchanged =
						chosen !== undefined &&
						(chosen === null ? !savedValue : chosen === savedValue);

					return (
						<Col className="mb-3" key={classSet} lg={6} xs={12}>
							<Form.Group>
								<Form.Label>
									{FormatGame(game)} {UppercaseFirst(classSet)}
								</Form.Label>
								<Form.Select
									onChange={(e) => handleClassChange(classSet, e.target.value)}
									value={selectValue}
								>
									<option value="">Select a value...</option>
									<option value={IMPORT_CLASS_CLEAR_SELECT_VALUE}>
										— (unset)
									</option>
									{gameConfig.classes[classSet]!.values.map((classInfo) => (
										<option key={classInfo.id} value={classInfo.id}>
											{classInfo.display}
										</option>
									))}
								</Form.Select>
								<div className="mt-2 pt-2 border-top border-secondary border-opacity-25">
									<div className="d-flex flex-wrap align-items-center column-gap-3 row-gap-2">
										<div className="text-start">
											<div className="small text-muted">
												Currently on profile
											</div>
											<div className="mt-1">
												{savedValue ? (
													<ClassBadge
														classSet={classSet}
														classValue={savedValue}
														game={game}
														showSetOnHover={false}
													/>
												) : (
													<span className="small text-muted">None</span>
												)}
											</div>
										</div>
										<span aria-hidden className="text-muted user-select-none">
											→
										</span>
										<div className="text-start">
											<div className="small text-muted">Will import</div>
											<div className="mt-1">
												{chosen === undefined ? (
													<span className="small text-muted">
														Pick a value above
													</span>
												) : chosen === null ? (
													<span className="small text-muted">
														Unset (clear)
													</span>
												) : (
													<ClassBadge
														classSet={classSet}
														classValue={chosen}
														game={game}
														showSetOnHover={false}
													/>
												)}
											</div>
										</div>
									</div>
									{unchanged && (
										<div className="small text-muted mt-2 mb-0">
											No change from profile.
										</div>
									)}
								</div>
							</Form.Group>
						</Col>
					);
				})}
			</Row>

			<ImportClassImportState state={importState} />

			<Button
				disabled={
					importState.state !== "not_started" ||
					providedClassSets.some((cs) => !(cs in classValues))
				}
				onClick={() => {
					const classesPayload: Record<string, string | null> = {};
					for (const cs of providedClassSets) {
						classesPayload[String(cs)] = classValues[cs]!;
					}
					runImport({
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ game, classes: classesPayload }),
					});
				}}
				variant="primary"
			>
				Import Class
			</Button>
		</>
	);
}
