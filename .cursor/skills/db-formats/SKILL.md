---
name: db-formats
description: Guidance on using db-formats/ column lists (SELECT_*) and document mappers (To*Document) instead of selectAll() when writing Postgres-backed endpoints in the Tachi server. Use when writing a new endpoint that reads from a Postgres table, adding a new db-formats file, or when working with Kysely selects that need to return API-compatible (v1-mongodb-like) response shapes.
---

# db-formats: Column Lists & Document Mappers

## Why not `.selectAll()`

`.selectAll()` is banned in endpoint code because it:

- Returns raw snake_case Postgres column names directly to API consumers (breaks the v1 MongoDB-compatible contract)
- Over-fetches columns (e.g. `client_secret` on a public endpoint, internal credential columns)
- Gives no compile-time guarantee that the row shape matches the `tachi-common` document type

**Exceptions** where `.selectAll()` is fine:
- Internal/private lookups that never reach API responses (e.g. `priv_account_credential` for password verification)
- Assertions on audit rows in tests (`DB.selectFrom("action").selectAll()...`)

---

## The pattern

Every Postgres table that is returned through the API needs two things in `src/lib/db-formats/<table>.ts`:

1. **`SELECT_*`** - a `const` array of `"table.column"` strings listing exactly the columns needed
2. **`To*Document`** - a mapper function that converts a typed Kysely row to the matching `tachi-common` document type

```typescript
// src/lib/db-formats/my-table.ts
import { type Selection } from "kysely";
import { type MyDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_MY_TABLE = [
    "my_table.user_id",
    "my_table.some_column",
] as const;

export function ToMyDocument(
    row: Selection<Database, "my_table", (typeof SELECT_MY_TABLE)[number]>,
): MyDocument {
    return {
        userID: row.user_id,         // snake_case → camelCase
        someColumn: row.some_column,
    };
}
```

The `Selection<Database, "table", (typeof SELECT_*)[number]>` type ensures the mapper only receives columns that were actually selected - Kysely will error at compile time if the select array and mapper fall out of sync.

---

## Using it in an endpoint

```typescript
import { SELECT_MY_TABLE, ToMyDocument } from "#lib/db-formats/my-table";

// Many rows
const rows = await DB.selectFrom("my_table")
    .select(SELECT_MY_TABLE)
    .where("user_id", "=", userId)
    .execute();

return res.status(200).json({
    success: true,
    description: "...",
    body: rows.map(ToMyDocument),
});

// Single row
const row = await DB.selectFrom("my_table")
    .select(SELECT_MY_TABLE)
    .where("user_id", "=", userId)
    .executeTakeFirst();

return res.status(200).json({
    success: true,
    description: "...",
    body: row ? ToMyDocument(row) : null,
});
```

---

## v1-MongoDB-compatible mapping conventions

The `To*Document` function is responsible for all shape translation. Common patterns:

| Postgres column type | API document shape | Example |
|---|---|---|
| `snake_case` columns | `camelCase` fields | `user_id` → `userID`, `client_id` → `clientID` |
| `ISO 8601` timestamp string | Unix milliseconds (`number`) | `ISO8601ToUnixMilliseconds(row.joined)` → `joinDate` |
| `pm_*` nullable boolean columns | Array or permissions object | `if (row.pm_submit_score) perms.push("submit_score")` |
| `bd_*` boolean badge columns | `badges: UserBadges[]` array | `if (row.bd_alpha) badges.push("alpha")` |
| `sm_*` social media columns | `socialMedia: { ... }` object | `{ discord: row.sm_discord, ... }` |
| V3 combined game column | `{ game, playtype }` split | `V3ToGamePT(row.game)` |
| `auth_level` enum string | `authLevel: number` | `AuthLevelToInt(row.auth_level)` |

---

## Stripping sensitive columns on public endpoints

`SELECT_API_CLIENT` includes `client_secret`. If the endpoint is public-facing (not the client owner), strip it after mapping:

```typescript
const { clientSecret: _secret, ...publicDoc } = ToAPIClientDocument(row);
```

---

## Adding a new db-formats file: checklist

1. Create `src/lib/db-formats/<table>.ts`
2. Export `SELECT_<TABLE>` as a `const` array of `"table.column"` strings (use the qualified `table.column` form, not bare column names, to avoid ambiguity in joins)
3. Export `To<Entity>Document` typed with `Selection<Database, "table", (typeof SELECT_<TABLE>)[number]>`
4. Return the matching `tachi-common` document type (import from `"tachi-common"`)
5. Apply all naming/shape conventions from the table above
6. Import and use `SELECT_*` + `To*Document` in the router/util - never `.selectAll()`

---

## Existing db-formats files

| File | Table | Document type |
|---|---|---|
| `api-client.ts` | `priv_api_client` | `TachiAPIClientDocument` |
| `api-token.ts` | `priv_api_token` | `APITokenDocument` |
| `user.ts` | `account` | `UserDocument` |
| `user-settings.ts` | `account_settings` | `UserSettingsDocument` |
| `game-profiles.ts` | `game_profile` | `UserGameStats` (ratings + classes); UGPT preferences and showcase JSON also live on `game_profile` |
| `kshook-sv6c-settings.ts` | `svc_kshook_sv6c_settings` | `KsHookSettingsDocument` |
