# Status Checks

These endpoints are generally for programmers checking their code works.
They can also be used to check the status of the server.

*****

## Check server status.

```GET /api/v1/status```

This endpoint is a status check for the API and the consumer,
It's a good way of sanity checking whether your code works.

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `echo` | String | A string to echo. This is useful for checking whether parameters are sending over properly. |


### Response

| Property | Type | Description |
| :: | :: | :: |
| `serverTime` | Integer | The current time of the server in Unix Milliseconds. |
| `startTime` | Integer | The time this server was booted in Unix Milliseconds. |
| `whoami` | Integer \| null | The userID you are authenticated as. If you are not authenticated, this is null. |
| `version` | String | The current version of Tachi-Server running. |
| `permissions` | Array&lt;string&gt; | The permissions this request had. |
| `echo` (Conditional) | String | If an `echo` parameter was provided, this is that exact parameter. |

### Example

`GET /api/v1/status?echo=helloworld`

```json
{
	"serverTime": 1623331110661,
	"version": "v2.0.0 (Mysterons)",
	"permissions": ["score_submit", "example_permission"],
	"echo": "helloworld"
}
```

*****

## Check server status with POST.

```POST /api/v1/status```

This endpoint is identical to `GET /status`, but it responds to POST requests,
and takes the `echo` parameter from the request body.

This is a good way to check whether your code sends JSON
bodies properly.

### Example

```json
POST /api/v1/status
```
```
{
	"echo": "hello world"
}
```

```json
{
	"serverTime": 1623331110662,
	"version": "v2.0.0 (Mysterons)",
	"permissions": ["score_submit", "example_permission"],
	"echo": "hello world"
}
```