# Individual User on Specific Game

This endpoints are for specific users information on specific game + playtype combinations.

This scenario appears frequently, and is typically shortened to UGPT.

---

## Get information about a user's plays on a game + playtype.

`GET /api/v1/users/:userID/games/:game/:playtype`

### Parameters

None.

### Response

|     Property      |                                 Type                                 |                                                Description                                                |
| :---------------: | :------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------: |
|    `gameStats`    |                        UserGameStatsDocument                         |                              The User's GameStats for this game + playtype.                               |
|   `firstScore`    |           [ScoreDocument](../../schemas/score.md) or Null            | The user's first score for this game + playtype. This is null if the user has no scores with timestamps.  |
| `mostRecentScore` |           [ScoreDocument](../../schemas/score.md) or Null            |           The user's most recent score. This is null if the user has no scores with timestamps.           |
|   `totalScores`   |                               Integer                                |                                 The total amount of scores this user has.                                 |
|   `rankingData`   | Record&lt;Rating Algorithm, { ranking: integer, outOf: integer }&gt; | The position of this player on the default leaderboards for this game, and how many players it is out of. |

### Example

#### Request

```
GET /api/v1/users/zkldi/games/iidx/SP
```

#### Response

```js
{
	gameStats: {
		userID: 1,
		game: "iidx",
		playtype: "SP",
		ratings: {
			ktRating: 15
		},
		classes: {
			dan: 14
		}
	},
	firstScore: null,
	mostRecentScore: null,
	totalScores: 5,
	rankingData: {
		ktRating: {
			ranking: 3,
			outOf: 18
		}
		ktLampRating: {
			ranking: 2,
			outOf: 18
		},
		BPI: {
			ranking: 5,
			outOf: 18
		}
	}
}
```

---

## Search a user's personal bests.

`GET /api/v1/users/:userID/games/:game/:playtype/pbs`

### Parameters

| Property |  Type  |                                           Description                                           |
| :------: | :----: | :---------------------------------------------------------------------------------------------: |
| `search` | String | Limits the returned scores to those where the corresponding song is most similar to this query. |

### Response

| Property |                         Type                         |                                   Description                                    |
| :------: | :--------------------------------------------------: | :------------------------------------------------------------------------------: |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |                     The array of songs this search returned.                     |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |                    The array of charts this search returned.                     |
|  `pbs`   |               Array&lt;PBDocument&gt;                | The array of personal bests this search returned. This is limited to 30 returns. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/pbs?search=Verfl
```

#### Response

```js
{
	pbs: [{
		userID: 1,
		scoreData: {
			score: 123,
			// ...
		}
	}],
	songs: [{
		title: "Verflucht",
		// ...
	}],
	charts: [{
		songID: 123,
		playtype: "SP",
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 123,
		playtype: "SP",
		difficulty: "HYPER",
	}]
}
```

## Get a user's best 100 personal bests.

`GET /api/v1/users/:userID/games/:game/:playtype/pbs/best`

This returns the users' best 100 personal bests according
to the [Default Rating Algorithm](../../codebase/implementation-details/game-configuration) for this game.

This is returned in descending sorted order.

The query parameter `alg` can be used to specify a
different rating algorithm to sort under.

### Parameters

| Property |  Type  |                          Description                          |
| :------: | :----: | :-----------------------------------------------------------: |
|  `alg`   | String | An overriding rating algorithm to use instead of the default. |

### Response

| Property |                         Type                         |                    Description                    |
| :------: | :--------------------------------------------------: | :-----------------------------------------------: |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |     The array of songs this search returned.      |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |     The array of charts this search returned.     |
|  `pbs`   |               Array&lt;PBDocument&gt;                | The array of personal bests this search returned. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/pbs/best?alg=BPI
```

#### Response

```js
{
	pbs: [{
		userID: 1,
		scoreData: {
			// ...
		},
		calculatedData: {
			ktRating: 15,
			BPI: 4.4
		}
	}, {
		userID: 1,
		scoreData: {
			// ...
		},
		calculatedData: {
			ktRating: 19,
			BPI: 4.2
		}
	}],
	songs: [{
		title: "Verflucht",
		// ...
	}, {
		title: "AA",
		// ...
	}],
	charts: [{
		songID: 123,
		playtype: "SP",
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 14,
		playtype: "SP",
		difficulty: "ANOTHER",
	}]
}
```

---

## Returns all of a users personal bests.

`GET /api/v1/users/:userID/games/:game/:playtype/pbs/all`

### Parameters

None.

### Response

| Property |                         Type                         |          Description          |
| :------: | :--------------------------------------------------: | :---------------------------: |
|  `pbs`   |               Array&lt;PBDocument&gt;                | All of the users PB Documents |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |  All of the relevant songs.   |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |  All of the relevant charts.  |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/pbs/all
```

#### Response

```js
{
	pbs: [{
		userID: 1,
		scoreData: {
			score: 123,
			// ...
		}
	}],
	songs: [{
		title: "Verflucht",
		// ...
	}],
	charts: [{
		songID: 123,
		playtype: "SP",
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 123,
		playtype: "SP",
		difficulty: "HYPER",
	}]
}
```

---

## Get A User's PB for a given chart.

`GET /api/v1/users/:userID/games/:game/:playtype/pbs/:chartID`

### Parameters

|     Property     |   Type   |                                      Description                                       |
| :--------------: | :------: | :------------------------------------------------------------------------------------: |
| `getComposition` | Presence | If present, the individual ScoreDocuments that composed this PB will also be returned. |

### Response

|        Property        |                         Type                         |                                                 Description                                                  |
| :--------------------: | :--------------------------------------------------: | :----------------------------------------------------------------------------------------------------------: |
|          `pb`          |                      PBDocument                      |                                        The user's PB for this chart.                                         |
|        `chart`         |       [ChartDocument](../../schemas/chart.md)        |                                           The chart this PB is on.                                           |
| `scores` (Conditional) | Array&lt;[ScoreDocument](../../schemas/score.md)&gt; | If `getComposition` is present, then this field contains the array of score documents that composed this PB. |

### Example

#### Request

```
GET /api/v1/users/1/games/iidx/SP/pbs/some_chart_id
```

#### Response

```js
{
	pb: {
		chartID: "some_chart_id",
		userID: 1,
		game: "iidx",
		playtype: "SP",
	},
	chart: {
		chartID: "some_chart_id"
	}
}
```

---

## Search a user's individual scores.

`GET /api/v1/users/:userID/games/:game/:playtype/scores`

### Parameters

| Property |  Type  |                                           Description                                           |
| :------: | :----: | :---------------------------------------------------------------------------------------------: |
| `search` | String | Limits the returned scores to those where the corresponding song is most similar to this query. |

### Response

| Property |                                 Type                                  |                               Description                                |
| :------: | :-------------------------------------------------------------------: | :----------------------------------------------------------------------: |
| `songs`  | Array&lt;[SongDocument](../../schemas/song.md) with \_\_textScore&gt; |                 The array of songs this search returned.                 |
| `charts` |         Array&lt;[ChartDocument](../../schemas/chart.md)&gt;          |                The array of charts this search returned.                 |
| `scores` |         Array&lt;[ScoreDocument](../../schemas/score.md)&gt;          | The array of scores this search returned. This is limited to 30 returns. |

!!! info
All `songs` returned also have the `__textScore`
property. This property describes how close the query
was to the actual text, and is mostly internal.

    You can read more into the details of this at [Search Implementation](../../codebase/implementation-details/search.md)

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/scores?search=Verfl
```

#### Response

```js
{
	scores: [{
		userID: 1,
		scoreData: {
			score: 123,
			// ...
		}
	}],
	songs: [{
		title: "Verflucht",
		// ...
	}],
	charts: [{
		songID: 123,
		playtype: "SP",
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 123,
		playtype: "SP",
		difficulty: "HYPER",
	}]
}
```

---

## Get a user's most recent 100 scores.

`GET /api/v1/users/:userID/games/:game/:playtype/scores/recent`

### Parameters

None.

### Response

| Property |                         Type                         |                               Description                                |
| :------: | :--------------------------------------------------: | :----------------------------------------------------------------------: |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |                 The array of songs this search returned.                 |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |                The array of charts this search returned.                 |
| `scores` | Array&lt;[ScoreDocument](../../schemas/score.md)&gt; | The array of scores this search returned. This is limited to 30 returns. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/scores/recent
```

#### Response

```js
{
	scores: [{
		userID: 1,
		scoreData: {
			score: 123,
			// ...
		}
	}],
	songs: [{
		title: "Verflucht",
		// ...
	}],
	charts: [{
		songID: 123,
		playtype: "SP",
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 123,
		playtype: "SP",
		difficulty: "HYPER",
	}]
}
```

---

## Search a user's sessions.

`GET /api/v1/users/:userID/games/:game/:playtype/sessions`

Searches the names of sessions from a given user. This
does not search session descriptions, nor does it search
song titles of played songs inside sessions.

### Parameters

| Property |  Type  |           Description           |
| :------: | :----: | :-----------------------------: |
| `search` | String | The session name to search for. |

### Response

| Property |                           Type                           |                  Description                   |
| :------: | :------------------------------------------------------: | :--------------------------------------------: |
| `<body>` | Array&lt;[SessionDocument](../../schemas/session.md)&gt; | The array of sessions that matched this query. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/sessions?search=epic%20session
```

#### Response

```js
[
	{
		name: "My Epic Session!!!",
		userID: 1,
		game: "iidx",
		playtype: "SP",
		// ...
	},
];
```

## Get a user's best 100 sessions.

`GET /api/v1/users/:userID/games/:game/:playtype/sessions/best`

Retrieves a user's best 100 sessions according to the
game + playtypes default algorithm. The algorithm can
be overrode with the `alg` query string parameter.

These are returned in descending order.

### Parameters

|     Property     |  Type  |                       Description                        |
| :--------------: | :----: | :------------------------------------------------------: |
| `alg` (Optional) | String | The name of the algorithm to use instead of the default. |

### Response

| Property |                           Type                           |              Description              |
| :------: | :------------------------------------------------------: | :-----------------------------------: |
| `<body>` | Array&lt;[SessionDocument](../../schemas/session.md)&gt; | The array of the users best sessions. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/sessions/best
```

#### Response

!!! info
The default rating algorithm for IIDX:SP is `ktRating`.

```js
[
	{
		userID: 1,
		game: "iidx",
		playtype: "SP",
		calculatedData: {
			ktRating: 14,
			bpi: 3,
		},
		// ... more properties
	},
	{
		userID: 1,
		game: "iidx",
		playtype: "SP",
		calculatedData: {
			ktRating: 13.2,
			bpi: 4,
		},
	},
];
```

## Get a user's most recent 100 sessions.

`GET /api/v1/users/:userID/games/:game/:playtype/sessions/recent`

Retrieves a user's most recent 100 sessions for this game.

These are returned in descending order according to `timeEnded`.

### Parameters

None.

### Response

| Property |                           Type                           |           Description            |
| :------: | :------------------------------------------------------: | :------------------------------: |
| `<body>` | Array&lt;[SessionDocument](../../schemas/session.md)&gt; | The array of the users sessions. |

---

## Get a user's most recent session.

`GET /api/v1/users/:userID/games/:game/:playtype/sessions/last`

!!! info
This endpoint will return 404 if the user has never had a
session for this game.

### Parameters

None.

### Response

| Property |                    Type                     |           Description           |
| :------: | :-----------------------------------------: | :-----------------------------: |
| `<body>` | [SessionDocument](../../schemas/session.md) | The user's most recent session. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/sessions/last
```

#### Response

```js
{
	"name": "foo",
	"desc": "My most recent session",
	// ...
}
```

## Get a user's most recent 100 highlighted sessions.

`GET /api/v1/users/:userID/games/:game/:playtype/sessions/highlighted`

Retrieves a user's most recent 100 highlighted sessions for this game.

These are returned in descending order according to `timeEnded`.

### Parameters

None.

### Response

| Property |                           Type                           |                 Description                  |
| :------: | :------------------------------------------------------: | :------------------------------------------: |
| `<body>` | Array&lt;[SessionDocument](../../schemas/session.md)&gt; | The array of the users highlighted sessions. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/sessions/highlighted
```

#### Response

```js
[
	{
		userID: 1,
		game: "iidx",
		playtype: "SP",
		calculatedData: {
			ktRating: 14,
			bpi: 3
		}
		highlight: true,
		// ... more props
	},
]
```

---

## Get a user's most played charts.

`GET /api/v1/users/:userID/games/:game/:playtype/most-played`

### Parameters

None.

### Response

| Property |                         Type                         |                                                               Description                                                                |
| :------: | :--------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------: |
| `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |                                                  The array of songs related to the pbs.                                                  |
| `charts` | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |                                                 The array of charts related to the pbs.                                                  |
|  `pbs`   | Array&lt;(PBDocument & {\_\_playcount: integer})&gt; | An array of PB documents with the `__playcount` property attached. This property dictates how many times the user has played this chart. |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/most-played
```

#### Response

```js
{
	songs: [{
		id: 1,
		title: "5.1.1.",
		// ...
	}, {
		id: 2,
		title: "GAMBOL",
		// ...
	}],
	charts: [{
		songID: 1,
		difficulty: "ANOTHER",
		// ...
	}, {
		songID: 2,
		difficulty: "LEGGENDARIA",
		// ...
	}, {
		songID: 1,
		difficulty: "HYPER",
	}],
	pbs: [{
		chartID: "something",
		__playcount: 5,
		// ...
	}, {
		chartID: "something_else",
		__playcount: 2,
		// ...
	}, {
		chartID: "something_more",
		__playcount: 1,
		// ...
	}]
}
```

---

## Retrieve a leaderboard around a user.

`GET /api/v1/users/:userID/games/:game/:playtype/leaderboard-adjacent`

### Parameters

| Property |       Type        |                                                     Description                                                     |
| :------: | :---------------: | :-----------------------------------------------------------------------------------------------------------------: |
|  `alg`   | String (Optional) | Optionally, you can provide an override algorithm to use for the leaderboards instead of the game+playtype default. |

### Response

|      Property      |                        Type                        |                     Description                     |
| :----------------: | :------------------------------------------------: | :-------------------------------------------------: |
|      `above`       |             Array&lt;UserGameStats&gt;             |  Up to 5 users' game stats better than this user.   |
|      `below`       |             Array&lt;UserGameStats&gt;             |         Same as above, but below the user.          |
|      `users`       | Array&lt;[UserDocument](../../schemas/user.md)&gt; | The user documents related to the above statistics. |
|  `thisUsersStats`  |                   UserGameStats                    |      The requested user's stats for this GPT.       |
| `thisUsersRanking` |         {outOf: integer, ranking: integer}         |     The requested user's ranking for this GPT.      |

### Example

#### Request

```
GET /api/v1/users/zkldimes/iidx/SP/leaderboard-adjacent
```

#### Response

```js
{
	above: [{
		userID: 2,
		ratings: {
			ktRating: 9
		},
		classes: {
			dan: 10
		},
		// ...
	}],
	below: [{
		userID: 3,
		ratings: {
			ktRating: 1
		},
		classes: {
			dan: 5
		},
		// ...
	}],
	users: [{
		userID: 2,
		username: "sptmgtm",
		// ...
	}, {
		userID: 3,
		username: "neil.c",
		// ...
	}],
	thisUsersStats: {
		userID: 1,
		ratings: {
			ktRating: 5
		},
		classes: {
			dan: 5
		}
	},
	thisUsersRanking: {
		ranking: 2,
		outOf: 3
	}
}
```

---

## Retrieve this user's GPT stat history.

`GET /api/v1/users/:userID/games/:game/:playtype/history`

Every day, a user's game stats are snapshotted and saved. This returns the recent ones.

### Parameters

None.

### Response

| Property |                Type                |                                                      Description                                                      |
| :------: | :--------------------------------: | :-------------------------------------------------------------------------------------------------------------------: |
| `<body>` | Array&lt;UserGameStatsSnapshot&gt; | The most recent (up to) 90 UGS Snapshots, where the first element is the most recent one, and the last is the oldest. |

### Example

#### Request

```
GET /api/v1/users/1/games/iidx/SP/history
```

#### Response

```js
[
	{
		classes: {
			dan: 13,
		},
		ratings: {
			BPI: 5,
			ktRating: 3,
			ktLampRating: 1,
		},
		timestamp: 12312323123123, // most recent
		playcount: 500,
		ranking: 14,
	},
	// and so on..
];
```

---

## Retrieve this user's GPT settings.

`GET /api/v1/users/:userID/games/:game/:playtype/settings`

!!! warning
Unlike most other applications, your settings are completely public. GPT Settings only concern
cosmetic things, like what rating algorithms to prefer.

### Parameters

None.

### Response

| Property |         Type         |             Description              |
| :------: | :------------------: | :----------------------------------: |
| `<body>` | UGPTSettingsDocument | The settings document for this user. |

### Example

#### Request

```
GET /api/v1/users/1/games/iidx/SP/settings
```

#### Response

```js
{
	preferredScoreAlg: null,
	preferredSessionAlg: "BPI",
	preferredProfileAlg: null,
	stats: []
}
```

---

## Modify your UGPT settings.

`PATCH /api/v1/users/:userID/games/:game/:playtype/settings`

!!! note
Although `stats` are part of your settings, they are not modifiable under these endpoints,
instead you should use [UGPT Showcase Endpoints](./ugpt-showcase.md).

### Permissions

- `customise_profile`

### Parameters

| Property |             Type             |                                                                    Description                                                                    |
| :------: | :--------------------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------: |
| `<body>` | Partial UGPTSettingsDocument | A UGPTSettingsDocument where all properties are optional. Properties not present will not be modified. Note that `stats` are not modifiable here. |

### Response

| Property |         Type         |          Description          |
| :------: | :------------------: | :---------------------------: |
| `<body>` | UGPTSettingsDocument | The new UGPTSettingsDocument. |

### Example

#### Request

```
PATCH /api/v1/users/1/games/iidx/SP/settings

{
	preferredScoreAlg: "BPI"
}
```

#### Response

```js

{
	preferredScoreAlg: "BPI",
	preferredSessionAlg: "ktRating",
	preferredProfileAlg: null,
	stats: []
}
```
