# beatmania IIDX (SP) Support

This game has the internal GPTString of `iidx:SP`.

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
| `percent` | Decimal | EX Score divided by the maximum possible EX Score on this chart. |
| `grade` | "F", "E", "D", "C", "B", "A", "AA", "AAA", "MAX-", "MAX" | Grades as they are in IIDX. We also add MAX- (94.44...%) and MAX (100%) as their own grades for convenience. |

### Optional Metrics

| Metric Name | Type | Description |
| :: | :: | :: |
| `fast` | Integer | The amount of mistakes in this score that were a result of hitting early. |
| `slow` | Integer | The amount of mistakes in this score that were a result of hitting late. |
| `maxCombo` | Integer | The largest combo in this score. |
| `bp` | Integer | The total bads + poors in this score. |
| `gauge` | Decimal | The life in percent (between 0 and 100) that was on the gauge at the end of the chart. |
| `comboBreak` | Integer | The amount of times combo was broken. |
| `gaugeHistory` | Array&lt;Decimal \| null &gt; | A snapshot of the gauge percent throughout the chart. The values should be null from the point the user dies until the end of the chart. |
| `scoreHistory` | Array&lt;Decimal \| null &gt; | A snapshot of the user's ghost throughout the chart. The values may be null. |
| `gsmEasy` | Array&lt;Decimal \| null &gt; | If GSM is used, this stores the easy gauge history. |
| `gsmNormal` | Array&lt;Decimal \| null &gt; | If GSM is used, this stores the normal gauge history. |
| `gsmHard` | Array&lt;Decimal \| null &gt; | If GSM is used, this stores the hard gauge history. |
| `gsmEXHard` | Array&lt;Decimal \| null &gt; | If GSM is used, this stores the ex-hard gauge history. |

## Judgements

The following judgements are defined:

- `pgreat`
- `great`
- `good`
- `bad`
- `poor`

## Rating Algorithms

### Score Rating Algorithms

The default rating algorithm is `ktLampRating`.

| Name | Description |
| :: | :: |
| `ktLampRating` | A rating system that values your clear lamps on charts. Tierlist information is taken into account. |
| `BPI` | A rating system for Kaiden level play. Only applies to 11s and 12s. A BPI of 0 states the score is equal to the Kaiden Average for that chart. A BPI of 100 is equal to the world record. |

### Session Rating Algorithms

The default rating algorithm is `ktLampRating`.

| Name | Description |
| :: | :: |
| `ktLampRating` | An average of the best 10 ktLampRatings this session. |
| `BPI` | An average of the best 10 BPIs this session. |

### Profile Rating Algorithms

The default rating algorithm is `ktLampRating`.

| Name | Description |
| :: | :: |
| `ktLampRating` | An average of your best 20 ktLampRatings. |
| `BPI` | An average of your best 20 BPIs. |

## Difficulties

- `NORMAL`
- `HYPER`
- `ANOTHER`
- `LEGGENDARIA`
- `All Scratch NORMAL`
- `All Scratch HYPER`
- `All Scratch ANOTHER`
- `All Scratch LEGGENDARIA`
- `Kichiku NORMAL`
- `Kichiku HYPER`
- `Kichiku ANOTHER`
- `Kichiku LEGGENDARIA`
- `Kiraku NORMAL`
- `Kiraku HYPER`
- `Kiraku ANOTHER`
- `Kiraku LEGGENDARIA`

## Classes

| Name | Type | Values |
| :: | :: | :: |
| `dan` | PROVIDED | KYU_7, KYU_6, KYU_5, KYU_4, KYU_3, KYU_2, KYU_1, DAN_1, DAN_2, DAN_3, DAN_4, DAN_5, DAN_6, DAN_7, DAN_8, DAN_9, DAN_10, CHUUDEN, KAIDEN

## Versions

| ID | Pretty Name |
| :: | :: |
| `20` | tricoro |
| `21` | SPADA |
| `22` | PENDUAL |
| `23` | copula |
| `24` | SINOBUZ |
| `25` | CANNON BALLERS |
| `26` | ROOTAGE |
| `27` | HEROIC VERSE |
| `28` | BISTROVER |
| `29` | CastHour |
| `30` | Resident |
| `31` | Epolis |
| `32` | Pinky Crush |
| `33` | Sparkle Shower |
| `3-cs` | 3rd Style CS |
| `4-cs` | 4th Style CS |
| `5-cs` | 5th Style CS |
| `6-cs` | 6th Style CS |
| `7-cs` | 7th Style CS |
| `8-cs` | 8th Style CS |
| `9-cs` | 9th Style CS |
| `10-cs` | 10th Style CS |
| `11-cs` | IIDX RED CS |
| `12-cs` | HAPPY SKY CS |
| `13-cs` | DISTORTED CS |
| `14-cs` | GOLD CS |
| `15-cs` | DJ TROOPERS CS |
| `16-cs` | EMPRESS CS |
| `26-omni` | ROOTAGE Omnimix |
| `27-omni` | HEROIC VERSE Omnimix |
| `28-omni` | BISTROVER Omnimix |
| `29-omni` | CastHour Omnimix |
| `30-omni` | Resident Omnimix |
| `31-omni` | Epolis Omnimix |
| `32-omni` | Pinky Crush Omnimix |
| `27-2dxtra` | HEROIC VERSE 2dxtra |
| `28-2dxtra` | BISTROVER 2dxtra |
| `30-2dxtra` | RESIDENT 2dxtra |
| `31-2dxtra` | Epolis 2dxtra |
| `bmus` | BEATMANIA US |
| `inf` | INFINITAS |

## Supported Match Types

- `inGameID`
- `tachiSongID`
- `songTitle`
