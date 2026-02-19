# jubeat Support

This game has the internal GPTString of `jubeat:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 1 million. |
| `musicRate` | Decimal | The music rate for this score. This is between 0 and 100 on normal difficulties, and 0 and 120 for hard-mode difficulties. This should be submitted to one decimal place. |
| `lamp` | "FAILED", "CLEAR", "FULL COMBO", "EXCELLENT" | The type of clear this was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "E", "D", "C", "B", "A", "S", "SS", "SSS", "EXC" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `musicBar` | Array&lt;Decimal&gt; | A snapshot of how well the player did in each part of the song |

## Judgements

The following judgements are defined:

- `perfect`
- `great`
- `good`
- `poor`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `jubility` | Jubility as it's implemented in game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `jubility` | The average of your best 10 jubilities this session. |

### Profile Rating Algorithms

The default rating algorithm is `jubility`.

| Name | Description |
| :: | :: |
| `jubility` | Your profile jubility. This takes your best 30 scores on PICK UP songs, and your best 30 elsewhere. |
| `naiveJubility` | A naive version of jubility which just adds together your best 60 scores. |

## Difficulties

- `BSC`
- `ADV`
- `EXT`
- `HARD BSC`
- `HARD ADV`
- `HARD EXT`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | BLACK, YELLOW_GREEN, GREEN, LIGHT_BLUE, BLUE, VIOLET, PURPLE, PINK, ORANGE, GOLD

## Versions

| ID | Pretty Name |
| :: | :: |
| `jubeat` | jubeat |
| `ripples` | ripples |
| `knit` | knit |
| `copious` | copious |
| `saucer` | saucer |
| `prop` | prop |
| `qubell` | Qubell |
| `clan` | clan |
| `festo` | festo |
| `festo-omni` | festo Omnimix |
| `ave` | Ave. |
| `beyond` | beyond the Ave. |

## Supported Match Types

- `inGameID`
- `tachiSongID`
