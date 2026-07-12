---
name: coverage-tools
description: >-
  Aggregates Vitest v8/Istanbul coverage across Tachi workspaces via
  tachi-coverage-tools (manifest, CLI, optional programmatic API). Use when
  measuring test coverage, reviewing coverage after changes, adding CI gates,
  registering a new Vitest package, or when the user mentions coverage reports,
  coverage-final.json, or just coverage-report.
---

# Coverage tools (tachi-coverage-tools)

## When to use

- After running tests with coverage, to see totals and cold areas.
- When adding a new workspace that runs Vitest with `--coverage`.
- To gate CI on minimum line coverage (`--min-lines` + `--strict`).

## Prerequisite

Coverage JSON is produced by Vitest v8 with `--coverage` (e.g. `just test-typescript`). Output is under each package’s `coverage/` directory (gitignored). If reports are missing, run tests with coverage first.

## Commands (repo root)

| Command | Purpose |
|--------|---------|
| `just coverage-report` | Table: lines, statements, functions, branches per registered package |
| `just coverage-report --by-dir` | Same plus top-level `src/*` buckets (server/bot) |
| `just coverage-report --json` | Machine-readable `CoverageReport` on stdout |
| `just coverage-report --packages server` | Filter by manifest `id` (comma-separated) |
| `just coverage-report --min-lines 80 --strict` | Exit non-zero if files missing or line % below floor |

Implementation: workspace package `typescript/coverage-tools` (`bun run --filter tachi-coverage-tools report`).

## Registering a new Vitest package

Edit `typescript/coverage-tools/src/manifest.ts`: add a `CoverageSource` with:

- `id` - short name for `--packages`
- `packageRoot` - e.g. `typescript/my-pkg`
- `coverageFinal` - path to `coverage/coverage-final.json` relative to repo root (Vitest default unless `coverage.reportsDirectory` overrides)

## Programmatic use

```typescript
import { buildReport, COVERAGE_SOURCES } from "tachi-coverage-tools";
```

`buildReport({ repoRoot, packageIds, byDir })` returns `CoverageReport` (see `typescript/coverage-tools/src/report-coverage.ts`).

## Related files

- `typescript/coverage-tools/src/manifest.ts` - source registry
- `typescript/coverage-tools/src/report-coverage.ts` - CLI flags and `buildReport`
- `Justfile-test` - `coverage-report` recipe
