# About Webhooks

Tachi supports webhooks. You can set a `webhookUri` as part of your
[Tachi API Client](../routes/clients.md).

## Usage and Security

When a given event happens on Tachi, your webhookUri will receive a POST
request with some content and the type of event.

You **MUST** validate that this request was from Tachi! Otherwise, anyone
could post fake data to your webhook URI and potentially compromise it.

To secure your webhook implementation, Tachi will send an Authorization header with `Bearer CLIENT_SECRET`. You should check that that value aligns with your client secret. If it doesn't, someone might be trying to perform an attack!

## Data Format

Data is sent as follows:

```json
{
	"type": "EVENT_TYPE",
	"content": {} // Content specific to that EVENT_TYPE!
}
```

The current Events are:

| Type | Description |
| :: | :: |
| `class-update/v1` | Fires whenever a user has had a class update positively, such as going from 9th Dan to 10th Dan. |
| `goal-achieved/v1` | Fires whenever a user has achieved a goal. |
| `quest-achieved/v1` | Fires whenever a user has achieved a quest. |
