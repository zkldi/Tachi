# Tachi API Clients

Tachi lets users create API Keys, such that programs can interact with their account on their behalf. These API Keys have permissions and other things. You can read about that [here](../../api/auth.md).

However, it's common for another programmer to want certain permissions for their client. For example, if I was making a score import hook for Tachi, I would need the `score_submit` permission.

We could ask users to manually create an API Key, copy it into a config file, and hope that they get the permissions right, or we could set up a nice flow.

## OAuth2 Flow

Tachi fully supports OAuth2. When you create a Tachi API Client, you can set a `redirectUri`, which is where your OAuth2 flow will go. You can read about it [here](./oauth2.md).

## Client File Flow

Alternatively, if you're just looking for a nice UI for users to create an API Key with the right permissions, check out the [Client File Flow](./file-flow.md).
