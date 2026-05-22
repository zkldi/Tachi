# API Authorisation

Certain endpoints on the Tachi API require permissions.
This page covers how to present your permissions to the server, and what those permissions are.

*****

## Authorising Requests

There are two ways to authorise a request. The first one involves API keys.

### Token Authentication

To use authentication with a request, you should set a HTTP header of:

```
Authorization: Bearer API_KEY
```

Where API_KEY is the API key you wish to use.

### Self-Key Authentication

The other way to authorise a request is with your session cookie. This **MUST NOT** be used by code, and is instead a way for logged-in users to interact with the API as themselves.

To use authentication in this way, simply make a request with your `Kamaitachi_SESSION` or
`Bokutachi_SESSION` cookie.

The reason for this second authentication method is so that, when a user logs in, they can use
the cookie they were set to also interact with the API.

This type of authentication is referred to as "Self-Key" or "Session-Key" authentication, and it grants special
permissions over API Tokens, such as being able to change your password.

## Getting Tokens

You should make a Tachi API Client. With that, you can use [our OAuth2 Flow](../codebase/infrastructure/oauth2.md),
or our [Client File Flow](../codebase/infrastructure/file-flow.md).

## Permissions

An API key does not implicitly have permission to do anything on a users behalf for security reasons.
Some endpoints require specific permissions, such as a `score_submit` permission for submitting scores.

!!! warning
	API keys **can not** have their permissions altered once set, a new key must be generated.

!!! info
	Cookie-based authentication always has *all* permissions for the user.

### Table Of Permissions

The table of permissions is as follows.

| Permission | Description |
| :: | :: |
| `submit_score` | Perform requests that could submit scores for the user. |
| `customise_profile` | Perform requests that could modify user info, like their status or about me. |
| `customise_session` | Perform requests that could modify the users sessions, such as changing their names. |
| `customise_score` | Perform requests that could modify a users scores, such as adding a comment. |
| `delete_score` | Perform requests that could delete scores for that user. |
