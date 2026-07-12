import { spawnSync } from "child_process";
import { Command } from "commander";
import fs from "fs";
import { type QuestDocument, type QuestlineDocument } from "tachi-common";

import { MutateCollection, ReadCollection } from "../util";

/**
 * @summary
 *
 * This script loads all the quests for a given game into a text editor. You can then
 * use your text editor to re-order those quests (and delete ones that aren't pertinent).
 *
 * This is modelled after git rebase -i. It's not an amazingly obvious tool, but
 * it does the job for now.
 */

const program = new Command();
program.requiredOption("-g, --game <game>").requiredOption("-p, --playtype <playtype>");

program.parse(process.argv);
const options = program.opts();

const { game, playtype } = options;

const quests = ReadCollection("quests.json").filter(
	(e) => e.game === game && e.playtype === playtype,
) as Array<QuestDocument>;

if (quests.length === 0) {
	console.log(`No quests found for game ${game} and playtype ${playtype}.`);

	process.exit(1);
}

const file = "QUESTLINE_TEMP.tmp";

fs.writeFileSync(
	file,
	`# Give your questline a kebab-case-ID. Something like epic-laser-questline.
ID: questline-id

# Give your questline a name and a description.
NAME: PUT_QUESTLINE_NAME_HERE
DESC: PUT_QUESTLINE_DESC_HERE

# Keep the quests you wish to be in a questline, then place them in order.
${quests.map((e) => `${e.questID} ${e.name}`).join("\n")}

# Save and exit the editor when you're done.`,
);

try {
	const r = spawnSync(process.env.EDITOR || "nano", [file], {
		stdio: "inherit",
	});

	if (r.status !== 0) {
		throw new Error(`Editor exited with non-zero status code.`);
	}
} catch (err) {
	console.error(err);
	console.log("Failed to open data in editor. Cancelling.");
	process.exit(1);
}

const data = fs.readFileSync(file, "utf-8");

fs.rmSync(file);

const questIDs: string[] = [];
let name: string | undefined;
let desc: string | undefined;
let questlineID: string | undefined;

for (const line of data.split("\n")) {
	if (line.length === 0 || line.startsWith("#")) {
		continue;
	}

	if (line.startsWith("NAME:")) {
		name = /NAME: ?(.*)/u.exec(line)![1]!;
	} else if (line.startsWith("DESC:")) {
		desc = /DESC: ?(.*)/u.exec(line)![1]!;
	} else if (line.startsWith("ID:")) {
		questlineID = /ID: ?(.*)/u.exec(line)![1]!;
	} else {
		questIDs.push(line.split(" ")[0]!);
	}
}

if (!name) {
	console.error(`Failed to give questline a NAME.`);
	process.exit(1);
}

if (!desc) {
	console.error(`Failed to give questline a DESC.`);
	process.exit(1);
}

if (!questlineID) {
	console.error(`Failed to give questline an ID.`);
	process.exit(1);
}

if (questIDs.length === 0) {
	console.error(`Can't create a questline with no quests.`);
	process.exit(1);
}

const questline: QuestlineDocument = {
	game,
	playtype,
	desc,
	name,
	quests: questIDs,
	questlineID,
};

MutateCollection("questlines.json", (ql) => [...ql, questline]);
