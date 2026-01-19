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

There are way more features that Tachi has, and you can read about all of them [here](https://docs.tachi.ac/wiki/features).

## Setup

Tachi maintains a setup guide that is easy to follow even if you've never programmed before.

Check the [Documentation](https://docs.tachi.ac/contributing/setup) for how to set Tachi up.

You can then check the component-specific guides to see how to run those components and contribute back!

## Quick Setup For Experienced Programmers

- Open `Tachi` in vscode
- Install the `Dev Containers` extension
- Run `Dev Container: Rebuild and Open in Container`
- (It can take a couple minutes to build and bootstrap)
- You should be placed inside a vscode instance called `Tachi (dev-container)`
- Inside there, you'll have a perfectly set up shell with fancy utils and fancy graphics. Use `just start` to start Tachi, use `seeds` to run seeds scripts, etc.

You should not be doing Tachi dev outside of the container. The container is set up perfectly with the right versions of everything and working ESLint and all that.

### Unsupported stuff

Tachi is intended to be developed inside a container. This ensures that you have the correct version of MongoDB, Redis, Typescript and all that jazz.

VSCode has excellent native support for dev containers, and as such this is the only method of local development we recommend.

Over the years we have had a _lot_ of issues with people having subtle variations on their system (or on windows). Given the contributor-centricity of Tachi, it's untenable to expect every contributor to be an expert with local dev setup.

The devcontainer provides us with the most simple, consistent experience, and allows us to put nice-to-haves inside the user's shell.

That said, if you're against using vscode you can:

- Start up the docker-compose file.
- `docker exec` your way into the dev container to get a shell
- Run `./dev/bootstrap.sh` inside the container.
- Use this shell from now on to run Tachi commands! Edit the code in whatever editor you want.

If those instructions don't make sense to you, I really recommend just using dev containers.

Alternatively **if you want to work outside of docker you're on your own**. Figure out the correct versions for everything (npm, pnpm, mongo, redis, ts-node...) and `dev/bootstrap.sh`.

## Repository Info

This monorepo contains the following codebases:

- `client/`, Which is a React frontend for Tachi. (AGPL3)

The client and the server are fairly decoupled. Someone could trivially create their own frontend client for Tachi.

- `server/`, Which is an Express-Typescript backend for Tachi. (AGPL3)

This contains all of our API calls, and interfaces with our database, and powers the actual score import engine.

- `seeds/`, Which is a git-tracked set of data to be synced with Tachi. (unlicense)

**This is the source of truth for the songs, charts, and more on the site!**
By submitting PRs to this, you can fix bugs on the website, add new charts, and more.

- `bot/`, Which is a discord bot frontend for Tachi. (MIT)

- `common/`, Which contains common types, utils and functions shared between all other packages. (MIT)

This is also published to NPM when it hits production.

- `docs/`, Which contains Tachi documentation. (MIT)

- `sieglinde/`, Which contains our BMS/PMS analysis functions. (MIT)
