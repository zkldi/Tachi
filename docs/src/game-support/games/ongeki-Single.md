# O.N.G.E.K.I. Support

This game has the internal game string of `ongeki`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | Known in-game as 'Technical Score'. It ranges between 0 and 1,010,000, where notes are worth 950,000, and bells 60,000. |
| `noteLamp` | "LOSS", "CLEAR", "FULL COMBO", "ALL BREAK", "ALL BREAK+" | The primary lamp. A clear is a draw or a win in-game. |
| `bellLamp` | "NONE", "FULL BELL" | Tracks whether all bells in the chart have been collected. |
| `platinumScore` | Integer | The Platinum Score value. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "D", "C", "B", "BB", "BBB", "A", "AA", "AAA", "S", "SS", "SSS", "SSS+" | The grade this score was. |
| `platinumStars` | "0-star", "1-star", "2-star", "3-star", "4-star", "5-star", "R-star" | The number of platinum stars of this score, with "R-star" representing rainbow. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The number of non-critical mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The number of non-critical mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `damage` | Integer | The number of damage ticks received. |
| `bellCount` | Integer | The number of bells collected. |
| `totalBellCount` | Integer | The maximum number of bells that could have been obtained at the time of the play's end. |
| `scoreGraph` | Array&lt;Decimal \| null &gt; | The history of the projected score, queried in one-second intervals. |
| `platinumGraph` | Array&lt;Decimal \| null &gt; | The Platinum Score history, queried in one-second intervals. |
| `bellGraph` | Array&lt;Decimal \| null &gt; | The history of the number of bells missed, queried in one-second intervals. |
| `lifeGraph` | Array&lt;Decimal \| null &gt; | The life gauge history, queried in one-second intervals. |

## Judgements

The following judgements are defined:

- `cbreak` (critical break)
- `break` (red/regular break)
- `hit`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

The default rating algorithm is `rating`.

| Name | Description |
| :: | :: |
| `rating` | A rating value of this score, capping at +2.0 at SSS+. This is identical to the system used in bright MEMORY and earlier versions. |
| `scoreRating` | A rating value of this score, capping at +2.7 at 1,010,000. This is identical to the system used in Re:Fresh. |
| `starRating` | A rating value of this score, based on stars derived from Platinum Score. This is identical to the system used in Re:Fresh. |

### Session Rating Algorithms

The default rating algorithm is `naiveRating`.

| Name | Description |
| :: | :: |
| `naiveRating` | The average of your best 10 classic ratings this session. |
| `naiveScoreRating` | The average of your best 10 score ratings this session. |
| `starRating` | The average of your best 10 star ratings this session. |

### Profile Rating Algorithms

The default rating algorithm is `naiveRating`.

| Name | Description |
| :: | :: |
| `naiveRating` | The average of your best 45 classic ratings. This is a simpler variant of the rating algorithm used in bright MEMORY and earlier versions, without distinguishing between new and old charts, and without taking recent scores into account. |
| `naiveRatingRefresh` | A weighted sum of the average of your best 60 score ratings, and your best 50 star ratings. This is a simpler variant of the rating algorithm used in Re:Fresh, without distinguishing between new and old charts. |
| `scoreRating` | The average of your best 60 score ratings. |
| `starRating` | The average of your best 50 star ratings. |

## Difficulties

- `BASIC`
- `ADVANCED`
- `EXPERT`
- `MASTER`
- `LUNATIC`
- `Re:MASTER`

The `LUNATIC`/`Re:MASTER` split is transparent; your import script must assume every "white" chart is `LUNATIC`.

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | BLUE, GREEN, ORANGE, RED, PURPLE, COPPER, SILVER, GOLD, PLATINUM, RAINBOW, RAINBOW_SHINY, RAINBOW_EX, RAINBOW_EX_TRUE

## Versions

| ID | Pretty Name |
| :: | :: |
| `brightMemory2Omni` | bright MEMORY Act.2 Omnimix |
| `brightMemory3` | bright MEMORY Act.3 |
| `brightMemory3Omni` | bright MEMORY Act.3 Omnimix |
| `refresh` | Re:Fresh Act.1 |
| `refreshOmni` | Re:Fresh Act.1 Omnimix |

## Supported Match Types

- `songTitle`
- `tachiSongID` – deprecated; don't use this
- `inGameID`

### Song Title Matching
There are several songs with non-unique names:

- Singularity (technoplanet) `inGameID: 391`
- Singularity (ETIA.「Arcaea」) `inGameID: 454`
- Singularity (SEGA SOUND STAFF「セガNET麻雀 MJ」) `inGameID: 516`

- Hand in Hand (livetune) `inGameID: 380`
- Hand in Hand (ユーフィリア(CV：高橋 李依)「アンジュ・ヴィエルジュ」) `inGameID: 212`

- Perfect_Shining!! LUNATIC 0 (Loctest chart) `inGameID: 8003`
- Perfect_Shining!! LUNATIC 13+ (Re:Master) `inGameID: 8091`

Most of these conflicts can be resolved by providing the `artist` field; the only exception is Perfect Shining, which uniquely has two LUNATIC charts and has to be matched by `inGameID`.
There are numerous songs with non-unique names (e.g. Singularity, Singularity, Singularity and Xingularity), but this can be resolved by providing the `artist` field. The only exception is Perfect Shining!!, which uniquely has two LUNATIC charts and has to be matched by `inGameID`.

### Song Data
O.N.G.E.K.I. song data additionally includes the following fields:
- `genre` (String): The GCM-style *genre* used to categorize songs in-game. This is guaranteed to be one of the following:
	- "POPS＆ANIME",
	- "niconico",
	- "東方Project",
	- "VARIETY",
	- "チュウマイ",
	- "オンゲキ",
	- "LUNATIC",
	- "ボーナストラック"
- `duration` (Number | null): The duration of the audio file, in seconds. This is used to plot graphs uniformly.
- `titleEn` (String | undefined): Romaji title, displayed on hover.
- `flavorGenre` (String | undefined): Optional [IIDX-style *genre*](https://silentblue.remywiki.com/ONGEKI:Genres).

### Chart Data
O.N.G.E.K.I. chart data additionally includes the following fields:
- `displayVersion`: The version this chart originates from. Note the value can differ between LUN and other charts. Gguaranteed to be one of the following:
	- "オンゲキ",
	- "オンゲキ PLUS",
	- "オンゲキ SUMMER",
	- "オンゲキ SUMMER PLUS",
	- "オンゲキ R.E.D.",
	- "オンゲキ R.E.D. PLUS",
	- "オンゲキ bright",
	- "オンゲキ bright MEMORY Act.1",
	- "オンゲキ bright MEMORY Act.2",
	- "オンゲキ bright MEMORY Act.3",
	- "オンゲキ Re:Fresh Act.1"
- `isBonusTrack` (Bool): Bonus Tracks are solo versions of O.N.G.E.K.I.' original vocal songs. They use the `inGameID` range of 7XXX, reuse the same charts as the base songs, are unranked (Rating is always 0.000), do not appear in regular folders, and their genre is "ボーナストラック".
	- For example, the song [青空コントレール](https://kamai.tachi.ac/games/ongeki/charts/C19d35e17e0287b74fcd) is a duet of [星咲 あかり](https://kamai.tachi.ac/games/ongeki/charts/C19d35e17e38a5edca25) and [日向 千夏](https://kamai.tachi.ac/games/ongeki/charts/C19d35e17e39c78a7a2a).
- `maxPlatScore` (Integer): Max Platinum Score, or note count multiplied by 2.
- `inGameID` (Number | null): Internal song ID.
- `chartViewURL` (String | undefined): Link to https://sdvx.in/ongeki.html.
- `levelHistory`: List of game versions alongside `level`/`levelNum` pairs. If the chart wasn't present in the version, the value is `null` instead.
