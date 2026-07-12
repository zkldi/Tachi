/**
 * Converts the editor's "raw" quest format (inline goal definitions) into the
 * canonical seeds format that lives in db/seeds/quests.json and db/seeds/goals.json.
 *
 * This mirrors the logic in typescript/seeds-scripts/rerunners/import-raw-quests.ts
 * but runs inside the server so it can be called from the proposals API.
 */

import { CreateGoalID } from "#lib/targets/goals";
import fjsh from "fast-json-stable-hash";
import { type GoalDocument, type V3Game } from "tachi-common";

// Mirrors client/src/types/tachi.ts — kept local to avoid a cross-package dep.
export type RawQuestGoal = {
	goal: Pick<GoalDocument, "charts" | "criteria" | "name">;
	note?: string;
};

export type RawQuestSection = {
	desc: string;
	rawGoals: Array<RawQuestGoal>;
	title: string;
};

export type RawQuestDocument = {
	desc: string;
	game: string;
	name: string;
	rawQuestData: Array<RawQuestSection>;
};

export type RawQuestlineDocument = {
	desc: string;
	/** V3Game identifier, e.g. "iidx-sp". */
	game: string;
	name: string;
	questlineID: string;
	quests: Array<string>;
};

// ─── Seeds-format types ────────────────────────────────────────────────────────

export type SeedsQuestGoalRef = {
	goalID: string;
	note?: string;
};

export type SeedsQuestSection = {
	desc?: string;
	goals: Array<SeedsQuestGoalRef>;
	title: string;
};

/**
 * Quest document shape expected by db/seeds/quests.json.
 * Uses `game` as a V3Game (e.g. "iidx-sp"), matching SEEDS_QUEST_DOCUMENT_SCHEMA.
 */
export type SeedsQuestDocument = {
	desc: string;
	game: string;
	name: string;
	questData: Array<SeedsQuestSection>;
	questID: string;
};

/**
 * Questline document shape expected by db/seeds/questlines.json.
 */
export type SeedsQuestlineDocument = {
	desc: string;
	game: string;
	name: string;
	questlineID: string;
	quests: Array<string>;
};

// ─── ID generation ────────────────────────────────────────────────────────────

/**
 * Creates a deterministic questID by hashing the quest's stable identity.
 * Using SHA-256 of { name, desc, game } so the same quest re-submitted by
 * different authors gets the same ID, but any textual change produces a new one.
 */
export function CreateQuestID(name: string, desc: string, game: V3Game): string {
	return fjsh.hash({ name, desc, game }, "sha256") as string;
}

// ─── Hydration ────────────────────────────────────────────────────────────────

/**
 * Converts an array of RawQuestDocuments (editor format) to the seeds format.
 * Returns the fully-resolved quests and the new goals that need to be merged
 * into db/seeds/goals.json.
 */
export function hydrateRawQuests(raws: Array<RawQuestDocument>): {
	goals: Array<GoalDocument>;
	quests: Array<SeedsQuestDocument>;
} {
	const newGoals: Array<GoalDocument> = [];
	const seenGoalIDs = new Set<string>();

	const quests: Array<SeedsQuestDocument> = raws.map((raw) => {
		const v3Game = raw.game as V3Game;

		const questData: Array<SeedsQuestSection> = raw.rawQuestData.map((section) => {
			const goals: Array<SeedsQuestGoalRef> = section.rawGoals.map((rawGoal) => {
				const goalID = CreateGoalID(rawGoal.goal.charts, rawGoal.goal.criteria, v3Game);

				if (!seenGoalIDs.has(goalID)) {
					seenGoalIDs.add(goalID);

					newGoals.push({
						charts: rawGoal.goal.charts,
						criteria: rawGoal.goal.criteria,
						game: v3Game,
						goalID,
						name: rawGoal.goal.name,
					} as GoalDocument);
				}

				return { goalID, ...(rawGoal.note !== undefined ? { note: rawGoal.note } : {}) };
			});

			return {
				title: section.title,
				...(section.desc ? { desc: section.desc } : {}),
				goals,
			};
		});

		return {
			questID: CreateQuestID(raw.name, raw.desc, v3Game),
			name: raw.name,
			desc: raw.desc,
			game: v3Game,
			questData,
		};
	});

	return { quests, goals: newGoals };
}

/**
 * Converts RawQuestlineDocuments to seeds format, replacing quest names with
 * the questIDs that hydrateRawQuests computed.
 *
 * @param questNameToID Map from the quest's original `name` to its computed questID.
 */
export function hydrateRawQuestlines(
	raws: Array<RawQuestlineDocument>,
	questNameToID: Map<string, string>,
): Array<SeedsQuestlineDocument> {
	return raws.map((ql) => {
		const questIDs = ql.quests
			.map((name) => questNameToID.get(name))
			.filter((id): id is string => id !== undefined);

		return {
			questlineID: ql.questlineID,
			name: ql.name,
			desc: ql.desc,
			game: ql.game,
			quests: questIDs,
		};
	});
}

/**
 * Merges new quests/goals into the existing seed arrays (deduplicating by ID).
 */
export function mergeIntoSeeds(opts: {
	existingGoals: Array<GoalDocument>;
	existingQuestlines: Array<SeedsQuestlineDocument>;
	existingQuests: Array<SeedsQuestDocument>;
	newGoals: Array<GoalDocument>;
	newQuestlines: Array<SeedsQuestlineDocument>;
	newQuests: Array<SeedsQuestDocument>;
}): {
	goals: Array<GoalDocument>;
	questlines: Array<SeedsQuestlineDocument>;
	quests: Array<SeedsQuestDocument>;
} {
	const existingQuestIDs = new Set(opts.existingQuests.map((q) => q.questID));
	const existingGoalIDs = new Set(opts.existingGoals.map((g) => g.goalID));
	const existingQuestlineIDs = new Set(opts.existingQuestlines.map((ql) => ql.questlineID));

	const mergedQuests = [
		...opts.existingQuests,
		...opts.newQuests.filter((q) => !existingQuestIDs.has(q.questID)),
	];

	const mergedGoals = [
		...opts.existingGoals,
		...opts.newGoals.filter((g) => !existingGoalIDs.has(g.goalID)),
	];

	const mergedQuestlines = [
		...opts.existingQuestlines,
		...opts.newQuestlines.filter((ql) => !existingQuestlineIDs.has(ql.questlineID)),
	];

	return { quests: mergedQuests, goals: mergedGoals, questlines: mergedQuestlines };
}
