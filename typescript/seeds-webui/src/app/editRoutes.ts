import type React from "react";

import { Bulk } from "#pages/Bulk";
import { Drafts } from "#pages/Drafts";
import { Validate } from "#pages/Validate";

// This module is only imported from a `EDIT_MODE ? import("...")` call site,
// which in a prod build (with EDIT_MODE === false literal) is dead code. As a
// result rollup never traces through this file and none of the edit-only
// pages end up in the output bundle.
export const editRoutes: Array<{ component: React.ComponentType; path: string }> = [
	{ component: Bulk, path: "/bulk" },
	{ component: Drafts, path: "/drafts" },
	{ component: Validate, path: "/validate" },
];
