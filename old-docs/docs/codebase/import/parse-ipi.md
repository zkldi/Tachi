# Parsing Import Processing Info

The ImportProcessingInfo array returned from our
importing process is unwieldy to work with. We are interested
in what it has to say, though.

This step converts that array into data we use
in successive score import steps.

!!! info
	Because the logic for this is essentially just one
	loop, it does not get its own file in `score-importing/`.

	Instead, it is defined inside `score-import-main.ts`.

*****

## Output

| Property | Type | Description |
| :: | :: | :: |
| `scoreIDs` | Array&lt;string&gt; | The array of scoreIDs imported as a result of this import. |
| `errors` | Array&lt;{ type, message }&gt; | An array of the failed ImportProcessingInfo's Types and Error Messages.
| `chartIDs` | Set&lt;string&gt; | A set of the chartIDs modified by this import. This is a set to ensure that every chartID here is unique. |
| `scorePlaytypeMap` | Record&lt;Playtype, Array&lt;Score&gt;&gt; | All of the score documents returned filtered into Playtype buckets.

### What's with ScorePlaytypeMap?

Some imports may import scores from multiple Playtypes. We
frequently want to only refer to the set of scores modified
under a given playtype (For importing a users game:playtype stats, as an example)
so this is a very useful data structure to have.
