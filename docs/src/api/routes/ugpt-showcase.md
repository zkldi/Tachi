# UGPT Stat Showcase

These endpoints are related to the Statistic Showcase feature.

*****

## Evaluate this users set stats

`GET /api/v1/users/:userID/games/:gameGroup/:playtype/showcase`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `projectUser` | Optional, userID | If provided, will *project* another users showcase onto this user, evaluating the same user against the projectedUser's stats. |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Array&lt;StatShowcaseResults&gt; | |

### Example

#### Request
```
GET /api/v1/users/1/games/iidx/SP/showcase
```

#### Response
```js
[{
	stat: {

	},
	value: {
		value: 123,
	},
	related: {
		song: {
			title: "FREEDOM DIVE",
			// ...
		},
		chart: {
			// some chart stuff..
		},
		// folders: [] if this is a folder(s) stat, then folders are displayed here.
	}
}]
```

*****

## Replace a user's stat showcase.

`PATCH /api/v1/users/:userID/games/:gameGroup/:playtype/showcase`

### Permissions

- `customise_profile`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Array&lt;StatDocument&gt; | An array of up to 6 stat documents. |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Array&lt;StatDocument&gt; | The newly updated stat documents. |

### Example

#### Request
```
PATCH /api/v1/users/1/games/iidx/SP/showcase

[
	{
		mode: "chart",
		chartID: "some_chart_id",
		property: "percent"
	}
]
```

#### Response
```js
[
	{
		mode: "chart",
		chartID: "some_chart_id",
		property: "percent"
	}
]
```

*****

## Evaluate a custom stat on this user.

`GET /api/v1/users/:userID/games/:gameGroup/:playtype/showcase/custom`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `mode` | "folder" \| "chart" | Whether the stat to evaluate is on a folder or a chart. |
| `property` | "grade" \| "lamp" \| "score" \| "percent" or "playcount" if mode is chart. | What property to evaluate on the given criteria. |
| `chartID` | string, if mode === "chart" | If mode is chart, this should contain the relevant chartID. |
| `folderID` | string, if mode === "folder" | If mode is folder, this should contain the relevant folderID. |
| `gte` | number, if mode === "folder" | If mode is folder, this must contain the value the property must be greater than, i.e. lamp >= 6, or percent >= 90 |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `stat` | StatDocument | The stat you evaluated. |
| `result` | {value: number \| null, outOf?: number } | Contains `value`, which contains the stat's value, or NULL if the mode is chart and the user has not played this chart. If mode is folder, `outOf` contains the total amount of charts in that folder. |
| `related` | {song, chart} or {folders} | If mode is chart, contains the pertinent song and chart. If mode is folder, contains the pertinent folder documents.

### Example

#### Request
```
GET /api/v1/users/1/games/iidx/SP/showcase/custom?mode=chart&property=percent&chartID=some_chart_id
```

#### Response
```js
{
	stat: {
		mode: "chart",
		property: "percent",
		chartID: "some_chart_id",
	},
	result: {
		value: 99.12
	},
	related: {
		song: {
			id: 123,
			title: "AA",
			artist: "DJ.Amuro",
			// ...
		},
		chart: {
			songID: 123,
			difficulty: "ANOTHER",
			// ...
		}
	}
}
```
