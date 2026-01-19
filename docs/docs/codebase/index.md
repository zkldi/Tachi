# Codebase Overview

This part of the documentation is for the [Tachi-Server](https://github.com/zkldi/Tachi/tree/main/server) codebase.

## Codebase Documentation vs. Code Documentation

This is documentation for the **Codebase**. **NOT** documentation for the code.

The distinction is because we aren't writing a library here - there's no need to document function
signatures or what function calls are meant to do. That can all be done inline because no other
projects depend on our function calls!

This documentation is more meta-level. Why things are in certain folders, what certain enums
correspond to, how `thing` works, etc.

## Repos and Licenses

Tachi is a monorepo, and is made up of many projects. These are:

- `client/`, Which is a React frontend for Tachi.

The client and the server are fairly decoupled. Someone could trivially create their own frontend client for Tachi.

- `server/`, Which is an Express-Typescript backend for Tachi.

This contains all of our API calls, and interfaces with our database, and powers the actual score import engine.

- `seeds/`, Which is a git-tracked set of data to be synced with Tachi.

**This is the source of truth for the songs, charts, and more on the site!**
By submitting PRs to this, you can fix bugs on the website, add new charts, and more.

- `bot/`, Which is a discord bot frontend for Tachi.

- `common/`, Which contains common types, utils and functions shared between all other packages.

This is also published to NPM when it hits production.

- `docs/`, Which contains Tachi documentation.

- `sieglinde/`, Which contains our BMS/PMS analysis functions.

Of these, `server/` and `client/` are licensed under the AGPL3. The `seeds/` are licensed under the unlicense, and everything else is MIT.
