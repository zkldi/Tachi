# API Client Management

These endpoints relate to managing your Tachi API clients, such as creating new ones or deleting them.

For a detailed explaination on how to use the OAuth2 flow, you can check [Using OAuth2 With Tachi](../../codebase/infrastructure/oauth2.md).

*****

!!! warning
	All endpoints on this list require [Self Key](./user-integrations.md) level authentication.

	That is to say, it cannot be performed using Bearer tokens, and must be done by the user themselves.

*****

## Retrieve all clients you have created.

`GET /api/v1/clients`

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Array&lt;OAuth2ClientDoc&gt; | All of the OAuth2 clients you have created. |

### Example

#### Request
```
GET /api/v1/clients
```

#### Response

```json
[{
	"name": "My Client",
	"clientID": "blah",
	"clientSecret": "secret!!",
	"requestPermissions": ["customise_profile"],
	"author": 1,
	"redirectUri": "https://example.com/callback",
}, 
	// ...
]
```

*****

## Create a new OAuth2 Client

`POST /api/v1/clients/create`

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `name` | String | A string between 3 and 80 characters. The name for this client. |
| `redirectUri` | Optional String (Valid URI) | Must be a HTTP/HTTPS URL, This is where users will be sent to after clicking Yes on the prompt. |
| `webhookUri` | Optional String (Valid URI) | Must be a HTTP/HTTPS URL. Registers this URL as a URL that wants webhook events to be sent to it. Read more about webhooks [here](../webhooks/main.md). |
| `apiKeyFormat` | Optional String | If present, this sets an expected format for the API Key in [Client File Flow](../../codebase/infrastructure/file-flow.md). Must contain %%TACHI_KEY%%. |
| `apiKeyFilename` | Optional String | If present, this sets a filename fir [Client File Flow](../../codebase/infrastructure/file-flow.md). |
| `permissions` | Array&lt;Permissions&gt; | An array of permissions this client requests. You can check all permissions [here](../auth.md). |

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | OAuth2ClientDoc | The OAuth2Client you just created. |

### Example

#### Request
```
POST /api/v1/clients/create

{
	"name": "My Client",
	"redirectUri": "https://example.com/callback",
	"permissions": ["customise_profile"]
}
```

#### Response

```json
{
	"name": "My Client",
	"redirectUri": "https://example.com/callback",
	"webhookUri": null,
	"requestedPermissions": ["customise_profile"],
	"clientID": "foobar",
	"clientSecret": "secret_val",
	"apiKeyFormat": null,
	"apiKeyFilename": null
}
```

*****

## Retrieve information about a client

`GET /api/v1/clients/:clientID`

This is used to display information about this client to the user, when they are deciding on whether to authenticate it.

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | OAuth2ClientDoc without clientSecret | The client document at this ID. |

### Example

#### Request
```
GET /api/v1/clients/some_client_id
```

#### Response
```json
{
	"name": "My Client",
	"redirectUri": "https://example.com/callback",
	"webhookUri": null,
	"requestedPermissions": ["customise_profile"],
	"clientID": "foobar",
	"clientSecret": "secret_val",
	"apiKeyFormat": null,
	"apiKeyFilename": null
}
```

*****

## Modify existing client

`PATCH /api/v1/clients/:clientID`

### Permissions

- Must be the owner of this client.

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `name` | String | A string between 3 and 80 characters. |
| `webhookUri` | String | A new webhookUri. |
| `redirectUri` | String | A new redirectUri. |
| `apiKeyFormat` | String | A new apiKeyFormat. |
| `apiKeyFilename` | String | A new apiKeyFilename. |


!!! note
	If you need to change permissions, you must make another client.

	Also, all the above properties are optional. If not present, they will not be changed.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | OAuth2ClientDoc | The new client document with the patched changes applied. |

### Example

#### Request
```
PATCH /api/v1/clients/some_client_id

{
	"name": "new name!"
}
```

#### Response

```json
{
	"name": "new name",
	"clientID": "some_client_id",
	// ... same props as in previous responses
}
```

*****

## Reset your client's secret.

`POST /api/v1/clients/:clientID/reset-secret`

!!! warning
	This does **NOT** reset api keys created by this client as per OAuth2 spec.
	
	If you need that functionality, you will need to delete
	your client.

### Permissions

- Must be the owner of this client.

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | OAuth2ClientDoc | The new client document with the new secret. |

### Example

#### Request
```
POST /api/v1/clients/some_client_id/reset-secret
```

#### Response
```json
{
	"name": "some client",
	"clientID": "some_client_id",
	"clientSecret": "FRESHLY_GENERATED_SECRET!",
	// ... more props
}
```

*****

## Delete your client.

`DELETE /api/v1/clients/:clientID`

### Permissions

- Must be the owner of this client.

### Parameters

None.

### Response

Empty Object.
