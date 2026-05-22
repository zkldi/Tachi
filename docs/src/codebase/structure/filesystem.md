# File/Folder Organisation

`tachi-server` has a specific setup of files and folders
to ensure that code is at where it's most sensible.

!!! note
	This documentation is a rough guide for where
	to place files if you are writing a new file,
	or where to look for certain functionality.

	It is not a comprehensive tutorial for every file
	in the repo, as that would be a pain to keep updated.

*****

## Top Level

All of these are at the root level of the project.

### `/src`

All of the server TypeScript code goes here.

### `/js`

!!! info
	This folder is gitignored.

When compiled, `tsc` will output the JS code here.

### `/scripts`

Various scripts for interacting with `tachi-server`, such
as single-use scripts for importing some data, or
frequently used scripts such as updating BMS tables.

## TypeScript Source Code

All of these are inside `/src`.

### `/datasets`

Some of `tachi-server`'s code interacts with datasets that
aren't worth putting into MongoDB, such as splash text.

This is mainly for things where we want to randomly select
from the list, and not perform any serious lookups - which
is why it's a good fit for splash text/automatic session names.

!!! info
	Selecting a random element from an entire collection
	in MongoDB is relatively expensive, and would quadruple
	the time an import takes.

!!! warning
	TypeScript does not support copying over non-code files.

	You can use `cp` in post to move files around, or
	place the data in memory, either is fine.

### `/external`

Code relating to the "external" applications for `tachi-server`,
such as MongoDB and Redis.

### `/lib`

Sets of code for `tachi-server` functionality. This is the
main important part of the codebase for handling things
like score imports, logging, and more.

### `/server`

This contains the express application that `tachi-server`
uses in order to be a server.

This contains our API, IR implementations and a way of
serving our PWA.

### `/test-utils`

Tachi's tests need mocks and some specialised code in order
to work well. This folder contains all of those things.

!!! warning
	**NOTHING** from this folder should be ran in production.

### `/utils`

Small utilities for interacting with Tachi, such as
functions that retrieve a user given certain params.

This also contains utilities for handling song/chart
database lookups - such as looking up on BMS hash.

## Express Server

All of the below folders are under `/src/server`.

As mentioned above, Tachi stores the routing for our
APIs and IR implementations here.

### `/middleware`

This contains the middleware we use for the server,
such as authentication middleware and such.

### `/router`

This contains the actual 'routes' for our server.

The folders here **MUST** be 1:1 with the endpoints
on the server. For example, the implementation of

```
https://boku.tachi.ac/api/v1/foo/bar
```

**MUST** be found at `src/server/router/api/v1/foo/bar/router.ts`

### Router Files

The only files allowed to declare endpoints are `router.ts` files.

This allows us to separate functionality from API structure
in cases where an API call needs to do a lot of things.

## Test Files

This documentation has been moved to [its own page](./testing.md)!
