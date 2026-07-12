# Updating Quests

We update quests by looking at the set of modified
goalIDs, and check the user's assigned quests to
get those that are affected.

*****

## Returns

We evaluate every quest that contain a goal that has just had it's status change.
For each one we create a bulkwrite operation to update the user's quest
progress.

If the user has newly achieved a quest, a Webhook Event
is emitted, which could be hooked into by our Discord Bot.

If the progress has changed at all, the data is
pushed to an array which is then returned. This is
attached onto the Import Document.
