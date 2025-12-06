These instructions assume you've already set up the [development container](https://docs.tachi.ac/contributing/setup/).

## Adding songs from data

1. Install `vgmstream-cli` in the container to parse song durations:

```shell
sudo apt install unzip

# optionally, replace r2055 with the latest version at https://github.com/vgmstream/vgmstream/releases/latest
curl -LO https://github.com/vgmstream/vgmstream/releases/download/r2055/vgmstream-linux-cli.zip
unzip vgmstream-linux-cli.zip
sudo install -Dm755 vgmstream-cli /usr/local/bin
```

This step only needs to be done once.

2. Navigate to `seeds/scripts/rerunners/maimaidx` and run the `merge-options.ts` script:

```shell
ts-node merge-options.ts --version <VERSION> --input /path/to/maimai/App/Package/Sinmai_Data/StreamingAssets /path/to/maimai/Option
```

3. Check the logs to see if the script changed anything unexpected, and fix if it happens.
4. Manually add search terms in `seeds/collections/songs-maimaidx.json`. At a minimum, songs with
Japanese titles should be romanized.
5. In the root project folder, run `just seeds test`.

## Adding a new version

1. Add a new version in `common/src/config/game-support/maimai-dx.ts`.
	- Also, add an Omnimix variant for the previous version.
2. Create tables and folders for the new version (and the omnimix version).
See `seeds/scripts/rerunners/maimaidx/add-maimaidx-table-and-folders.js`. You will have
to adjust the constants for the version you're adding.
3. Deactivate old tables using `seeds/scripts/rerunners/toggle-table-inactive.js`:

```
node toggle-table-inactive.js -t maimaidx-Single-<VERSION>-levels
```

Keep tables for the current and last (aka n-1) versions.

4. Switch the new table to the default one by editing `seeds/collections/tables.json`.
Change to `"default": true` for the current version, and `"default": false` for all
other tables of the game.

5. Verify you've done everything correctly by running `just seeds test` in the root project
folder.
