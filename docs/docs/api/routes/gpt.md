# Game:Playtype Endpoints

These endpoints are for games + their playtypes.
To find out what games are supported by a service
programmatically, you should see [Game Endpoints](./games.md).

---

## Retrieve Game:Playtype Configuration.

`GET /api/v1/games/:game/:playtype`

### Parameters

None.

### Response

| Property |     Type     |                   Description                    |
| :------: | :----------: | :----------------------------------------------: |
| `config` | GamePTConfig | The configuration file for this game + playtype. |

!!! warning
A GamePTConfig is different to a GameConfig! Read more
[here](../../codebase/implementation-details/game-configuration.md).

### Example

#### Request

```
GET /api/v1/games/iidx/SP
```

#### Response

```json
{
	"config": {
		"idString": "iidx:SP",

		"percentMax": 100,

		"defaultScoreRatingAlg": "ktRating",
		"defaultSessionRatingAlg": "ktRating",
		"defaultProfileRatingAlg": "ktRating"

		// ... more props - a lot more props
	}
}
```

---

## Retrieve the player leaderboard.

`GET /api/v1/games/:game/:playtype/leaderboard`

### Parameters

|     Property     |  Type  |                                        Description                                         |
| :--------------: | :----: | :----------------------------------------------------------------------------------------: |
| `alg` (Optional) | String | If present, specifies an alternative algorithm to sort players on, instead of the default. |

### Response

|  Property   |                        Type                        |                    Description                     |
| :---------: | :------------------------------------------------: | :------------------------------------------------: |
| `gameStats` |               Array&lt;GameStats&gt;               |    The sorted statistics for the leaderboards.     |
|   `users`   | Array&lt;[UserDocument](../../schemas/user.md)&gt; | All of the related users for the above statistics. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/leaderboard
```

#### Response

```json
{
	"gameStats": [
		{
			"userID": 1,
			"ratings": {
				"ktRating": 4
				// ...
			}
			// ...
		}
	],
	"users": [
		{
			"id": 1,
			"username": "zkldi"
		}
	]
}
```

---

## Retrieve a song and its charts.

`GET /api/v1/games/:game/:playtype/songs/:songID`

### Parameters

None.

### Response

| Property |                   Type                    |                          Description                          |
| :------: | :---------------------------------------: | :-----------------------------------------------------------: |
|  `song`  |   [SongDocument](../../schemas/song.md)   |                 The requested song document.                  |
| `charts` | [ChartDocument](../../schemas/chart.md)[] | All of the charts that belong to this song for this playtype. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/songs/1
```

#### Response

```json
{
	"song": {
		"id": 1,
		"title": "5.1.1."
	},
	"charts": [
		{
			"songID": 1,
			"playtype": "SP",
			"difficulty": "HYPER"
			// ...
		},
		{
			"songID": 1,
			"playtype": "SP",
			"difficulty": "ANOTHER"
			// ...
		}
	]
}
```

---

## Get popular charts for this game + playtype.

`GET /api/v1/games/:game/:playtype/charts`

### Parameters

|      Property       |  Type  |         Description         |
| :-----------------: | :----: | :-------------------------: |
| `search` (Optional) | String | A song title to search for. |

!!! note
If no search parameter is set, then the most popular
100 charts for this game are returned.

    If a search parameter is set, then the most popular
    charts that match the search criteria will be returned,
    in that order.

### Response

| Property |                                  Type                                   |                                         Description                                         |
| :------: | :---------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md) with `__playcount`&gt; | The chart documents that matched this search, or the most popular 100 charts for this game. |
| `songs`  |           Array&lt;[SongDocument](../../schemas/song.md)&gt;            |                        The associated song documents for the charts.                        |

!!! info
The `__playcount` property is patched onto the chart
documents returned. This indicates the amount of unique
players that have played this chart.

### Example

#### Request

```
GET /api/v1/games/iidx/SP/charts?search=AA
```

#### Response

```json
{
	"songs": [
		{
			"title": "AA",
			"id": 3
			// ...
		},
		{
			"title": "AA -rebuild-",
			"id": 133
			// ...
		}
	],
	"charts": [
		{
			"songID": 3,
			"difficulty": "ANOTHER",
			"__playcount": 1049
			// ...
		},
		{
			"songID": 133,
			"difficulty": "ANOTHER",
			"__playcount": 120
		}
		//...
	]
}
```

---

## Retrieve a chart at a specific ID.

`GET /api/v1/games/:game/:playtype/charts/:chartID`

### Parameters

None.

### Response

| Property |                  Type                   |           Description           |
| :------: | :-------------------------------------: | :-----------------------------: |
|  `song`  |  [SongDocument](../../schemas/song.md)  | The parent song for this chart. |
| `chart`  | [ChartDocument](../../schemas/chart.md) |  The requested chart document.  |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/charts/some_chart_id
```

#### Response

```json
{
	"song": {
		"id": 123,
		"title": "BLOCKS"
		// ...
	},
	"chart": {
		"chartID": "some_chart_id",
		"songID": 123,
		"playtype": "SP"
		// ...
	}
}
```

---

## Retrieve playcount for this chart.

`GET /api/v1/games/:game/:playtype/charts/:chartID/playcount`

### Parameters

None.

### Response

| Property |  Type   |            Description             |
| :------: | :-----: | :--------------------------------: |
| `count`  | Integer | The amount of plays on this chart. |

### Example

Self-explanatory.

---

## Retrieve leaderboards for this chart.

`GET /api/v1/games/:game/:playtype/charts/:chartID/pbs`

### Parameters

|         Property          |                                  Type                                   | Description |
| :-----------------------: | :---------------------------------------------------------------------: | :---------: |
| `startRanking` (Optional) | Specify a start point to return 100 pbs from. Defaults to 1. Inclusive. |

### Response

| Property |              Type              |             Description             |
| :------: | :----------------------------: | :---------------------------------: |
|  `pbs`   |    Array&lt;PBDocument&gt;     | The array of pbs sorted by ranking. |
| `users`  | The users these PBs belong to. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/charts/some_chart/pbs
```

#### Response

```json
{
	"pbs": [{
		"chartID": "some_chart",
		"userID": 1,
		"rankingData": {
			"rank": 1,
			"outOf": 100,
		},
		// ...
	},
		//...
	],
	"users": [{
		"id": 1,
		"username": "zkldi
		// ...
	},
		// ...
	]
}
```

---

## Search for a user's PB on this chart.

`GET /api/v1/games/:game/:playtype/charts/:chartID/pbs/search`

### Parameters

| Property |  Type  |               Description               |
| :------: | :----: | :-------------------------------------: |
| `search` | String | The user whose PB you're searching for. |

### Response

Same as `/api/v1/games/:game/:playtype/charts/:chartID/pbs`.

### Example

See Above.

---

## Search a GPT's folders.

`GET /api/v1/games/:game/:playtype/folders`

### Parameters

| Property |  Type  |              Description               |
| :------: | :----: | :------------------------------------: |
| `search` | String | A string to search for a given folder. |

### Response

| Property |            Type             |              Description              |
| :------: | :-------------------------: | :-----------------------------------: |
| `<body>` | Array&lt;FolderDocument&gt; | The folders that matched this search. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/folders?search=12
```

#### Response

```js
[
	{
		name: "beatmania IIDX Level 12",
		// ...
	},
];
```

---

## Retrieve information on a specific folderID

`GET /api/v1/games/:game/:playtype/folders/:folderID`

### Parameters

None.

### Response

| Property |                         Type                         |                 Description                  |
| :------: | :--------------------------------------------------: | :------------------------------------------: |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  | The related song documents for this folder.  |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; | The related chart documents for this folder. |
| `folder` |                    FolderDocument                    |       The folder document at this ID.        |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/folders/some_folder_id
```

#### Response

```js
{
	songs: [{
		id: 123,
		title: "Epic Song",
		artist: "foo bar",
		// ...
	}],
	charts: [{
		chartID: "foo_bar",
		songID: 123,
		difficulty: "ANOTHER",
		// ...
	}],
	folder: {
		name: "beatmania IIDX Level 12",
		folderID: "some_folder_id",
		// ...
	}
}
```

---

## Return all the tables for this game

`GET /api/v1/games/:game/:playtype/tables`

!!! note
Unlike the folders endpoint, this one doesn't have a search parameter. This is because we expect
the total table count to stay rather small.

    If this changes in the future, this might become a paginated search like endpoint.

### Parameters

None.

### Response

| Property |            Type            |        Description        |
| :------: | :------------------------: | :-----------------------: |
| `tables` | Array&lt;TableDocument&gt; | Every table for this GPT. |

### Example

#### Request

```
GET /api/v1/games/bms/7K/tables
```

#### Response

```js
{
	tables: [
		{
			name: "Insane",
			// ...
		},
		{
			name: "Overjoy",
			// ...
		},
	];
}
```

---

## Retrieve folder documents for a specific table.

`GET /api/v1/games/:game/:playtype/tables/:tableID`

### Parameters

None.

### Response

| Property  |            Type             |            Description             |
| :-------: | :-------------------------: | :--------------------------------: |
| `folders` | Array&lt;FolderDocument&gt; | All of the folders for this table. |
|  `table`  |        TableDocument        |   The table document at this ID.   |

### Example

#### Request

```
GET /api/v1/games/bms/7K/tableID/insane
```

#### Response

```js
{
	folders: [
		// insane lv1, insane lv2 -- insane lv 25, so on.
	],
	table: {
		tableID: "insane",
		name: "Insane",
		// ...
	}
}
```

---

## Retrieve the PB leaderboard for this Game.

`GET /api/v1/games/:game/:playtype/pb-leaderboard`

### Parameters

| Property |       Type       |                                      Description                                       |
| :------: | :--------------: | :------------------------------------------------------------------------------------: |
|  `alg`   |      String      |              An alternative algorithm to use instead of the GPTs default.              |
| `limit`  | Optional Integer | Optionally, provide a number between 1 and 50 to change the amount of scores returned. |

### Response

| Property |                         Type                         |                 Description                  |
| :------: | :--------------------------------------------------: | :------------------------------------------: |
|  `pbs`   |               Array&lt;PBDocument&gt;                | The array of pbs part of the PB leaderboard. |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |     The array of songs part of the PBs.      |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |     The array of charts part of the PBs.     |
| `users`  |  Array&lt;[UserDocument](../../schemas/user.md)&gt;  |     The array of users part of the PBs.      |

---

## Get the distribution of players for a provided class.

`GET /api/v1/games/:game/:playtype/player-distribution`

### Parameters

| Property |  Type  |                                      Description                                       |
| :------: | :----: | :------------------------------------------------------------------------------------: |
| `class`  | String | Must be one of the GPTs supported classes, This specifies what distribution to return. |

### Response

| Property |               Type                |                                  Description                                  |
| :------: | :-------------------------------: | :---------------------------------------------------------------------------: |
| `<body>` | Record&lt;ClassValue, integer&gt; | Returns a record of the class value against the amount of people who have it. |

### Example

#### Request

```
GET /api/v1/games/bms/7K/player-distribution?class=stslDan
```

#### Response

```js
{
	"12": 1,
	"11": 5,
	"10": 7,
	"9": 6,
	"8": 4,
	// Note that keys will be empty if nobody has them.
	"5": 30,
	// ... so on
}
```

!!! info
You can find the humanised conversions for these classes in the gptConfig for this GPT.

    See [tachi/common](https://github.com/zkldichi/tree/main/common) for more information.

---

## Retrieve recent class updates from all users on this game.

`GET /api/v1/games/:game/:playtype/player-distribution`

### Parameters

| Property |       Type       |                                               Description                                               |
| :------: | :--------------: | :-----------------------------------------------------------------------------------------------------: |
| `limit`  | Optional Integer | Optionally, An integer between 1 and 50 can be provided to limit the amount of returns. Defaults to 10. |

### Response

| Property  |                        Type                        |                 Description                  |
| :-------: | :------------------------------------------------: | :------------------------------------------: |
|  `users`  | Array&lt;[UserDocument](../../schemas/user.md)&gt; | Array of the users who achieved the courses. |
| `classes` |       Array&lt;ClassAchievementDocument&gt;        |  Data about the recently achieved classes.   |

---

## Retrieve the most recent highlighted scores for this GPT.

`GET /api/v1/games/:game/:playtype/scores/highlighted`

### Parameters

| Property |       Type       |                                            Description                                             |
| :------: | :--------------: | :------------------------------------------------------------------------------------------------: |
| `limit`  | Optional Integer | Optionally, provide an integer between 1 and 100 to return this amount of scores. Defaults to 100. |

### Response

| Property |                         Type                         |          Description          |
| :------: | :--------------------------------------------------: | :---------------------------: |
| `scores` | Array&lt;[ScoreDocument](../../schemas/score.md)&gt; |    The highlighted scores.    |
| `users`  |  Array&lt;[UserDocument](../../schemas/user.md)&gt;  | The users who own the scores. |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  | The songs the scores are on.  |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; | The charts the scores are on. |
