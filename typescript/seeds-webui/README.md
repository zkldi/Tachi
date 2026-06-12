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
