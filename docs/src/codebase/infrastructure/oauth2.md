# OAuth2 Flow

`tachi-server` has a functional implementation of OAuth2, which lets people create clients to request APIKeys from users.

This is the preferred way of handling authorisation between web applications, as it can be done without the user ever really having to deal with their API keys!

!!! note
	The below steps assume some familiarity with OAuth2. If you are not familiar, I find [this](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2) to be the best explaination.

We use an *almost* standard OAuth2 flow, but with the added react-app caveat of POSTing for an intermediate token. If that makes sense to you, you don't need to read this page!

## Process

In this scenario, we have two users, user A, who is making a service that integrates with Tachi, and user B, who wants to link integrate their service with their tachi profile.

!!! info
	In this example we will use `boku.tachi.ac` as the Tachi site name.

- An OAuth2 client is created by user A.

This client will have the following properties.

```json
{
	"clientID": "ABCDEF", // this is a random string in practice.
	"clientSecret": "GHIJKL", // this is another random string.
	"name": "Epic Games",
	"author": 1,
	"redirectUri": "https://epicgames.example.com/tachi-auth-callback",
	"requestedPermissions": ["customise_score"],
	"apiKeyFormat": null, // These are for the Client File Flow.
	"apiKeyFilename": null, // More on that later.
}
```

- User B wants to link their account to this service, and must click on an auth link on Tachi.

In the `tachi-client`, this link is `https://boku.tachi.ac/oauth/request-auth?clientID={clientID}`

EpicGames would show this link to the user, and they would click it.

While on Tachi, they are presented with the option to accept linking with `clientID`, or decline it.

- If they accept, `tachi-client` will make a POST request to `https://boku.tachi.ac/api/v1/oauth/create-code`, which will create an intermediate authorisation code.

The user and this authorisation code are then taken to the `redirectUri` defined in the client. In our case, this means they are taken to
`https://epicgames.example.com/tachi-auth-callback?code=SOME_INTERMEDIATE_TOKEN`

This token **IS NOT** an API Key, but rather an intermediate value that needs to then be converted up.

EpicGames would now have to take this token and make a POST request to `https://boku.tachi.ac/api/v1/oauth/token`, with their client secret and the intermediate token.

This POST request will then return the API Key EpicGames wants! The user can then be redirected by EpicGames to wherever they want.

## The application I want to integrate isn't a web app!

That's fine. Infact, it's very common for us to integrate with applications
that just want an API token inside a JSON file. For that, we have the
[Client File Flow](./file-flow.md)