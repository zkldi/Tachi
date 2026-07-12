import type { ChartDocument } from "tachi-common";

import { log } from "#lib/log/log";
import { PullDatabaseSeeds } from "#lib/seeds/repo";
import { WrapScriptPromise } from "#utils/misc";
import fetch from "node-fetch";

const AI_URL = "https://bms.hexlataia.xyz/tables/json/ai.json";

interface AITableEntry {
	level: string;
	md5: string;
}

export async function UpdateAILevels() {
	const data = (await fetch(AI_URL).then((r) => r.json())) as Array<AITableEntry>;

	const map = Object.fromEntries(data.map((e) => [e.md5, e.level]));

	const repo = await PullDatabaseSeeds();

	await repo.MutateCollection<ChartDocument<"bms-7k">>("charts-bms-7k", (charts) => {
		for (const chart of charts) {
			chart.data.aiLevel = map[chart.data.hashMD5] ?? null;
		}

		return charts;
	});

	await repo.Destroy();
}

if (require.main === module) {
	WrapScriptPromise(UpdateAILevels(), log);
}
