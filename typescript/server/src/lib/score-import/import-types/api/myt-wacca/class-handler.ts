import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { WaccaVersion } from "#proto/generated/wacca/common_pb";
import { DataRequestSchema, WaccaUser } from "#proto/generated/wacca/user_pb";
import { create } from "@bufbuild/protobuf";
import { createClient, type Transport } from "@connectrpc/connect";
import { WaccaStageUps } from "tachi-common/config/game-support/wacca";

export default async function CreateMytWACCAClassHandler(
	titleApiId: string,
	transport: Transport,
): Promise<ClassProvider<"wacca">> {
	const client = createClient(WaccaUser, transport);
	const req = create(DataRequestSchema, { apiId: titleApiId });
	const data = await client.getData(req);

	return (_game, _userID, _ratings, _logger) => {
		// Currently (May 2025) Reverse and Plus are supported on Myt.
		// We look for both Reverse and PLUS version data, PLUS being prioritized if exists.
		// If / when custom dans are added, this will need to change.
		const versionData =
			data.versionData[WaccaVersion.PLUS] ?? data.versionData[WaccaVersion.REVERSE];

		// rank: 0 = none, 1 = stage I, 2 = stage II, ... 14 = stage XIV
		if (versionData === undefined || versionData.rank === 0) {
			return {};
		}

		const stageEnum = WaccaStageUps[versionData.rank - 1];

		if (stageEnum === undefined) {
			throw new ScoreImportFatalError(400, `Unknown stage up value ${versionData.rank}`);
		}

		return {
			stageUp: stageEnum.id,
		};
	};
}
