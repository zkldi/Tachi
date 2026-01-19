# Contribution Guides

The Tachi repository that you just set up is made up of multiple "components".

All of them have their own things going on, so this page has all the guides for each specific component.

## What can I contribute to?

In order of difficulty, here are the components of Tachi you can contribute to!

All of these sections summarise a part of Tachi, and end with a link to a guide you can use to
contribute to it.

### Issue Reports

You can report issues on the [GitHub](https://github.com/zkldi/Tachi) repository. This requires
_absolutely no programming knowledge_ on your part. All you have to do is write up a nice summary
of the bug.

!!! note
Although they're called GitHub _issues_, they're actually used for tracking anything. If you've
came up with a cool feature idea, send it over as an issue! `zk` will read and Triage them.

For more information, read our [Issue Reporting Guide](./components/issues.md).

### Documentation

We store our documentation as a series of markdown files in the [Main Repository](https://github.com/zkldichi). You can find it under the `docs/` folder.

Writing, maintaining and proofreading the documentation is something that is **severely** neglected
at the moment. Simple things like typo fixes, all the way up to writing new explanations about major features
are **thoroughly** appreciated, as `zk` prioritises maintaining the core of working code.

If you're interested in this, check out the [Documentation Contribution Guide](./components/documentation.md).

### Database Seeds

We use an interesting system for parts of our database. We actually store a game's songs and charts _in_
our GitHub repository! That means you can:

- Open the `songs` file for a game.
- Edit a `title` of a song that has a typo.
- Add a couple new songs that were added in the latest update
- Submit your changes back and if they're accepted...
- They automatically synchronise with the site!

!!! important
This part of Tachi is the most important part for external contributors.
You guys know these games better than `zk` does, and you guys keep an eye on all the updates for your games!

    If people don't add songs/charts to this database, `zk` will **not** keep an eye on the game for you! Someone *has* to pick up the reigns for each game!

    If you want to add/fix songs, charts, folders or tables for your favourite game - **START HERE!**

    Or in general, if you just want to contribute and don't know what to -- **this is the MOST in need of help. Always.**

Want to get started on contributing to the Database? Check out our [Database Contribution Guide](./components/seeds.md).

### Server, Client

The server and client form the powerful _core_ of Tachi.

The server handles all of our logic -- How do we get scores, where should scores come from, how do we calculate all these stats and way more.

The client tries to then place a slick UI over that logic and its exposed API.

!!! warning
Tachi's core is not an amazingly complex beast, but it is _not_ going to be reasonably followable
with not a lot of programming experience. You'll need some background in programming to be able to do almost anything in this area.

    That said, we still have a thorough guide -- It's not *from 0*, but it is *from some programming knowledge*.

Want to get started on contributing to the Core? Check out our [Core Contribution Guide](./components/core.md).

We'll cover...

- Running a local development instance of Tachi.
- How to configure the server with `conf.json5`.
- How our codebase is laid out.
- How to run tests and more!

## That's it for now!

Everything else in Tachi isn't seeking external contribution at the moment. So, feel free to check
out one of the above linked guides!
