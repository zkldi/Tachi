import { Env, ServerConfig } from "#config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ExpectedErr } from "bliss";

import type { SlashCommand } from "../types";

import { ACTION_Sync } from "../../actions/sync";
import { CreateEmbed } from "../../utils/embeds";
import { Pluralise } from "../../utils/misc";

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
		["CG SDVX", "api/cg-prod-sdvx"],
		["CG MUSECA", "api/cg-prod-museca"],
		["CG Pop'n", "api/cg-prod-popn"],
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
				.addChoices(choices),
		)
		.toJSON(),
	exec: async (interaction, requestingUser) => {
		await interaction.editReply(`Importing scores...`);

		const import_type = interaction.options.getString("service", true);

		try {
			const result = await ACTION_Sync(
				{
					acct: requestingUser.acct,
					ip: null,
				},
				{ import_type, "!api_token": requestingUser.api_token },
			);

			return CreateEmbed()
				.setTitle(
					`Imported ${result.score_count} ${Pluralise(result.score_count, "score")}!`,
				)
				.addField("Created Sessions", result.session_count.toString(), true)
				.addField("Errors", result.error_count.toString(), true)
				.addField(
					"Your Profile",
					`${Env.TACHI_SERVER_LOCATION}/u/${result.user_id}/games/${result.games[0]}`,
				);
		} catch (e) {
			if (ExpectedErr.is(e)) {
				return e.reason;
			}

			throw e;
		}
	},
};

export default command;
