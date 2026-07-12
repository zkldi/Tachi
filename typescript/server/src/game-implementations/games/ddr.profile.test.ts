import { DDR_IMPL } from "#game-implementations/games/ddr";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

let ddrSeedCounter = 0;

/**
 * Inserts one song + primary chart + PB for DDR profile flare tests.
 * Rows are ordered by `flareSkill` descending in the implementation; use distinct values when order matters.
 */
async function seedDdrPbRow(
	userId: number,
	args: {
		calculatedDataOverride?: Record<string, unknown>;
		/** Omit or use a value other than CLASSIC | WHITE | GOLD to model songs excluded from the sum. */
		flareCategory?: string;
		flareSkill: number;
		game?: "ddr-dp" | "ddr-sp";
		isPrimary?: boolean;
	},
): Promise<void> {
	const n = ++ddrSeedCounter;
	const songId = `ddr-prof-song-${n}`;
	const chartId = `ddr-prof-chart-${n}`;
	const game = args.game ?? "ddr-sp";
	const isPrimary = args.isPrimary ?? true;

	const songData = args.flareCategory !== undefined ? { flareCategory: args.flareCategory } : {};

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 300_000 + n,
			game_group: "ddr",
			title: "T",
			artist: "A",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify(songData),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: chartId,
			game,
			song_id: songId,
			level: "10",
			level_num: 10,
			is_primary: isPrimary,
			difficulty: "EXPERT",
			versions: [],
			data: JSON.stringify({}),
		})
		.execute();

	const calculatedData = args.calculatedDataOverride ?? { flareSkill: args.flareSkill };

	await DB.insertInto("pb")
		.values({
			user_id: userId,
			chart_id: chartId,
			lens: null,
			data: JSON.stringify({}),
			derived_data: JSON.stringify({}),
			calculated_data: JSON.stringify(calculatedData),
			judgements: JSON.stringify({}),
			ranking_value: args.flareSkill,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: null,
		})
		.execute();
}

describe("DDR profileCalcs (flareSkill, Postgres)", () => {
	it("returns flareSkill null when the user has no qualifying PBs", async () => {
		const { id: userId } = await seedUser();

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: null });
	});

	it("sums one CLASSIC chart’s flareSkill", async () => {
		const { id: userId } = await seedUser();
		await seedDdrPbRow(userId, { flareSkill: 42, flareCategory: "CLASSIC" });

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: 42 });
	});

	it("uses ddr-dp charts when game is ddr-dp", async () => {
		const { id: userId } = await seedUser();
		await seedDdrPbRow(userId, {
			flareSkill: 77,
			flareCategory: "WHITE",
			game: "ddr-dp",
		});

		const spOnly = await DDR_IMPL.profileCalcs("ddr-sp", userId);
		expect(spOnly).toEqual({ flareSkill: null });

		const dp = await DDR_IMPL.profileCalcs("ddr-dp", userId);
		expect(dp).toEqual({ flareSkill: 77 });
	});

	it("excludes songs without CLASSIC, WHITE, or GOLD flareCategory from the sum", async () => {
		const { id: userId } = await seedUser();
		await seedDdrPbRow(userId, { flareSkill: 999, flareCategory: "OTHER" });

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: 0 });
	});

	it("excludes PBs when calculated_data.flareSkill is not a JSON number", async () => {
		const { id: userId } = await seedUser();
		await seedDdrPbRow(userId, {
			flareSkill: 0,
			flareCategory: "CLASSIC",
			calculatedDataOverride: { flareSkill: "not-a-number" },
		});

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: null });
	});

	it("ignores non-primary charts", async () => {
		const { id: userId } = await seedUser();
		await seedDdrPbRow(userId, {
			flareSkill: 500,
			flareCategory: "CLASSIC",
			isPrimary: false,
		});

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: null });
	});

	it("counts at most 30 PBs per flare category (global flare order, per-category index)", async () => {
		const { id: userId } = await seedUser();
		// 31 CLASSIC rows, flareSkill 1031..1001 - sorted desc; index 30 is dropped (top < 30 keeps 0..29).
		for (let i = 0; i < 31; i++) {
			await seedDdrPbRow(userId, {
				flareSkill: 1031 - i,
				flareCategory: "CLASSIC",
			});
		}

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		const expectedSum = Array.from({ length: 30 }, (_, k) => 1031 - k).reduce(
			(a, b) => a + b,
			0,
		);
		expect(result.flareSkill).toBe(expectedSum);
	});

	it("assigns per-category ranks in global flareSkill order (mixed categories)", async () => {
		const { id: userId } = await seedUser();
		// Desc global order: GOLD 300, CLASSIC 200, WHITE 100 → all three indices 0 in their category; sum 600.
		await seedDdrPbRow(userId, { flareSkill: 300, flareCategory: "GOLD" });
		await seedDdrPbRow(userId, { flareSkill: 200, flareCategory: "CLASSIC" });
		await seedDdrPbRow(userId, { flareSkill: 100, flareCategory: "WHITE" });

		const result = await DDR_IMPL.profileCalcs("ddr-sp", userId);

		expect(result).toEqual({ flareSkill: 600 });
	});
});
