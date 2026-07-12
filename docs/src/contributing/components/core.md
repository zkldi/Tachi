# Client + Server Contribution Guide

The client and server are the meat and potatoes of Tachi. They handle all of our requests and display our fancy UI.

Contributing here is a bit more difficult than contributing to the seeds, but it's certainly not impossible!

Plus, it's good fun to be able to mess around with websites. If you've got something you want to mess around with, you might find it surprisingly easy to do!

## Pre-Setup

You must have [Setup a local dev environment](../setup.md) in order to work nicely with the docs!

## Component Overview

The content for the client is inside `client/` and the content for the server is inside `server/`.

The client and server share quite a bit of code. This is inside `common/`.

To run the client and server, use `just start`. You can hit `Ctrl+C` to stop the server.

## Editing the Client

With `just start` running, the client will listen for changes you make, and reload accordingly. You will see your changes reflected on http://localhost:3000.

## Editing the Server

Likewise, with `just start` running, the server will listen for changes you make, and reload accordingly.

!!! warning
	Be careful with triggering a server reload. If you do it mid-import you can cause some serious state issues.

	If you suspect that your local state is screwed up, run `just wipe-local-db` to reset
	the database.

## Getting real data

The client, out of the box, is sort of hard to test because you'll have no scores to display.

Use `just load-kamai-dataset` or `just load-boku-dataset` to load a *real* dataset from either of the Tachis.

You'll then need to edit `server/conf.json5` and change `MONGO_DATABASE_NAME` to `"anon-kamai"` or `"anon-boku"`.

Everyone's passwords are set to `password`, so feel free to log in as anyone, and see real data!
