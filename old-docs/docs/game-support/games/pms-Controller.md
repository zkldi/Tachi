# PMS (Controller) Support

This game has the internal GPTString of `pms:Controller`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | EX Score. This should be between 0 and the maximum possible EX on this chart. |
| `lamp` | "NO PLAY", "FAILED", "ASSIST CLEAR", "EASY CLEAR", "CLEAR", "HARD CLEAR", "EX HARD CLEAR", "FULL COMBO" | The type of clear this was. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "F", "E", "D", "C", "B", "A", "AA", "AAA", "MAX-", "MAX" | Grades as they are in IIDX. We also add MAX- (94.44...%) and MAX (100%) as their own grades for convenience. |
| `percent` | Decimal | EX Score divided by the maximum possible EX Score on this chart. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `bp` | Integer | The total bads + poors in this score. |
| `gauge` | Decimal | The life in percent (between 0 and 100) that was on the gauge at the end of the chart. |
| `gaugeHistory` | Array&lt;Decimal&gt; | A snapshot of the gauge percent throughout the chart. The values should be null from the point the user dies until the end of the chart. |
| `gaugeHistoryEasy` | Array&lt;Decimal&gt; | The easy gauge history. |
| `gaugeHistoryGroove` | Array&lt;Decimal&gt; | The groove gauge history. |
| `gaugeHistoryHard` | Array&lt;Decimal&gt; | The hard gauge history. |
| `epg` | Integer | The amount of early PGreats in this score. |
| `egr` | Integer | The amount of early greats in this score. |
| `egd` | Integer | The amount of early goods in this score. |
| `ebd` | Integer | The amount of early bads in this score. |
| `epr` | Integer | The amount of early poors in this score. |
| `lpg` | Integer | The amount of late PGreats in this score. |
| `lgr` | Integer | The amount of late greats in this score. |
| `lgd` | Integer | The amount of late goods in this score. |
| `lbd` | Integer | The amount of late bads in this score. |
| `lpr` | Integer | The amount of late poors in this score. |

## Judgements

The following judgements are defined:

- `cool`
- `great`
- `good`
- `bad`
- `poor`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `sieglinde` | A clearing algorithm that rewards you points based on how difficult an easy clear or hard clear was. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `sieglinde` | The average of your best 10 sieglinde ratings this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `sieglinde` | The average of your best 20 sieglinde ratings. |

## Difficulties

- `CHART`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `dan` | PROVIDED | INSANE_1, INSANE_2, INSANE_3, INSANE_4, INSANE_5, INSANE_6, INSANE_7, INSANE_8, INSANE_9, INSANE_10, INSANE_KAIDEN, OVERJOY, UNDEFINED

## Versions

This game has no versions, and presumably doesn't need to disambiguate its IDs.

## Supported Match Types

- `bmsChartHash`
- `tachiSongID`
