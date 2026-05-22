# maimai Support

This game has the internal GPTString of `maimai:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `percent` | Decimal | The percent this score was worth. Sometimes called 'rate' in game. This is upper-bounded by how many BREAK notes the chart has. |
| `lamp` | "FAILED", "CLEAR", "FULL COMBO", "ALL PERFECT", "ALL PERFECT+" | The type of clear this score was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "F", "E", "D", "C", "B", "A", "AA", "AAA", "S", "S+", "SS", "SS+", "SSS", "SSS+" | The grade this score was. |

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
| `naiveRate` | An average of your 30 best ratings. This is different from the rating in-game, as that is song-based and takes into account recent scores. |

## Difficulties

- `Easy`
- `Basic`
- `Advanced`
- `Expert`
- `Master`
- `Re:Master`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | WHITE, BLUE, GREEN, YELLOW, RED, PURPLE, BRONZE, SILVER, GOLD, RAINBOW
| `dan` | PROVIDED | DAN_1, DAN_2, DAN_3, DAN_4, DAN_5, DAN_6, DAN_7, DAN_8, DAN_9, DAN_10, KAIDEN, SHINDAN_1, SHINDAN_2, SHINDAN_3, SHINDAN_4, SHINDAN_5, SHINDAN_6, SHINDAN_7, SHINDAN_8, SHINDAN_9, SHINDAN_10, SHINKAIDEN

## Versions

| ID | Pretty Name |
| :: | :: |
| `finale` | FiNALE |

## Supported Match Types

- `songTitle`
- `tachiSongID`
- `inGameID`
- `inGameStrID`
