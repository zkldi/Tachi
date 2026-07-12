# Score import load tests (HTTP)

Stress **`POST /api/v1/import/file`** against a **running** Tachi instance using real fixtures from `src/test-utils/test-data/` (CSV, XML, JSON).

## Prerequisites

- Server reachable (e.g. `http://127.0.0.1:8080` when using local `PORT`).
- Accounts with **`submit_score`**:
  - **Session:** login cookie (see below) - **one in-flight import per user**, so keep **`--concurrency 1`** unless you only care about rate limits.
  - **API tokens:** one token per parallel slot. Generate many tokens with the seeder (below).

**Rate limiting:** In dev, score imports are limited to **5 per minute per IP** unless you set:

```bash
export TACHI_DISABLE_SCORE_IMPORT_RATE_LIMIT=true
```

Restart the server after changing this. Turn it off when you are done load testing.

## Commands

From repo root, prefer **`just`** (see `Justfile-test`). From **`typescript/server`**, you can use **`bun`** directly.

### Run the load CLI

```bash
# From repo root
just load-test-score-import -- \
  --url http://127.0.0.1:8080 \
  --token-file ./tokens.txt \
  --requests 40 \
  --concurrency 8 \
  --import-type file/eamusement-iidx-csv \
  --mutate-body
```

Equivalent from `typescript/server`:

```bash
bun run load-test:score-import -- --url http://127.0.0.1:8080 --token-file ./tokens.txt ...
```

### Seed many API tokens (parallel imports)

Creates N users in **your configured Postgres** (same DB as the server) and writes one bearer token per line:

```bash
just load-test-score-import-seed-tokens 64 /tmp/tachi-load-tokens.txt
```

Then:

```bash
just load-test-score-import -- \
  --url http://127.0.0.1:8080 \
  --token-file /tmp/tachi-load-tokens.txt \
  --requests 128 \
  --concurrency 64 \
  --mutate-body
```

### Session cookie (single-user, sequential)

1. Log in (example: admin / dev password, captcha `test`):

   ```bash
   curl -sS -c cookies.txt -X POST http://127.0.0.1:8080/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","!password":"password","captcha":"test"}'
   ```

2. Build the `Cookie` header from `cookies.txt` (Netscape format: the `Tachi_*_SESSION` line is tab-separated; do not use `grep -v '^#'` or you will drop `#HttpOnly_…` lines).

3. Run with **`--cookie 'Tachi_…_SESSION=…'`** and **`--concurrency 1`**.

## Useful flags

| Flag | Purpose |
|------|--------|
| `--url` | Origin only, no trailing slash (required). |
| `--token-file` | One `Bearer` token per line (`#` comments ok). |
| `--requests` / `--concurrency` | Total uploads and parallel batch size (≤ token count for multi-user). |
| `--import-type` | `file/eamusement-iidx-csv` (default), `file/solid-state-squad`, `file/batch-manual`, etc. |
| `--file` | Override fixture path (defaults pick a file under `test-utils/test-data` per import type). |
| `--playtype` | `SP` / `DP` for IIDX CSV. |
| `--set key=value` | Extra multipart fields (repeatable). |
| `--mutate-body` | Slightly vary each upload (timestamps / scores) so payloads differ. |
| `--timeout-ms` | Per-request fetch timeout (`0` = none). |

## Behaviour notes

- **409** if the same user starts a second import before the first finishes.
- **429** from the score-import rate limiter unless disabled via env (above).
- **200** synchronous success; **202** if the server uses an external score-import worker (queued).
- Heavy runs (large CSV + high concurrency) will stress CPU, Postgres, and Redis; watch Grafana / local metrics.

## Files

- `score-import-load-cli.ts` - multipart client.
- `seed-stress-api-tokens.ts` - bulk token seeder for dev DBs.
