import useSetSubheader from "#components/layout/header/useSetSubheader";
import { TachiConfig } from "#lib/config";
import { APIFetchV1 } from "#util/api";
import React, { useMemo, useState } from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { type GameGroup, GetGameGroupConfig } from "tachi-common";

export default function AdminDestructivePage() {
	useSetSubheader(["Admin", "Destructive"]);

	const [deleteScoreId, setDeleteScoreId] = useState("");
	const [deleteSessionId, setDeleteSessionId] = useState("");

	const [userGameUserID, setUserGameUserID] = useState("");
	const [userGameGame, setUserGameGame] = useState<GameGroup>(TachiConfig.GAME_GROUPS[0]);
	const userGameConfig = useMemo(() => GetGameGroupConfig(userGameGame), [userGameGame]);
	const [userGamePlaytype, setUserGamePlaytype] = useState<string>(
		() => GetGameGroupConfig(TachiConfig.GAME_GROUPS[0]).playtypes[0],
	);

	const [destroyChartId, setDestroyChartId] = useState("");
	const [destroyChartGame, setDestroyChartGame] = useState<GameGroup>(TachiConfig.GAME_GROUPS[0]);

	function confirmDelete(message: string): boolean {
		return window.confirm(message);
	}

	return (
		<Row className="g-4">
			<Col lg={6}>
				<Card className="border-danger">
					<Card.Header className="bg-danger bg-opacity-10 text-danger">
						Delete score
					</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="delete-score">
							<Form.Label>Score ID</Form.Label>
							<Form.Control
								onChange={(e) => setDeleteScoreId(e.target.value)}
								type="text"
								value={deleteScoreId}
							/>
						</Form.Group>
						<Button
							disabled={!deleteScoreId.trim()}
							onClick={() => {
								if (
									!confirmDelete(
										"Permanently delete this score? This cannot be undone.",
									)
								) {
									return;
								}
								void APIFetchV1(
									`/admin/delete-score`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ scoreID: deleteScoreId.trim() }),
									},
									true,
									true,
								);
							}}
							variant="danger"
						>
							Delete score
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card className="border-danger">
					<Card.Header className="bg-danger bg-opacity-10 text-danger">
						Delete session
					</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="delete-session">
							<Form.Label>Session ID</Form.Label>
							<Form.Control
								onChange={(e) => setDeleteSessionId(e.target.value)}
								type="text"
								value={deleteSessionId}
							/>
						</Form.Group>
						<Button
							disabled={!deleteSessionId.trim()}
							onClick={() => {
								if (
									!confirmDelete(
										"Permanently delete this session and its scores? This cannot be undone.",
									)
								) {
									return;
								}
								void APIFetchV1(
									`/admin/delete-session`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ sessionID: deleteSessionId.trim() }),
									},
									true,
									true,
								);
							}}
							variant="danger"
						>
							Delete session
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card className="border-danger">
					<Card.Header className="bg-danger bg-opacity-10 text-danger">
						Destroy user game profile
					</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="userprofile-user">
							<Form.Label>User ID</Form.Label>
							<Form.Control
								onChange={(e) => setUserGameUserID(e.target.value)}
								type="number"
								value={userGameUserID}
							/>
						</Form.Group>
						<Form.Group className="mb-3" controlId="userprofile-game">
							<Form.Label>Game</Form.Label>
							<Form.Select
								onChange={(e) => {
									const g = e.target.value as GameGroup;
									setUserGameGame(g);
									const cfg = GetGameGroupConfig(g);
									setUserGamePlaytype(cfg.playtypes[0]);
								}}
								value={userGameGame}
							>
								{TachiConfig.GAME_GROUPS.map((g) => (
									<option key={g} value={g}>
										{g}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						<Form.Group className="mb-3" controlId="userprofile-pt">
							<Form.Label>Playtype</Form.Label>
							<Form.Select
								onChange={(e) => setUserGamePlaytype(e.target.value)}
								value={userGamePlaytype}
							>
								{userGameConfig.playtypes.map((pt) => (
									<option key={pt} value={pt}>
										{pt}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						<Button
							disabled={!userGameUserID.trim()}
							onClick={() => {
								const uid = Number.parseInt(userGameUserID, 10);
								if (Number.isNaN(uid)) {
									alert("User ID must be a number.");
									return;
								}
								if (
									!confirmDelete(
										`Destroy all stats for user ${uid} (${userGameGame} ${userGamePlaytype})? This cannot be undone.`,
									)
								) {
									return;
								}
								void APIFetchV1(
									`/admin/destroy-userprofile`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											userID: uid,
											game: userGameGame,
											playtype: userGamePlaytype,
										}),
									},
									true,
									true,
								);
							}}
							variant="danger"
						>
							Destroy User Profile
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card className="border-danger">
					<Card.Header className="bg-danger bg-opacity-10 text-danger">
						Destroy chart
					</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="destroy-chart-game">
							<Form.Label>Game</Form.Label>
							<Form.Select
								onChange={(e) => setDestroyChartGame(e.target.value as GameGroup)}
								value={destroyChartGame}
							>
								{TachiConfig.GAME_GROUPS.map((g) => (
									<option key={g} value={g}>
										{g}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						<Form.Group className="mb-3" controlId="destroy-chart-id">
							<Form.Label>Chart ID</Form.Label>
							<Form.Control
								onChange={(e) => setDestroyChartId(e.target.value)}
								type="text"
								value={destroyChartId}
							/>
						</Form.Group>
						<Button
							disabled={!destroyChartId.trim()}
							onClick={() => {
								if (
									!confirmDelete(
										"Destroy this chart and all related scores and sessions? This cannot be undone.",
									)
								) {
									return;
								}
								void APIFetchV1(
									`/admin/destroy-chart`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											chartID: destroyChartId.trim(),
											game: destroyChartGame,
										}),
									},
									true,
									true,
								);
							}}
							variant="danger"
						>
							Destroy chart
						</Button>
					</Card.Body>
				</Card>
			</Col>
		</Row>
	);
}
