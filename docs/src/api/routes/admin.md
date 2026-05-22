# Admin Endpoints

These endpoints are for adminstrator use. As such, they all
require an `authLevel` of at least 3. For more information, see the [UserDocument](../../schemas/user.md).

*****

## Change Server Log Level

`POST /api/v1/admin/change-log-level`

### Permissions

- Admin

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `logLevel` | "crit" \| "severe" \| "warn" \| "info" \| "verbose" \| "debug" | The log level to change to. |
| `duration` | Number, Optional | How long to keep this change for in minutes. If not set, defaults to 60 minutes. |
| `noReset` | Boolean, Optional | If true, do not ever reset this log level change. |

### Response

Empty Object.

### Example

#### Request
```
POST /api/v1/admin/change-log-level

{
	duration: 5,
	logLevel: "verbose"
}
```

#### Response

Empty Object.

*****

## Delete any Score

This performs all the necessary checks to remove a score document aswell.

`POST /api/v1/admin/delete-score`

### Permissions

- Admin

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `scoreID` | String | The scoreID to delete. |

### Response

Empty Object.

*****

## Re-run PB processing for every scored user+chart (synchronous).

`POST /api/v1/admin/recalc-pbs`

Inserts every distinct `(user_id, chart_id)` from the **`score`** table into **`pb_dirty`**, then **drains** `pb_dirty` and downstream **`session_dirty`** / **`game_profile_dirty`** queues until nothing remains (same batching as the background worker, but the HTTP request waits until idle). Intended when PBs may be out of sync (e.g. after a bad migration). There is **no request body** and no filter-always all distinct pairs that appear on scores.

### Permissions

- Admin

### Parameters

None (send `{}` if your client requires a body).

### Response

Empty object (standard success wrapper with `body`).

### Example

#### Request

```
POST /api/v1/admin/recalc-pbs
```

```js
{}
```

#### Response

```js
{}
```

*****

## Destroy a users GPT Profile and forces a leaderboard recalc.

`POST /api/v1/admin/destroy-ugpt`

!!! warning
	This is intended to completely remove a users GPT profile.
	You should use this **only** if a user has irrevocably screwed
	their account. Preferably early on!

### Permissions

- Admin

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `userID` | Integer | The user part of the UGPT. |
| `game` | Game | The game part of the UGPT. |
| `playtype` | Playtype | The PT part of the UGPT. Must be for the above game. |

### Response

Empty Object.

### Example

#### Request
```
POST /api/v1/admin/destroy-ugpt
```

```js
{
	"userID": 1,
	"game": "iidx",
	"playtype": "DP"
}
```

#### Response

Empty Object.

*****

## Destroy a chart and all of its scores.

`POST /api/v1/admin/destroy-chart`

### Permissions

- Admin

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `chartID` | String | The chartID you wish to destroy. |
| `game` | Game | The game this chart belongs to (Necessary for lookups). |

### Response

Empty Object.

### Example

#### Request
```
POST /api/v1/admin/destroy-chart
```
```js
{
	"chartID": "SomeChartID",
	"game": "iidx"
}
```

#### Response

Empty Object.

*****

## Re-derive all scores site-wide (synchronous).

`POST /api/v1/admin/recalc`

Enqueues **every chart** into **`score_rederive`**, then **drains** `score_rederive` and downstream **`pb_dirty`**, **`session_dirty`**, and **`game_profile_dirty`** queues until nothing remains (the request waits until idle). Re-runs `scoreDeriver` and `scoreCalcs` for every score. There is **no request body** and no filter-always all charts.

### Permissions

- Admin

### Parameters

None (send an empty JSON object `{}` if your client requires a body).

### Response

Empty object (standard success wrapper with `body`).

### Example

#### Request

```
POST /api/v1/admin/recalc
```

```js
{}
```

#### Response

```js
{}
```
