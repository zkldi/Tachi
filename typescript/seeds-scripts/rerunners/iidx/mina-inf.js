import { MutateCollection } from "../../util.js";

// This is the numerical ID of the song we want to add to the Infinitas table
// Make sure to double check if it's using legacy charts for some stupid reason
// CTRL-F the title in songs-iidx, grab the songID and CTRL-F 'ID": xxx' to find the inGameID
// Or use a tool capable of extracting is (ie Reflux)
// Infinitas exclusives must be added with add-new-primary-IIDX-chart
// This script is ONLY for regular charts, DO NOT USE FOR LEGGENDARIAS
// To use, run 'node .\mina-inf.js --<ingameid 1> --<ingameid 2> [...] --<ingameid thelastoneyouhave>' in terminal
// Example: node.\mina-inf.js --1000 --1001 [...] --1010

// Extract the command line arguments
const args = process.argv.slice(2);

// Check if inGameIDs are provided as command line arguments
const inGameIDs = [];
for (let i = 0; i < args.length; i++) {
	if (args[i].startsWith("--")) {
		inGameIDs.push(parseInt(args[i].substring(2), 10));
	} else {
		console.error("Invalid argument format:", args[i]);
		console.error("Please provide inGameIDs as command line arguments like this: --<inGameID>");
		process.exit(1);
	}
}

// Check if at least one inGameID is provided
if (inGameIDs.length === 0) {
	console.error(
		"Please provide at least one inGameID as a command line argument like this: --<inGameID>",
	);
	process.exit(1);
}

MutateCollection("charts-iidx.json", (charts) => {
	// Iterate over each provided inGameID
	for (const inGameID of inGameIDs) {
		for (const chart of charts) {
			if (
				chart.data.inGameID === inGameID &&
				!chart.versions.includes("inf") &&
				chart.data["2dxtraSet"] === null &&
				chart.difficulty !== "LEGGENDARIA" &&
				chart.difficulty !== "BEGINNER"
			) {
				chart.versions.push("inf");
			}
		}
	}

	return charts;
});
