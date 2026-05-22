# Importing DryScores

This page goes over hydrating a DryScore into a fully
fledged Tachi score, and then goes over how it is imported.

!!! warning
	Performance has been squeezed out of this process
	rather aggressively, as such, some of the more
	'obvious' ways to do things have been ignored
	for performance gains.

!!! info
	The code that handles this logic is found in
	`src/lib/score-import/framework/score-importing/score-importing.ts`.

*****

## Return Format

The `ImportIterableDatapoint` returns
`ImportProcessingInfo` or `null`. The format for the former
can be found in `tachi-common`, and **should be read** before
following this document!

As a rough outline:
```ts
{
	// whether this import worked or not
	success: boolean; 
	// ScoreImported implies success: true, and all others imply success: false.
	type: "ScoreImported" | "SongOrChartNotFound" // ... and more;
	// An error message.
	message: String | null;
	// Some errors return some data about the error, or things like scoreImported returns the score that was imported.
	content: see_implementation
}
```

## Dealing with converter returns

As mentioned in [Parsers and Converters](./parse-conv.md),
converters will return a DryScore, and its matching chart
and song on success.

However, failures are also an expected throw from a
converter function. We handle these throws by logging
them dependent on their severity, and returning
that this score has failed to be imported properly
in the `ImportProcessingInfo` format.

If the converter was successful, we now have a DryScore, song and chart to work with.

## Hydration

Our first step is to turn that DryScore into a 'real score'.

!!! info
	The code for this is found in `HydrateScore`.

Before anything, we calculated the ScoreID for this score.
This is used to dedupe scores, and is a checksum of
the following properties.

- userID
- chartID
- lamp
- grade
- score
- percent

We fill out all the properties that can be calculated
about the score, such as the aptly named `calculatedData`,
and things like `gradeIndex` and `lampIndex`, which are
just the index of the grade/lamp string in the set of grade/lamps.

Other properties, such as `timeAdded` (the time this data was inserted into the database) can be trivially attached onto the score.

## Insertion

Now that we have a real Tachi score, we can insert it into
the database.

The obvious solution here is something like:
```ts
await db.scores.insert(scoreDocument);
```

But this has performance implications for large sets of
scores.

To solve these performance issues, we use a queue to insert
scores.

ScoreDocuments are appended to a queue of 500.
If the queue hits 501 scores, the queue is bulk-written to
the database. At the end of hydrating and queueing all scores, the queue is flushed one last time.

This simple optimisation provides large performance benefits.

## Final Returns

Importing each datapoint gives us an `ImportProcessingInfo`
object OR `null`. We want to return only the former,
as `null` is for skipped scores.

We filter out all the nulls and flush the queue before
returning the array of `ImportProcessingInfo` objects
that were returned from our import process.
