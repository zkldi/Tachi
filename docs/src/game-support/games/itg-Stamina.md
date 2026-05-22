# ITG Support

This game has the internal GPTString of `itg:Stamina`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `scorePercent` | Decimal | The % value this score was worth. This is a number between 0 and 100. Note that negative %s, although existing in ITG, are not supported. |
| `survivedPercent` | Decimal | How far this user survived through the chart. For clears, this should be 100, if the user got halfway through, this should be 50, etc. |
| `lamp` | "FAILED", "CLEAR", "FULL COMBO", "FULL EXCELLENT COMBO", "QUAD", "QUINT" | The type of clear this user got. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "F", "D", "C", "B", "A", "S", "★", "★★", "★★★", "★★★★" | The grade this score was. Note that grades are capped at F if this was a fail. |
| `finalPercent` | Decimal | A combination of `survivedPercent` and `scorePercent`. This metric is `survivedPercent` if the player didn't clear the chart. Otherwise, it's their `scorePercent` + 100. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `lifebarHistory` | Array&lt;Decimal&gt; | A snapshot of how much life the player had throughout the chart. |

## Judgements

The following judgements are defined:

- `fantastic+`
- `fantastic`
- `excellent`
- `great`
- `decent`
- `wayoff`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

The default rating algorithm is `blockRating`.

| Name | Description |
| :: | :: |
| `blockRating` | How much this clear is worth. |
| `fastest32` | The fastest BPM this score streamed 32 measures straight for. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `blockRating` | An average of your best 5 block levels cleared this session. |

### Profile Rating Algorithms

The default rating algorithm is `highestBlock`.

| Name | Description |
| :: | :: |
| `highestBlock` | The highest block level this player has cleared. |
| `fastest32` | The fastest BPM this user has streamed 32 unbroken measures at. |

## Difficulties

This game uses dynamic difficulties. A difficulty name may be any string, provided `songID` + `playtype` + `difficulty` is unique.

## Classes

| Name | Type | Values |
| :: | :: | :: |

## Versions

This game has no versions, and presumably doesn't need to disambiguate its IDs.

## Supported Match Types

- `itgChartHash`
