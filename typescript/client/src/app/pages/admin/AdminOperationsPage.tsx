import useSetSubheader from "#components/layout/header/useSetSubheader";
import { APIFetchV1 } from "#util/api";
import { useState } from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { ALL_GAMES, FormatGame, type V3Game } from "tachi-common";

export default function AdminOperationsPage() {
	useSetSubheader(["Admin", "Operations"]);

	const [announcementTitle, setAnnouncementTitle] = useState("");
	const [announcementGame, setAnnouncementPlaytype] = useState<V3Game | null>(null);

	const [folderId, setFolderId] = useState("");

	const [supporterUser, setSupporterUser] = useState("");

	return (
		<Row className="g-4">
			<Col lg={6}>
				<Card className="h-100">
					<Card.Header>Site announcement</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="announcement-title">
							<Form.Label>Title</Form.Label>
							<Form.Control
								onChange={(e) => setAnnouncementTitle(e.target.value)}
								type="text"
								value={announcementTitle}
							/>
						</Form.Group>
						<Form.Group className="mb-3" controlId="announcement-game">
							<Form.Label>Game</Form.Label>
							<Form.Select
								onChange={(e) => setAnnouncementPlaytype(e.target.value as V3Game)}
								value={announcementGame ?? ""}
							>
								<option value="">-</option>
								{ALL_GAMES.map((game) => (
									<option key={game} value={game}>
										{FormatGame(game)}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						<Button
							disabled={!announcementTitle.trim()}
							onClick={() => {
								const body: Record<string, unknown> = {
									title: announcementTitle.trim(),
								};
								if (announcementGame) {
									body.game = announcementGame;
								}
								void APIFetchV1(
									`/admin/announcement`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify(body),
									},
									true,
									true,
								);
							}}
							variant="primary"
						>
							Send announcement
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card className="h-100">
					<Card.Header>Supporter status</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="supporter-user">
							<Form.Label>Username or user ID</Form.Label>
							<Form.Control
								onChange={(e) => setSupporterUser(e.target.value)}
								placeholder="e.g. zkldi or 1"
								type="text"
								value={supporterUser}
							/>
						</Form.Group>
						<div className="d-flex flex-wrap gap-2">
							<Button
								disabled={!supporterUser.trim()}
								onClick={() =>
									void APIFetchV1(
										`/admin/supporter/${encodeURIComponent(supporterUser.trim())}`,
										{ method: "POST" },
										true,
										true,
									)
								}
								variant="primary"
							>
								Grant supporter
							</Button>
							<Button
								disabled={!supporterUser.trim()}
								onClick={() =>
									void APIFetchV1(
										`/admin/supporter/${encodeURIComponent(supporterUser.trim())}`,
										{ method: "DELETE" },
										true,
										true,
									)
								}
								variant="outline-danger"
							>
								Revoke supporter
							</Button>
						</div>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card>
					<Card.Header>Rebuild folder chart lookup (Postgres)</Card.Header>
					<Card.Body>
						<Form.Group className="mb-3" controlId="folder-id">
							<Form.Label>Folder ID (optional)</Form.Label>
							<Form.Control
								onChange={(e) => setFolderId(e.target.value)}
								placeholder="Leave empty to rebuild all folders"
								type="text"
								value={folderId}
							/>
						</Form.Group>
						<Button
							onClick={() => {
								const body: { folderId?: string } = {};
								if (folderId.trim()) {
									body.folderId = folderId.trim();
								}
								void APIFetchV1(
									`/admin/rebuild-folder-chart-lookup`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify(body),
									},
									true,
									true,
								);
							}}
							variant="primary"
						>
							Rebuild
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card>
					<Card.Header>Reprocess all goals</Card.Header>
					<Card.Body>
						<p className="text-body-secondary small">
							Re-runs goal and quest processing for every user game profile. Heavy
							operation.
						</p>
						<Button
							onClick={() =>
								void APIFetchV1(
									`/admin/reprocess-all-goals`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({}),
									},
									true,
									true,
								)
							}
							variant="warning"
						>
							Reprocess all goals
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card>
					<Card.Header>Recalc PBs</Card.Header>
					<Card.Body>
						<p className="text-muted small mb-3">
							Enqueues every distinct user+chart that has at least one score into
							<code className="mx-1">pb_dirty</code>, then drains that queue and
							downstream session/profile queues until idle (all games). This request
							waits until processing finishes.
						</p>
						<Button
							onClick={() => {
								void APIFetchV1(
									`/admin/recalc-pbs`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({}),
									},
									true,
									true,
								);
							}}
							variant="primary"
						>
							Recalc all PBs
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card>
					<Card.Header>Recalc game profiles</Card.Header>
					<Card.Body>
						<p className="text-muted small mb-3">
							Enqueues every game profile and every distinct committed score (user,
							game) pair into
							<code className="mx-1">game_profile_dirty</code>, then drains that queue
							until idle (all games). This request waits until processing finishes.
						</p>
						<Button
							onClick={() => {
								void APIFetchV1(
									`/admin/recalc-profiles`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({}),
									},
									true,
									true,
								);
							}}
							variant="primary"
						>
							Recalc all profiles
						</Button>
					</Card.Body>
				</Card>
			</Col>

			<Col lg={6}>
				<Card>
					<Card.Header>Recalc scores</Card.Header>
					<Card.Body>
						<p className="text-muted small mb-3">
							Enqueues every chart for full score re-derivation (all games), then
							drains score and downstream queues until idle. This request waits until
							processing finishes; can take a long time on large databases.
						</p>
						<Button
							onClick={() => {
								void APIFetchV1(
									`/admin/recalc`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({}),
									},
									true,
									true,
								);
							}}
							variant="primary"
						>
							Recalc all scores
						</Button>
					</Card.Body>
				</Card>
			</Col>
		</Row>
	);
}
