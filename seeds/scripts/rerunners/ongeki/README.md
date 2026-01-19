1. Have a working Tachi Docker container.
2. Parse music data
   1. Generate `music.json` (you should know how) without omnimixes or custom charts, then put it in `seeds/scripts/rerunners/ongeki/ongeki`.
   2. In the container, in `seeds/scripts/rerunners/ongeki`, run `npx ts-node parse-music-data.ts`.
   3. Check if `parse-music-data-output.json` doesn't list anything unexpected, then delete it.
3. Parse song durations
   1. Download `vgmstream-cli` and put it somewhere in the container.
   2. Run `npx ts-node parse-song-duration.ts -v <absolute-path-to-vgmstream-cli> -d <path-to-opts> -g ongeki`.
4. Scrape sdvx.in links (optional)
   1. Run `npx ts-node scrape-sdvx-in.ts`.
   2. Fix any missing entries manually in `seeds/collections/charts-ongeki.json` (refer to `songs-ongeki.json` for `songID`s).
5. Manually add search terms in `songs-ongeki.json`, especially romanizations (optional)
6. In the root project folder, run `just seeds test`.
