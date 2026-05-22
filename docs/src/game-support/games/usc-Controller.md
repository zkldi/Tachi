# USC (Controller) Support

This game has the internal GPTString of `usc:Controller`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 10 million. |
| `lamp` | "FAILED", "CLEAR", "EXCESSIVE CLEAR", "ULTIMATE CHAIN", "PERFECT ULTIMATE CHAIN" | The type of clear this score was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "D", "C", "B", "A", "A+", "AA", "AA+", "AAA", "AAA+", "S", "PUC" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `gauge` | Decimal | The amount of life in the gauge when this chart finished. This is between 0 and 100. |

## Judgements

The following judgements are defined:

- `critical`
- `near`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `VF6` | VOLFORCE as it is implemented in SDVX6. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `ProfileVF6` | The average of your best 10 VF6s this session, multiplied to be on the same scale as profile VOLFORCE. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `VF6` | Your best 50 VF6 values added together. |

## Difficulties

- `NOV`
- `ADV`
- `EXH`
- `INF`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `vfClass` | DERIVED | SIENNA_I, SIENNA_II, SIENNA_III, SIENNA_IV, COBALT_I, COBALT_II, COBALT_III, COBALT_IV, DANDELION_I, DANDELION_II, DANDELION_III, DANDELION_IV, CYAN_I, CYAN_II, CYAN_III, CYAN_IV, SCARLET_I, SCARLET_II, SCARLET_III, SCARLET_IV, CORAL_I, CORAL_II, CORAL_III, CORAL_IV, ARGENTO_I, ARGENTO_II, ARGENTO_III, ARGENTO_IV, ELDORA_I, ELDORA_II, ELDORA_III, ELDORA_IV, CRIMSON_I, CRIMSON_II, CRIMSON_III, CRIMSON_IV, IMPERIAL_I, IMPERIAL_II, IMPERIAL_III, IMPERIAL_IV

## Versions

This game has no versions, and presumably doesn't need to disambiguate its IDs.

## Supported Match Types

- `uscChartHash`
- `tachiSongID`
