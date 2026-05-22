# Score Oddities

Writing a score tracker is easy. Dealing with 20 years of questionable score storage habits is not.

Here's a collection of weird things that have reared their head. If you've been
linked here, it's to warn you about this.

## LR2 Auto Scratch Easy Clear

Before ASSIST CLEAR was a dedicated clear type in IIDX, AutoScr would degrade
the score back down to an EASY CLEAR. This is fine normally, as the score would
also have a BP of -1 or NULL. You could easily tell when a score was AutoScr
and correct it.

However. If you then get **ANY SCORE** on the chart without Auto Scratch, your
BP will be set to a normal value, rather than -1 or NULL. This means that...

```
EASY CLEAR, BP -1
then...
FAILED, BP: 140
becomes
EASY CLEAR, BP: 140
```

And there's no longer any way to determine the score was auto scratched!

## Beatoraja + LR2 DP Random

Beatoraja and LR2 only store the left hand random. They completely ignore
the right hand one and never store or send it anywhere.

## E-Amusement IIDX Resets (0EX Lamps)

E-Amusement resets scores for IIDX every version. This would be fine under a normal interpretation of 'resets score', but the emphasis here is on the word *score*, not *reset*.

E-Amusement IIDX Score Resets only reset your EX Score, you actually get to keep your lamp.
For exported E-Amusement CSVs, this means that you submit scores with 0EX, but with lamps.
For sanities sake, scores with 0EX are rejected so that you don't accidentally flood the server with fake scores because...

## E-Amusement IIDX Resets (Timestamps)

The timestamp for all your scores is also changed to the point when you first carded in on
the new version of the game, meaning that if you were to import all those 0EX scores, you
would create a session of every single chart you've ever lamped at that exact moment.

## E-Amusement IIDX Timestamps

Timestamps in E-Amusement IIDX CSVs are also only on a per-song basis, rather than a per-chart basis.
If you play V (Another) and V (Hyper) in the same session, the data in the CSV says that you
played both of those charts at the same time (since all charts of V have to share a timestamp).

## Legacy LEGGENDARIA Formats (IIDX)

From IIDX 21 to IIDX 26, Leggendarias were not their own difficulty. Instead they were
just anothers with the special quantifier that the song title ended in † or †LEGGENDARIA exactly.
To handle this, Tachi will automatically convert song titles ending in † or †LEGGENDARIA
into their original form, changing the difficulty from ANOTHER to LEGGENDARIA.

!!! note
	This only applies to legacy imports -- This has been fixed since IIDX 27 (2019).

## Deduplication False Positives (All Games)

Tachi identifies scores using a `scoreID`. This is calculated from some properties on the score, such as who got it (`userID`) and the various metrics for this game (`score`, `percent`, `lamp`, etc.)

`scoreID`s are *unique* across all of Tachi. The motivation for this is to avoid score duplication.

!!! example
	Let's say you imported your local score database, which has some scores in it.
	You then get some more scores, and import your local score database.
	
	What you *want* to happen here is that your new scores get imported and the old ones are just ignored.

	Therefore, we need a way of recognising that a score has already been imported, and ignore
	it.

To deduplicate scores, we compare scoreIDs. This works in all scenarios, and avoiding score duplication is a good thing. *However*, it has a false positive in exactly one scenario.

**If you get the same score twice, only one of them will be imported**.

There is no way to distinguish between a user getting a score twice, and a user getting a score once and importing it twice (therefore being deduplicated).

### Why not simply check the timestamp?

You can't check the score timestamp. Games like LR2 do not store timestamps, games like E-Amusement lie about their timestamps and generally clobber them. PLI infamously lied about almost all their timestamps to hide what players were playing, etc.

Similarly, scores are sometimes duplicated across services -- someone might import their FLO scores to EAG using their integration. Those timestamps also get clobbered.

It is safer to be right all the time on deduplication and sacrifice this case.
