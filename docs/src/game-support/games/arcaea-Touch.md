# Arcaea Support

This game has the internal GPTString of `arcaea:Touch`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 10 million, plus bonus points dependent on how many shiny PUREs you get. |
| `lamp` | "LOST", "EASY CLEAR", "CLEAR", "HARD CLEAR", "FULL RECALL", "PURE MEMORY" | The type of clear this was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "D", "C", "B", "A", "AA", "EX", "EX+" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |

## Judgements

The following judgements are defined:

- `pure`
- `far`
- `lost`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `potential` | Potential as it is implemented in Arcaea. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `naivePotential` | The average of your best 10 potentials this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `naivePotential` | The average of your best 30 potential values. This is different to in-game, as it does not take into account your recent scores in any way. |

## Difficulties

- `Past`
- `Present`
- `Future`
- `Eternal`
- `Beyond`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `badge` | DERIVED | BLUE, GREEN, ASH_PURPLE, PURPLE, RED, ONE_STAR, TWO_STARS, THREE_STARS
| `courseBanner` | PROVIDED | PHASE_1, PHASE_2, PHASE_3, PHASE_4, PHASE_5, PHASE_6, PHASE_7, PHASE_8, PHASE_9, PHASE_10, PHASE_11, PHASE_12

## Versions

| ID | Pretty Name |
| :: | :: |
| `mobile` | Mobile |
| `switch` | Nintendo Switch |

## Supported Match Types

- `inGameStrID`
- `songTitle`
- `tachiSongID`
