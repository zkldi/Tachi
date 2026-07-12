# User Game Stats

A user has overarching statistics for a game.

This part of the score importing process updates those
overarching statistics, such as their profile rating
and their classes.

!!! note
	If a user has never played this game + playtype
	combination before, a new user game stats
	object is saved to the database as a result
	of this update.

*****

## Format

A User Game Stats object looks like this:
```ts
{
	userID: string;
	game: "iidx" | "bms" // ... so on
	playtype: "SP" | "DP" // ... the set of playtypes this game supports.
	// A set of continuous statistics about a user.
	ratings: {
		// A record of numbers with keys determined
		// by the game + playtype combination.
		// such as:
		VF6: number;
		// for SDVX and USC.
	},
	// A set of discrete statistics about a user.
	classes: {
		// This typically contains things like dan ranks
		// or skill divisions, such as:
		dan: 14,
		// for IIDX, or
		skillColour: 19
		// for gitadora.

		// Note that instead of remembering each number
		// for each class, they are defined as constants
		// in common/src/constants/game.ts
	}
}
```

## Ratings

Ratings are calculated for the given Game + Playtype combination.

Different combinations will have different statistics,
Gitadora will have a profile skill level, whereas SDVX
would use Profile Volforce.

All the rating functions for a game are declared
in `src/lib/score-import/framework/user-game-stats/rating.ts`.

## Classes

There are two types of classes in Tachi. Static classes
are classes that can always be derived from the data around
them. Things like this are typically discrete buckets
for continuous data, such as Skill Colours in GITADORA.

The other type of classes are external classes. These
are things like Dans, where the information cannot be
derived from any other data around it, and instead must
be explicitly told to change.

### Class Handlers

You may recall that in [Parsers and Converters](./parse-conv.md) it was documented that parsers can return a
ClassHandler. The ClassHandler is intended to handle those
explicit changes.

For example, let's say we have an import type that tells us:
```js
{
	scores: [{score: 1000, songID: 1, diff: "spa"}],
	sp_class: "kaiden"
}
```

We could return a classHandler from our parser function
that encloses this updated information, such as:
```ts
function CreateClassHandler(spClass: number): ClassHandler {
	return (../../* classHandlers have some args but we dont need them for this example */) => {
		return {
			dan: spClass
		}
	}
}
```

This returned classHandler is called with 5 arguments
and is expected to return a partial record of the users
classes. This is then merged with the static classes
and returned as the users classes.

### Static Class Handlers

Static class handlers are built in, and always called
when a user's game stats is updated.

## Deltas

Once a user's classes have been calculated, they are diffed
against the current user's stats. If they have been
increased, then a redis message is sent out, and things
like the Tachi discord bot may choose to echo this
in the discord.

The deltas are returned to be part of the ImportDocument.