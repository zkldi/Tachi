# Users

These endpoints are related to users in general.

---

## List Users

`GET /api/v1/users`

### Parameters

|      Property       |   Type   |                                              Description                                               |
| :-----------------: | :------: | :----------------------------------------------------------------------------------------------------: |
| `online` (Optional) | Presence |             If present, this limits the returned users to those that are currently online.             |
| `search` (Optional) |  String  | If present, this endpoint will only return users where this string is contained within their username. |

### Response

| Property |                        Type                        |              Description               |
| :------: | :------------------------------------------------: | :------------------------------------: |
| `<body>` | Array&lt;[UserDocument](../../schemas/user.md)&gt; | The array of up to 100 users returned. |

!!! note
Users are guaranteeably returned in order of when they were `lastSeen`.

### Example

#### Request

```
GET /api/v1/users
```

#### Response

```js
[
	{
		id: 1,
		username: "zkldi",
		// ... continued
	},
];
```

---

## Retrieve user with ID

`GET /api/v1/users/:userID`

!!! note
The :userID param has some special functionality,
and any time you see it in these docs, that
functionality is supported.

    You may pass the integer userID for this user - 1.
    You may also pass the username - zkldihis is also case-insensitive, so you could pass zklzkldi
    You may also pass the special string - `me` - which
    will select whatever user you are authenticated as.

### Parameters

None.

### Response

| Property |                 Type                  |                Description                |
| :------: | :-----------------------------------: | :---------------------------------------: |
| `<body>` | [UserDocument](../../schemas/user.md) | The user this ID/username corresponds to. |

### Example

!!! note
`zk` is the username for the user with userID 1.

    it's also the username of the person writing these
    docs. Hi!

#### Request

```
GET /api/v1/users/zkldi
OR
GET /api/v1/users/1
OR
GET /api/v1/users/zkldit's case insensitive!)
OR
GET /api/v1/users/me IF authenticated as userID 1.
```

#### Response

```js
{
	id: 1,
	username: "zkldi
	// ... so on
}
```

---

## Modify this user document.

`PATCH /api/v1/users/:userID`

### Permissions

- Self-Key level authentication as this user.

### Parameters

|                           Property                           |      Type      |                                  Description                                  |
| :----------------------------------------------------------: | :------------: | :---------------------------------------------------------------------------: |
|                           `about`                            |     String     |                  An about me. This is rendered as markdown.                   |
|                           `status`                           | String \| Null |                The users status. If null, this will be unset.                 |
| `discord`, `twitter`, `github`, `steam`, `youtube`, `twitch` | String \| Null | Information about this users social media. If null, this field will be unset. |

### Response

| Property |                 Type                  |                     Description                      |
| :------: | :-----------------------------------: | :--------------------------------------------------: |
| `<body>` | [UserDocument](../../schemas/user.md) | The user document with all of those changes applied. |

### Example

#### Request

```js
{
	"about": "#Hello!**I'm zkldi,
	"status": "I'm cool!",
	"twitter": null,
	"steam": "zkldi
}
```

#### Response

```js
{
	"id": 1,
	"username": "zkldi
	"usernameLowercase": "zkldi
	"socialMedia": {
		"twitter": null,
		"steam": "zkldi
		// this property was already here, and not modified by the request.
		"discord": "chatbpd",
	},
	"about": "#Hello!**I'm zkldi,
	"status": "I'm cool!",
	// and other user props...
}
```

---

## Retrieve user's statistics on all games.

`GET /api/v1/users/:userID/game-stats`

### Parameters

None.

### Response

| Property |                         Type                         |                 Description                 |
| :------: | :--------------------------------------------------: | :-----------------------------------------: |
| `<body>` | Array&lt;UserGameStatsDocument & \_\_rankingData&gt; | The array of User Game Stats this user has. |

!!! info
For UI reasons, the UserGameStatsDocuments here have an additional `__rankingData` property, which contains leaderboard ranking information for this user.

### Example

#### Request

```
GET /api/v1/users/zkldime-stats
OR
GET /api/v1/users/1/game-stats
```

#### Response

```js
[
	{
		userID: 1,
		game: "iidx",
		playtype: "SP",
		ratings: {
			ktRating: 15,
		},
		classes: {
			dan: 14,
		},
		__rankingData: {
			ktRating: {
				ranking: 15,
				outOf: 74,
			},
			BPI: {
				ranking: 12,
				outOf: 74,
			},
		},
	},
	{
		userID: 1,
		game: "gitadora",
		playtype: "Dora",
		ratings: {
			skill: 1404,
		},
		classes: {
			skillColour: 1,
		},
		__rankingData: {
			skill: {
				ranking: 199,
				outOf: 202,
			},
		},
	},
];
```

!!! info
In the event a user has played no games, this will
return an empty array.

---

## Change Profile Picture

`PUT /api/v1/users/:userID/pfp`

### Permissions

- customise_profile
- Must be the owner of this profile.

### Parameters

| Property |    Type     |           Description           |
| :------: | :---------: | :-----------------------------: |
|  `pfp`   | JPG, or PNG | The new profile picture to set. |

!!! note
This endpoint expects multipart form data.

### Response

| Property |  Type  |                        Description                         |
| :------: | :----: | :--------------------------------------------------------: |
|  `get`   | String | This contains the URL to then GET the new profile picture. |

### Example

#### Request

```
PUT /api/v1/users/1/pfp
```

```
// this is not a real multipart request, as those things
// are huge!
pfp=<somefiledata>
```

#### Response

```json
{
	"get": "/api/v1/users/1/pfp"
}
```

---

## Get a user's profile picture.

`GET /api/v1/users/:userID/pfp`

### Parameters

None.

### Response

**Not JSON**. This returns the actual JPG or PNG stored for
this user.

### Example

N/A

---

## Unset your profile picture.

`DELETE /api/v1/users/:userID/pfp`

!!! note
If you do not have a profile picture set, this will be
a 404 error.

### Permissions

- customise_profile
- Must be the owner of this profile.

### Parameters

None.

### Response

None.

### Example

Self-explanatory.

---

## Change Profile Banner

`PUT /api/v1/users/:userID/banner`

### Permissions

- customise_profile
- Must be the owner of this profile.

### Parameters

| Property |    Type     |          Description           |
| :------: | :---------: | :----------------------------: |
| `banner` | JPG, or PNG | The new profile banner to set. |

!!! note
This endpoint expects multipart form data.

### Response

| Property |  Type  |                        Description                        |
| :------: | :----: | :-------------------------------------------------------: |
|  `get`   | String | This contains the URL to then GET the new profile banner. |

### Example

#### Request

```
PUT /api/v1/users/1/banner
```

```
// this is not a real multipart request, as those things
// are huge!
banner=<somefiledata>
```

#### Response

```json
{
	"get": "/api/v1/users/1/banner"
}
```

---

## Get a user's profile banner.

`GET /api/v1/users/:userID/banner`

### Parameters

None.

### Response

Not JSON. This returns the actual JPG or PNG stored for
this user.

### Example

N/A

---

---

## Unset your profile banner.

`DELETE /api/v1/users/:userID/banner`

!!! note
If you do not have a profile banner set, this is
a 404 error.

### Permissions

- customise_profile
- Must be the owner of this profile.

### Parameters

None.

## Retrieve your notifications

`GET /api/v1/users/:userID/notifications`

### Permissions

- Must be a session-request from the user who owns these notifications.

!!! note
All of the notification endpoints must be accessed by session-level authentication
from the right requesting user; viz. no api keys can access these endpoints, and
nobody can read another players notifications.

    This isn't really for any security reasons, but more for privacy reasons. It feels
    wrong to be able to let others read others notifications.

### Parameters

None.

### Response

| Property |               Type                |                                     Description                                      |
| :------: | :-------------------------------: | :----------------------------------------------------------------------------------: |
| `<body>` | Array&lt;NotificationDocument&gt; | An array of all of this users notifications, sorted by most recently recieved first. |

---

## Mark all of your notifications as read.

`POST /api/v1/users/:userID/notifications/mark-all-read`

!!! info
This endpoints marks all of a users notifications as read, and is intended for a UI
to invoke this request when they open their inbox.

### Permissions

- Must be a session-level request from the user who owns these notifications.

### Parameters

None.

### Response

None. (Empty Object)

---

## Clear all notifications from your inbox.

`POST /api/v1/users/:userID/notifications/delete-all`

### Permissions

- Must be a session-level request from the user who owns these notifications.

### Parameters

None.

### Response

None. (Empty Object)
