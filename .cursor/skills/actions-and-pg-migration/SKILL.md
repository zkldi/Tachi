---
name: actions-and-pg-migration
description: Patterns for writing actions (MakeAction/MakeAnonAction), using the Postgres DB (Kysely), and migrating Express routes from MongoDB to Postgres in the Tachi server. Use when adding a new mutation, migrating a Mongo-backed router to Postgres, writing action files, or writing tests for actions or routers.
---

# Actions & Postgres Migration - Tachi Server

## Actions

### Signatures

All action input/output schemas live in `src/lib/actions/actions.ts`. Add a new entry to `ActionSignatures` (for authenticated actions) or `AnonActionSignatures` (for unauthenticated ones):

```typescript
// src/lib/actions/actions.ts
MY_ACTION: {
    input: z.object({ ... }),
    output: z.object({ ... }),
},
```

### Action files

Place the implementation in `src/actions/my-action.ts`:

```typescript
import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_MyAction = MakeAction(
    "MY_ACTION",
    async (taker, { fieldA, fieldB }) => {
        // taker.acct.id  - authenticated user's numeric ID
        // taker.acct.username - their username
        // taker.ip - request IP (for audit log)

        if (somethingWrong) {
            throw new ExpectedErr(400, "Human-readable reason.");
        }

        await DB.insertInto("priv_some_table").values({ ... }).execute();

        return { result: "value" }; // must match output schema
    },
);
```

`MakeAction` automatically writes an `action` row (`kind`, `result: "GOOD"|"BAD"`, `ip`, `user_id`) to the `action` audit table on every call. `MakeAnonAction` is the same but `taker` only has `ip` (no `acct`).

### ExpectedErr

`ExpectedErr(code, reason)` is an intentional control-flow error. Throw it for 400/403/404/409 etc. The global Express error handler in `server.ts` (`MAIN_ERR_HANDLER`) catches it and returns `{ success: false, description: reason }` with the right HTTP status. **Never wrap action calls in `try/catch`** - let it propagate.

### Calling actions from a router

```typescript
// taker construction - same pattern everywhere:
const user = req.session.tachi?.user;
if (!user) return res.status(401).json({ success: false, description: "..." });

const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

// No try/catch - errors reach MAIN_ERR_HANDLER automatically
const result = await ACTION_MyAction(taker, { fieldA: body.fieldA });

return res.status(200).json({ success: true, description: "...", body: result });
```

---

## Postgres / Kysely

### DB import

```typescript
import DB from "#services/pg/db";          // routers / utils
```

`DB` is a typed `Kysely<Database>` instance. Types come from the generated `tachi-db` workspace package (`src/generated/public/Priv*.ts`).

### Table naming

Postgres tables use `snake_case`. Private/sensitive tables are prefixed `priv_`. Permissions are sparse boolean columns named `pm_<permission_name>`.

| Concept | Mongo | Postgres |
|---|---|---|
| API clients | `api-clients` | `priv_api_client` |
| API tokens | `api-tokens` | `priv_api_token` |
| Users | `users` | `account` |

### Column lists & document mappers

Reusable `SELECT_*` arrays and `To*Document` mappers live in `src/lib/db-formats/`. Use them to avoid repetition and keep types consistent:

```typescript
import { SELECT_API_CLIENT, ToAPIClientDocument } from "#lib/db-formats/api-client";

const rows = await DB.selectFrom("priv_api_client")
    .select(SELECT_API_CLIENT)
    .where("author", "=", userId)
    .execute();

const docs = rows.map(ToAPIClientDocument); // → TachiAPIClientDocument[]
```

`SELECT_API_CLIENT` includes `client_secret`. For public-facing lookups, strip it after fetching:

```typescript
const { clientSecret: _secret, ...publicDoc } = doc;
```

### Common query patterns

```typescript
// Select one
await DB.selectFrom("priv_api_client")
    .select(["client_id", "author"])
    .where("client_id", "=", id)
    .executeTakeFirst(); // returns undefined if not found

// Insert
await DB.insertInto("priv_api_client").values({ ... }).execute();

// Update (fetch after separately - don't use .returning() with prefixed column lists)
await DB.updateTable("priv_api_client").set({ name: "New" }).where("client_id", "=", id).execute();
const updated = await GetClientByID(id); // re-fetch via existing query helper

// Delete
await DB.deleteFrom("priv_api_token").where("from_oauth2_client", "=", id).execute();

// Count
const { count } = await DB.selectFrom("priv_api_client")
    .select(DB.fn.countAll().as("count"))
    .where("author", "=", userId)
    .executeTakeFirstOrThrow();
```

Existing query helpers (e.g. `GetClientByID`) live in `src/utils/queries/`. Use them in routers; actions can query directly.

---

## Migrating a Mongo-backed router to Postgres

### Checklist

1. **Identify Mongo collections** → find the equivalent `priv_*` Postgres table.
2. **Reads** - replace `MONGODB_KILL["collection"].find/findOne()` with Kysely selects. Use the existing `SELECT_*` + `To*Document` helpers from `src/lib/db-formats/`.
3. **Mutations** - extract each write operation into a `MakeAction`-wrapped file in `src/actions/`. Add its signature to `ActionSignatures` in `actions.ts`.
4. **Middleware** - update any middleware that does Mongo lookups (e.g. `GetClientFromID`) to use a query helper or direct Kysely query.
5. **Remove Mongo import** - `MONGODB_KILL` should be gone from the file.
6. **Ownership checks** - move them inside the action (`taker.acct.id === row.author`) rather than in Express middleware, so the action is self-contained.
7. **Error handler** - throw `ExpectedErr` instead of returning early; no `try/catch` in routes needed.

### Permission columns

Mongo stored permissions as an array. Postgres uses individual nullable boolean columns (`pm_submit_score`, `pm_customise_profile`, etc.). Convert with:

```typescript
// array → columns
perms.includes("submit_score") ? true : null   // null = permission not granted

// columns → array (see ToAPIClientDocument for full example)
if (row.pm_submit_score) result.push("submit_score");
```

---

## Testing

### Framework & setup

- **Vitest** + colocated `*.test.ts` files (not `__tests__/` folders)
- Each test worker gets its own DB, truncated between every test via `vitest.setup.ts`
- Run with `bun run test`

### Action tests (unit-style)

```typescript
import { seedUser } from "#test-utils/pg-fixtures";
import { seedApiClient } from "./test-utils/api-tokens";

describe("ACTION_MyAction", () => {
    let userId: number;
    let username: string;

    beforeEach(async () => {
        ({ id: userId, username } = await seedUser({ username: "test_user" }));
    });

    it("throws 404 when resource does not exist", async () => {
        const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
        await expect(ACTION_MyAction(taker, { id: "missing" }))
            .rejects.toMatchObject({ code: 404 });
    });

    it("writes a GOOD action row on success", async () => {
        const taker = { ip: "10.0.0.1", acct: { id: userId, username } };
        await ACTION_MyAction(taker, { ... });

        const row = await DB.selectFrom("action")
            .selectAll()
            .where("kind", "=", "MY_ACTION")
            .executeTakeFirstOrThrow();

        expect(row).toMatchObject({ result: "GOOD", ip: "10.0.0.1", user_id: userId });
    });
});
```

### Router integration tests

```typescript
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";

afterAll(() => CloseServerConnection());

async function loginAs(username: string, password = "password123") {
    const res = await mockApi.post("/api/v1/auth/login").send({
        username, "!password": password, captcha: "test",
    });
    return res.headers["set-cookie"] as unknown as string[];
}

describe("POST /api/v1/some/route", () => {
    let cookie: string[];

    beforeEach(async () => {
        await seedUser({ username: "test_user", withCredential: true, withSettings: true });
        cookie = await loginAs("test_user");
    });

    it("returns 401 when not authenticated", async () => {
        const res = await mockApi.post("/api/v1/some/route").send({ ... });
        expect(res.status).toBe(401);
    });

    it("returns 200 on success", async () => {
        const res = await mockApi.post("/api/v1/some/route")
            .set("Cookie", cookie)
            .send({ ... });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
```

### Key test fixtures

| Helper | Source | Purpose |
|---|---|---|
| `seedUser(opts?)` | `#test-utils/pg-fixtures` | Insert `account` row; `withCredential` + `withSettings` needed for login |
| `seedApiClient(opts)` | `src/actions/test-utils/api-tokens` | Insert `priv_api_client` row |
| `seedApiToken(opts)` | `src/actions/test-utils/api-tokens` | Insert `priv_api_token` row |
| `getApiToken(token)` | `src/actions/test-utils/api-tokens` | Select a token row by value |
