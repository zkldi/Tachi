import QuickTooltip from "#components/layout/misc/QuickTooltip";
import MiniTable from "#components/tables/components/MiniTable";
import ApiError from "#components/util/ApiError";
import ExternalLink from "#components/util/ExternalLink";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import { AllYourUGStatsContext } from "#context/AllYourUGStatsContext";
import { UserContext } from "#context/UserContext";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameProps } from "#types/react";
import { IsNotNullish } from "#util/misc";
import { useContext } from "react";
import { Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type ChartDocument,
	type FolderDocument,
	FormatDifficultySearch,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	type SongDocument,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

export default function ChartInfoFormat({
	song,
	chart,
	game,
}: { chart: ChartDocument; song: SongDocument } & GameProps) {
	const { data, error } = useApiQuery<FolderDocument[]>(
		`/games/${game}/charts/${chart.chartID}/folders`,
	);

	const { user } = useContext(UserContext);
	const { ugs } = useContext(AllYourUGStatsContext);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const ugsExists = user && ugs?.find((u: UserGameStats) => u.game === game);

	return (
		<Row
			className="text-center align-items-center gap-8 gap-lg-0"
			style={{
				paddingTop: "2.2rem",
				justifyContent: "space-evenly",
			}}
		>
			<Col lg={3} style={{ textAlign: "left" }} xs={12}>
				<h4>Appears In</h4>
				<ChartInfoLeft
					data={data}
					game={game}
					username={ugsExists ? user.username : undefined}
				/>
			</Col>
			<Col lg={4} xs={12}>
				<ChartInfoMiddle chart={chart} game={game} song={song} />
			</Col>
			<Col lg={3} xs={12}>
				<ChartInfoRight chart={chart} game={game} />
			</Col>
		</Row>
	);
}

function ChartInfoLeft({
	game,
	data,
	username,
}: {
	data: FolderDocument[];
	game: V3Game;
	username: string | undefined;
}) {
	if (data.length === 0) {
		return <Muted>No folders...</Muted>;
	}

	const gameConfig = GetGameConfig(game);
	const versionKeys = Object.keys(gameConfig.versions);

	// These games define folders other than "Level N"
	if (["chunithm", "jubeat", "ongeki", "popn", "sdvx"].includes(game)) {
		const groups: { [key: string]: FolderDocument[] } = Object.fromEntries(
			[...versionKeys, "__other"].map((s) => [s, []]),
		);
		for (const folder of data) {
			if (folder.versionFilter?.length === 1) {
				groups[folder.versionFilter[0]].push(folder);
			} else {
				groups.__other.push(folder);
			}
		}
		const sortingKey = (e: { slug: string; title: string }) => {
			if (e.title.startsWith("Level")) {
				// Prioritize wider folders (i.e. popn, jubeat)
				if (e.title.match(/Level \d+-\d+/u)) {
					return 1;
				}
				if (e.title.match(/Level \d+\.\d/u)) {
					return 3;
				}
				return 2;
			}
			if (
				"order" in gameConfig.difficulties &&
				gameConfig.difficulties.order.includes(e.title)
			) {
				return 4;
			}
			return 5;
		};
		return (
			<>
				{Object.entries(groups)
					.sort(([a], [b]) => versionKeys.indexOf(a) - versionKeys.indexOf(b))
					.filter(([, v]) => v.length > 0)
					.map(([k, v]) => (
						<div className="mb-2" key={k}>
							{k !== "__other" && (
								<div className="fw-bold">{gameConfig.versions[k]}</div>
							)}
							{v
								.map((e) => ({
									slug: e.slug,
									title: e.title.match(/([^(]+) \(/u)?.[1] ?? e.title,
								}))
								.sort((a, b) => sortingKey(a) - sortingKey(b))
								.map((e, idx) => (
									<span key={e.slug}>
										<>{idx > 0 && " • "}</>
										<span>
											<Link
												className="text-decoration-none"
												to={`${username ? `/u/${username}` : ""}/games/${game}/folders/${e.slug}`}
											>
												{e.title}
											</Link>
										</span>
									</span>
								))}
						</div>
					))}
			</>
		);
	}

	return (
		<>
			{data
				.sort((a, b) => a.title.localeCompare(b.title))
				.sort(
					(a, b) =>
						versionKeys.indexOf(a.versionFilter?.[0] ?? "") -
						versionKeys.indexOf(b.versionFilter?.[0] ?? ""),
				)
				.map((e) => (
					<li key={e.slug}>
						<Link
							className="text-decoration-none"
							to={`${username ? `/u/${username}` : ""}/games/${game}/folders/${e.slug}`}
						>
							{e.title}
						</Link>
					</li>
				))}
		</>
	);
}

function ChartInfoMiddle({
	game,
	song,
	chart,
}: {
	chart: ChartDocument;
	game: V3Game;
	song: SongDocument;
}) {
	if (game === "bms-7k" || game === "bms-14k") {
		const bmsChart = chart as ChartDocument<"bms-7k" | "bms-14k">;

		return (
			<>
				<ExternalLink
					href={`https://makiba.ac/charts/sha256/${bmsChart.data.hashSHA256}/view`}
				>
					View Chart
				</ExternalLink>
				<br />
				<ExternalLink href={`https://lr2ir.com/charts/${bmsChart.data.hashMD5}`}>
					View on LR2IR Archive
				</ExternalLink>
				<br />
				<ExternalLink href={`backbeat://charts/sha256/${bmsChart.data.hashSHA256}`}>
					Download with Backbeat
				</ExternalLink>
			</>
		);
	} else if (game === "pms-controller" || game === "pms-keyboard") {
		const pmsChart = chart as ChartDocument<"pms-controller" | "pms-keyboard">;

		return (
			<>
				<ExternalLink href={`https://lr2ir.com/charts/${pmsChart.data.hashMD5}`}>
					View on LR2IR Archive
				</ExternalLink>
				<br />
				<ExternalLink href={`backbeat://charts/sha256/${pmsChart.data.hashSHA256}`}>
					Download with Backbeat
				</ExternalLink>
			</>
		);
	}

	const gameGroupConfig = GetGameGroupConfig(GameToGameGroup(game));

	const diff = FormatDifficultySearch(chart);
	const gameName =
		game === "ongeki" ? "オンゲキ" : game === "maimaidx" ? "maimai" : gameGroupConfig.name;
	const formattedTitle = song.title
		.replace(/([!?,]){4,}/gu, (m) => m[0].repeat(3))
		.replace(/-/gu, " ");

	let search = `${gameName} ${formattedTitle}`;

	if (diff !== null) {
		search += ` ${diff}`;
	}

	return (
		<>
			<ExternalLink
				href={`https://youtube.com/results?search_query=${encodeURIComponent(search)}`}
			>
				Search YouTube
			</ExternalLink>
			{"chartViewURL" in chart.data && (
				<>
					<br />
					<ExternalLink href={chart.data.chartViewURL}>Chart view</ExternalLink>
				</>
			)}
		</>
	);
}

function ChartInfoRight({ game, chart }: { chart: ChartDocument; game: V3Game }) {
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	if (gptImpl.displayLevelHistory !== undefined && "levelHistory" in chart.data) {
		const gameConfig = GetGameConfig(game);
		if (chart.data.levelHistory === null) {
			return <Muted>N/A</Muted>;
		}
		return (
			<>
				<MiniTable colSpan={2} headers={["Level history"]}>
					{gptImpl.displayLevelHistory.map((v) => {
						const levelHistory = (chart.data as any).levelHistory as Record<
							string,
							{ level: string; levelNum: number } | null
						>;
						if (levelHistory[v] === null) {
							return (
								<tr key={v}>
									<td>{gameConfig.versions[v]}</td>
									<td>
										<Muted>N/A</Muted>
									</td>
								</tr>
							);
						}
						const { level, levelNum } = levelHistory[v];
						return (
							<tr key={v}>
								<td>{gameConfig.versions[v]}</td>
								<td>
									{level} <Muted>({levelNum.toFixed(1)})</Muted>
								</td>
							</tr>
						);
					})}
				</MiniTable>
			</>
		);
	}

	const ratingSystems = gptImpl.ratingSystems;

	if (ratingSystems.some((k) => IsNotNullish(k.toString(chart as any)))) {
		return (
			<>
				<MiniTable colSpan={2} headers={["Ratings"]}>
					{ratingSystems.map((e) => {
						// @ts-expect-error bad types
						const strV = e.toString(chart);
						// @ts-expect-error bad types
						const numV = e.toNumber(chart);

						if (
							strV === null ||
							strV === undefined ||
							numV === null ||
							numV === undefined
						) {
							return null;
						}

						return (
							<tr key={e.name}>
								<td>{e.name}</td>
								<td>
									{strV} <Muted>({numV.toFixed(2)})</Muted>
									{/* @ts-expect-error utterly silly types */}
									{e.idvDifference(chart) && (
										<>
											<br />
											<QuickTooltip tooltipContent="Individual Difference - The difficulty of this varies massively between people!">
												<span>
													<Icon type="balance-scale-left" />
												</span>
											</QuickTooltip>
										</>
									)}
								</td>
							</tr>
						);
					})}
				</MiniTable>
			</>
		);
	} else {
		return (
			<>
				<Muted>No tierlist info.</Muted>
			</>
		);
	}
}
