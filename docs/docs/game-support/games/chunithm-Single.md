# CHUNITHM Support

This game has the internal GPTString of `chunithm:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 1.01 million. |
| `noteLamp` | "NONE", "FULL COMBO", "ALL JUSTICE", "ALL JUSTICE CRITICAL" | The type of combo this was. |
| `clearLamp` | "FAILED", "CLEAR", "HARD", "BRAVE", "ABSOLUTE", "CATASTROPHY" | The type of clear this was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "D", "C", "B", "BB", "BBB", "A", "AA", "AAA", "S", "S+", "SS", "SS+", "SSS", "SSS+" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `scoreGraph` | Array&lt;Decimal&gt; | The history of the projected score, queried in one-second intervals. |
| `lifeGraph` | Array&lt;Decimal&gt; | Challenge gauge history, queried in one-second intervals. |

## Judgements

The following judgements are defined:

- `jcrit`
- `justice`
- `attack`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `rating` | The rating value of this score. This is identical to the system used in game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `naiveRating` | The average of your best 10 ratings this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `naiveRating` | The average of your best 50 ratings. |

## Difficulties

- `BASIC`
- `ADVANCED`
- `EXPERT`
- `MASTER`
- `ULTIMA`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | BLUE, GREEN, ORANGE, RED, PURPLE, COPPER, SILVER, GOLD, PLATINUM, RAINBOW, RAINBOW_II, RAINBOW_III, RAINBOW_IV, RAINBOW_EX_I, RAINBOW_EX_II, RAINBOW_EX_III
| `dan` | PROVIDED | DAN_I, DAN_II, DAN_III, DAN_IV, DAN_V, DAN_INFINITE
| `emblem` | PROVIDED | DAN_I, DAN_II, DAN_III, DAN_IV, DAN_V, DAN_INFINITE

## Versions

| ID | Pretty Name |
| :: | :: |
| `paradiselost` | PARADISE LOST |
| `new` | NEW |
| `newplus` | NEW PLUS |
| `sun` | SUN |
| `sun-intl` | SUN International |
| `sun-omni` | SUN Omnimix |
| `sunplus` | SUN PLUS |
| `sunplus-intl` | SUN PLUS International |
| `sunplus-omni` | SUN PLUS Omnimix |
| `luminous` | LUMINOUS |
| `luminous-intl` | LUMINOUS International |
| `luminous-omni` | LUMINOUS Omnimix |
| `luminousplus` | LUMINOUS PLUS |
| `luminousplus-intl` | LUMINOUS PLUS International |
| `luminousplus-omni` | LUMINOUS PLUS Omnimix |
| `verse` | VERSE |
| `verse-intl` | VERSE International |
| `verse-omni` | VERSE Omnimix |
| `xverse` | X-VERSE |
| `xverse-intl` | X-VERSE International |
| `xverse-omni` | X-VERSE Omnimix |

## Supported Match Types

- `inGameID`
- `songTitle`
- `tachiSongID`
