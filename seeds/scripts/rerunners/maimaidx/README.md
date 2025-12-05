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
