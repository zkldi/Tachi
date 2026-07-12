import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import DifficultyCell from "#components/tables/cells/DifficultyCell";
import TitleCell from "#components/tables/cells/TitleCell";
import TachiTable from "#components/tables/components/TachiTable";
import { CascadingRatingValue } from "#components/tables/headers/ChartHeader";
import ProfilePicture from "#components/user/ProfilePicture";
import ApiError from "#components/util/ApiError";
import DebounceSearch from "#components/util/DebounceSearch";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import { useTachiSearch } from "#components/util/search/useTachiSearch";
import SelectButton from "#components/util/SelectButton";
import { UserContext } from "#context/UserContext";
import { ONE_MINUTE } from "#util/constants/time";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, { useContext, useEffect, useLayoutEffect, useState } from "react";
import { Badge, Col, Form, Row } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
	type ChartDocument,
	FormatGame,
	type integer,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

function parseSearchParams(search: string) {
	const params = new URLSearchParams(search);
	return {
		q: params.get("q") ?? "",
		hasPlayedGame: params.get("hasPlayedGame") !== "false",
	};
}

export default function SearchPage() {
	useSetSubheader("Search");

	const { user } = useContext(UserContext);
	const history = useHistory();
	const location = useLocation();

	const { q: initialQ, hasPlayedGame: initialHasPlayed } = parseSearchParams(location.search);
	const [search, setSearch] = useState(initialQ);
	const [hasPlayedGame, setHasPlayedGame] = useState(initialHasPlayed);

	useLayoutEffect(() => {
		const params = parseSearchParams(location.search);
		setSearch(params.q);
		setHasPlayedGame(params.hasPlayedGame);
	}, [location.search]);

	useEffect(() => {
		const qs = `?q=${encodeURIComponent(search)}&hasPlayedGame=${hasPlayedGame}`;
		if (location.search !== qs) {
			history.replace(`/search${qs}`);
		}
	}, [search, hasPlayedGame]);

	return (
		<Row>
			<Col xs={12}>
				<Card className="mt-8" header="Search Tachi">
					<DebounceSearch
						autoFocus
						className="form-control-lg"
						committedSearch={search}
						placeholder="Search songs, users..."
						setSearch={setSearch}
					/>
					{user && (
						<div className="w-100 mt-4 ms-1">
							<Form.Check
								checked={hasPlayedGame}
								label="Hide games you haven't played?"
								onChange={(e) => setHasPlayedGame(e.target.checked)}
							/>
						</div>
					)}
					<Divider />
				</Card>
			</Col>
			<Col xs={12}>
				<SearchResults hasPlayedGame={hasPlayedGame} search={search} />
			</Col>
		</Row>
	);
}

function SearchResults({ search, hasPlayedGame }: { hasPlayedGame: boolean; search: string }) {
	const { data, error } = useTachiSearch(search, hasPlayedGame);
	const [mode, setMode] = useState<"users" | V3Game | null>(null);

	useEffect(() => {
		if (data) {
			const thingsWithCharts = Object.entries(data.charts)
				.sort(StrSOV((x) => x[0]))
				.filter((k) => k[1].length > 0);

			if (thingsWithCharts.length > 0) {
				setMode(thingsWithCharts[0][0] as V3Game);
			} else if (data.users.length > 0) {
				setMode("users");
			} else {
				setMode(null);
			}
		} else {
			setMode(null);
		}
	}, [data, hasPlayedGame]);

	if (search === "") {
		return <></>;
	}

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const hasCharts = Object.values(data.charts).some((k) => k.length > 0);
	const hasUsers = data.users.length > 0;
	if (!hasCharts && !hasUsers) {
		return (
			<Row>
				<Col xs={12}>Found nothing. Sorry!</Col>
			</Row>
		);
	}

	return (
		<Row>
			<Col
				className="d-flex"
				lg={3}
				style={{
					flexWrap: "wrap",
					flexDirection: "column",
					gap: "2px",
				}}
				xs={12}
			>
				{Object.entries(data.charts)
					.sort(StrSOV((x) => x[0]))
					.map(([g, charts]) => {
						if (charts.length === 0) {
							return null;
						}

						const game = g as V3Game;

						return (
							<SelectButton id={game} key={game} setValue={setMode} value={mode}>
								{FormatGame(game)}
								<Badge bg="secondary" className="ms-2 text-light">
									{charts.length}
								</Badge>
							</SelectButton>
						);
					})}

				{data.users.length > 0 && (
					<SelectButton
						disabled={data.users.length === 0}
						id="users"
						setValue={setMode}
						value={mode}
					>
						Users
						<Badge bg="secondary" className="ms-2">
							{data.users.length}
						</Badge>
					</SelectButton>
				)}

				<div className="d-block d-lg-none">
					<Divider />
				</div>
			</Col>
			{mode !== null && (
				<Col lg={9} xs={12}>
					{mode === "users" ? (
						<UsersView users={data.users} />
					) : (
						<ChartView charts={data.charts[mode]!} game={mode} />
					)}
				</Col>
			)}
		</Row>
	);
}

function ChartView({
	charts,
	game,
}: {
	charts: Array<{
		chart: ChartDocument;
		playcount: integer;
		song: SongDocument;
	}>;
	game: V3Game;
}) {
	return (
		<TachiTable
			dataset={charts}
			defaultReverseSort
			defaultSortMode="Site Playcount"
			entryName="Charts"
			headers={[
				["Chart", "Chart", (a, b) => CascadingRatingValue(game, a.chart, b.chart)],
				["Song Title", "Song", StrSOV((x) => x.song.title)],
				["Site Playcount", "Playcount", NumericSOV((x) => x.playcount)],
			]}
			rowFunction={(d) => (
				<tr>
					<DifficultyCell chart={d.chart} game={game} />
					<TitleCell chart={d.chart} game={game} song={d.song} />
					<td>{d.playcount}</td>
				</tr>
			)}
			searchFunctions={{
				title: (x) => x.song.title,
				artist: (x) => x.song.artist,
				playcount: (x) => x.playcount,
				difficulty: (x) => x.chart.difficulty,
				level: (x) => x.chart.levelNum,
			}}
		/>
	);
}

function UsersView({ users }: { users: Array<UserDocument> }) {
	return (
		<TachiTable
			dataset={users}
			defaultSortMode="Last Seen"
			entryName="Users"
			headers={[
				["User", "User", StrSOV((x) => x.username)],
				["Status", "Status", StrSOV((x) => x.status ?? "")],
				["Last Seen", "Last Seen", NumericSOV((x) => x.lastSeen)],
			]}
			rowFunction={(u) => (
				<tr>
					<td>
						<Link to={`/u/${u.username}`}>
							<ProfilePicture size="sm" user={u} />
							{u.username}
						</Link>
					</td>
					<td>
						<Muted>{u.status ?? "No status."}</Muted>
					</td>
					<td>
						{u.lastSeen === 0
							? "Never"
							: new Date(u.lastSeen).toLocaleDateString("en-GB", {
									timeZone: "UTC",
									year: "2-digit",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
									timeZoneName: "short",
								})}
					</td>
				</tr>
			)}
			searchFunctions={{
				username: (x) => x.username,
				status: (x) => x.status,
				lastSeen: (x) => {
					if (x.lastSeen === 0) {
						return null;
					}
					return new Date(x.lastSeen).toLocaleString("en-GB", {
						timeZone: "UTC",
						timeZoneName: "short",
					});
				},
			}}
		/>
	);
}

function LastSeenCell({ time }: { time: number }) {
	if (time === 0) {
		return <td>Never</td>;
	}

	const now = Date.now();

	if (now - time < ONE_MINUTE) {
		return <td>Just Now</td>;
	}

	const d = new Date(time);

	return <td>{d.toLocaleDateString("en-GB")}</td>;
}
