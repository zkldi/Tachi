# MÚSECA Support

This game has the internal GPTString of `museca:Single`.

!!! note
	For information on what each section means, please see [Common Config](../common-config/index.md).

## Metrics

For more information on what metrics are and how they work, see [TODO]!

### Provided Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `score` | Integer | The score value. This is between 0 and 1 million. |
| `lamp` | "FAILED", "CLEAR", "CONNECT ALL", "PERFECT CONNECT ALL" | The type of clear this score was. **Note:** we define a CLEAR as being >= 800k, and FAILED as anything less. We do not respect MUSECA's story mode for clear/failed types. |

### Derived Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `grade` | "没", "拙", "凡", "佳", "良", "優", "秀", "傑", "傑G" | The grade this score was. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |

## Judgements

The following judgements are defined:

- `critical`
- `near`
- `miss`

## Rating Algorithms

### Score Rating Algorithms

| Name | Description |
| :: | :: |
| `curatorSkill` | Curator Skill as it's implemented in-game. |

### Session Rating Algorithms

| Name | Description |
| :: | :: |
| `curatorSkill` | The average of your best 10 Curator skills this session. |

### Profile Rating Algorithms

| Name | Description |
| :: | :: |
| `curatorSkill` | The sum of your best 20 Curator Skills. This is identical to how it's calculated in-game. |

## Difficulties

- `Green`
- `Yellow`
- `Red`

## Classes

| Name | Type | Values |
| :: | :: | :: |

## Versions

| ID | Pretty Name |
| :: | :: |
| `1.5` | 1 + 1/2 |
| `1.5-b` | 1 + 1/2 Rev. B |

## Supported Match Types

- `songTitle`
- `tachiSongID`
- `inGameID`
