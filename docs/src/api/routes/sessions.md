# Session Endpoints

---

## Get a specific session

`GET /api/v1/sessions/:sessionID`

### Parameters

None.

### Response

| Property  |                         Type                         |                  Description                  |
| :-------: | :--------------------------------------------------: | :-------------------------------------------: |
| `session` |     [SessionDocument](../../schemas/session.md)      |       The session document at this ID.        |
| `scores`  | Array&lt;[ScoreDocument](../../schemas/score.md)&gt; | The score documents involved in this session. |
|  `songs`  |  Array&lt;[SongDocument](../../schemas/song.md)&gt;  |  The songs these score documents belong to.   |
| `charts`  | Array&lt;[ChartDocument](../../schemas/chart.md)&gt; |  The charts these score documents belong to.  |
|  `user`   |        [UserDocument](../../schemas/user.md)         |       The user that made this session.        |

### Example

#### Request

```
GET /api/v1/sessions/Qe7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b
```

#### Response

```js
{
	user: {
		id: 1,
		username: "zkldi",
		// ...
	},
	session: {
		sessionID: "Qe7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b",
		scores: [{
			scoreID: "foo",
			// ...
		}],
		name: "my session",
		// ...
	},
	scores: [{
		scoreID: "foo",
		songID: 1,
		chartID: "foo_chartID",
	}],
	songs: [{
		id: 1,
		// ...
	}],
	charts: [{
		chartID: "foo_chartID",
		songID: 1
		// ...
	}]
}
```

---

## Modify a session

`PATCH /api/v1/sessions/:sessionID`

### Permissions

- customise_session
- Must be the owner of this session.

### Parameters

|        Property        |  Type   |                                                                Description                                                                |
| :--------------------: | :-----: | :---------------------------------------------------------------------------------------------------------------------------------------: |
|   `name` (optional)    | String  |    A new name for this session. This must be between 3 and 80 characters. If not present, no update will be made to the session name.     |
|   `desc` (optional)    | String  | A new description for this session. This must be between 3 and 120 characters. If not present, no update to the description will be made. |
| `highlight` (optional) | boolean |               Whether this session is highlighted or not. If not present, no change will be made to the highlighted status.               |

!!! info
Although all these fields are optional, making a request
without any of them is a 400 error.

### Response

| Property |                    Type                     |                  Description                   |
| :------: | :-----------------------------------------: | :--------------------------------------------: |
| `<body>` | [SessionDocument](../../schemas/session.md) | The new session document, after modifications. |

### Example

#### Request

```
PATCH /api/v1/sessions/Qe7b00261b1d3ba8e5c9ee4e76e77ea9f07d9493b
```

```json
{
	"name": "new session name"
}
```

#### Response

```json
{
	"name": "new session name",
	"desc": "old session desc",
	"highlighted": false
	// ...
}
```
