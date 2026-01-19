# GPT-Target Endpoints

These endpoints deal with [targets](../../api/terminology.md) for a Game + Playtype. These are things like searching goals or quests, or retrieving information about a specific ID.

For user-specific target endpoints, such as subscriptions, see [UGPT-Target Endpoints](./ugpt-targets.md).

---

## Retrieve this game's recently achieved targets

`GET /api/v1/games/:game/:playtype/targets/recently-achieved`

!!! info
This endpoint returns the 100 most recently achieved goal subscriptions, and 50 most recently achieved quest subscriptions.

    A target is not considered recently achieved if it was [instantly achieved](../../codebase/implementation-details/goals-quests.md#instant-indirect-achievements).

### Parameters

None.

### Response

|  Property   |             Type              |                        Description                        |
| :---------: | :---------------------------: | :-------------------------------------------------------: |
|   `goals`   |   Array&lt;GoalDocument&gt;   |      The goal documents that were recently achieved.      |
|  `quests`   |  Array&lt;QuestDocument&gt;   |     The quest documents that were recently achieved.      |
| `goalSubs`  | Array&lt;GoalSubDocument&gt;  | User subscriptions to goals that were recently achieved.  |
| `questSubs` | Array&lt;QuestSubDocument&gt; | User subscriptions to quests that were recently achieved. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/targets/recently-achieved
```

#### Response

```js
{
	goals: [{
		name: "HARD CLEAR 5.1.1 Another",
		goalID: "foo"
		// ... other goal props
	}],
	quests: [{
		name: "Go Beyond Diamond 1",
		questID: "bar",
		// ... other quest props
	}],
	goalSubs: [{
		userID: 1,
		goalID: "foo",
		achieved: true,
		// ... other goalsub props
	}],
	questSubs: [{
		userID: 3,
		questID: "bar",
		achieved: true,
		// ... other quest sub props
	}]
}
```

---

## Retrieve this game's recently interacted-with targets

`GET /api/v1/games/:game/:playtype/targets/recently-raised`

!!! info
This endpoint returns the 100 most recently interacted-with goal subscriptions, and 50 most recently interacted-with quest subscriptions.

    A recently interacted with target subscription is one where `progress` or `outOf` has changed recently.

!!! warn
This endpoint excludes achieved targets -- targets still get interacted with when achieved, which means a user with a lot of targets will just flood this endpoint with redundant updates on larger imports.

### Parameters

None.

### Response

|  Property   |             Type              |                           Description                            |
| :---------: | :---------------------------: | :--------------------------------------------------------------: |
|   `goals`   |   Array&lt;GoalDocument&gt;   |         The goal documents that were recently achieved.          |
|  `quests`   |  Array&lt;QuestDocument&gt;   |         The quest documents that were recently achieved.         |
| `goalSubs`  | Array&lt;GoalSubDocument&gt;  | User subscriptions to goals that were recently interacted with.  |
| `questSubs` | Array&lt;QuestSubDocument&gt; | User subscriptions to quests that were recently interacted with. |

### Example

#### Request

```
GET /api/v1/games/iidx/SP/targets/recently-raised
```

#### Response

```js
{
	goals: [{
		name: "HARD CLEAR 5.1.1 Another",
		goalID: "foo"
		// ... other goal props
	}],
	quests: [{
		name: "Go Beyond Diamond 1",
		questID: "bar",
		// ... other quest props
	}],
	goalSubs: [{
		userID: 1,
		goalID: "foo",
		achieved: false,
		lastInteraction: 1649438990417,
		// ... other goalsub props
	}],
	questSubs: [{
		userID: 3,
		questID: "bar",
		achieved: false,
		lastInteraction: 1649438990415,
		// ... other quest sub props
	}]
}
```

---

## Get the most popular goals for this GPT.

`GET /api/v1/games/:game/:playtype/targets/goals/popular`

### Parameters

N/A

### Response

| Property |                      Type                      |                                                     Description                                                      |
| :------: | :--------------------------------------------: | :------------------------------------------------------------------------------------------------------------------: |
| `<body>` | Array&lt;GoalDocument & `__subscriptions` &gt; | An array of the 100 most popular goals for this GPT, where `__subscriptions` is how many subscriptions the goal has. |

### Example

#### Request

```
GET /api/v1/games/:game/:playtype/targets/goals/popular
```

#### Response

```js
[
	{
		name: "HARD CLEAR foo",
		// ...
	},
	{
		name: "AAA foo",
		// ...
	},
];
```

---

## Retrieve information about a specific goal and its subscribers.

`GET /api/v1/games/:game/:playtype/targets/goals/:goalID`

### Parameters

None.

### Response

|    Property    |             Type             |                Description                |
| :------------: | :--------------------------: | :---------------------------------------: |
|     `goal`     |         GoalDocument         |       The goal document at this ID.       |
|   `goalSubs`   | Array&lt;GoalSubDocument&gt; |  All of the subscriptions to this goal.   |
|    `users`     |  Array&lt;UserDocument&gt;   | All of the users subscribed to this goal. |
| `parentQuests` |  Array&lt;QuestDocument&gt;  | All of the quests that include this goal. |

---

## Evaluate a goal upon a user.

`GET /api/v1/games/:game/:playtype/targets/goals/:goalID/evaluate-for`

!!! note
This endpoint is notably in a bit of a strange position. It can't go under UGPT because
`UGPT/goals/:goalID` is for goal subscriptions, and overloading the endpoint to be
something like "return the goal subscription or evaluate it if doesn't exist" is ugly.

    As such, it ends up here, but is generally a bit awkward.

### Parameters

| Property |  Type  |             Description             |
| :------: | :----: | :---------------------------------: |
| `userID` | String | The user to evaluate this goal for. |

### Response

|        Property         |     Type     |                       Description                       |
| :---------------------: | :----------: | :-----------------------------------------------------: |
|         `goal`          | GoalDocument |          The goal document that was evaluated.          |
|         `user`          | UserDocument |       The user that this goal was evaluated for.        |
|   `results.achieved`    |   Boolean    | Whether this user would have this goal achieved or not. |
|   `results.progress`    |   Integer    |    What this user's progress would be on this goal.     |
| `results.progressHuman` |    String    |  A user friendly format for this user's goal progress.  |
|     `results.outOf`     |   Integer    |               What this goal was out of.                |
|  `results.outOfHuman`   |    String    |  A user friendly format for what this goal was out of.  |

!!! info
For more info on `progress`/`outOf`, see [Goals](../../codebase/implementation-details/goals-quests.md#evaluating-a-users-progress).

### Example

#### Request

```
GET /api/v1/games/iidx/SP/targets/goals/some_goal_id/evaluate-for?userID=zkldi
```

#### Response

```js
{
	user: {
		username: "zkldi
		id: 1,
		// ...
	},
	goal: {
		goalID: "some_goal_id",
		name: "FULL COMBO some chart"
		// ...
	},
	result: {
		achieved: false,
		progress: 5,
		progressHuman: "EX HARD CLEAR",
		outOf: 6,
		outOfHuman: "FULL COMBO"
	}
}
```

---

## Search quests for this GPT.

`GET /api/v1/games/:game/:playtype/targets/quests`

!!! note
You might notice that there's no equivalent endpoint for goals.

    Searching goals for a GPT isn't very interesting, since they can be created by anyone at any time. The only reason goals are stored separately to subscriptions are for deduplication purposes and quests.

    As such, searching goals for a GPT is pointless, since technically it should search the set of all possible goals.

### Parameters

| Property |  Type  |       Description        |
| :------: | :----: | :----------------------: |
| `search` | String | The query to search for. |

### Response

| Property |            Type            |                     Description                      |
| :------: | :------------------------: | :--------------------------------------------------: |
| `<body>` | Array&lt;QuestDocument&gt; | All of the quests that matched this search criteria. |

---

## Retrieve information about a specific quest, and who is subscribed to it.

`GET /api/v1/games/:game/:playtype/targets/quests/:questID`

### Parameters

N/A

### Response

|      Property      |              Type              |                     Description                     |
| :----------------: | :----------------------------: | :-------------------------------------------------: |
|      `quest`       |         QuestDocument          |            The quest with this questID.             |
|    `questSubs`     | Array&lt;QuestSubDocument&gt;  |       All of the subscriptions to this quest.       |
|      `users`       |   Array&lt;UserDocument&gt;    | All of the user's with subscriptions to this quest. |
|      `goals`       |   Array&lt;GoalDocument&gt;    |           All of the goals in this quest.           |
| `parentQuestlines` | Array&lt;QuestlineDocument&gt; |       Any questlines that contain this quest.       |

---

## Evaluate a quest for a user, even if they aren't subscribed to it.

`GET /api/v1/games/:game/:playtype/targets/quests/:questID/evaluate-for`

### Parameters

| Property |  Type  |                  Description                   |
| :------: | :----: | :--------------------------------------------: |
| `userID` | String | The user you wish to evaluate this quest upon. |

### Response

|   Property    |               Type               |                                    Description                                    |
| :-----------: | :------------------------------: | :-------------------------------------------------------------------------------: |
|    `goals`    |    Array&lt;GoalDocument&gt;     |                          All of the goals in this quest.                          |
| `goalResults` | Array&lt;EvaluatedGoalResult&gt; |            This user's progress on each individual goal in this quest.            |
|  `achieved`   |             Boolean              |                 Whether this user has this quest achieved or not.                 |
|  `progress`   |             Integer              |               How many goals this user has achieved in this quest.                |
|    `outOf`    |             Integer              | How many goals need to be achieved in this quest for it to be marked as achieved. |

#### EvaluatedGoalResult

|    Property     |      Type      |                                       Description                                        |
| :-------------: | :------------: | :--------------------------------------------------------------------------------------: |
|    `goalID`     |     String     |                         The goal ID that these results are for.                          |
|   `achieved`    |    Boolean     |                          Whether this goal was achieved or not.                          |
|   `progress`    | Number \| Null |       How much progress this user made on this goal. Null if no progress was made.       |
|     `outOf`     |     Number     | What `progress` needs to be greater than or equal to for this goal to count as achieved. |
| `progressHuman` |     String     |              A humanised, pretty-printed progress indicator for this goal.               |
|  `outOfHuman`   |     String     |                A humanised, pretty-printed outOf indicator for this goal.                |

---

## Search Questlines

`GET /api/v1/games/:game/:playtype/targets/questlines`

### Parameters

| Property |  Type  |             Description              |
| :------: | :----: | :----------------------------------: |
| `search` | String | A name of a questline to search for. |

### Response

| Property |              Type              |                          Description                           |
| :------: | :----------------------------: | :------------------------------------------------------------: |
| `<body>` | Array&lt;QuestlineDocument&gt; | An array of QuestlineDocuments, based on the search parameter. |

---

## Retrieve a questline with a specific ID.

`GET /api/v1/games/:game/:playtype/targets/questlines/:questlineID`

### Parameters

N/A

### Response

|  Property   |            Type            |                     Description                     |
| :---------: | :------------------------: | :-------------------------------------------------: |
| `questline` |     QuestlineDocument      |         The questline document at this ID.          |
|  `quests`   | Array&lt;QuestDocument&gt; | All of the quest documents that belong to this set. |
