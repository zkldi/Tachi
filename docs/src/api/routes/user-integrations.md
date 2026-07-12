# User Integrations

These endpoints are related to a users integrations with external services.

*****

## Retrieve whether this user is authenticated with this kaiType.

`GET /api/v1/users/:userID/integrations/kai/:kaiType`

**Kamaitachi Only**

!!! note
	A KaiType is either "flo", "min", or "eag". Since these three services
	share backends, they all use the same authentication mechanisms, and share
	endpoints like this.

### Permissions

- Self-key: This request must be made using Cookie authentication, which means it cannot be used with API keys.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `authStatus` | boolean | True if the user is authenticated with this kaiType, false if they are not. |

### Example

#### Request
```
GET /api/v1/users/1/integrations/kai/flo
```

#### Response

```js
{
	authStatus: false
}
```

*****

## Revoke this user's authentication with this kaiType

`DELETE /api/v1/users/:userID/integrations/kai/:kaiType`


**Kamaitachi Only**

!!! note
	A KaiType is either "flo", "min", or "eag". Since these three services
	share backends, they all use the same authentication mechanisms, and share
	endpoints like this.

### Permissions

- Self-key: This request must be made using Cookie authentication, which means it cannot be used with API keys.

### Parameters

None.

### Response

Empty Object.

*****

## Update a user's access_token and refresh_token from an intermediate code.

`POST /api/v1/users/:userID/integrations/kai/:kaiType/oauth2callback`

**Kamaitachi Only**

!!! info
	This is used as part of an [OAuth2 Flow](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2).

	The client controls the callback link after authentication with the service, and then POSTs the returned `code` to us.
	This part of the flow actually updates the user.

### Permissions

- Self-key

### Parameters

| Property | Type | Description |
| :: | :: | :: |
| `code` | String | The intermediate code to use to get the access_token and refresh_token. |

### Response

Empty object for body. 200 on success, not 200 on failure - status code depending on error.

### Example

#### Request
```js
{
	code: "This_Is_An_1nT3rMeDIate_Code"
}
```

#### Response

```js
{}
```
