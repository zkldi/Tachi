# GITADORA (Dora) Support

This game has the internal GPTString of `gitadora:Dora`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `percent` | Decimal | The percent this score was worth. Sometimes referred to as 'Achievement Rate' in game. This is a value between 0 and 100. |
| `lamp` | "FAILED", "CLEAR", "FULL COMBO", "EXCELLENT" | The type of clear this was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "C", "B", "A", "S", "SS", "MAX" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |

## Judgements

The following judgements are defined:

- `perfect`
- `great`
- `good`
- `ok`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `skill` | Skill Rating as it's implemented in game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `skill` | The average of your best 10 skill ratings this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `naiveSkill` | Your best 50 skill levels added together, regardless of whether the chart is HOT or not. |

## Difficulties

- `BASIC`
- `ADVANCED`
- `EXTREME`
- `MASTER`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | WHITE, ORANGE, ORANGE_GRD, YELLOW, YELLOW_GRD, GREEN, GREEN_GRD, BLUE, BLUE_GRD, PURPLE, PURPLE_GRD, RED, RED_GRD, BRONZE, SILVER, GOLD, RAINBOW

## Versions

| ID | Pretty Name |
| :: | :: |
| `konaste` | Konaste |
| `fuzzUp` | FUZZ-UP |
| `highVoltage` | HIGH-VOLTAGE |
| `nextage` | NEX+AGE |
| `exchain` | EXCHAIN |
| `matixx` | Matixx |

## Supported Match Types

- `inGameID`
- `songTitle`
- `tachiSongID`
