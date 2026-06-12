import { useProfileRatingAlg } from "#components/util/useScoreRatingAlg";
import { type GameProps } from "#types/react";
import { FormatGameProfileRatingName, getProfileRatingAlgKeysInDisplayOrder } from "#util/misc";
import { Link } from "react-router-dom";
import { type integer, type ProfileRatingAlgorithms, type V3Game } from "tachi-common";

export default function UserGameRankingData({
	rankingData,
	game,
	userID,
}: {
	rankingData: Record<ProfileRatingAlgorithms[V3Game], { outOf: integer; ranking: number }>;
	userID: integer;
} & GameProps) {
	const alg = useProfileRatingAlg(game);

	// weird react edge case where rankingData and alg desynchronise.
	if (!(alg in rankingData)) {
		return <>Loading...</>;
	}

	const extendData = [];

	for (const k of getProfileRatingAlgKeysInDisplayOrder(game)) {
		const key = k as ProfileRatingAlgorithms[V3Game];

		if (!(key in rankingData) || key === alg) {
			continue;
		}

		extendData.push(
			<div className="col-12" key={key}>
				<small className="text-body-secondary">
					{FormatGameProfileRatingName(game, key)}: #{rankingData[key].ranking}/
					{rankingData[key].outOf}
				</small>
			</div>,
		);
	}

	return (
		<div className="row text-center">
			<div className="col-12">
				<h4>
					Ranking
					{extendData.length ? ` (${FormatGameProfileRatingName(game, alg)})` : ""}
				</h4>
			</div>
			<div className="col-12">
				<Link
					className="text-decoration-none"
					to={`/u/${userID}/games/${game}/leaderboard`}
				>
					<strong className="display-4">#{rankingData[alg].ranking}</strong>
				</Link>
				<span className="text-body-secondary">/{rankingData[alg].outOf}</span>
			</div>
			{extendData}
		</div>
	);
}

export function LazyRankingData({ ranking, outOf }: { outOf: integer; ranking: integer }) {
	return (
		<div className="row text-center">
			<div className="col-12">
				<h4>Ranking</h4>
			</div>
			<div className="col-12">
				<strong className="display-4">#{ranking}</strong>
				<span className="text-body-secondary">/{outOf}</span>
			</div>
		</div>
	);
}
