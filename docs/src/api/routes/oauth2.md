# OAuth2 Integration

Tachi provides an OAuth2 API and some other things
so that you can create your own clients and retrieve
user api keys safely.

For a detailed explaination on how to use the OAuth2 flow, you can check [Using OAuth2 With Tachi](../../codebase/infrastructure/oauth2.md)

*****

## Convert Auth Code to API Key

`POST /api/v1/oauth/token`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `client_id` | String | Your clients ID. |
| `client_secret` | String | Your clients secret. |
| `grant_type` | "authorization_code" | This is the only form of grant_type we currently support. |
| `redirect_uri` | String | The redirect URI your client uses. This must match the one in your client. |
| `code` | String | The intermediate auth code to convert up into an API Key. |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | APIKeyDocument | The APIKeyDocument created for your service to use. |

### Example

#### Request
```
POST /api/v1/oauth/token
---
{
	"client_id": "my_client_id",
	"client_secret": "some_secret_value!",
	"grant_type": "authorization_code",
	"redirect_uri": "https://example.com/callback",
	"code": "intermediate_code"
}
```

#### Response

```json
{
	"userID": 1,
	"token": "fdbufasbfuarf",
	"identifier": "Your_Service Token",
	"permissions": {
		"customise_profile": true
	},
	"fromAPIClient": "my_client_id"
}
```

*****

## Create an intermediate Code

`POST /api/v1/create-code`

!!! info
	This infers the current user from the session cookie.

	This is *not* meant to be called by external code, and
	is instead something for `tachi-client` to use on the oauth confirmation screen.

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `code` | String | The intermediate code. |
| `userID` | Integer | The user this code belongs to. |
| `createdOn` | Number | The time in unix milliseconds that this code was created. |

!!! warning
	These codes expire around 30 minutes from their creation.

### Example

#### Request
```
POST /api/v1/oauth/create-code
```

#### Response
```json
{
	"code": "foobarbarhsdufh",
	"userID": 1,
	"createdAt": 111111111111
}
```
