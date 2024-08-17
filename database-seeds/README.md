# Tachi Database Seeds

This repository contains some base "seed" files for the Tachi Database.

They are intended to be used with MongoDB, but since these are just a JSON export, you can
really do anything you want with them.

## Contribution Info

All work should be merged into `main`.

## What Databases Are Here?

Nothing private, nothing pertaining to an instance of Tachi. These are backbone files, such
as songs, charts, and folders.

You can read more about what all these documents mean in [common/](https://github.com/zkrising/Tachi/tree/main/common).

- `songs-{game}`

These contain the song documents for the provided game.

- `charts-{game}`

These contain the chart documents for the provided game.

- `folders`

This contains the set folders for all games.

- `tables`

This contains the set tables for all games.

- `bms-course-lookup`

BMS Dans that should be registered by the IR.

- `goals`

Goals that are registered by default in tachi.
These are likely because they're in a quest.

- `quests`

Quests that are registered by default in tachi.

- `questlines`

Groups of quests that are registered by default.

## How do I use this?

Depends what you want. If you're familiar with JSON, just
take the files and do whatever.

If you want to analyse this data in a more advanced fashion,
install `mongodb-tools` (You'll want mongoimport in `$PATH`) from your favourite location.

`../_scripts/bootstrap` will synchronise these seeds with your local development install on first setup.

You can use `server/src/scripts/load-seeds` to re-synchronise whenever you want.

## Contribution

If your change involves inserting or removing records, you **must** run `node scripts/deterministic-collection-sort.js`.
This will ensure diffs stay somewhat sane.
