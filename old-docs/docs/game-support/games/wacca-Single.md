# WACCA Support

This game has the internal GPTString of `wacca:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 1 million. |
| `lamp` | "FAILED", "CLEAR", "MISSLESS", "FULL COMBO", "ALL MARVELOUS" | The type of clear this score was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "D", "C", "B", "A", "AA", "AAA", "S", "S+", "SS", "SS+", "SSS", "SSS+", "MASTER" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |

## Judgements

The following judgements are defined:

- `marvelous`
- `great`
- `good`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `rate` | Rating as it's implemented in game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `rate` | The average of your best 10 ratings this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `naiveRate` | A naive rating algorithm that just sums your 50 best scores. |

## Difficulties

- `NORMAL`
- `HARD`
- `EXPERT`
- `INFERNO`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `stageUp` | PROVIDED | I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, XIV
| `colour` | DERIVED | ASH, NAVY, YELLOW, RED, PURPLE, BLUE, SILVER, GOLD, RAINBOW

## Versions

| ID | Pretty Name |
| :: | :: |
| `reverse` | REVERSE |
| `plus` | PLUS |

## Supported Match Types

- `songTitle`
- `tachiSongID`
- `inGameID`