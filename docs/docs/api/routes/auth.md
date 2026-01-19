# Internal Authentication

These endpoints relate to internal authentication methods. Read the warning below.

!!! danger
This is **NOT** for external use. You should **NEVER**
be requesting a username and password from a user.

    Furthermore, interacting with this programmatically
    is near-impossible because you need to complete a CAPTCHA.

    Nevertheless, This is documented for completeness' sake.

!!! warning
All of these endpoints are aggressively rate limited. If you fire a bot at this, you will probably get
your IP blacklisted. Don't do that.

---

## Login with username and password.

`POST /api/v1/auth/login`

Logs a user in and returns a session cookie.

### Parameters

|  Property   |  Type  |                                        Description                                        |
| :---------: | :----: | :---------------------------------------------------------------------------------------: |
| `username`  | String |                 The user's username. This is compared case-insensitively.                 |
| `!password` | String |                                   The user's password.                                    |
|  `captcha`  | String | Information about the captcha filled out by the user. We use a Google ReCaptcha instance. |

!!! info
The `!` prefix is special in that anything with it is assumed to be private and is **always**
ignored by our request logger.

    Without it, we would log passwords!

### Response

| Property |  Type   |               Description                |
| :------: | :-----: | :--------------------------------------: |
| `userID` | Integer | The ID of the user you authenticated as. |

| HTTP Header  |                     Description                      |
| :----------: | :--------------------------------------------------: |
| `Set-Cookie` | Contains a session cookie for future authentication. |

### Example

#### Request

```
POST /api/v1/auth/login
```

```json
{
	"username": "zkldi",
	"!password": "my_password",
	"captcha": "herebedragons"
}
```

#### Response

```json
{
	"userID": 1
}
```

---

## Register a new account.

`POST /api/v1/auth/register`

### Parameters

|            Property            |                  Type                  |                                                     Description                                                      |
| :----------------------------: | :------------------------------------: | :------------------------------------------------------------------------------------------------------------------: |
|           `username`           |                 String                 | A string between 3 and 20 characters. The first character must be A-Z, _ or -. The other 19 may be A-Z, 0-9, _ or -. |
|          `!password`           |                 String                 |                                           An 8 character or longer string.                                           |
|            `email`             |                 String                 |                                                                                                                      |
| `inviteCode` (Kamaitachi Only) | String (Undefined/Unused on Bokutachi) |                                If on Kamaitachi, this is the user's invitation code.                                 |
|           `captcha`            |                 String                 |                                                                                                                      |

### Response

| Property |                 Type                  |               Description               |
| :------: | :-----------------------------------: | :-------------------------------------: |
| `<body>` | [UserDocument](../../schemas/user.md) | The newly-created user's User Document. |

### Example

#### Request

```
POST /api/v1/auth/register
```

```json
{
	"username": "newGuy",
	"!password": "my_password",
	"captcha": "herebedragons",
	"email": "test@example.com"
}
```

#### Response

```json
{
	"id": 2,
	"username": "newGuy",
	"usernameLowercase": "newguy",
	"socialMedia": {
		"discord": null,
		"twitter": null,
		"github": null,
		"steam": null,
		"youtube": null,
		"twitch": null
	},
	"joinDate": 1639628634978,
	"lastSeen": 1639628634978,
	"about": "I'm a fairly nondescript person.",
	"status": null,
	"customPfpLocation": null,
	"customBannerLocation": null,
	"clan": null,
	"badges": [],
	"authLevel": 1
}
```

---

## Verify an email from the code that was sent to it.

`POST /api/v1/auth/verify-email`

### Parameters

| Property |  Type  |                 Description                  |
| :------: | :----: | :------------------------------------------: |
|  `code`  | String | The Code that was sent to the users mailbox. |

### Response

Empty Object

### Example

#### Request

```
{
	"code": "abcdef1234567890"
}
```

#### Response

Empty Object.

---

## Resend a verification email to the requesting user's email address.

`POST /api/v1/auth/resend-verify-email`

**Requires Self-Key Level Auth**

### Parameters

None, This endpoint reads the requesting user from their session.

### Response

Empty object.

### Example

N/A

---

## Log Out.

`POST /api/v1/auth/logout`

Destroys the current session associated with this cookie.

### Parameters

None.

### Response

Empty Object.

### Example

#### Request

```
POST /api/v1/auth/logout
```

#### Response

Nothing.

---

## Create a password reset code and send it to the provided email.

`POST /api/v1/auth/forgot-password`

!!! note
This endpoint sends the password reset code pretty-printed to the email, and is **NOT**
returned as part of the HTTP request.

### Parameters

| Property |  Type  |                                                   Description                                                   |
| :------: | :----: | :-------------------------------------------------------------------------------------------------------------: |
| `email`  | String | A user's email. If the email does not correspond to any accounts, 202 is returned anyway as a security measure. |

### Response

Empty Object. The endpoint immediately returns 202 to avoid giving away information about registered emails.

### Example

#### Request

```js
{
	"email": "zkldiv@gmail.com"
}
```

#### Response

Although the request body returns nothing, `zkldiv@gmail.com` will have recieved an email with
a URL containing the password reset code.

---

## Reset a user's password with a password reset code.

`POST /api/v1/auth/reset-password`

### Parameters

|  Property   |  Type  |                            Description                             |
| :---------: | :----: | :----------------------------------------------------------------: |
|   `code`    | String | A password reset code. This is provided in a password reset email. |
| `!password` | String |                     The password to change to.                     |

### Response

Empty Object.

### Example

#### Request

```js
{
	"code": "1234567890abcdef",
	"!password": "zkldi_so_cool",
}
```

#### Response

Empty Object.
