import type { CommandInteraction } from "discord.js";

import { Env } from "#config";
import { log } from "#utils/log";
import {
	type ChartDocument,
	type GoalDocument,
	type ImportDocument,
	type integer,
	type PBScoreDocument,
	type QuestDocument,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import type { ImportDeferred, ImportPollStatus, UGPTStats } from "./return-types";

import { RequestTypes, TachiServerV1Get, TachiServerV1Request } from "./fetch-tachi";
import { Sleep } from "./misc";

export async function GetUserInfo(userID: string | integer) {
	const res = await TachiServerV1Get<UserDocument>(`/users/${userID}`, null);

	if (!res.success) {
		throw new Error(`Failed to fetch user with userID ${userID}.`);
	}

	return res.body;
}

export async function GetUGPTStats(userID: string | integer, game: V3Game) {
	const res = await TachiServerV1Get<UGPTStats>(`/users/${userID}/games/${game}`, null);

	if (!res.success) {
		throw new Error(`Failed to fetch UGPT stats for userID ${userID}, ${game}.`);
	}

	return res.body;
}

export async function GetGoalWithID(goalID: string, game: V3Game) {
	const res = await TachiServerV1Get<{ goal: GoalDocument }>(
		`/games/${game}/targets/goals/${goalID}`,
		null,
	);

	if (!res.success) {
		throw new Error(`Failed to fetch goal with ID ${goalID}. '${res.description}'.`);
	}

	return res.body.goal;
}

export async function GetQuestWithID(questID: string, game: V3Game) {
	const res = await TachiServerV1Get<{ quest: QuestDocument }>(
		`/games/${game}/targets/quests/${questID}`,
		null,
	);

	if (!res.success) {
		throw new Error(`Failed to fetch quest with ID ${questID}. '${res.description}'.`);
	}

	return res.body.quest;
}

export async function GetChartInfoForUser(userID: string | integer, chartID: string, game: V3Game) {
	const res = await TachiServerV1Get<{ chart: ChartDocument; song: SongDocument }>(
		`/games/${game}/charts/${chartID}`,
		null,
	);

	if (!res.success) {
		throw new Error(`Failed to fetch song/chart with chartID ${chartID}.`);
	}

	const pbRes = await TachiServerV1Get<{ chart: ChartDocument; pb: PBScoreDocument }>(
		`/users/${userID}/games/${game}/pbs/${chartID}`,
		null,
	);

	const pb = pbRes.success ? pbRes.body.pb : null;

	if (pb === null && pbRes.statusCode !== 404) {
		throw new Error(`Failed to fetch score info for userID ${userID} on chart ${chartID}.`);
	}

	return { song: res.body.song, chart: res.body.chart, pb };
}

export async function PerformScoreImport(
	url: string,
	authToken: string,
	body: Record<string, unknown>,
	interaction?: CommandInteraction,
) {
	const initRes = await TachiServerV1Request<ImportDeferred | ImportDocument>(
		RequestTypes.POST,
		url,
		authToken,
		body,
	);

	if (!initRes.success) {
		if (initRes.statusCode >= 500) {
			log.error({ body }, `Failed to perform score import on ${url}.`);
			throw new Error(`Failed to perform import on ${url}.`);
		} else {
			return initRes.description;
		}
	}

	// this server does not defer imports to a scorequeue
	if (initRes.statusCode === 200) {
		const result = initRes.body as ImportDocument;

		return result;
	} else if (initRes.statusCode === 202) {
		// this server defers imports.

		while (true) {
			// eslint-disable-next-line no-await-in-loop
			const pollRes = await TachiServerV1Get<ImportPollStatus>(
				`/imports/${initRes.body.importID}/poll-status`,
				authToken,
			);

			if (pollRes.success && pollRes.statusCode < 400) {
				if (pollRes.body.importStatus === "completed") {
					// is there even a nice way around this --
					// why *are* we nested so deeply?

					if (interaction) {
						void interaction.editReply(`Import finished!`);
					}

					return pollRes.body.import;
				}

				if (pollRes.body.importStatus === "ongoing") {
					const progress = pollRes.body.progress;
					const description =
						progress &&
						typeof progress === "object" &&
						"description" in progress &&
						typeof progress.description === "string"
							? progress.description
							: "Importing.";

					if (interaction) {
						void interaction.editReply(`Importing Scores: ${description}..`);
					}

					// eslint-disable-next-line no-await-in-loop
					await Sleep(1000);
					continue;
				}
			}

			if (!pollRes.success || pollRes.statusCode >= 400) {
				// silly kai bug they won't ever fix. hacking around it in the bot here.
				if (/attempting reauthentication/u.exec(pollRes.description)) {
					throw new Error(`Failed to import scores.
Your authentication with this service has expired, and a bug on their end prevents us from automatically renewing it.

Please go to ${Env.TACHI_SERVER_LOCATION}/u/me/integrations/services to un-link and re-link.`);
				}

				throw new Error(`Failed to import scores. ${pollRes.description}.`);
			}

			throw new Error(
				`Failed to import scores. ${pollRes.description ?? "Unexpected poll response."}.`,
			);
		}
	}

	log.error({ body }, `Unexpected status code ${initRes.statusCode} returned from ${url}.`);

	throw new Error(`Unexpected status code ${initRes.statusCode} returned from ${url}.`);
}
