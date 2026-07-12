# API Token Management

These endpoints relate to managing a users created API Tokens.
These tokens are likely to be generated from an OAuth2 integration, but in the future users may be able to create their own API Keys manually.

!!! note
	All of the below endpoints require [Self Key](../auth.md) level authentication. You cannot interact with these endpoints with Bearer auth.

*****

## Retrieve all API Tokens

`GET /api/v1/users/:userID/api-tokens`

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | APIKeyDocument | An array of APIKeyDocuments that belong to this user. |

### Example

#### Request
```
GET /api/v1/users/1/api-tokens
```

#### Response
```json
[{
	"identifier": "Fervidex Token",
	"token": "foobar",
	"permissions": {"submit_score": true},
	"userID": 1,
	"fromAPIClient": "FERVIDEX_OA2_CLIENT_ID"
}]
```

*****

## Delete a specific token.

`DELETE /api/v1/users/:userID/api-token/:token`

### Parameters

None.

### Response

Empty Object.

### Example

#### Request
```
DELETE /api/v1/users/1/api-token/foobar
```

#### Response
```json
{}
```

*****

## Create an API Token

`POST /api/v1/users/:userID/api-tokens/create`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `permissions` | Array&lt;String&gt; | An array of permissions you wish the key to have. |
| `clientID` | String | Alternatively, you can pass the clientID of an OAuth2 Client. This will select permissions based on what that client wants. |
| `identifier` | String | A humanised identifier for what the string was from. Necessary if using `permissions`. Filled out for you if using `clientID`.

!!! info
	If using ClientID for permissions, the clientID will be pinned to the
	token you've created as `fromAPIClient`. You can only have one
	API Token per OAuth2 client, and will get a 409 if you repeat the request.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | APITokenDocument | The API Token you created. |
