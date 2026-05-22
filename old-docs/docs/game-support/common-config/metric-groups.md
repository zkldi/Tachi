
# Metric Groups

Metrics for a GPT are grouped into three categories:

## Provided Metrics

These metrics **must** be provided in a score import. These are, in effect, **MANDATORY** metrics.

These metrics go into the scoreID.

!!! example
	```ts
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_000_000),
			formatter: FmtNum,
			description: "The score value. This is between 0 and 1 million.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "MISSLESS", "FULL COMBO", "ALL MARVELOUS"],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this score was.",
		},
	},
	```

	Any score import for a GPT like this *must* provide a compliant `score:` and `lamp:` value.

## Derived Metrics

These metrics are derived from the provided metrics (and the chart the score was on), but stored on scores for conveniences sake. These will **ALWAYS** be present on a score.

It may also be the case that this derived form of a metric is the default metric for a game, in which case, we'd definitely want to store it for leaderboards!

These metrics **DO NOT** go into the scoreID, as they are merely functions of other captured state.

!!! example
	```ts
	derivedMetrics: {
		percent: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			description: "EX Score divided by the maximum possible EX Score on this chart.",
		},
		grade: {
			type: "ENUM",
			values: ["F", "E", "D", "C", "B", "A", "AA", "AAA", "MAX-", "MAX"],
			minimumRelevantValue: "A",
			description:
				"Grades as they are in IIDX. We also add MAX- (94.44...%) and MAX (100%) as their own grades for convenience.",
		},
	},
	```

	In IIDX, the derived metrics are `percent` (as it's exScore / maximumEXOnThisChart)
	and `grade`, which is also derivable.

	We want to store these values for convenience and displaying on the UI, so we will.

## Optional Metrics

Sometimes, we want to store some metrics that not all score imports could provide. For that, we have optional metrics.

These metrics are defined like any other, but are all allowed to be not-provided by an importer.

!!! example
	```ts
	optionalMetrics: {
		bp: {
			type: "INTEGER",
			validate: p.isPositive,
			formatter: FmtScoreNoCommas,
			description: "The total bads + poors in this score.",
		},
		gauge: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			description:
				"The life in percent (between 0 and 100) that was on the gauge at the end of the chart.",
		},
	}
	```

	For IIDX, not all importing methods might know these values, and we don't want to exclude users of those services from being able to import their scores.

	As such, we mark these as optional.

!!! warning
	It's possible, but rare, that an optional metric should be part of the scoreID.

	For these cases, you can mark an optional metric with `partOfScoreID: true`.
	This metric will now - as you'd expect - be part of the scoreID.

	We actually use this in SDVX for `exScore`. EX Score might not be available, as it
	doesn't necessarily have to be enabled by the user - but if it does exist, we want
	to track it properly. That is to say, if the user raises their `exScore` but nothing
	else, we should still count that as a new score - despite `exScore` being optional!
