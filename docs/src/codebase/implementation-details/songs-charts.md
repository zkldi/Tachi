# Songs And Charts

Tachi structures its song and chart data in a specific
manner in order to avoid copying properties all over
the place.

*****

## Songs

Songs look like this:

```json
{
	"title": "5.1.1.",
	"artist": "dj nagureo",
	"id": 1,
	"firstVersion": "0",
	"alt-titles": [],
	"search-titles": [],
	"data": {
		"genre": "PIANO AMBIENT"
	}
}
```

They're relatively small documents, and contain some metadata.

Depending on the game, the `data` prop will contain
game-specific properties (i.e. not all games have
song genres!)

Songs, however, don't contain any information about
their *charts*. The charts are what people actually play.

In short, songs are *just* a collection of metadata that
parents a chart document!

*****

## Chart Documents

Chart Documents **MUST** belong to a song. In the below
chart, `songID` refers to the above song document:

```json
{
	"chartID": "c2311194e3897ddb5745b1760d2c0141f933e683",
	"difficulty": "ANOTHER",
	"songID": 1,
	"playtype": "SP",
	"levelNum": 10,
	"level": "10",
	"data": {
		"inGameID": 1000,
		"notecount": 786,
	},
	"isPrimary": true,
	"versions": [
		"27-omni",
		"26-omni",
		"27",
		"26",
		"inf",
		"16-cs",
		"12-cs",
		"10-cs",
		"8-cs",
		"7-cs",
		"bmus"
	]
}
```

Songs can have multiple charts, but charts can only have
one song.

## Primary

Sometimes, games like to rechart things and release them
under the exact same song. Sometimes, they even do this
under the *exact* same internal songID!

A 'Primary' chart refers to a chart that is the *current*
variant of that chart for this game. Non-Primary charts
are not eligible for any rating calculations, nor do they
contribute to profile rating.

To check if a chart is primary or not, the `isPrimary` property
handles that.

For example:

```json
{
	"chartID": "103ff8bb004e1a8a005f808c025c3feb",
	"difficulty": "ANOTHER",
	"songID": 1,
	"playtype": "SP",
	"levelNum": 5,
	"level": "5",
	"data": {
		"inGameID": 1000,
		"notecount": 433
	},
	"isPrimary": false,
	"versions": [
		"1"
	]
}
```

Notice that the chartID is different, and `isPrimary`
is set to false.

Even though this chart is "5.1.1 (SP ANOTHER)", it isn't
the primary chart for this songID + playtype + difficulty.

For the UI, Tachi will hide non-primary charts by default.
Realistically, they only exist to support legacy scores
without having to throw them away when a rechart occurs.
