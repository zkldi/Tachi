# Versions

Versions are a method for us marking charts as being available in a certain "version" of the game.

The predominant use for this is for arcade games, where new versions of the game generally come out and add/remove charts.

It's useful for us to know what charts are available in what version for two purposes.

The first allows us to create folders - users playing on a certain version of a game don't want to see charts they can't play!

The second is more complex.

## Disambiguation and `isPrimary`

Sadly, the real world isn't easy to deal with. It's possible for a chart to exist in
version A of a game, get removed in version B, and then come back in version C with
new, completely different charts.

**Worse still**, it's possible for that song to use the *exact same* in game ID it used
before. If we use `inGameID` to identify things, now we've got a critical ambiguity!

Does `inGameID: 1, difficulty: ANOTHER` refer to the version A chart, or the version C one? For games where metrics are chart-dependent, this could be *lethal* to the leaderboards.

It's much easier to get a good score in IIDX if the chart thinks it has less notes than it actually has!

To fix this, we also use versions as an identifer for disambiguation. If a score comes
in, it **MAY** pass what version the score was attained on.

This allows us to immediately disambiguate the previous case.

If a version is **not** passed in, we assume that the score is for the chart marked as
`isPrimary: true`. Furthermore, seeds tests **enforce** that duplicates on certain IDs expected-to-be-unique cannot be true unless all-but-one-of-them is marked as `isPrimary: false`.
