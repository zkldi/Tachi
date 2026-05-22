# Score Endpoints

!!! note
	Scores are *not* personal bests. For more information
	on the distinction, see [PBs and Scores](../../wiki/pbs-scores.md).

*****

## Retrieve specific score.

`GET /api/v1/scores/:scoreID`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `getRelated` | Presence | If present, also return the song and chart for this score document. |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `score` | [ScoreDocument](../../schemas/score.md) | The score document with this scoreID. |
| `song` (Conditional) | [SongDocument](../../schemas/song.md) | If `getRelated` is set, then this is the song the score belongs to. |
| `chart` (Conditional) | [ChartDocument](../../schemas/chart.md) | Same as above, but for the chart document. |

### Example

#### Request
```
GET /api/v1/scores/Re7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b
```

#### Response

```json
{
	"score": {
		"scoreID": "Re7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b",
		"songID": 1,
		"chartID": "some_chart_ID"
	},
	"song": {
		"id": 1,
		"title": "5.1.1."
	},
	"chart": {
		"chartID": "some_chartID",
		"songID": 1
	}
}
```

*****

## Modify a score document.

`PATCH /api/v1/scores/:scoreID`

### Permissions

- customise_score
- Must be the owner of this score.

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `comment` (Optional) | Null or String | A string between 1 and 120 characters, or null. If null, the score will have its comment unset. If not, the comment for this score will be set to its contents. If the key is not present, no change will be made. |
| `highlight` (Optional) | Boolean | Whether this score was a highlight or not. If this field is not present, no change will be made to the highlight status. |

!!! info
	Although all of these fields are optional, providing none
	of them is a 400 failure.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | [ScoreDocument](../../schemas/score.md) | The new score document.

### Example

#### Request
```
PATCH /api/v1/scores/Re7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b
```

```json
{
	"comment": "new comment"
}
```

#### Response

```json
{
	"scoreID": "Re7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b",
	"comment": "new comment",
	"highlighted": false,
	// etc..
}

```

*****

## Delete a score.

`DELETE /api/v1/scores/:scoreID`

!!! info
	Deleting a score will result in profile recalculations and PB updates.

### Permissions

- delete_score
- Must be the owner of this score (Or a server administrator).

### Parameters

None.

### Response

None. (Empty Object)
