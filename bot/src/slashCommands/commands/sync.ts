import { PerformScoreImport } from "../../utils/apiRequests";
import { CreateImportEmbed } from "../../utils/embeds";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ServerConfig } from "config";
import type { SlashCommand } from "../types";

const choices: Array<[string, string]> = (
	[
		["FLO IIDX", "api/flo-iidx"],
		["FLO SDVX", "api/flo-sdvx"],
		["EAG IIDX", "api/eag-iidx"],
		["EAG SDVX", "api/eag-sdvx"],
		["MIN SDVX", "api/min-sdvx"],
		["CG DEV SDVX", "api/cg-dev-sdvx"],
		["CG DEV MUSECA", "api/cg-dev-museca"],
		["CG DEV Pop'n", "api/cg-dev-popn"],
		["CG DEV Jubeat", "api/cg-dev-jubeat"],
		["CG DEV IIDX", "api/cg-dev-iidx"],
		["CG SDVX", "api/cg-prod-sdvx"],
		["CG MUSECA", "api/cg-prod-museca"],
		["CG Pop'n", "api/cg-prod-popn"],
		["CG IIDX", "api/cg-prod-iidx"],
		["MYT CHUNITHM", "api/myt-chunithm"],
		["MYT MAIMAI DX", "api/myt-maimaidx"],
		["MYT ONGEKI", "api/myt-ongeki"],
		["MYT WACCA", "api/myt-wacca"],
	] as Array<[string, string]>
)

	// @ts-expect-error god i hate the includes signature
	.filter((e) => ServerConfig.IMPORT_TYPES.includes(e[1]));

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("sync")
		.setDescription("Synchronise your scores with another service.")
		.addStringOption((str) =>
			str
				.setName("service")
				.setRequired(true)
				.setDescription("The service to synchronise scores with.")
				.addChoices(choices)
		)
		.toJSON(),
	exec: async (interaction, requestingUser) => {
		await interaction.editReply(`Importing scores...`);

		const importType = interaction.options.getString("service", true);

		const importDoc = await PerformScoreImport(
			`/import/from-api`,
			requestingUser.tachiApiToken,
			{
				importType,
			},
			interaction
		);

		if (typeof importDoc === "string") {
			return importDoc;
		}

		return CreateImportEmbed(importDoc);
	},
};

export default command;
