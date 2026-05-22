# Score Import Main

This page refers to the entry point function for a score
import.

This function can be found at `src/lib/score-import/framework/score-import-main.ts`.

## Signature

`ScoreImportMain` takes four arguments and an optional fifth.

| Argument | Type | Description |
| :: | :: | :: |
| `user` | [UserDocument](../../schemas/user.md) | The user that is making this import request. |
| `userIntent` | boolean | Whether this import was performed with User Intent - See [Import Types](./import-types.md#user-intent) |
| `importType` | ImportType | What kind of import "type" this is. For more on this, see [Import Types](./import-types.md)
| `InputParser` | Function | The parser function to call. For more info, see [Parsing and Converting](./parse-conv.md)
| `providedImportObjects` (Optional) | { logger, importID } | Optionally, a logger and existing importID can be passed here. This is used for scenarios where the logger and importID have already been created before importMain was called. |

## Import Logger

For ease of debugging, a logger is passed between most
functions in the score importing process. This logger
contains the context of the currently importing user
and the ImportID.

## Steps

To make the process easier to parse, the importing process
is split into multiple steps. These steps may split into
further sub-steps, depending on how much occurs in said
step.

!!! tip
	These steps are also commented inline in
	`score-import-main.ts`.

!!! warning
	These steps are only an outline of the process!
	
	For more information on each specific step, links
	are given.

### Setup

If `providedImportObjects` is not given, then ScoreImportMain generates a new Logger and an ImportID.

### Parsing

This step calls the ParserFunction provided as an argument
to this function. The returns from that are then used
in the below steps.

- Full Page: [Parsing and Converting](./parse-conv.md)

### Importing

We iterate over the `iterable` returned from the Parser Function,
calling the Converter Function for each element.

Once we have converted the element, we can fill it in
and insert it into the database.

This process returns an array called the "Import Info".

This object holds information about the set of charts this
import involved, and the set of scores that were imported.

- Full Page (Converting): [Parsing and Converting](./parse-conv.md)
- Full Page (Importing): [Importing](./importing.md)

!!! info
	This step does most of the work, and is where a
	lot of our complexity lies.

### Parse Import Info

The next steps require certain information from our Import Info.

This step parses that data into some values we have use for, such as the set of chartIDs impacted
by this import.

- Full Page: [Parsing ImportProcessingInfo](./parse-ipi.md)

### Sessions

Now that we have imported the scores and have got
an array of scoreIDs newly created from Parse Import Info,
we can move on to creating sessions from this import.

- Full Page: [Sessions](./sessions.md)

### Personal Bests

This step updates the 'personal bests' for the user. It
iterates over every unique chartID modified in this import
and conjoins the users best scores on the chart into one document.

This is to have a single document that has the users best
lamp and score, which avoids having to join it together
whenever we want to display a users best score and lamp
at the same time.

- Full Page: [Personal Bests](./pbs.md)

### Game Stats

This step updates the user's Game Stats.

If this is the users first play on this game, then we create
game stats for them.

The update is performed by recalculating their statistics
with the new scores inserted.

!!! info
	This section is referred to as UGS sometimes internally.

	This is short for User Game Stats.

- Full Page: [User Game Stats](./ugs.md)

### Goals

This step checks the charts modified in this import and
retrieves all the relevant goals. It then checks
all of these goals for whether their status has
changed or not, and updates them accordingly.

- Full Page: [Goals](./goals.md)

### Quests

Checks the set of goals modified in the previous step,
and gets the relevant quests. This step then re-evaluates all of those quests and
updates accordingly.

- Full Page: [Quests](./quests.md)

### Import Document

Finally, we take all of the returns of the above steps
and combine them into an import document.

This is inserted to the database, and is also the return
value of this function.

### Import Timings

Every step in this process is timed in milliseconds.

The time each step took is saved alongside the ImportID.

This is used for internal debugging and degraded performance
checks.
