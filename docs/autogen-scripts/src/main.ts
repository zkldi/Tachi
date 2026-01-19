/* eslint-disable no-console */
/* eslint-disable operator-assignment */
// Generate documentation for all GPT configs in-tree.

import {
	FormatGame,
	GetGPTConfig,
	GetGPTString,
	GetGameConfig,
	allSupportedGames,
} from "tachi-common";
import { writeFileSync } from "fs";
import path from "path";
import type { Game, Playtype } from "tachi-common";
import type {
	ClassConfig,
	DifficultyConfig,
	RatingAlgorithmConfig,
} from "tachi-common/js/types/game-config-utils";
import type { ConfScoreMetric } from "tachi-common/js/types/metrics";

function metricsToTbl(metrics: Record<string, ConfScoreMetric>): string {
	let tbl = `| Metric Name | Type | Description |
| :: | :: | :: |`;

	for (const [metricName, conf] of Object.entries(metrics)) {
		let typeStr;

		switch (conf.type) {
			case "DECIMAL": {
				typeStr = "Decimal";
				break;
			}

			case "INTEGER": {
				typeStr = "Integer";
				break;
			}

			case "GRAPH": {
				typeStr = "Array&lt;Decimal&gt;";
				break;
			}

			case "NULLABLE_GRAPH": {
				typeStr = "Array&lt;Decimal \\| null &gt;";
				break;
			}

			case "ENUM": {
				typeStr = conf.values.map((e) => `"${e}"`).join(", ");
				break;
			}
		}

		tbl += `\n| \`${metricName}\` | ${typeStr} | ${conf.description} |`;
	}

	return tbl;
}

function stringArrToList(strings: ReadonlyArray<string>): string {
	return strings.map((e) => `- \`${e}\``).join("\n");
}

function formatDifficulties(difficulties: DifficultyConfig): string {
	if (difficulties.type === "DYNAMIC") {
		return `This game uses dynamic difficulties. A difficulty name may be any string, provided \`songID\` + \`playtype\` + \`difficulty\` is unique.`;
	}

	return stringArrToList(difficulties.order);
}

function formatRatings(ratings: Record<string, RatingAlgorithmConfig>, defaultRating: string) {
	let base = "";

	if (Object.keys(ratings).length > 1) {
		base = `The default rating algorithm is \`${defaultRating}\`.

`;
	}

	base += `| Name | Description |
| :: | :: |`;

	for (const [alg, conf] of Object.entries(ratings)) {
		base += `\n| \`${alg}\` | ${conf.description} |`;
	}

	return base;
}

function formatClasses(classes: Record<string, ClassConfig>): string {
	let tbl = `| Name | Type | Values |
| :: | :: | :: |`;

	for (const [name, conf] of Object.entries(classes)) {
		tbl += `\n| \`${name}\` | ${conf.type} | ${conf.values.map((e) => e.id).join(", ")}`;
	}

	return tbl;
}

function formatVersions(versions: Record<string, string>): string {
	if (Object.keys(versions).length === 0) {
		return `This game has no versions, and presumably doesn't need to disambiguate its IDs.`;
	}

	let tbl = `| ID | Pretty Name |
| :: | :: |`;

	for (const [id, name] of Object.entries(versions)) {
		tbl += `\n| \`${id}\` | ${name} |`;
	}

	return tbl;
}

function createConfigDocumentation(game: Game, playtype: Playtype) {
	const gptString = GetGPTString(game, playtype);
	const gptConfig = GetGPTConfig(gptString);

	const output = `# ${FormatGame(game, playtype)} Support

This game has the internal GPTString of \`${gptString}\`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

${metricsToTbl(gptConfig.providedMetrics)}

### Derived Metrics

${metricsToTbl(gptConfig.derivedMetrics)}

### Optional Metrics

${metricsToTbl(gptConfig.optionalMetrics)}

## Judgements

The following judgements are defined:

${stringArrToList(gptConfig.orderedJudgements)}

## Rating Algorithms

### Score Rating Algorithms

${formatRatings(gptConfig.scoreRatingAlgs, gptConfig.defaultScoreRatingAlg)}

### Session Rating Algorithms

${formatRatings(gptConfig.sessionRatingAlgs, gptConfig.defaultSessionRatingAlg)}

### Profile Rating Algorithms

${formatRatings(gptConfig.profileRatingAlgs, gptConfig.defaultProfileRatingAlg)}

## Difficulties

${formatDifficulties(gptConfig.difficulties)}

## Classes

${formatClasses(gptConfig.classes)}

## Versions

${formatVersions(gptConfig.versions)}

## Supported Match Types

${stringArrToList(gptConfig.supportedMatchTypes)}`;

	return output;
}

const baseDir = path.join(__filename, "../../../docs/game-support/games");

let mkdocsConf = "- Game Information:";

for (const game of allSupportedGames) {
	const gameConfig = GetGameConfig(game);

	for (const playtype of gameConfig.playtypes) {
		writeFileSync(
			path.join(baseDir, `${game}-${playtype}.md`),
			createConfigDocumentation(game, playtype)
		);

		mkdocsConf += `\n    - "game-support/games/${game}-${playtype}.md"`;
	}
}

console.error("Done! Paste this config into your mkdocs.yml.");

console.log(mkdocsConf);
