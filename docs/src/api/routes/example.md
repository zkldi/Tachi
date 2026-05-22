# Example Endpoint

_Endpoints will be formatted like this. - These are not real endpoints!_

---

## Greet a user.

`GET /api/v1/greet`

This endpoint greets the user.

### Permissions

_If permissions are required, they will be listed here._

- example_permission

### Parameters

_Parameters are required unless explicitly stated to be optional._

!!! note
As mentioned in API Overview, GET parameters are to be sent in the query string,
and all other methods are to have their content in the request body as
`application/json`.

|       Property        |   Type   |                Description                |
| :-------------------: | :------: | :---------------------------------------: |
|        `name`         |  String  |      The name of the user to greet.       |
| `birthday` (optional) | Presence | Whether it is the user's birthday or not. |

Not providing required parameters will result in a 400 error.

### Response

_Parameters are always present unless stated to be conditional/optional._

!!! info
The below properties correspond to keys in the `body`
property of a request.

    This means that the below table corresponds to
    ```json
    {
    	"success": true,
    	"description": "Greeted user.",
    	"body": {
    		"greeting": "Hello, zkldi!",
    		"wasBirthday": false,
    	}
    }
    ```

|   Property    |  Type   |                 Description                 |
| :-----------: | :-----: | :-----------------------------------------: |
|  `greeting`   | String  |          A greeting for the user.           |
| `wasBirthday` | Boolean | Whether today is the users birthday or not. |

!!! info
Since the above table corresponds to keys in the `body`
property of a request, the special property name
`<body>` refers to the body itself.

    For example:

    | Property | Type | Description |
    | :: | :: | :: |
    | `<body>` | String | The greeting. |

    Corresponds to:
    ```json
    {
    	"success": true,
    	"description": "Greeted user.",
    	"body": "Hello, zkldi
    }
    ```

### Example

#### Request

```
GET /greet?name=zkldi
```

#### Response

```json
{
	"greeting": "Hello, zkldi
	"wasBirthday": false
}
```

!!! warning
The example response is implicitly the `body` key of the API response.
That is to say that, the real response for this request is:

    ```json
    {
    	"success": true,
    	"description": "Greeted user.",
    	"body": {
    		"greeting": "Hello, zkldi
    		"wasBirthday": false
    	}
    }
    ```

    This is omitted, because it's redundant all of the time. -- That is to say,
    You should never depend on parsing the content of `description`.
