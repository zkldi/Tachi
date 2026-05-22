# Import Document Endpoints

!!! note
	This should not be confused with [Import Endpoints](./import.md). Those are for 
	importing scores, whereas these endpoints are for Import Document interaction.

*****

*****

## Retrieve an import document and information about it.

`GET /api/v1/imports/:importID`

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `scores` | Array&lt;ScoreDocument&gt; | All of the scores imported from this import. |
| `songs` | Array&lt;SongDocument&gt; | All of the songs related to the scores in this import. |
| `charts` | Array&lt;ChartDocument&gt; | All of the charts related to the scores in this import. |
| `sessions` | Array&lt;SessionDocument&gt; | All of the sessions created as a result of this import. **Note that this does not include sessions modified by this import!** |
| `import` | ImportDocument | The Import document you requested. |
| `user` | UserDocument | The user document for the person who made this import. |

*****

## Revert an import.

`POST /api/v1/imports/:importID/revert`

!!! info
	This endpoint is intended to *undo* a faulty import. For example, if you were using
	a batch-manual script that somehow went haywire. Normal users should *not* need to
	use this, but it is on the UI regardless incase they cause catastrophic failure.

!!! warning
	Reverting an import is equivalent to undoing all of the scores that were imported as
	a result of the import. This, however, does not necessitate that classes will be
	reverted, such as if the import also declared you as kaiden -- that currently requires
	manual moderator intervention.

### Permissions

- delete_score
- Must be the owner of this import (Or a server administrator).

### Parameters

None.

### Response

None. (Empty Object)

*****

## Poll an ongoing import

`GET /api/v1/imports/:importID/poll-status`

!!! question
	The reason we can't directly respond with import info is that `tachi-server` **may**
	use a feature called SCORE_IMPORT_WORKERS. This dedicates score processing to separate
	processes which communicate back with any parent server. This means that the result of
	an import processed on one server may be returned by another.

	This feature is enabled on our instances of `tachi-server` -- Boku and Kamai, which
	means you will have to poll this endpoint.

!!! info
	You are intended to poll this endpoint every one second or so. Do it until
	`body.importStatus` is "completed".

!!! tip
	`body.progress.description` is human-friendly output, you can render it to
	a client on every ping in the case where `body.importStatus` is "ongoing".

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `importStatus` | "completed" \| "ongoing" | If this is equal to completed, the import is finished and the importDocument is returned under `import` . If this is "ongoing", a `progress` key will display information and progress though the import |
| `progress` | `{ description: string }` \| Not Present | If `importStatus` is "ongoing", this will contain a string `description` of where in the import process this import is. |
| `import` | ImportDocument \| Not Present | If `importStatus` is "completed", this will contain the import document that was just inserted into the database. |

### Example

#### Request
```
GET /api/v1/imports/my_import_id/poll-status
```

#### Response

```js
{
	importStatus: "ongoing",
	progress: {
		description: "Imported 1832 Scores..."
	}
}
```

Alternatively,

```js
{
	importStatus: "completed",
	import: {
		importID: "my_import_id",
		scoreIDs: ["foo", "bar"],
		// ... more import props
	}
}
```