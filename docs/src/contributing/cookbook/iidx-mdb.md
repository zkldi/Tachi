# Merging IIDX Data into seeds

Updating seeds via IIDX data is a complicated endeavour. Luckily, we've automated it with scripts.

!!! important
	You need to have a working setup of Tachi to use this script.

	For instructions on how to do that, see [Tachi Setup](../setup.md).

## How to use

You will need `ifstools` in your `$PATH`. You can do this by installing `python3` and then running `pip install ifstools`.

Navigate to `seeds/scripts/rerunners/iidx/iidx-mdb-parse`.

Run `ts-node merge-mdb.ts --help` for information on what arguments are needed.

Fill out those arguments, and run the script in the terminal. If everything has gone correctly, `charts-iidx.json` and `songs-iidx.json` will be updated accordingly.

## Blacklisting

Sometimes, you might want to exclude certain charts from the parser.
Edit `blacklist.txt` accordingly.

!!! tip
	Make sure you have `ts-node` installed. If you don't, you can get it with `pnpm add -g ts-node`.
