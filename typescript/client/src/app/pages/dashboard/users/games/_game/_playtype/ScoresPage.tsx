import useSetSubheader from "#components/layout/header/useSetSubheader";
import PBTable from "#components/tables/pbs/PBTable";
import ScoreTable from "#components/tables/scores/ScoreTable";
import DebounceSearch from "#components/util/DebounceSearch";
import Icon from "#components/util/Icon";
import LoadingWrapper from "#components/util/LoadingWrapper";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectLinkButton from "#components/util/SelectLinkButton";
import usePreferredRanking from "#components/util/usePreferredRanking";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import useUserGameBase from "#components/util/useUserGameBase";
import { type GameProfileProps, type GameProps, type SetState } from "#types/react";
import { FormatGameScoreRatingName } from "#util/misc";
import { useState } from "react";
import { Col, Form, Row } from "react-bootstrap";
import { Route, Switch } from "react-router-dom";
import {
	type ChartDocument,
	FormatGame,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	type PBScoreDocument,
	type ScoreDocument,
	type ScoreRatingAlgorithms,
	type SongDocument,
	type UnsuccessfulAPIResponse,
	type UserDocument,
	type V3Game,
} from "tachi-common";

export default function ScoresPage({
	reqUser,
	game,
}: {
	reqUser: UserDocument;
} & GameProps) {
	const gameConfig = GetGameConfig(game);

	const defaultRating = useScoreRatingAlg(game);

	const [alg, setAlg] = useState(defaultRating);

	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Scores",
		],
		[reqUser],
		`${reqUser.username}'s ${FormatGame(game)} Scores`,
	);

	const base = useUserGameBase({ reqUser, game });

	return (
		<Row xs={{ cols: 1 }}>
			<Col className="text-center">
				<div className="btn-group d-flex justify-content-center mb-4">
					<SelectLinkButton className="text-wrap" to={`${base}/scores`}>
						<Icon type="trophy" /> Best 100 PBs
					</SelectLinkButton>
					<SelectLinkButton className="text-wrap" to={`${base}/scores/history`}>
						<Icon type="history" /> Recent 100 Scores
					</SelectLinkButton>
					<SelectLinkButton className="text-wrap" to={`${base}/scores/most-played`}>
						<Icon type="mortar-pestle" /> Most Played
					</SelectLinkButton>
					<SelectLinkButton className="text-wrap" to={`${base}/scores/all`}>
						<Icon type="database" /> All PBs
					</SelectLinkButton>
				</div>
			</Col>
			<Col className="d-flex flex-column gap-4">
				<Switch>
					<Route exact path="/u/:userID/games/:game/scores">
						<>
							{Object.keys(gameConfig.scoreRatingAlgs).length > 1 && (
								<AlgSelector {...{ alg, setAlg, game }} />
							)}
							<PBsOverview
								url={`/users/${reqUser.id}/games/${game}/pbs/best?alg=${alg}`}
								{...{ reqUser, game, alg }}
							/>
						</>
					</Route>
					<Route path="/u/:userID/games/:game/scores/history">
						<ScoresOverview {...{ reqUser, game }} />
					</Route>
					<Route path="/u/:userID/games/:game/scores/all">
						<PBsOverview
							game={game}
							indexCol={false}
							key="all-pbs"
							reqUser={reqUser}
							url={`/users/${reqUser.id}/games/${game}/pbs/all`}
						/>
					</Route>
					<Route path="/u/:userID/games/:game/scores/most-played">
						<PBsOverview
							game={game}
							indexCol
							key="most-played-pbs"
							reqUser={reqUser}
							showPlaycount
							url={`/users/${reqUser.id}/games/${game}/most-played`}
						/>
					</Route>
				</Switch>
			</Col>
		</Row>
	);
}

function AlgSelector({
	game,
	alg,
	setAlg,
}: {
	alg: ScoreRatingAlgorithms[V3Game];
	setAlg: SetState<ScoreRatingAlgorithms[V3Game]>;
} & GameProps) {
	const gameConfig = GetGameConfig(game);
	return (
		<Form.Group className="d-flex flex-column gap-1">
			<div>Best 100 PBs according to</div>
			<Form.Select onChange={(e) => setAlg(e.target.value as any)} value={alg}>
				{Object.keys(gameConfig.scoreRatingAlgs).map((e) => (
					<option key={e} value={e}>
						{FormatGameScoreRatingName(game, e)}
					</option>
				))}
			</Form.Select>
		</Form.Group>
	);
}

function useFetchPBs(url: string, reqUser: UserDocument) {
	const { data, error } = useApiQuery<{
		charts: ChartDocument[];
		pbs: PBScoreDocument[];
		songs: SongDocument[];
	}>(url);

	return {
		error: error as UnsuccessfulAPIResponse,
		data: data ? FormatData(data.pbs, data.songs, data.charts, reqUser) : undefined,
	};
}

function PBsOverview({
	reqUser,
	game,
	indexCol = true,
	showPlaycount = false,
	url,
	alg,
}: {
	alg?: ScoreRatingAlgorithms[V3Game];
	indexCol?: boolean;
	reqUser: UserDocument;
	showPlaycount?: boolean;
	url: string;
} & GameProps) {
	const [search, setSearch] = useState("");

	const { data, error } = useFetchPBs(url, reqUser);

	const preferredRanking = usePreferredRanking();

	return (
		<div className="row">
			<div className="col-12">
				<DebounceSearch placeholder="Search all PBs..." setSearch={setSearch} />
			</div>
			<div className="col-12 mt-4">
				{search === "" ? (
					<LoadingWrapper style={{ height: 500 }} {...{ error, dataset: data }}>
						<PBTable
							alg={alg}
							dataset={data!}
							defaultRankingViewMode={preferredRanking}
							game={game}
							indexCol={indexCol}
							showPlaycount={showPlaycount}
						/>
					</LoadingWrapper>
				) : (
					<PBsSearch {...{ reqUser, game, search }} />
				)}
			</div>
		</div>
	);
}

function FormatData<D extends PBScoreDocument | ScoreDocument>(
	d: D[],
	songs: SongDocument[],
	charts: ChartDocument[],
	reqUser: UserDocument,
) {
	const songMap = new Map();
	const chartMap = new Map();

	for (const song of songs) {
		songMap.set(song.id, song);
	}

	for (const chart of charts) {
		chartMap.set(chart.chartID, chart);
	}

	const data = d.map((e, i) => ({
		...e,
		__related: {
			song: songMap.get(e.songID),
			chart: chartMap.get(e.chartID),
			index: i,
			user: reqUser,
		},
	}));

	return data;
}

function useFetchScores(url: string, reqUser: UserDocument) {
	const { data, error } = useApiQuery<{
		charts: ChartDocument[];
		scores: ScoreDocument[];
		songs: SongDocument[];
	}>(url);

	return {
		error: error as UnsuccessfulAPIResponse,
		data: data ? FormatData(data.scores, data.songs, data.charts, reqUser) : undefined,
	};
}

function PBsSearch({
	reqUser,
	game,
	search,
	alg,
}: {
	alg?: ScoreRatingAlgorithms[V3Game];
	reqUser: UserDocument;
	search: string;
} & GameProps) {
	const { data, error } = useFetchPBs(
		`/users/${reqUser.id}/games/${game}/pbs?search=${search}`,
		reqUser,
	);

	return (
		<LoadingWrapper style={{ height: 500 }} {...{ error, dataset: data }}>
			<PBTable alg={alg} dataset={data!} game={game} indexCol={false} />
		</LoadingWrapper>
	);
}

function ScoresOverview({ reqUser, game }: GameProfileProps) {
	const [search, setSearch] = useState("");

	const { data, error } = useFetchScores(
		`/users/${reqUser.id}/games/${game}/scores/recent`,
		reqUser,
	);

	return (
		<div className="row">
			<div className="col-12">
				<DebounceSearch
					placeholder="Search all individual scores..."
					setSearch={setSearch}
					size="lg"
				/>
			</div>
			<div className="col-12 mt-4">
				{search === "" ? (
					<LoadingWrapper style={{ height: 500 }} {...{ dataset: data, error }}>
						<ScoreTable dataset={data!} game={game} />
					</LoadingWrapper>
				) : (
					<ScoresSearch {...{ reqUser, game, search }} />
				)}
			</div>
		</div>
	);
}

function ScoresSearch({
	reqUser,
	game,
	search,
}: { reqUser: UserDocument; search: string } & GameProps) {
	const { data, error } = useFetchScores(
		`/users/${reqUser.id}/games/${game}/scores?search=${search}`,
		reqUser,
	);

	return (
		<LoadingWrapper style={{ height: 500 }} {...{ error, dataset: data }}>
			<ScoreTable dataset={data!} game={game} />
		</LoadingWrapper>
	);
}
