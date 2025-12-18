# What is BATCH-MANUAL?

BATCH-MANUAL is a JSON format that Tachi accepts.
This format can be submitted as [a file](../../api/routes/import.md#import-scores-from-a-file)
using the `file/batch-manual` [Import Type](../import/import-types.md), or it can be submitted as a
[HTTP request body](./direct-manual.md).

*****

## Motivation

Instead of Tachi writing new support for every kind of
possible export, and bothering other service providers
to write exports, we could write a generic format we accept
and then users with a bit of scripting knowledge can import
their own scores.

This has the additional advantage of allowing extremely
obscure imports, and reduces the workload on Tachi.

## Format

The format is incredibly simple JSON.

It is comprised of two base keys, `meta` and `scores`.

!!! note
	These keys were originally called `head` and `body` in Kamaitachi. You will have to update
	existing batch-manual code.

### Meta

The `meta` key contains metadata, and looks like this:

```json
{
	"game": "iidx",
	"playtype": "SP",
	"service": "foobar"
}
```

The fields have the following values:

| Property | Type | Description |
| :: | :: | :: |
| `game` | Any Game Identifier | The game this import is for. |
| `playtype` | Any Playtype for the above game. | The playtype this import is for. |
| `service` | String | A humanised string to explain where these scores are from. This must be between 2 and 15 characters. |
| `version` (Optional) | String | Optionally, you can specify a version of the game this import is for. This should be used when conflicting versions of songs exist, or when this import is rather old. Most of the time, this does not need to be present. |

### Scores

The `scores` property is an array of Batch Manual Scores. An example
score is as follows:

```json
{
	"score": 500,
	"lamp": "HARD CLEAR",
	"matchType": "songTitle",
	"identifier": "5.1.1.",
	"difficulty": "ANOTHER",
	"timeAchieved": 1624324467489
}
```

The properties are described as this:

| Property | Type | Description |
| :: | :: | :: |
| `score` | Number | The score for this, well, score. This should use the default scoring algorithm for this game. |
| `lamp` | Lamp | The lamp for this score. This should be one of the lamps as described in the config for your game + playtype. |
| `percent` (Conditional) | Number | Only appears for `jubeat`. This should be set to the Percent for this score. In jubeat's case, this is your Music Rate. |
| `matchType` | "songTitle" \| "ddrSongHash" \| "tachiSongID" \| "bmsChartHash" \| "inGameID" \| "uscChartHash" | This determines how `identifier` will be used to match your scores' chart with Tachi's database of songs and charts. |
| `identifier` | String | A string that Tachi uses to identify what chart this is for. How this is used depends on the `matchType`. |
| `difficulty` (Conditional) | String | If `matchType` is "tachiSongID", "inGameID", "ddrSongHash" or "songTitle", this field must be present, and describe the difficulty of the chart this score is for. |
| `artist` (Conditional) | String | If `matchType` is "songTitle", this field can be present, and describe the artist name for less equivocal matching. This field is optional for legacy purposes. |
| `timeAchieved` (Optional) | integer \| null | This is *when* the score was achieved in unix milliseconds. This should be provided if possible, as Tachi uses it for a LOT of features. |
| `comment` (Optional) | string \| null | A comment from the user about this score. |
| `judgements` (Optional) | Record&lt;Game Judgement, integer&gt; | This should be a record of the judgements for your game + playtype, and the integer indicating how often they occured. |
| `optional` (Optional) | See [Game Specific Optional Metrics](../../schemas/score.md#game-specific) | Any optional metrics you wish to provide for this game. |
| `scoreMeta` (Optional) | See [Game Specific Score Meta](../../schemas/score.md#game-specific) | This can be a partial record of various `scoreMeta` props for this game. |

!!! warning
	`identifier` should always be a string. Even if it's something like a numeric ID! Tachi will handle this.

!!! warning
	`timeAchieved` is in **UNIX MILLISECONDS**. Most programming languages use unix seconds. You might have to
	multiply your timestamps by 1000.

#### Match Type

There are many match types, and they all use identifier
in a different way.

- songTitle

As the name implies, this searches for a song whose title
is exactly `identifier`. **THIS IS NOT FUZZY MATCHING**,
and is by far the least reliable way to send scores to
Tachi. This is kept for compatibility purposes with poor quality APIs.

This match type *necessitates* that `difficulty` be defined
and set to a valid difficulty for this game + playtype.

This match type can be augmented with a secondary identifier `artist`
which resolves title clashes:

```json
{
	"score": 500,
	"lamp": "HARD CLEAR",
	"matchType": "songTitle",
	"identifier": "5.1.1.",
	"artist": "dj nagureo",
	"difficulty": "ANOTHER",
	"timeAchieved": 1624324467489
}
```

- tachiSongID

This uses `identifier` as if it were an integer, to match
songs based on the `id` field of a tachi song.

This match type *necessitates* that `difficulty` be defined
and set to a valid difficulty for this game + playtype.

- bmsChartHash

As the name implies, this looks for the chart hash BMS
uses. This can be either the MD5 hash or the SHA256 hash,
both will match.

This match type can only be used for BMS.

- uscChartHash

This looks for the chart SHA1 that USC uses. As expected, this
can only be used for USC.

- inGameID

This uses the in-game-ID for this **SONG**. You, therefore,
**MUST** specify the difficulty for this chart as well.

This is supported for the following games:

- IIDX
- Pop'n Music
- Jubeat
- CHUNITHM
- GITADORA
- maimai
- maimai DX
- WACCA
- MUSECA

- sdvxInGameID

This uses the in-game-ID for this SDVX song. You must specify
the difficulty for this chart as well.

The reason SDVX gets its own special `matchType` is because this
matchType supports `difficulty: "ANY_INF"`. This special difficulty
means that it will check for any of `INF/GRV/HVN/VVD/XCD` for this song.

This is useful for services that store all of those as the same difficulty.

- ddrSongHash

This is a 32-character hash used by the official DDR e-amusement website to
identify a song; you must specify the difficulty for this chart as well.

## Example

A final example of a simple BATCH MANUAL format
looks like this:

```json
{
	"meta": {
		"game": "iidx",
		"playtype": "SP",
		"service": "My Service"
	},
	"scores": [{
		"score": 500,
		"lamp": "HARD CLEAR",
		"matchType": "songTitle",
		"identifier": "5.1.1.",
		"artist": "dj nagureo",
		"difficulty": "ANOTHER"
	}, {
		"score": 123,
		"lamp": "FAILED",
		"matchType": "tachiSongID",
		"identifier": "1",
		"difficulty": "HYPER",
		"comment": "This score sucked!",
		"optional": {
			"bp": 5
		},
		"scoreMeta": {
			"random": "MIRROR"
		}
	}]
}
```
