# Implementing on the Server

Now that we've got a config defined in `common/` for a GPT, we need to implement
parts of it on the server.

## Where do Server Implementations go?

Implementations should be written in `server/src/game-implementations/games/GAMENAME.ts`.

Once you have written a config, go to `server/src/game-implementations/game-implementations.ts` and import it. Mount the game configuration on `GPT_SERVER_IMPLEMENTATIONS`.

## `chartSpecificValidators`

Any metrics you declared as being `chartSpecificMax: true` in the config need
an implementation here. You can declare a function that takes in the metric's value
and the chart the score is on and validate accordingly.

These functions should return a string on error, and true on success. This is aligned
with how [Prudence](https://github.com/zkldi/Prudence) works, so you can re-use prudence
functions here.

!!! example
```ts
musicRate: (rate, chart) => {
switch (chart.difficulty) {
case "BSC":
case "ADV":
case "EXT":
return p.isBetween(0, 100)(rate);

    		case "HARD BSC":
    		case "HARD ADV":
    		case "HARD EXT":
    			return p.isBetween(0, 120)(rate);
    	}
    },
    ```

## `derivers`

Any derived metrics you declared need derivers implemented here. This is a function
that takes in the provided metrics and the chart for this score and should return
the metric value we expect.

!!! example
`ts
	percent: (metrics, chart) => (100 * metrics.score) / (chart.data.notecount * 2);
	`

## `scoreCalcs`, `sessionCalcs`, `profileCalcs`

For any `{score, session, profile}RatingAlgs` you defined, implement them here.

## `classDerivers`

For all the classes you declared with `type: "DERIVED"`, implement the derivers here.

## `goalCriteriaFormatters`

When creating a goal on a metric, how should we format the title?

```
Get a score of 1234 on 5.1.1 SP ANOTHER
^^^^^^^^^^^^^^^^^^^^^^
this bit
```

## `goalOutOfFormatters`

When creating a goal on a metric, how should we format the "outOf" part?

```
HARD CLEAR/FULL COMBO
 ^^^^^^^^
  this bit
```

## `goalProgressFormatters`

How should we format the progress of this goal?

```
HARD CLEAR/FULL COMBO
            ^^^^^^^^
             this bit
```

## `pbMergeFunctions`

How should we combine scores into one PB? There is an _extraordinarily_ useful helper
function for this called `CreatePBMergeFor`.

The way PBs are merged works like a chain: the first score is the best score this user
has on this chart for the `defaultMetric` declared in the config. Then, every
merge function defined in this pipeline is ran on the score and mutates the original.

Eventually, you have a fully merged PB document.

The below code defines a PB merger that gets the largest lamp. It will then run the
final function with the base score and the score it just fetched.

In the event it doesn't find a score (i.e. the user has no scores with `optional.bp`)
the function will simply not be called.

```ts
[
	CreatePBMergeFor("largest", "enumIndexes.lamp", "Best Lamp", (base, lamp) => {
		base.scoreData.lamp = lamp.scoreData.lamp;

		base.scoreData.optional.gsmEasy = lamp.scoreData.optional.gsmEasy;
		base.scoreData.optional.gsmNormal = lamp.scoreData.optional.gsmNormal;
		base.scoreData.optional.gsmHard = lamp.scoreData.optional.gsmHard;
		base.scoreData.optional.gsmEXHard = lamp.scoreData.optional.gsmEXHard;

		base.scoreData.optional.gauge = lamp.scoreData.optional.gauge;
		base.scoreData.optional.gaugeHistory = lamp.scoreData.optional.gaugeHistory;

		base.scoreData.optional.comboBreak = lamp.scoreData.optional.comboBreak;
	}),
	CreatePBMergeFor("smallest", "optional.bp", "Lowest BP", (base, bp) => {
		base.scoreData.optional.bp = bp.scoreData.optional.bp;
	}),
];
```

## `defaultMergeRefName`

As mentioned above, the chain of PB functions starts by plucking the best score this
user has on this chart under the `defaultMetric`. What should we call that score?

!!! example
For IIDX, this is "Best Score". For something like GITADORA, which only has percent,
this might be called "Best Percent".

## `scoreValidators`

Out of the box, Tachi will assume complete independence of all variables in a score.
However, this is often not the case, and there are certain things you expect to be true
between the metrics of a score.

For example, you shouldn't be able to submit a `PERFECT ULTIMATE CHAIN` if your score
isn't 10 million - the two imply each other!

In this part of the server implementation, you may specify as many validation functions
as you like. These assert relations between the fields on a score, and allow you
to restrict certain things.

Like real life, passing judgements subjects you to more scrutiny -- getting a `FULL COMBO` with misses should likely fail a validation function.

## That's it!

The only thing left is to define the [Client Implementation](./client-impl.md)!
