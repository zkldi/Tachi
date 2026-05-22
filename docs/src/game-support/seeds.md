# Adding Seeds

With a [Common Configuration](./common-config/index.md) defined, we know what the songs and charts for this game should look like.

Lets load them into the database seeds.

## Quick Primer

The database seeds are a folder in the monorepo: `seeds/collections`, which contain JSON files.

These JSON files contain the state of a lot of our databases that need to be loaded. When changes are made to these seeds and committed to the main repository, a script will automatically apply those changes to the database.

!!! info
	For local usage, you can use `pnpm sync-database-local` in the terminal to sync
	the database with your local seeds.

## Adding songs and charts

If they don't already exist, create new files for `songs-GAMENAME.json` and `charts-GAMENAME.json`. Place `[]` inside those files, as they should be arrays.

It's left as an exercise for the reader to source the song and chart data for their game. You will likely need to write your own scripts.

Once you've gotten that data, you need to convert it into Tachi's song/chart format.

## Writing the files

You can modify the JSON files however you want. It really doesn't matter. However, there is a `seeds/scripts/` folder with a bunch of scripts you can use
to ease this process.

For things you only want to run a single time, place the script in the `seeds/scripts/personal` folder.
For things you want to keep around, place the script in the `seeds/rerunners` folder. Simple.

The file `util.js` contains a bunch of miscellaneous utils for helping out, like `CreateChartID` or `MutateCollection`.

## What do songs and charts look like?

A song in Tachi looks like this:

```json
{
	"altTitles": [],
	"artist": "dj nagureo",
	"data": {
		// the things you defined in GAME_CONFIG.songData go here
	},
	"id": 1,
	"searchTerms": [],
	"title": "5.1.1."
},
```

For information on what each of these properties mean, see [Song Document](../schemas/song.md).

A chart in Tachi looks like this:

```json
{
	// This is a randomly generated 20 byte string.
	// The utility function `CreateChartID` should be used.
	"chartID": "70b80da02a2037d556026b412c386b2fd1e57dbd",

	"data": {
		// this should be what you defined in GPT_CONFIG.chartData.
	},

	// If your difficulties are "FIXED", this should be one of the expected difficulties.
	// Otherwise, any string goes here.
	"difficulty": "Green",

	"level": "3",
	"levelNum": 3,

	// this should be one of the playtypes for your game.
	"playtype": "Single",
	"songID": 1,

	// This should be an array of the versions this chart appears in.
	// For more information, see Common Config's Versions documentation.
	"versions": [
		"1.5",
		"1.5-b"
	],
	// See Common Config's Versions documentation.
	"isPrimary": true
}
```

## Tables and Folders

You'll probably want to create at least one table and some folders for your game.

There are various utilities for this, like `scripts/rerunners/add-level-version-folders.js` for creating a traditional "Level 1, Level 2, Level 3" kind of table.

## Loading the seeds

Once you've modified the database seeds, test them with `pnpm test` inside the `seeds/scripts` folder. This will check a bunch of properties about the songs and charts you just made.

If they fail, read why and make appropriate changes. If they pass, move to the root of the Tachi repository and run `pnpm sync-database-local`. This will load the changes into your MongoDB instance.
