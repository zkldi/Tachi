---
name: exhaustive-switch
description: Prefer staticAssertUnreachable in the default branch of switches that must cover every variant of a union, so exhaustiveness is checked at compile time. Use when writing or reviewing switch on discriminated unions, string literal unions, enums, or any switch meant to be exhaustive in the Tachi TypeScript server.
---

# Exhaustive switches with `staticAssertUnreachable`

## When to use

Use this pattern when the `switch` is **meant to be exhaustive**: every value of the discriminant type should have a `case`, and adding a new variant later should cause a **TypeScript error** until a new `case` is added.

## Pattern

1. Import `staticAssertUnreachable` from `#utils/misc.js` (server code).

2. Bind the switched value in a variable if needed so the `default` branch receives a narrowed type.

3. In `default`, call `staticAssertUnreachable(discriminant)` with the same value you are switching on (after all `case`s, TypeScript should infer its type as `never`).

```typescript
import { staticAssertUnreachable } from "#utils/misc.js";

switch (value) {
	case "a":
		return 1;
	case "b":
		return 2;
	default:
		staticAssertUnreachable(value);
}
```

For a block body:

```typescript
default: {
	staticAssertUnreachable(gpt);
}
```

Reference: `staticAssertUnreachable` in `typescript/server/src/utils/misc.ts` - it takes `never` and throws at runtime if execution reaches it.

## Why

- **Compile time**: If a new union member is added and not handled, `default` no longer receives `never`, and TypeScript reports an error.
- **Runtime**: If a value slips through anyway, you get a clear error instead of silent wrong behavior.

## Avoid

- A `default` that only `throw new Error("unreachable")` **without** passing a `never`-typed value - you lose exhaustiveness checking.
- `default: break` or empty `default` on switches that are supposed to be exhaustive - same problem.

## When not to use

- Switches that are **intentionally partial** (e.g. only handle some cases and fall through to shared logic). Use an explicit `default` that handles “everything else” with correct typing, not `staticAssertUnreachable`.
- If the discriminant is typed too widely (e.g. `string`), `default` will not be `never` and the pattern will not typecheck - narrow the type first or handle the real domain of values.

## Imports

In `typescript/server`, prefer `#utils/misc.js`. Relative imports to `./misc` are acceptable next to `utils/misc.ts` (see `conversion.ts`).
