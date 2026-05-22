# Score ID implementation

Score IDs exist to dedupe scores when a user re-submits
the same scores. This happens frequently with `file/`
and `api/` [Import Types](../import/import-types.md),
as they typically resubmit the same scores.

If a user only got a score once, we don't want to store
it twice.

Sadly, we can't depend on things like timestamps to assert
whether or whether not we've saw a score before. Many services
alter/tamper their timestamps such that they're unreliable.

!!! example
	E-Amusement IIDX CSVs will change the timestamp of every single
	score when a new version comes out to the second the user created
	their new account.

*****

## Hashing

The score ID is created by joining the following properties:

- The `userID` that got this score
- The `chartID` that this score was on
- All [Provided Metrics](todo) for this GPT
- Any [Optional Metrics](todo) that have been marked as `partOfScoreID`

and then hashing them with SHA256.

This is then prefixed with `T`, and returned.

## Clobbering

Since a scoreID isn't necessarily all of the possible statistics for a score, it's
possible for users to "clobber" their scores, by importing a score without as many
pieces of info (i.e. no judgements), then trying to import that same score with
judgements later will not work, as the scoreID sees it as a duplicate.

See [Clobbering](todo).
