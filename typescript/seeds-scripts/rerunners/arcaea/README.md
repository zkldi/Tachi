1. Have a working Tachi Docker container
2. Parse music data
   1. Get the latest APK and extract `songlist` and `packlist` from `assets/songs`
   2. `bun run merge-songlist.ts -i <path/to/songlist> -p <path/to/packlist>`
3. Fetch notecounts/internal levels
   1. `bun run notes-and-constant.ts`
   2. There is also the backup option of scraping wikiwiki (not recommended)
4. Run `just db-load-seeds`
