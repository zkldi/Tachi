// Generate documentation for all game configs in-tree.

import type { ConfScoreMetric } from "tachi-common/types/metrics";

import { writeFileSync } from "fs";
import path from "path";
import { ALL_GAMES, FormatGame, GetGameConfig, type V3Game } from "tachi-common";
import {
	type ClassConfig,
	type DifficultyConfig,
	type RatingAlgorithmConfig,
} from "tachi-common/types/game-config-utils";

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

function createConfigDocumentation(game: V3Game) {
	const gameConfig = GetGameConfig(game);

	const output = `# ${FormatGame(game)} Support

This game is internally called \`${game}\`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

${metricsToTbl(gameConfig.providedMetrics)}

### Derived Metrics

${metricsToTbl(gameConfig.derivedMetrics)}

### Optional Metrics

${metricsToTbl(gameConfig.optionalMetrics)}

## Judgements

The following judgements are defined:

${stringArrToList(gameConfig.orderedJudgements)}

## Rating Algorithms

### Score Rating Algorithms

${formatRatings(gameConfig.scoreRatingAlgs, gameConfig.defaultScoreRatingAlg)}

### Session Rating Algorithms

${formatRatings(gameConfig.sessionRatingAlgs, gameConfig.defaultSessionRatingAlg)}

### Profile Rating Algorithms

${formatRatings(gameConfig.profileRatingAlgs, gameConfig.defaultProfileRatingAlg)}

## Difficulties

${formatDifficulties(gameConfig.difficulties)}

## Classes

${formatClasses(gameConfig.classes)}

## Versions

${formatVersions(gameConfig.versions)}

## Supported Match Types

${stringArrToList(gameConfig.supportedMatchTypes)}`;

	return output;
}

const baseDir = path.join(__filename, "../../../docs/game-support/games");

let mkdocsConf = "- Game Information:";

for (const game of ALL_GAMES) {
	writeFileSync(path.join(baseDir, `${game}.md`), createConfigDocumentation(game));

	mkdocsConf += `\n    - "game-support/games/${game}.md"`;
}

console.error("Done! Paste this config into your mkdocs.yml.");

console.log(mkdocsConf);
