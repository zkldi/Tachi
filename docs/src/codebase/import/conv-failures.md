# Converter Failures

This page contains the list of possible converter fail
states that can be thrown. All of them can be found in
`src/lib/score-import/common/converter-failures.ts`.

*****

## SkipScoreFailure

This is a special case of a failure, in that it isn't
logged or marked as an error in the import. This call
just means we should skip the score.

An example case of this would be something like the 
eamusement IIDX CSV format, which can pass 'empty' scores
for a chart. We would want to skip over those, and they
aren't an error.

When this is thrown, the score is skipped, and nothing is
imported.

## SongOrChartNotFoundFailure

!!! bug
	KTData means 'Kamaitachi Data', but this applies to
	Bokutachi just as much, it is just a legacy name
	holdover.

This failure means that the score could not match with
anything in the database, such as giving a chartID that
Tachi does not have in its database.

This failure also takes the current data, importType and
parser context. This is so we can create [Orphan Scores](./orphans.md).

## Invalid Score Failure

This score provided invalid data that we cannot process.

An example of this would be an IIDX score with -1 EX Score.

## Internal Failure

This is an internal failure, and thrown when something bad
has occurred on our end.

The most common case for throwing this is the "Song-Chart"
desync. This occurs when a chart has no parent song (and
a chart must have a parent song.)

!!! info
	This is generally used for states that should never happen,
	but we want to handle them nicely anyway.

## Any Exception

If any exception is thrown from a converter that is **NOT**
an `instanceof` ConverterFailure, it is treated as an
InternalFailure.
