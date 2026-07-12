import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type SetState } from "#types/react";
import {
	type ComparePBsDataset,
	type FolderDataset,
	type PBDataset,
	type RivalChartDataset,
	type ScoreDataset,
} from "#types/tables";
import { FormatGameScoreRatingName } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import {
	type AnyScoreRatingAlg,
	GetGameConfig,
	type PBScoreDocument,
	type ScoreDocument,
	type ScoreRatingAlgorithms,
	type V3Game,
} from "tachi-common";

import SelectableRating from "../components/SelectableRating";
import { type Header, type ZTableTHProps } from "../components/TachiTable";

export function GetGameCoreHeaders<
	Dataset extends
		| ComparePBsDataset
		| FolderDataset
		| PBDataset
		| RivalChartDataset
		| ScoreDataset,
>(
	game: V3Game,
	rating: ScoreRatingAlgorithms[V3Game],
	setRating: SetState<ScoreRatingAlgorithms[V3Game]>,
	kMapToScoreOrPB: (k: Dataset[0]) => PBScoreDocument | ScoreDocument | null,
): Header<Dataset[0]>[] {
	const gameConfig = GetGameConfig(game);

	let RatingHeader: Header<Dataset[0]>;

	if (Object.keys(gameConfig.scoreRatingAlgs).length === 1) {
		const alg = Object.keys(gameConfig.scoreRatingAlgs)[0] as AnyScoreRatingAlg;

		RatingHeader = [
			FormatGameScoreRatingName(game, alg),
			FormatGameScoreRatingName(game, alg),
			NumericSOV((x) => kMapToScoreOrPB(x)?.calculatedData[alg] ?? -Infinity),
		];
	} else {
		RatingHeader = [
			"Rating",
			"Rating",
			NumericSOV((x) => kMapToScoreOrPB(x)?.calculatedData[rating] ?? -Infinity),
			(thProps: ZTableTHProps) => (
				<SelectableRating
					game={game}
					key={game}
					rating={rating}
					setRating={setRating}
					{...thProps}
				/>
			),
		];
	}

	const implHeaders = GAME_CLIENT_IMPLEMENTATIONS[game].scoreHeaders;

	const outHeaders: Array<Header<Dataset[0]>> = [];

	for (const header of implHeaders) {
		if (header[2]) {
			outHeaders.push([
				header[0],
				header[1],
				(a, b) => {
					const pbA = kMapToScoreOrPB(a);
					const pbB = kMapToScoreOrPB(b);

					if (!pbA) {
						return -Infinity;
					}
					if (!pbB) {
						return Infinity;
					}

					return (header[2] as any)(pbA, pbB);
				},
			]);
		} else {
			outHeaders.push(header as Header<Dataset[0]>);
		}
	}

	outHeaders.push(RatingHeader);

	return outHeaders;
}
