# Tachi

This is the main monorepo for Tachi.

![](.github/img/tachi.png)
![](.github/img/tachi-2.png)

## What is Tachi?

Tachi is a modern, powerful, modular Rhythm Game Score Tracker.

In short, it does the things that people would otherwise make spreadsheets for.

Tachi is a score tracker and analyser for various rhythm games.
It was designed out of a dislike for existing websites that display your scores.
I think that scores are integral to the rhythm game experience, and that displaying them
properly is _just_ as important!

By using Tachi, you get access to powerful, novel rhythm game score-tracking features, like automatically breaking your scores into sessions, setting goals and rivals, and more!

Full database dumps for Tachi are published semi-regularly (when I remember to); see [tachi-datasets](https://github.com/zkldi/tachi-datasets).

## Quick Setup For Experienced Programmers

- Open `Tachi` in [VSCode](https://code.visualstudio.com) or [Cursor](https://cursor.com).
- Other editors can be used, but you will need to set up devcontainers yourself.
- Install the `Dev Containers` extension
- Run `Dev Container: Rebuild and Open in Container`
- (It can take a couple minutes to build and bootstrap)
- You should be placed inside a vscode instance called `Tachi (dev-container)`
- Inside there, you'll have a perfectly set up shell with fancy utils and fancy graphics. Use `just start` to start Tachi, use `seeds` to run seeds scripts, etc.

**Doing Tachi dev outside of the devcontainer is unsupported.** The container is set up perfectly with the right versions of everything and is the expected way to do things.
Please do not report bugs in the local setup if you are not using the devcontainer.

### Loading data

If you want to load real data into localdev, use `just db-load-dataset` to interactively
load real datasets from the [tachi-datasets](https://github.com/zkldi/tachi-datasets).

## Repository Info

This monorepo contains the following codebases:

- `typescript/client/`, Which is a React frontend for Tachi. (AGPL3)

The client and the server are fairly decoupled. Someone could trivially create their own frontend client for Tachi.

- `typescript/server/`, Which is an Express-Typescript backend for Tachi. (AGPL3)

This contains all of our API calls, and interfaces with our database, and powers the actual score import engine.

- `seeds/`, Which is a git-tracked set of data to be synced with Tachi. (unlicense)

**This is the source of truth for the songs, charts, and more on the site!**
By submitting PRs to this, you can fix bugs on the website, add new charts, and more.

- `typescript/bot/`, Which is a discord bot frontend for Tachi. (MIT)

- `typescript/common/`, Which contains common types, utils and functions shared between all other packages. (MIT)

This is also published to NPM when it hits production.

- `docs/`, Which contains Tachi documentation. (MIT)

- `typescript/sieglinde/`, Which contains our BMS/PMS analysis functions. (MIT)

- `java/beatoraja-ir/`, Which is the Tachi Internet Ranking implementation for the LR2oraja variant of beatoraja. (MIT)
