# Merging a SDVX music_db.xml into seeds

We have a script that already exists for parsing a `music_db.xml` file and merging it with the database seeds.
This is convenient for when you want to provide an update for SDVX based off data you have.

!!! important
	You need to have a working setup of Tachi to use this script.

	For instructions on how to do that, see [Tachi Setup](../setup.md).

## How to use

Navigate to `seeds/scripts/rerunners/sdvx`.

The file you're looking to run is `merge-mdb.ts`, but it needs two arguments:

- `--input`, which is the location of the `music_db.xml` file you're looking to parse.
- `--version`, what version of the game this music db is from. For a list of versions, see the [SDVX Config](../../game-support/games/sdvx-Single.md#versions).

You can run this script by typing `ts-node merge-mdb.ts --input YOUR_INPUT_HERE --version YOUR_VERSION_HERE` in the terminal.
