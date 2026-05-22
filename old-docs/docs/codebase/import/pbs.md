# Personal Bests

Tachi has a lot of scenarios where it needs to reference
a users best score alongside their best lamp.

This is a standard for most arcade games to conjoin the
best aspects of all your scores, so Tachi needs to
replicate that behaviour.

However, not all games agree on what aspects to join about
scores. Although in most scenarios we will be joining
a user's best lamp with their best score, there are some
games (like IIDX) which have other statistics that need
to be conjoined.

*****

## Calculating Personal Bests

A user is only allowed one personal best per chart, this
allows us to know what personal bests need to be modified
by looking at the set of chartIDs modified from this import.

We can iterate over that set and recalculate the users
personal best for each chart.

Firstly, we select the users score on the chart with the
highest percent, then we select the users score on the
chart with the highest lampIndex.

We can then join the relevant properties of this
into a PBScore, where the best parts of the lampPB
are unioned with the best part of the scorePB.

!!! info
	A ScorePB refers to a user's best Percent/Score on a chart.

	A PBScore refers to the aforementioned conjoined score
	document.

## Game Specific Things

Some games require specific conjoining code. The below games
have said exceptional behaviour.

### SDVX, USC

VF5 and VF6 depends on the users best lamp and their best score.

That is, you cannot just select the larger volforce from
the two scores, as HC 9m -> NC 9.1M should have the
volforce of HC 9.1M.

### IIDX, BMS

IIDX and BMS have BP. This number is the amount of bads
plus the amount of poors a player made. The lowest non-null
value for this should be selected as that property for the
PBScore.
