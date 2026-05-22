import { SlashCommandBuilder } from "@discordjs/builders";
import deepmerge from "deepmerge";

import type { SlashCommand } from "../types";

import { Env, ServerConfig } from "../../config";
import { CreateEmbed } from "../../utils/embeds";

const NEUTRAL_FAQ_ENTRIES: Record<string, string> = {
	duplicates: `Scores on ${ServerConfig.NAME} are deduplicated based on your score and lamp (and some other things).
If you happen to get the exact same score twice, ${ServerConfig.NAME} will **ignore** the second one!
There are legitimate reasons for this -- it's very common for people to import the same scores twice through file uploads or import scripts.
For more info on why this is a fundamental limitation of ${ServerConfig.NAME}, check [the documentation](https://docs.tachi.ac/wiki/score-oddities/#deduplication-false-positives-all-games).`,
	contribute: `Contributing to ${ServerConfig.NAME} in any way will get you the Contributor role, and a cool green name.\n
Contributors who save us hours (or more) of dev time, or are just generally really supportive will get the Significant Contributor role, and an even cooler orange name.
${ServerConfig.NAME} is an Open Source project. Feel free to read our [contribution guide](https://docs.tachi.ac/contributing/), or just generally ask for stuff to help out with!`,
	docs: `Documentation for ${ServerConfig.NAME} is stored at https://docs.tachi.ac.`,
	pbs: `A PB is all of your best scores on that specific chart joined together.
For most games, this means joining your best score with your best lamp.
Read more about this [here](https://docs.tachi.ac/wiki/pbs-scores/)`,
	filter_directives: `Filter Directives are a fancy way of *filtering* rows inside a table.
They provide an advanced toolkit for users to perform complex queries on their data.
Read more about them [here](https://docs.tachi.ac/wiki/filter-directives/)`,
	dans: `Dans are good as a milestone for your skill. However, focusing too much on dans can be massively detrimental to your skill as a player.\n
Playing a fixed set of charts all the time will not expose you to more things, and will generally slow down your improvement as a player. Furthermore, they're stressful, and designed to be played *just* at the cusp of what you can play.\n
In short. Don't play dans too much.`,
	orphans: `Importing scores for songs/charts we don't have in the database yet results in them becoming orphaned.
Orphaned scores stay in limbo until they find their 'parent' song or chart. When that's found, they're imported *exactly* as you had them originally! That way, you never lose scores.`,
	whatare_goals: `Goals are simple challenges a player can set. Players may subscribe to goals, and they will automatically be tracked for them!

When creating a goal, you can control the following things:

**Criteria**: Is this a lamp, score, grade or percent goal?
**Value**: Do you need to get an EASY CLEAR? HARD CLEAR? 95%? etc.
**Charts**: A specific chart, a specific set of charts, any charts in a specific folder, or the set of all charts.
**Mode**: If you've picked multiple charts, you can also specify how many charts need to be cleared -- Clear 10 of the charts, Clear 5% of the charts, etc.

**Example Goals**
\`\`\`
- HARD CLEAR Freedom Dive.
- EASY CLEAR Freedom Dive or Blastix Riotz.
- HARD CLEAR 10 Charts in the level 12 folder.
- AAA 30% of the charts in the level 10 folder.
- Get 9,234,567 or better on any chart.
\`\`\`
`,
	whatare_quests: `Quests are structured groups of goals. Players can subscribe to quests, and that will automatically subscribe them to all of the goals inside it.

**Quests are very similar in functionality to things like bingo cards.** You group a bunch of goals that share a common incentive (Breaking into level 12s, maybe?), and slowly check them off.

Quests can group their goals into subsections -- this doesn't affect the quest, but can visually break up different types of goals, such as timing goals vs. clearing goals. Quest creators can also add notes to goals, to express why a goal is in the quest.

**Example Quest**
\`\`\`
Name: Breaking Into Level 17s (SDVX)
Description: These goals are for players aiming to break the 17 wall in SDVX. They focus on all skill sets you should be aiming for around this level.

--- Clearing ---
-- These goals are focused on your clearing ability! --

Clear 20 unique 16s (NOTE: pattern diversity test)
Clear lEyl [EXH] (NOTE: just a good generic mid/high 16)
Clear 蟲の棲む処 [MXM] (NOTE: Good, easy 17)

--- Timing ---
-- These goals are focused on your timing ability! Good timing improves your technical ability as a player, so don't neglect it! --

AAA 3 Level 16s (NOTE: Just a generic accuracy test)
AA 10 Level 16s
\`\`\`

[Here's an example Quest screenshot from Tachi v1, if the above explanation isn't clear enough!](https://cdn.discordapp.com/attachments/795824903906394142/965662379654393976/unknown.png)
`,
	whatare_questlines: `Quests themselves can be grouped up into ordered quest-lines. This allows users to make a 'scale' of quests that go up in difficulty.

For a real world example, [LIFE4](https://life4ddr.com/rank-requirements/) would be considered a questline:

\`\`\`
Questline: LIFE4

Copper I
Copper II
Copper III
Copper IV
Copper V
Bronze I
Bronze II
Bronze III
Bronze IV
Bronze V
Silver I
Silver II
Silver III
... (LIFE4 has like 50 separate quests, so I can't fit them all here, but you get the idea)
\`\`\`
`,
	creating_quests: `At the moment, there is no UI for users to create quests. In the future, there will be a way to do this!

For now, all quests are built-in to Tachi. Ideally, we want the built-in Tachi quests to be interesting for players -- they should be effective targets for an improving player!`,
	good_quests: `A good quest should never make the player feel like they're wasting their time.

You shouldn't make goals like playing everything in a large folder, since those are more tests of endurance than skill. They're just going to be wasting their time!

You should also avoid redundant goals -- all the goals in the quest should ideally be around the same difficulty! Something like Clear 10 18s and Clear 25 18s are obviously redundant, but this also applies to goals like AAA Easy_Chart and Way_harder_chart. Every goal and part of a goal in a quest should be something a player can reasonably have last to achieve.`,
	builtin_questline: `I want every game on Tachi to have at least one fairly comprehensive questline (see \`/faq whatare_questlines\`). These should be useful for players of all skill levels, so that they have some good ideas for goals to set around their level.

I'm ideally looking for something that the average player can just set and have fun checking off. The questline itself should have the quests fairly distinguished, players shouldn't be pushing multiple quests in the same questline at the same time.
	
Since I don't play a lot of the the games that ${ServerConfig.NAME} supports, we need your help to come up with some good drafts! Your game might have a dedicated \`-quests\` channel. Check it out and discuss with others!`,
};

// Server specific FAQ stuff.
const KAMAI_FAQ_ENTRIES: Record<string, string> = {
	kai_support: `Support for KAI based networks (FLO, EAG, MIN) is available, but we are waiting on APIs for more games on their end. At the moment, only IIDX and SDVX are supported.`,
	bokutachi: `Bokutachi is our public sister website for home games and simulators. Feel free to check out [the discord](${
		Buffer.from("aHR0cHM6Ly9kaXNjb3JkLmdnL3N3VkJUanhtUFk=", "base64") // Note: obfuscating this for obvious reasons so we don't get garbage bot spam.
	})`,
	sdvx_1259: `Automation Paradise is song ID 1259. It is not a real song, and it is not supported by ${ServerConfig.NAME}. Related autopara-only songs are not supported, either.`,
	invites: `To invite your friends, go to your profile and select 'Invites'. From there, you can create an invite code.
Your friend can then go to ${Env.TACHI_SERVER_LOCATION} and sign up with the code! You can also invite them to the discord.`,
};

const BOKU_FAQ_ENTRIES: Record<string, string> = {
	usc_hard_mode: `Hard Mode windows are not supported on ${ServerConfig.NAME}. Your scores **will be ignored** if they are played on non-standard windows.`,
	ir_login: `You **must** put your API Key in the password field for the Bokutachi IR, **NOT your real password!**. See instructions here: ${Env.TACHI_SERVER_LOCATION}/import/beatoraja-ir.
(This is because putting your real password in there is a security nightmare.)`,
	lr2: `Support for LR2 (the LR2Hook) are **not officially maintained** and therefore **not managed by bokutachi developers**.
We urge you to use a more modern BMS client like lr2oraja, unless you have very good reason to stay on LR2.
Beatoraja is actively developed and integrates properly with the Bokutachi IR, it is also significantly more stable and works on modern hardware without encoding hacks.`,
};

let faqEntries = NEUTRAL_FAQ_ENTRIES;

if (ServerConfig.TYPE !== "boku") {
	faqEntries = deepmerge(faqEntries, KAMAI_FAQ_ENTRIES);
}

if (ServerConfig.TYPE !== "kamai") {
	faqEntries = deepmerge(faqEntries, BOKU_FAQ_ENTRIES);
}

const choiceMap = new Map(Object.entries(faqEntries));

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("faq")
		.setDescription("Retrieve various little bits of info.")
		.addStringOption((s) =>
			s
				.setName("entry")
				.setDescription("The FAQ entry to retrieve.")
				.setRequired(true)
				.addChoices(Object.keys(faqEntries).map((e) => [e, e])),
		)
		.toJSON(),
	exec: (interaction) => {
		const entry = interaction.options.getString("entry", true);

		const data = choiceMap.get(entry);

		if (!data) {
			return `This FAQ entry does not exist.`;
		}

		return CreateEmbed().setTitle(`FAQ: ${entry}`).setDescription(data);
	},
};

export default command;
