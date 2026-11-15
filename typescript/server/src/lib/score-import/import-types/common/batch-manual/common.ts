import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { AllEnabledGames } from "#lib/setup/config";
import { IsEnabledGame, IsEnabledGameGroup } from "#utils/misc";
import { GetGameGroupConfig, type V3Game } from "tachi-common";
/**
 * Support old (gameGroup+playtype) stuff.
 */
export function ResolveBatchManualGame(
	maybeGame: string,
	maybePlaytype: string | undefined,
): V3Game {
	if (IsEnabledGame(maybeGame)) {
		return maybeGame;
	}

	if (!maybePlaytype) {
		throw new ScoreImportFatalError(
			400,
			`Unknown game provided - Expected any of ${AllEnabledGames().join(", ")}`,
		);
	}

	// playtype provided

	const maybeGameGroup = maybeGame;

	if (typeof maybeGameGroup !== "string" || !IsEnabledGameGroup(maybeGameGroup)) {
		throw new ScoreImportFatalError(
			400,
			// don't help users doing the wrong thing
			`Do not provide 'playtype'. This is legacy code and barely supported.`,
		);
	}

	if (
		typeof maybePlaytype !== "string" ||
		!GetGameGroupConfig(maybeGameGroup).playtypes.includes(maybePlaytype as any)
	) {
		throw new ScoreImportFatalError(
			400,
			`Do not provide 'playtype'. This is legacy code and barely supported.`,
		);
	}

	const v3GameMappings: Record<string, Record<string, V3Game>> = {
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

	const maybe = v3GameMappings?.[maybeGameGroup]?.[maybePlaytype];

	if (IsEnabledGame(maybe)) {
		return maybe;
	}

	throw new ScoreImportFatalError(
		400,
		// don't help users doing the wrong thing
		`Do not provide 'playtype'. This is legacy code and barely supported.`,
	);
}
