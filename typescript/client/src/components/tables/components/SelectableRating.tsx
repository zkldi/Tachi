import Icon from "#components/util/Icon";
import { type SetState } from "#types/react";
import {
	FormatGameProfileRatingName,
	FormatGameScoreRatingName,
	FormatGameSessionRatingName,
	getProfileRatingAlgKeysInDisplayOrder,
} from "#util/misc";
import { GetGameConfig, type V3Game } from "tachi-common";

import { type ZTableTHProps } from "./TachiTable";

type AllRatings = any;

export default function SelectableRating({
	game,
	rating,
	setRating,
	changeSort,
	currentSortMode,
	reverseSort,
	mode = "score",
}: {
	game: V3Game;
	mode?: "profile" | "score" | "session";
	rating: AllRatings;
	setRating: SetState<AllRatings>;
} & ZTableTHProps) {
	const gameConfig = GetGameConfig(game);

	let key: "profileRatingAlgs" | "scoreRatingAlgs" | "sessionRatingAlgs";
	if (mode === "score") {
		key = "scoreRatingAlgs";
	} else if (mode === "profile") {
		key = "profileRatingAlgs";
	} else {
		key = "sessionRatingAlgs";
	}

	const ratingKeys =
		mode === "profile"
			? getProfileRatingAlgKeysInDisplayOrder(game)
			: (Object.keys(gameConfig[key]) as string[]);

	return (
		<th>
			<div className="vstack gap-1 align-items-center justify-content-center">
				<select
					className="border-0 text-body fw-bolder bg-transparent rounded focus-ring focus-ring-light"
					onChange={(v) => setRating(v.target.value as AllRatings)}
					value={rating}
				>
					{ratingKeys.map((s) => (
						<option key={s} value={s}>
							{mode === "session"
								? FormatGameSessionRatingName(game, s)
								: mode === "profile"
									? FormatGameProfileRatingName(game, s)
									: FormatGameScoreRatingName(game, s)}
						</option>
					))}
				</select>
				<div onClick={() => changeSort("Rating")}>
					<span className="d-flex justify-content-center gap-1">
						<Icon
							className={
								currentSortMode === "Rating" && reverseSort
									? "opacity-100"
									: "opacity-25"
							}
							type="arrow-up"
						/>
						<Icon
							className={
								currentSortMode === "Rating" && !reverseSort
									? "opacity-100"
									: "opacity-25"
							}
							type="arrow-down"
						/>
					</span>
				</div>
			</div>
		</th>
	);
}
