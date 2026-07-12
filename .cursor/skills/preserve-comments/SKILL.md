---
name: preserve-comments
description: Preserves existing code comments (line, block, JSDoc, region markers) when editing files; does not delete or collapse comments for brevity unless the user asked to remove or update them. Use when editing any source file, refactoring, or applying fixes where comments already exist.
---

# Preserve comments when editing

## Default rule

When changing code, **keep existing comments** in place unless one of the exceptions below applies.

- **Line comments** (`//`), **block comments** (`/* */`), **JSDoc/TSDoc** (`/** */`), and **region/pragma-style markers** the file already uses - preserve them; do not strip them to “clean up” or shorten the diff.
- If a comment sits next to changed logic, **update the comment only when the behavior it describes changed**. Otherwise leave it untouched.
- **Do not** replace a nuanced comment with nothing, or with a shorter generic note, unless the user asked for that.

## When removal or heavy edits are OK

- The user **explicitly** asked to remove comments, delete dead documentation, or “dedupe” comments.
- The comment is **factually wrong** after the edit and would mislead readers - then fix or remove that comment and prefer a short accurate replacement over silence.
- The **entire block of code** the comment referred to is deleted - remove or relocate the comment so it does not orphan misleading text (or move it if it still applies elsewhere).

## What this is not

- This does not require adding new comments for every change.
- This does not forbid editing comments when they must track the code.
