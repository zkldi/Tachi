# Import Scores

*****

## Import scores from a file.

```POST /api/v1/import/file```

Perform a score import that depends on a file, such as a .csv import.

### Permissions

- `submit_score`

### Parameters

This endpoint expects data in `multipart/form-data` form.
This is because we're handling file imports, and is the
appropriate way to send files.

| Property | Type | Description |
| :: | :: | :: |
| `importType` | String | The ImportType this import is for. This only accepts `file/` [ImportTypes](../../codebase/import/import-types.md). |
| `scoreData` | File | The file to import scores from. |

| HTTP Header | Description |
| :: | :: |
| `X-User-Intent` (optional) | If this header is "true", the request is assumed to have been sent with 'User Intent'. For more on this, see [Import Types](../../codebase/import/import-types.md) |

!!! info
	It's the responsibility of the API user to use the X-User-Intent
	header properly. It should only be used when the user
	has explicitly requested this import (i.e. not sent by an automated script).

### Response

**Implementation Dependent**.
There are two reponse scenarios for this endpoint, depending on whether the server uses an external score processor or not.

#### External Score Processor Response

If an external score processor is being used, **202** is returned as a status code, and you are given the following:

| Property | Type | Description |
| :: | :: | :: |
| `url` | String | A URL to poll for information about this import, while it's being processed. |
| `importID` | String | The ID of the import currently being processed. |

#### Internal Score Processor Response

If score processing is not done externally, the following is returned:

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | ImportDocument | The import document created as a result of this import. |

### Example

#### Request
```
POST /api/v1/import/file
```

```
// this is not actually a multipart http request example
// as those are huge.

importType="file/eamusement-iidx-csv"
scoreData=<file data>
```

#### Response

```js
{
	"importType": "file/eamusement-iidx-csv",
	"idStrings": [
		"iidx:SP"
	],
	"scoreIDs": [
		"R6fad5f4947454d8238b45d6a1255d63be4da1130bf91fe9d05df29765a148da8"
	],
	"errors": [],
	"importID": "bea63277b54a5846bab1fd3a6ce54bfd41276857",
	"timeFinished": 1623352263023,
	"timeStarted": 1623352260445,
	"createdSessions": [
		{
			"sessionID": "Qb336d6b1cc0930747f161769a13238a41dce0004",
			"type": "Created"
		}
	],
	"userID": 1,
	"classDeltas": [],
	"goalInfo": [],
	"questInfo": [],
	"userIntent": false, // if X-User-Intent was set, this would be true.
}
```

**OR**

```js
{
	url: "https://boku.tachi.ac/api/v1/imports/SOME_IMPORT_ID/poll-status",
	importID: "SOME_IMPORT_ID"
}
```

*****

## Synchronise scores up with an API.

`POST /api/v1/import/from-api`

This endpoint requests scores from an API to sync up with the requesting user's profile. This can
be performed programmatically, as long as the key has `submit_score` permissions.

!!! note
	The user must configure integration with these services up.

### Permissions

- `submit_score`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `importType` | Any Supported API Import Type | The importType this synchronisation is for. |

### Response

**Implementation Dependent**.
There are two reponse scenarios for this endpoint, depending on whether the server uses an external score processor or not.

#### External Score Processor Response

If an external score processor is being used, **202** is returned as a status code, and you are given the following:

| Property | Type | Description |
| :: | :: | :: |
| `url` | String | A URL to poll for information about this import, while it's being processed. |
| `importID` | String | The ID of the import currently being processed. |

#### Internal Score Processor Response

If score processing is not done externally, the following is returned:

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | ImportDocument | The import document created as a result of this import. |

### Example

#### Request
```
POST /api/v1/import/from-api

{
	importType: "api/flo-iidx"
}
```


#### Response

See previous example.

*****

## Force Tachi to reprocess your orphanned scores.

`POST /api/v1/import/orphans`


This endpoint goes through all of the requesting user's [Orphanned Scores](../../codebase/import/orphans.md) and attempts to find them a parent song & chart.

!!! note
	Scores automatically attempt de-orphaning every day at 1 AM UTC on Kamaitachi and Bokutachi,
	this endpoint just allows you to force a deorphaning, should you wish to.

### Permissions

- submit_score

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `processed` | Integer | The amount of orphans processed. |
| `failed` | Integer | The amount of orphans that did not find a parent chart, and were kept as orphans. |
| `success` | Integer | The amount of orphans that successfully found a parent chart, and were turned into real scores. |
| `removed` | Integer | The amount of orphans removed -- They found a parent chart, but were rejected by the converter for being invalid scores, such as having unsupported options or impossible score values. |

### Example

#### Request

N/A

#### Response

```js
{
	"processed": 100,
	"failed": 95,
	"success": 2,
	"removed": 3
}
```

*****

## List your orphaned scores

`GET /api/v1/import/orphans`

Returns rows from `orphan_score` for the authenticated user (scores that failed with SongOrChartNotFound and were persisted for later matching). Newest rows are returned first.

### Permissions

- submit_score

### Query parameters

| Parameter | Type | Description |
| :: | :: | :: |
| `limit` | Integer (optional) | Page size, 1–100. Default `50`. |
| `after` | String (optional) | Keyset cursor: the `rowID` from the last orphan in the previous page. Omit on the first request. |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `orphans` | Array | Each object includes `orphanID`, `rowID`, `importType`, `gameGroup`, `timeInserted` (ms), `message` (nullable), `summary` (nullable, best-effort hint from stored data). |
| `hasMore` | Boolean | Whether another page exists after this one. |

*****

## Get one orphaned score (full payload)

`GET /api/v1/import/orphans/:orphanID`

Returns a single `orphan_score` row for the authenticated user, including raw `data` and `context` JSON (for debugging unmatched imports). `404` if the row does not exist or belongs to another user.

### Permissions

- submit_score

### Parameters

| Parameter | Type | Description |
| :: | :: | :: |
| `orphanID` | Path | The orphan’s `orphanID` (same as in `GET /import/orphans` or import errors). |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `orphanID` | String | Stable orphan identifier. |
| `importType` | String | Import type that produced the orphan. |
| `gameGroup` | String | Game group. |
| `timeInserted` | Number | Unix time in ms when the row was stored. |
| `message` | String or null | Stored error / context message. |
| `data` | Object | Raw import datapoint (shape depends on `importType`). |
| `context` | Object | Raw import context. |

*****

## Delete one orphaned score

`DELETE /api/v1/import/orphans/:orphanID`

Removes a single `orphan_score` row **only if** it belongs to the authenticated user. Use this when you no longer want Tachi to keep or retry a given orphan (for example after a bad import).

### Permissions

- submit_score

### Parameters

| Parameter | Type | Description |
| :: | :: | :: |
| `orphanID` | Path | The orphan’s `orphanID` (for example from an import error or from `GET /import/orphans`). |

### Response

Empty body on success (`success: true`). `404` if no such orphan exists for this user.
