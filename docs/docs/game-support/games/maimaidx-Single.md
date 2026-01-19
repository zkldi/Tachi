# maimai DX Support

This game has the internal GPTString of `maimaidx:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `percent` | Decimal | The percent this score was worth. Sometimes called 'rate' in game. This is between 0 and 101. |
| `lamp` | "FAILED", "CLEAR", "FULL COMBO", "FULL COMBO+", "ALL PERFECT", "ALL PERFECT+" | The type of clear this score was. |

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
| `percentGraph` | Array&lt;Decimal \| null &gt; | The history of the projected achievement, queried in one-second intervals. |
| `lifeGraph` | Array&lt;Decimal \| null &gt; | Life count history, queried in one-second intervals. |

## Judgements

The following judgements are defined:

- `pcrit`
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
| `naiveRate` | A naive rating algorithm that just sums your 50 best scores. |

## Difficulties

- `Basic`
- `Advanced`
- `Expert`
- `Master`
- `Re:Master`
- `DX Basic`
- `DX Advanced`
- `DX Expert`
- `DX Master`
- `DX Re:Master`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `colour` | DERIVED | WHITE, BLUE, GREEN, YELLOW, RED, PURPLE, BRONZE, SILVER, GOLD, PLATINUM, RAINBOW
| `dan` | PROVIDED | DAN_1, DAN_2, DAN_3, DAN_4, DAN_5, DAN_6, DAN_7, DAN_8, DAN_9, DAN_10, SHINDAN_1, SHINDAN_2, SHINDAN_3, SHINDAN_4, SHINDAN_5, SHINDAN_6, SHINDAN_7, SHINDAN_8, SHINDAN_9, SHINDAN_10, SHINKAIDEN, URAKAIDEN
| `matchingClass` | PROVIDED | B5, B4, B3, B2, B1, A5, A5, A4, A3, A2, A1, S5, S4, S3, S2, S1, SS5, SS4, SS3, SS2, SS1, SSS5, SSS4, SSS3, SSS2, SSS1, LEGEND

## Versions

| ID | Pretty Name |
| :: | :: |
| `universeplus` | UNiVERSE PLUS |
| `festival` | FESTiVAL |
| `festivalplus` | FESTiVAL PLUS |
| `buddies` | BUDDiES |
| `buddies-omni` | BUDDiES Omnimix |
| `buddiesplus` | BUDDiES PLUS |
| `buddiesplus-omni` | BUDDiES PLUS Omnimix |
| `prism` | PRiSM |
| `prism-omni` | PRiSM Omnimix |
| `prismplus` | PRiSM PLUS |

## Supported Match Types

- `songTitle`
- `tachiSongID`
- `inGameID`
