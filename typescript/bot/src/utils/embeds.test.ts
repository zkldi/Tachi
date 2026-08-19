import type { ImportDocument } from "tachi-common";

import { Env } from "#config";
import { MessageEmbed } from "discord.js";
import { describe, expect, it } from "vitest";

import { CreateImportEmbed } from "./embeds";

function makeImportDoc(overrides: Partial<ImportDocument> = {}): ImportDocument {
	return {
		importID: "import-abc-123",
		userID: 42,
		gameGroup: "iidx",
		games: ["iidx-sp"],
		scoreIDs: ["s1", "s2"],
		createdSessions: [{ sessionID: "sess1", type: "Created" }],
		errors: [],
		classDeltas: [],
		goalInfo: [],
		questInfo: [],
		...overrides,
	} as unknown as ImportDocument;
}

function getProfileField(embed: MessageEmbed) {
	return embed.fields?.find((field) => field.name === "Your Profile");
}

describe("CreateImportEmbed", () => {
	it("includes the game in Your Profile when games are returned", () => {
		const embed = CreateImportEmbed(makeImportDoc());

		expect(embed).toBeInstanceOf(MessageEmbed);
		expect(embed.title).toBe("Imported 2 scores!");
		expect(getProfileField(embed)?.value).toBe(
			`${Env.TACHI_SERVER_LOCATION}/u/42/games/iidx-sp`,
		);
	});

	it("omits the game segment from Your Profile when games is empty", () => {
		const embed = CreateImportEmbed(makeImportDoc({ games: [] }));

		expect(getProfileField(embed)?.value).toBe(`${Env.TACHI_SERVER_LOCATION}/u/42`);
	});
});
