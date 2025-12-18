# pop'n music Support

This game has the internal GPTString of `popn:9B`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. |
| `clearMedal` | "failedCircle", "failedDiamond", "failedStar", "easyClear", "clearCircle", "clearDiamond", "clearStar", "fullComboCircle", "fullComboDiamond", "fullComboStar", "perfect" | The clear medal for this score. This is a superset of lamps. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `lamp` | "FAILED", "EASY CLEAR", "CLEAR", "FULL COMBO", "PERFECT" | The lamp for this score. This is a subset of clearMedals, and is - as a result - derived from them. We keep both around as lamps are better for grouping up scores. |
| `grade` | "E", "D", "C", "B", "A", "AA", "AAA", "S" | The grade this score was worth. Note that scores are capped at a grade of A if they are a fail, regardless of how good the score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `gauge` | Decimal | The gauge value this score had at the end. This is a value between 0 and 100. |

## Judgements

The following judgements are defined:

- `cool`
- `great`
- `good`
- `bad`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `classPoints` | Class Points as they're implemented in game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `classPoints` | The average of your best 10 class points this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `naiveClassPoints` | A naive average of your best 20 scores. This is different to in game class points, as that is affected by recent scores, and not just your best scores. |

## Difficulties

- `Easy`
- `Normal`
- `Hyper`
- `EX`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `class` | DERIVED | KITTY, STUDENT, DELINQUENT, DETECTIVE, IDOL, GENERAL, HERMIT, GOD

## Versions

| ID | Pretty Name |
| :: | :: |
| `peace` | peace |
| `kaimei` | Kaimei Riddles |
| `unilab` | Unilab |

## Supported Match Types

- `inGameID`
- `tachiSongID`
- `popnChartHash`
