import ImportFileInfo from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { p } from "prudence";
import {
	ALL_GAMES,
	type BatchManual,
	FormatGame,
	FormatPrError,
	type GameGroup,
	GetGameGroupConfig,
	LEGACY_Playtypes,
	type V3Game,
} from "tachi-common";
import { PR_BATCH_MANUAL } from "tachi-common/lib/schemas";

const v3GameMappings: { [G in GameGroup]: Record<LEGACY_Playtypes[G], V3Game> } = {
	iidx: { SP: "iidx-sp", DP: "iidx-dp" },
	museca: { Single: "museca" },
	sdvx: { Single: "sdvx" },
	bms: { "14K": "bms-14k", "7K": "bms-7k" },
	gitadora: { Dora: "gitadora-dora", Gita: "gitadora-gita" },
	chunithm: { Single: "chunithm" },
	wacca: { Single: "wacca" },
	jubeat: { Single: "jubeat" },
	popn: { "9B": "popn" },
	maimai: { Single: "maimai" },
	maimaidx: { Single: "maimaidx" },
	pms: { Controller: "pms-controller", Keyboard: "pms-keyboard" },
	usc: { Controller: "usc-controller", Keyboard: "usc-keyboard" },
	itg: { Stamina: "itg-stamina" },
	arcaea: { Touch: "arcaea" },
	ongeki: { Single: "ongeki" },
	ddr: { SP: "ddr-sp", DP: "ddr-dp" },
};

export function OldBatchManual_GameGroupPTToGame<G extends GameGroup>(
	game: G,
	playtype: LEGACY_Playtypes[G],
): V3Game {
	return v3GameMappings[game][playtype];
}

function ResolveBatchManualGameFromMeta(meta: BatchManual["meta"]): V3Game {
	if ("playtype" in meta && meta.playtype !== undefined) {
		const gameGroupConfig = GetGameGroupConfig(meta.game as GameGroup);

		if (!gameGroupConfig) {
			throw new Error(
				`Invalid batch-manual. Please do not provide 'playtype' if you can avoid it.`,
			);
		}

		if (!gameGroupConfig.playtypes.includes(meta.playtype as never)) {
			throw new Error(
				`Invalid batch-manual. Please do not provide 'playtype' if you can avoid it.`,
			);
		}

		return OldBatchManual_GameGroupPTToGame(meta.game as GameGroup, meta.playtype);
	}

	const rawGame = meta.game;
	if (typeof rawGame !== "string" || !ALL_GAMES.includes(rawGame as V3Game)) {
		throw new Error(
			`Invalid game '${String(rawGame)}'. Expected any of ${ALL_GAMES.join(", ")}.`,
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

				if (!("service" in data.meta)) {
					throw new Error("Invalid BATCH-MANUAL: Missing service name");
				}

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
