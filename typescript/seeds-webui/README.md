# Seeds WebUI

The seeds workstation. Browse, query, diff over git history - and, in
localdev, edit `db/seeds/*.json` directly.

## Running

```sh
# Local dev (editing enabled, spawns a Vite dev server on :3003)
just seeds-webui

# Build a static, read-only bundle (no editing)
cd typescript/seeds-webui && bun run build
```

## Shape

- **Static SPA in prod.** Hosted at `seeds.tachi.ac`. No backend; reads
  commit history from the GitHub REST API and the current seeds from a
  pre-built `/seeds-bundle/` snapshot shipped with the site.
- **Dev mode adds a Vite plugin** (`dev/vite-plugin-seeds-dev.ts`) that
  mounts `/__seeds/*` against the local repo's `db/seeds/`. That plugin is
  _only_ loaded during `vite dev`; `vite build` never includes it.
- **In-browser SQLite** (`@sqlite.org/sqlite-wasm` + OPFS) for queries.
  The worker at `src/lib/sqlite/worker.ts` ingests collections on first
  load and caches them in OPFS by content hash.
- **Drafts** are queued in IndexedDB. The Drafts drawer composes them into
  JSON Patches and calls `transport.writeCollection`, which in dev mode
  rewrites the file and re-runs `sort-seeds.js`.

## Edit-mode safety

Two locks:

1. `VITE_SEEDS_EDIT_MODE` is set to the literal `false` during `vite
   build`, so every `EDIT_MODE`-guarded branch is tree-shaken out of the
   prod bundle.
2. At runtime, the transport additionally probes `/__seeds/ping` before
   unlocking edit paths. A static host where somebody deploys a dev build
   by mistake will still act read-only.
