import type { GameImplementations } from "./types";

import { ARCAEA_IMPL } from "./games/arcaea";
import { BMS_7K_IMPL, BMS_14K_IMPL, PMS_CONTROLLER_IMPL, PMS_KEYBOARD_IMPL } from "./games/bms-pms";
import { CHUNITHM_IMPL } from "./games/chunithm";
import { DDR_IMPL } from "./games/ddr";
import { GITADORA_DORA_IMPL, GITADORA_GITA_IMPL } from "./games/gitadora";
import { IIDX_DP_IMPL, IIDX_SP_IMPL } from "./games/iidx";
import { ITG_STAMINA_IMPL } from "./games/itg";
import { JUBEAT_IMPL } from "./games/jubeat";
import { MAIMAI_IMPL } from "./games/maimai";
import { MAIMAIDX_IMPL } from "./games/maimaidx";
import { MUSECA_IMPL } from "./games/museca";
import { ONGEKI_IMPL } from "./games/ongeki";
import { POPN_IMPL } from "./games/popn";
import { SDVX_IMPL } from "./games/sdvx";
import { USC_CONTROLLER_IMPL, USC_KEYBOARD_IMPL } from "./games/usc";
import { WACCA_IMPL } from "./games/wacca";

/**
 * Server-Specific implementation details for games. These handle things like validating
 * input for chart-specific metrics (i.e EXScore in IIDX is upper-bounded by
 * a chart's notecount * 2) and also instructions on how to derive metrics from
 * the provided metrics.
 *
 * Basically, anything that can't be done in the common config, specific to the server.
 */
export const GAME_IMPLEMENTATIONS: GameImplementations = {
	"bms-14k": BMS_14K_IMPL,
	"bms-7k": BMS_7K_IMPL,
	"pms-controller": PMS_CONTROLLER_IMPL,
	"pms-keyboard": PMS_KEYBOARD_IMPL,
	"iidx-sp": IIDX_SP_IMPL,
	"iidx-dp": IIDX_DP_IMPL,
	wacca: WACCA_IMPL,
	chunithm: CHUNITHM_IMPL,
	"gitadora-dora": GITADORA_DORA_IMPL,
	"gitadora-gita": GITADORA_GITA_IMPL,
	"itg-stamina": ITG_STAMINA_IMPL,
	jubeat: JUBEAT_IMPL,
	maimai: MAIMAI_IMPL,
	maimaidx: MAIMAIDX_IMPL,
	museca: MUSECA_IMPL,
	popn: POPN_IMPL,
	"usc-controller": USC_CONTROLLER_IMPL,
	"usc-keyboard": USC_KEYBOARD_IMPL,
	sdvx: SDVX_IMPL,
	arcaea: ARCAEA_IMPL,
	ongeki: ONGEKI_IMPL,
	"ddr-sp": DDR_IMPL,
	"ddr-dp": DDR_IMPL,
};
