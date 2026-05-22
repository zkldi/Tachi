# Orphan Scores

SongOrChartNotFoundFailures state that we don't have the data
to understand what chart/song this score is for.

However, that doesn't necessarily imply we won't have that
data in the future. Orphaned scores are a way of storing
score-like data without a song or chart as a parent.

Then, when the song and chart are made available, those
scores can be imported as if nothing had changed!

*****

## How do they work?

Orphaned scores store the `data` and `context` from the parser.

When unorphaning is attempted, the Converter Function is
called with that data and context.

If it results in a SongOrChartNotFoundFailure, we do nothing.

If it results in a success, we have a new DryScore we can import.

!!! info
	If another type of failure occurs - i.e. InvalidScoreFailure,
	then we remove the orphaned score from the DB.

!!! note
	This is why Converter Functions are completely
	static, so we can safely call the same Converter
	Function with this data to unorphan scores.
