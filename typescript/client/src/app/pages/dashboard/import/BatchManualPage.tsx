import ImportFileInfo from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { TachiConfig } from "#lib/config";
import { p } from "prudence";
import {
	ALL_GAMES,
	type BatchManual,
	FormatGame,
	FormatPrError,
	type GameGroup,
	GetGameGroupConfig,
	LEGACY_GameGroupPTToGame,
	type V3Game,
} from "tachi-common";
import { PR_BATCH_MANUAL } from "tachi-common/lib/schemas";

function ResolveBatchManualGameFromMeta(meta: BatchManual["meta"]): V3Game {
	if ("playtype" in meta && meta.playtype !== undefined) {
		const gameGroupConfig = GetGameGroupConfig(meta.game as GameGroup);

		if (!gameGroupConfig) {
			throw new Error(
				`Invalid game ${meta.game}. Expected any of ${TachiConfig.GAME_GROUPS}.`,
			);
		}

		if (!gameGroupConfig.playtypes.includes(meta.playtype as never)) {
			throw new Error(
				`Invalid Playtype ${meta.playtype}. Expected any of ${gameGroupConfig.playtypes}.`,
			);
		}

		return LEGACY_GameGroupPTToGame(meta.game as GameGroup, meta.playtype);
	}

	const allGameGroups = TachiConfig.GAME_GROUPS;
	const allEnabledGames = [];
	for (const gameGroup of allGameGroups) {
		for (const game of GetGameGroupConfig(gameGroup).games) {
			allEnabledGames.push(game);
		}
	}

	const rawGame = meta.game;
	if (typeof rawGame !== "string" || !ALL_GAMES.includes(rawGame as V3Game)) {
		throw new Error(
			`Invalid game '${String(rawGame)}'. Expected any of ${allEnabledGames.join(", ")}.`,
		);
	}

	return rawGame as V3Game;
}

export default function BatchManualPage() {
	useSetSubheader(["Dashboard", "Import Scores", "Batch Manual"]);

	return (
		<ImportFileInfo
			acceptMime="application/json"
			importType="file/batch-manual"
			name="Batch Manual"
			parseFunction={(text: string) => {
				const data: BatchManual = JSON.parse(text);

				const game = ResolveBatchManualGameFromMeta(data.meta);

				const err = p(data, PR_BATCH_MANUAL(game));

				if (err) {
					throw new Error(FormatPrError(err, "Invalid BATCH-MANUAL: "));
				}

				return {
					valid: true,
					info: {
						Game: FormatGame(game),
						Scores: data.scores.length,
					},
				};
			}}
		/>
	);
}
