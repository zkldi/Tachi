import RivalChartTable from "#components/tables/rivals/RivalChartTable";
import ApiError from "#components/util/ApiError";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import useUserGameBase from "#components/util/useUserGameBase";
import { UserContext } from "#context/UserContext";
import { type ChartRivalsReturn } from "#types/api-returns";
import { type RivalChartDataset } from "#types/tables";
import { NumericSOV } from "#util/sorts";
import { useContext } from "react";
import { Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import { type ChartDocument, GetGameConfig, type UserDocument, type V3Game } from "tachi-common";

export default function RivalCompare({ chart, game }: { chart: ChartDocument; game: V3Game }) {
	const { user: currentUser } = useContext(UserContext);

	if (!currentUser) {
		return <div>You're not signed in. How did you even get to this page?</div>;
	}

	return <Inner chart={chart} currentUser={currentUser} game={game} />;
}

function Inner({
	currentUser,
	game,
	chart,
}: {
	chart: ChartDocument;
	currentUser: UserDocument;
	game: V3Game;
}) {
	const base = useUserGameBase({ reqUser: currentUser, game });

	const { data, error } = useApiQuery<ChartRivalsReturn>(
		`/users/${currentUser.id}/games/${game}/pbs/${chart.chartID}/rivals`,
	);

	if (!data) {
		return <Loading />;
	}

	if (error) {
		return <ApiError error={error} />;
	}

	if (data.rivals.length === 0) {
		return (
			<div className="w-100 text-center">
				You have no rivals set!
				<br />
				Why not <Link to={`${base}/rivals/manage`}>set some?</Link>
			</div>
		);
	}

	const gameConfig = GetGameConfig(game);

	const rivalDataset: RivalChartDataset = [...data.rivals, currentUser]
		.map((u) => ({
			...u,
			__related: {
				pb: data.pbs.find((p) => p.userID === u.id) ?? null,
			},
		}))
		.sort(
			NumericSOV(
				// @ts-expect-error this access is obviously legal
				(x) => x.__related.pb?.scoreData[gameConfig.defaultMetric] ?? -Infinity,
				true,
			),
		)
		.map((e, index) => ({
			...e,
			__related: {
				...e.__related,
				index,
			},
		}));

	return (
		<Col xs={12}>
			<RivalChartTable chart={chart} dataset={rivalDataset} game={game} />
		</Col>
	);
}
