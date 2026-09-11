1. Have a working Tachi Docker container.
2. Parse music data
   1. Generate `music.json` (you should know how) without omnimixes or custom charts, then put it in `seeds/scripts/personal`.
   2. In the container, in `seeds/scripts/rerunners/ongeki`, run `bun parse-music-data.ts -m ../../personal/music.json`.
   3. Check if `parse-music-data-output.json` doesn't list anything unexpected, then delete it.
3. Parse song durations
   1. Download `vgmstream-cli` and put it in `seeds/scripts/personal`.
   2. Put opts in `seeds/scripts/personal`.
   3. Run `bun parse-song-duration.ts -v /tachi/typescript/seeds-scripts/personal/vgmstream-cli -d ../../personal/vgmstream-cli -g ongeki`.
4. Scrape sdvx.in links (optional)
   1. Run `bun scrape-sdvx-in.ts`.
   2. Fix any missing entries manually in `seeds/collections/charts-ongeki.json` (refer to `songs-ongeki.json` for `songID`s).
5. Manually add search terms in `songs-ongeki.json`, especially romanizations (optional)
6. Run `bun sync-bonus-track-data.ts` if any bonus tracks are present.
7. Run `bun check-data.ts` and verify the output.
8. Run `just db-load-seeds`.
