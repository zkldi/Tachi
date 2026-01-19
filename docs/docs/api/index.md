# API Overview

Tachi exposes a public API which allows programs to interact with Tachi.

This means you could make your own applications that work off of Tachi's
datasets.

!!! warning
This documentation assumes some basic programming knowledge, such as how to make
HTTP requests, and how to parse JSON.

Depending on what variant of Tachi you want to interact with, the API is hosted
on `https://kamai.tachi.ac/api/v1` or `https://boku.tachi.ac/api/v1`.

!!! note
Some API endpoints are only available on Kamaitachi or Bokutachi. If an
endpoint has this restriction, it will be documented on that endpoints'
page.

---

## Abuse

The Tachi API is provided under the assumption that it will be used to make
cool things, and used responsibly.

Abuse of this API will result in your ability to use it being banned.

The API has a rate limit of 500 requests every minute. This is a very
generous rate limit, and you should not even be close to hitting it.

If you are in a scenario where you might be hitting even 100 requests a minute consistently,
send an email to `zk@tachi.ac` and let me know what you're up to. Otherwise, I might revoke your tokens for abuse.

## License

[Tachi-Server](https://github.com/zkldi/Tachi/tree/main/server) (Where the API is written) is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html).

To quote GitHub:

!!! quote
Permissions of this strongest copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. When a modified version is used to provide a service over a network, the complete source code of the modified version must be made available.

This is not legal advice.

## Requests

Unless otherwise mentioned, all non-GET request properties should be sent to the API in `application/json` form.

GET request properties should be sent to the API in the Query String.

Your authentication tokens should be sent in the HTTP `Authorization` header, using `Bearer token` form.

You should provide this token for every endpoint. Even though not all endpoints
require authentication tokens, they are still used for API analytics.

## Response

Unless otherwise mentioned, all responses to the API are in `application/json` form.

The API has two schemas for JSON responses.

### Success Response

As the name implies, the Success Response is returned on a successful request.

|   Property    |        Type        |                                          Description                                          |
| :-----------: | :----------------: | :-------------------------------------------------------------------------------------------: |
|   `success`   |        true        |                            Always true for a successful response.                             |
| `description` |       String       |                       Information about what happened with the request.                       |
|    `body`     | Endpoint Dependent | Any data that the endpoint needs to return, such as a user's document from a profile request. |

The HTTP Status Code for any Success Response will always be of 2XX form.

### Failed Response

As the name implies, the Failed Response is returned when a request fails.

|   Property    |  Type  |                     Description                     |
| :-----------: | :----: | :-------------------------------------------------: |
|   `success`   | false  |         Always false for a failed response.         |
| `description` | String | Information about what went wrong with the request. |

The HTTP Status Code for any Failed Response will always be of either 4XX or 5XX form.

!!! warning
The `description` property is **NOT** intended for program usage. You should **NEVER** depend
on the output of `description`, as it may be changed at any time for any reason.

!!! note
Any API request can fail for any reason. You should always account for the
case where the request fails.

## Footnote

That should be everything. If you have any questions about the API, you can
contact me at `zk@tachi.ac`. You can also write an issue on the
[Issue Tracker](https://github.com/zkldichi). I'll get around to either.

It's entirely possible that I might've made a typo or wrote a poor explaination
of something, so please reach out!
