import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import SessionOverview from "#components/sessions/SessionOverview";
import ApiError from "#components/util/ApiError";
import DebugContent from "#components/util/DebugContent";
import Divider from "#components/util/Divider";
import EditableText from "#components/util/EditableText";
import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { type SessionAdjacentReturns, type SessionReturns } from "#types/api-returns";
import { type GameProfileProps } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { CreateChartMap, CreateScoreIDMap, CreateSongMap } from "#util/data";
import React, { useContext, useMemo, useState } from "react";
import { Badge, Button, Col, Row } from "react-bootstrap";
import { Redirect, useParams } from "react-router-dom";
import { GameToGameGroup, GetGameGroupConfig, type SessionDocument } from "tachi-common";

export default function SpecificSessionPage({ reqUser, game }: GameProfileProps) {
	const { sessionID } = useParams<{ sessionID: string }>();

	const { data, error } = useApiQuery<SessionReturns>(`/sessions/${sessionID}`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const sessionV3Game = data.session.game;

	if (data.user.id !== reqUser.id || game !== sessionV3Game) {
		return (
			<Redirect
				to={`/u/${data.user.username}/games/${sessionV3Game}/sessions/${sessionID}`}
			/>
		);
	}

	return <SessionPage key={data.session.sessionID} {...{ data, game, reqUser }} />;
}

function SessionPage({ data, game }: { data: SessionReturns } & GameProfileProps) {
	const { settings } = useContext(UserSettingsContext);

	const [sessionData, setSessionData] = useState(data);
	const { session, user, charts, scores, songs } = sessionData;

	const { user: loggedInUser } = useContext(UserContext);

	useSetSubheader(
		[
			"Users",
			user.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Sessions",
			session.name,
		],
		[session.name, game, user],
		`${user.username}: ${session.name}`,
	);

	const songMap = CreateSongMap(songs);
	const chartMap = CreateChartMap(charts);
	const scoreMap = CreateScoreIDMap(scores);

	const scoreDataset = useMemo(() => {
		const d = [];

		for (const sci of sessionData.scoreInfo) {
			const score = scoreMap.get(sci.scoreID);

			if (!score) {
				console.error(`No score for scoreID ${sci.scoreID}, but one was in session?`);
				continue;
			}

			const chart = chartMap.get(score.chartID);
			const song = songMap.get(score.songID);

			if (!chart || !song) {
				console.error(`No chart for ${score.chartID} (${score.songID})?`);
				continue;
			}

			d.push({
				...score,
				__related: {
					chart,
					song,
					index: 0,
					user,
				},
			});
		}

		return d;
	}, [sessionData]);

	const [highlight, setHighlight] = useState(session.highlight);

	const isAuthorised =
		loggedInUser && (loggedInUser.authLevel === 3 || loggedInUser.id === user.id);

	const updateSession = (sessionData: SessionReturns) => {
		APIFetchV1(
			`/sessions/${sessionData.session.sessionID}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: sessionData.session.name,
					desc: sessionData.session.desc,
					highlight: sessionData.session.highlight,
				}),
			},
			true,
			true,
		);
	};

	const { data: adjacentData } = useApiQuery<SessionAdjacentReturns>(
		`/sessions/${session.sessionID}/adjacent`,
	);

	const sessionIndex = sessionData.index;

	const centerContent = (
		<div className="d-flex flex-column gap-2 align-items-center justify-content-center text-center w-100 py-4 px-3">
			<span
				className="text-muted"
				style={{ fontSize: "1.1rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
			>
				Session #{sessionIndex}
			</span>
			<EditableText
				as="h1"
				authorised={isAuthorised || false}
				className="enable-rfs my-0"
				initialText={session.name || ""}
				onSubmit={(name) => {
					const newSession: SessionReturns = {
						...sessionData,
						session: { ...sessionData.session, name },
					};
					setSessionData(newSession);
					updateSession(newSession);
				}}
				placeholderText={session.name || "Untitled Session"}
			/>

			<EditableText
				authorised={isAuthorised || false}
				className="fs-5 text-muted"
				initialText={session.desc || ""}
				onSubmit={(desc) => {
					const newSession: SessionReturns = {
						...sessionData,
						session: { ...sessionData.session, desc },
					};
					setSessionData(newSession);
					updateSession(newSession);
				}}
				placeholderText={session.desc || "No Description..."}
			/>

			{session.highlight && (
				<Badge bg="warning" style={{ lineHeight: "15px" }}>
					Highlight!
				</Badge>
			)}

			{user.id === loggedInUser?.id && (
				<div>
					{highlight ? (
						<Button
							onClick={async () => {
								setHighlight(false);
								session.highlight = false;
								await APIFetchV1(
									`/sessions/${session.sessionID}`,
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ highlight: false }),
									},
									true,
									true,
								);
							}}
							size="sm"
							variant="outline-danger"
						>
							<Icon type="star" /> Un-Highlight
						</Button>
					) : (
						<Button
							onClick={async () => {
								setHighlight(true);
								session.highlight = true;
								await APIFetchV1(
									`/sessions/${session.sessionID}`,
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ highlight: true }),
									},
									true,
									true,
								);
							}}
							size="sm"
							variant="outline-warning"
						>
							<Icon regular type="star" /> Highlight
						</Button>
					)}
				</div>
			)}
		</div>
	);

	return (
		<Row className="justify-content-center">
			<Col xs={12}>
				{/* Desktop: tape layout */}
				<div className="d-none d-md-block">
					<SessionNavRow
						adjacent={adjacentData ?? null}
						currentSession={session}
						sessionIndex={sessionIndex}
						username={user.username}
					>
						{centerContent}
					</SessionNavRow>
				</div>

				{/* Mobile: stacked layout */}
				<div className="d-md-none">
					<MobileSessionNav
						adjacent={adjacentData ?? null}
						currentSession={session}
						sessionIndex={sessionIndex}
						username={user.username}
					/>
					{centerContent}
					<MobileSessionNav
						adjacent={adjacentData ?? null}
						bottom
						currentSession={session}
						sessionIndex={sessionIndex}
						username={user.username}
					/>
				</div>

				<Divider className="mt-4 mb-4" />
			</Col>
			<SessionOverview
				reqUser={data.user}
				scoreDataset={scoreDataset}
				sessionData={sessionData}
				setSessionData={setSessionData}
			/>
			{settings?.preferences.developerMode && (
				<Col xs={12}>
					<Divider />
					<Card header="Debug Content">
						<DebugContent data={sessionData} />
					</Card>
				</Col>
			)}
		</Row>
	);
}

function formatSessionTimeDiff(fromSession: SessionDocument, toSession: SessionDocument): string {
	const diffMs = toSession.timeStarted - fromSession.timeStarted;
	const absDiff = Math.abs(diffMs);
	const direction = diffMs < 0 ? "before" : "after";

	const minutes = Math.round(absDiff / 60_000);
	const hours = Math.round(absDiff / 3_600_000);
	const days = Math.round(absDiff / 86_400_000);
	const weeks = Math.round(absDiff / (7 * 86_400_000));
	const months = Math.round(absDiff / (30 * 86_400_000));

	let amount: string;
	if (minutes < 60) {
		amount = `${minutes}m`;
	} else if (hours < 24) {
		amount = `${hours}h`;
	} else if (days < 14) {
		amount = `${days}d`;
	} else if (weeks < 8) {
		amount = `${weeks}w`;
	} else {
		amount = `${months}mo`;
	}

	return `${amount} ${direction}`;
}

function MobileSessionNav({
	adjacent,
	bottom,
	currentSession,
	sessionIndex,
	username,
}: {
	adjacent: SessionAdjacentReturns | null;
	bottom?: boolean;
	currentSession: SessionDocument;
	sessionIndex: number;
	username: string;
}) {
	const sessionUrl = (s: SessionDocument) =>
		`/u/${username}/games/${s.game}/sessions/${s.sessionID}`;

	const prev = adjacent?.prev ?? null;
	const next = adjacent?.next ?? null;

	return (
		<div className="d-flex gap-2 mb-3">
			{!bottom && prev ? (
				<LinkButton
					className="flex-fill d-flex align-items-center gap-2 text-start py-2 px-3"
					to={sessionUrl(prev)}
					variant="outline-secondary"
				>
					<span style={{ fontSize: "1.1rem" }}>&laquo;</span>
					<div style={{ minWidth: 0 }}>
						<div
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.05em",
								textTransform: "uppercase",
								opacity: 0.6,
							}}
						>
							&laquo; #{sessionIndex - 1} &middot;{" "}
							{formatSessionTimeDiff(currentSession, prev)}
						</div>
						<div className="text-truncate" style={{ fontWeight: 600 }}>
							{prev.name}
						</div>
					</div>
				</LinkButton>
			) : !bottom ? (
				<div
					className="flex-fill py-2 px-3 border border-secondary rounded d-flex align-items-center gap-2"
					style={{ opacity: 0.25 }}
				>
					<span style={{ fontSize: "1.1rem" }}>&laquo;</span>
					<div style={{ fontSize: "0.85rem" }}>No earlier session</div>
				</div>
			) : null}

			{bottom && next ? (
				<LinkButton
					className="flex-fill d-flex align-items-center justify-content-end gap-2 text-end py-2 px-3"
					to={sessionUrl(next)}
					variant="outline-secondary"
				>
					<div style={{ minWidth: 0 }}>
						<div
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.05em",
								textTransform: "uppercase",
								opacity: 0.6,
							}}
						>
							#{sessionIndex + 1} &middot;{" "}
							{formatSessionTimeDiff(currentSession, next)} &raquo;
						</div>
						<div className="text-truncate" style={{ fontWeight: 600 }}>
							{next.name}
						</div>
					</div>
					<span style={{ fontSize: "1.1rem" }}>&raquo;</span>
				</LinkButton>
			) : bottom ? (
				<div
					className="flex-fill py-2 px-3 border border-secondary rounded d-flex align-items-center justify-content-end gap-2"
					style={{ opacity: 0.25 }}
				>
					<div style={{ fontSize: "0.85rem" }}>No later session</div>
					<span style={{ fontSize: "1.1rem" }}>&raquo;</span>
				</div>
			) : null}
		</div>
	);
}

function SessionNavRow({
	adjacent,
	children,
	currentSession,
	sessionIndex,
	username,
}: {
	adjacent: SessionAdjacentReturns | null;
	children: React.ReactNode;
	currentSession: SessionDocument;
	sessionIndex: number;
	username: string;
}) {
	const sessionUrl = (s: SessionDocument) =>
		`/u/${username}/games/${s.game}/sessions/${s.sessionID}`;

	const borderColor = "var(--bs-secondary)";
	const sideStyle = {
		border: `1px solid ${borderColor}`,
		background: "rgba(255,255,255,0.02)",
	};

	return (
		<div className="d-flex align-items-stretch" style={{ minHeight: "80px" }}>
			{/* Prev */}
			<div style={{ flex: "2 1 0", minWidth: 0 }}>
				{adjacent?.prev ? (
					<LinkButton
						className="w-100 h-100 d-flex flex-column align-items-start justify-content-center px-3 py-3 text-start"
						style={{ borderRadius: "6px 0 0 6px", ...sideStyle }}
						to={sessionUrl(adjacent.prev)}
						variant="outline-secondary"
					>
						<span
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase",
								opacity: 0.6,
							}}
						>
							&laquo; #{sessionIndex - 1} &middot;{" "}
							{formatSessionTimeDiff(currentSession, adjacent.prev)}
						</span>
						<span
							className="text-truncate w-100 mt-1"
							style={{ fontSize: "1rem", fontWeight: 600 }}
						>
							{adjacent.prev.name}
						</span>
					</LinkButton>
				) : (
					<div
						className="w-100 h-100 d-flex flex-column align-items-start justify-content-center px-3 py-3"
						style={{ borderRadius: "6px 0 0 6px", ...sideStyle, opacity: 0.25 }}
					>
						<span
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase",
							}}
						>
							&laquo; Prev
						</span>
						<span className="mt-1" style={{ fontSize: "1rem", fontWeight: 600 }}>
							(This is your first session!)
						</span>
					</div>
				)}
			</div>

			{/* Current session — children */}
			<div
				className="d-flex align-items-center justify-content-center"
				style={{
					flex: "3 1 0",
					minWidth: 0,
					borderTop: `1px solid ${borderColor}`,
					borderBottom: `1px solid ${borderColor}`,
					background: "rgba(255,255,255,0.015)",
				}}
			>
				{children}
			</div>

			{/* Next */}
			<div style={{ flex: "2 1 0", minWidth: 0 }}>
				{adjacent?.next ? (
					<LinkButton
						className="w-100 h-100 d-flex flex-column align-items-end justify-content-center px-3 py-3 text-end"
						style={{ borderRadius: "0 6px 6px 0", ...sideStyle }}
						to={sessionUrl(adjacent.next)}
						variant="outline-secondary"
					>
						<span
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase",
								opacity: 0.6,
							}}
						>
							{formatSessionTimeDiff(currentSession, adjacent.next)} &middot; #
							{sessionIndex + 1} &raquo;
						</span>
						<span
							className="text-truncate w-100 mt-1"
							style={{ fontSize: "1rem", fontWeight: 600 }}
						>
							{adjacent.next.name}
						</span>
					</LinkButton>
				) : (
					<div
						className="w-100 h-100 d-flex flex-column align-items-end justify-content-center px-3 py-3"
						style={{ borderRadius: "0 6px 6px 0", ...sideStyle, opacity: 0.25 }}
					>
						<span
							style={{
								fontSize: "0.7rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase",
							}}
						>
							Next &raquo;
						</span>
						<span className="mt-1" style={{ fontSize: "1rem", fontWeight: 600 }}>
							(This is your most recent session!)
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
