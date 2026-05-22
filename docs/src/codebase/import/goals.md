# Updating Goals

If a user has goals set, we need to update their
progress on those goals as a result of this import.

*****

## Getting Relevant Goals

In V1 of Tachi, we fetched *all* goals for a user,
and recalculated all of them.

This was fine for users with some goals, but for users with
lots of goals, it quickly became a huge performance boon.

To avoid that, Tachi V2 fetches only the "relevant" goals
as a result of the import. This is calculated as follows:

- Single Goals are matched if their chartID is inside the set of chartIDs affected.

- Multi Goals are matched if their data contains any chartIDs that were affected.

- Folder goals are matched if the folder contains any charts inside the set of chartIDs affected.

## Processing Goals

For every goal matched, we iterate over it and evaluate
it using `EvaluateGoalForUser`.

We then need to convert the returns of that function into
the expected goal format for ImportDocuments.

That means we have to compare the old UserGoal's progress
with the newly returned one.

If nothing has changed, we return undefined. If something
has changed, we return a `bwrite` key that contains a
MongoDB bulk-write operation to update the UserGoal, and the expected import format of goalID, old, new.
