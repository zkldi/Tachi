/**
 * `API_V1_ROUTER` is the singleton TypedRouter that every `/api/v1/...`
 * submodule registers its routes on. It lives in its own module (with no
 * transitive imports of any submodule) so that:
 *
 *   1. `router.ts` can synchronously `import "./sub/router"` every submodule
 *      to register routes as a side effect, then call `API_V1_ROUTER.build()`.
 *   2. The submodules' `import { API_V1_ROUTER } from "../_singleton"` does
 *      NOT cycle through `router.ts` (the previous setup had submodules
 *      importing `../router`, which made the only way to break the cycle
 *      `await import(...)` + top-level await in `router.ts` - and vitest's
 *      vite-node under `pool: "threads" + isolate: false` does not reliably
 *      wait for TLA before serving a module's exports to a static import).
 *
 * Keep this module dependency-light: it must not, transitively, import
 * anything that itself imports any of the route submodules.
 */

import { TypedRouter } from "#lib/router/typed-router";

import { API_V1_SPEC } from "./spec";

export const API_V1_ROUTER = new TypedRouter(API_V1_SPEC);
