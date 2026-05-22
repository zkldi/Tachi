# Goals, Quests, Questlines

This page covers pretty much everything you need to know about interacting with goals
and quests.

Although these features are fairly straightforward on the surface, their implementation is a bit complex at points. We'll get to it.

## What is a Goal?

A goal is a set of instructions that are evaluated for a player if they are subscribed to it (and it is relevant to their current import, see [Getting Relevant Goals](../import/goals.md)).

!!! example
	An example goal would be something like "AAA 100 charts in the X Folder".

Users must subscribe to goals for them to be evaluated when they import scores. This is
abstracted away from the user, as the operation to create a goal will automatically subscribe
them to the same goal.

### Identification

Goals are identified by a checksum of their instructions. If two users make the goal to "AAA Freedom Dive", the goalID will be the same.

This allows us to do things like see what goals are popular, and reduce the general duplication on the database.

## User Subscriptions

Users may create and subscribe to goals. This is done with the [UGPT Create Goals Endpoint](TODO). If they create a goal that already exists, they are just subscribed to that goal.

If they create a goal that does not already exist, it is created, and they are subscribed.

Users may unsubscribe from goals that they no longer care about getting pinged for.

Subscriptions to goals are stored in a [GoalSubscriptionDocument](../../schemas/goal-sub.md).
This document is uniquely identified by the joining of the `goalID` with the `userID`.

### Instant Direct Achievements

If a user creates/subscribes to a goal that they would instantly achieve, they are denied
from adding goal directly.

### Evaluating A User's Progress

Goals have two main components in terms of evaluation -- `progress` and `outOf`. If the progress is greater than or equal to the `outOf`, the goal is marked as achieved.

Both of these values are numbers, and are not intended for human consumption. For example, the goal 'HARD CLEAR Freedom Dive' would be represented by an `outOf` of `6`, which is the internal lampIndex for a BMS HARD CLEAR.

For human representation, these values are formatted and stored in the Goal Subscription Document as `progressHuman` and `outOfHuman`, respectively. These values are prettified for human users, and leverage game-specific formatting in some cases.

!!! note
	Achieved goals are still calculated -- a user may actually find themselves un-achieving goals in some stranger cases.

	If their goal is something like AAA 10% of a folder, and the folder gets larger, they
	may find themselves losing the achieved status on this goal.

!!! warning
	Goal Subscriptions are capped by the MAX_GOAL_SUBSCRIPTIONS [conf.json5](../setup/config.md) property, and defaults to 1000.

!!! danger
	Unsubscribing from goals directly is only possible if they do not have any parent quests.
	More on that below.

## What is a Quest?

Quests are groups of goals, defined in a structured form, with support for assigning
notes next to goalIDs, and other generally useful stuff.

Their purpose for users is to give them a quick way to assign a bunch of goals they might care about.

For example, a dedicated user may make their own "Kaiden Checklist", and create a set of goals
they think are useful for kaidens to aim for. Another user interested in this can just
subscribe to that quest, and all the goals will be managed for them.

### Identification

Quests are identified by their `questID`, which is a completely arbitrary string.

At the moment, users cannot create quests directly, they are hard-defined by the [Database Seeds](../infrastructure/seeds.md).

### Evaluating a User's Progress

Similarly to goals, user's can subscribe to quests.

Quest subscriptions are interesting in that the `progress` factor is always an integer -- how many goals in the quest the user has achieved, and the `outOf` factor is always an integer -- how many goals need to be achieved in the quest for the quest to be marked as achieved.

Similarly, the `achieved` status on quests is identical to `progress` being greater than or equal to `outOf`.

### Parenting Goal Subscriptions

When a quest is subscribed to, all the goals in the quest are also subscribed to.

When a user is subscribed to a quest, they *must* also be subscribed to all the goals in
that quest. If they aren't, they've desynced with the quest, and that's an awful
user experience.

As such, Tachi keeps track of all the quests that care about this goal subscription, and users are *prevented from unsubscribing from this goal* while any of their quest subscriptions parent the goal.

### Instant Indirect Achievements

Subscribing to a quest *mandates* that all of the goals are assigned. It is not rare for this to mean that you subscribe to goals that are instantly achieved.

This is fine. If this does happen though, `wasInstantlyAchieved` is set on the goal, and no
webhook event is emitted.

### Unsubscribing

For all `goalID`s in the quest, we check if this goal subscription has any other parent quests.

If this quest was the only reason the goal was assigned (i.e. it wasn't assigned directly, or isn't part of another quest), this quest will be unsubscribed from.

## Questlines

Questline are ordered lists of quests. Their purpose is to group quests together
visually in an ordered manner.

Users *can not* "subscribe" to questlines, but they can use questlines as a utility for subscribing to all the related quests.
