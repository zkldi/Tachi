import Card from "#components/layout/page/Card";
import LinkButton from "#components/util/LinkButton";
import LoadingWrapper from "#components/util/LoadingWrapper";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import ReferToUser from "#components/util/ReferToUser";
import { AllYourUGStatsContext } from "#context/AllYourUGStatsContext";
import { UserContext } from "#context/UserContext";
import { type UGSWithRankingData } from "#types/api-returns";
import { memo, useContext } from "react";
import { Col, Row } from "react-bootstrap";
import { ALL_GAMES, FormatGame, type UserDocument, type UserGameStats } from "tachi-common";

import UserGameRankingData from "./UserGameRankingData";
import UserGameRatingsTable from "./UserGameStatsOverview";

interface GamesInfoProps {
	ugsList: UserGameStats[];
	reqUser: UserDocument;
}

interface GamesInfoUnitProps {
	ugs: UserGameStats;
	reqUser: UserDocument;
}

export default function UserGameProfiles({ reqUser }: { reqUser?: UserDocument }) {
	const { user } = useContext(UserContext);

	return (
		<Row lg={{ cols: 2 }} xs={{ cols: 1 }}>
			{user && (!reqUser || reqUser.id === user.id) ? (
				<ContextualGamesInfo user={user} />
			) : reqUser ? (
				<QueryGamesInfo reqUser={reqUser} />
			) : (
				<>User not provided; can't show games for nobody!</>
			)}
		</Row>
	);
}

const ContextualGamesInfo = memo(({ user }: { user: UserDocument }) => {
	const { ugs } = useContext(AllYourUGStatsContext);

	return <GamesInfo reqUser={user} ugsList={ugs ?? []} />;
});

function QueryGamesInfo({ reqUser }: { reqUser: UserDocument }) {
	const { data, error } = useApiQuery<UserGameStats[]>(
		`/users/${reqUser.id}/game-profiles`,
		undefined,
		undefined,
		!reqUser,
	);

	if (error) {
		throw new Error("An error occurred fetching User Game Stats.", { cause: error });
	}

	return (
		<LoadingWrapper dataset={data} error={error}>
			<GamesInfo reqUser={reqUser} ugsList={data!} />
		</LoadingWrapper>
	);
}

function GamesInfo({ ugsList, reqUser }: GamesInfoProps) {
	if (ugsList.length === 0) {
		return (
			<div className="col-12 w-100 text-center">
				<Muted>
					<ReferToUser reqUser={reqUser} /> not played anything.
				</Muted>
			</div>
		);
	}

	const ugsMap = new Map(ugsList.map((ugs) => [ugs.game, ugs] as const));

	return (
		<>
			{ALL_GAMES.map((game) => {
				const e = ugsMap.get(game);

				if (!e) {
					return null;
				}

				return <GamesInfoUnit key={game} reqUser={reqUser} ugs={e} />;
			})}
		</>
	);
}

function GamesInfoUnit({ ugs, reqUser }: GamesInfoUnitProps) {
	const rankingData = (ugs as Partial<UGSWithRankingData>).__rankingData;

	return (
		<Col className="p-2 flex-grow-1">
			<Card
				className="h-100"
				footer={
					<div className="d-flex justify-content-end">
						<LinkButton to={`/u/${reqUser.username}/games/${ugs.game}`}>
							View Game Profile
						</LinkButton>
					</div>
				}
				header={FormatGame(ugs.game)}
			>
				<UserGameRatingsTable ugs={ugs} />
				{rankingData ? (
					<UserGameRankingData
						game={ugs.game}
						rankingData={rankingData}
						userID={ugs.userID}
					/>
				) : null}
			</Card>
		</Col>
	);
}
