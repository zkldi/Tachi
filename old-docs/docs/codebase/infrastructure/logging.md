# Logging

As mentioned in the [Toolchain](./toolchain), we use
WinstonJS for logging. We use a slightly modified setup
of winston, but the same basic logging principles apply.

!!! note
If you like my defaults for logging, they can be quickly
invoked with the [Mei](https://github.com/zkldi/mei) wrapper.

---

## Log Levels

Tachi uses the following log levels, listed in order of
severity.

### Crit

```ts
logger.crit("foo");
```

`crit` or Critical is the most severe log level in tachi.

Calling this means **the process must now completely exit**.

This fail state is triggered in things like not being able
to connect to a Mongo or Redis instance, where the application
absolutely cannot function anymore and should quit immediately.

### Severe

```ts
logger.severe("foo");
```

`severe` is the second most severe log level in tachi.

Calling this means an error has occurred, and that error implies
it will apply to multiple parts of the codebase.

This log level is used with things like a Song-Chart
desync -- A chart must have a song as a parent, but if it
doesn't, that's a severe-level error.

Think of this like an error with wider-reaching implications.

### Error

```ts
logger.error("foo");
```

`error` is the third most severe log level in tachi.

Calling this means an error has occurred, but the impact of
it is limited to the function or general area it was called in.

Errors may be recovered from or ignored by the code, but generally that should be reserved for `warn`.

### Warn

```ts
logger.warn("foo");
```

`warn` indicates that something has gone wrong, but is safely
recoverable from, such as a mathematical function being given NaN unexpectedly, and just returning 0.

`warn` calls **MUST** be recoverable from, and must not
imply severe damage to the global state of the application.

### Info

```ts
logger.info("foo");
```

!!! info
This is the default [LOG_LEVEL](./config) for tachi.

    This means that all the levels below this are
    not displayed to the console or stored.

`info` indicates that something notable has happened. This
should not be used for any errors - instead, it should be
used for notable events, such as a new user signing up.

### Verbose

```ts
logger.verbose("foo");
```

`verbose` indicates that something has happened. This is
used for debugging, and is typically only enabled in dev
to find out what has gone wrong.

### Debug

```ts
logger.debug("foo");
```

`debug` is the least notable logging level. This is used
exclusively for debugging, and logs typically uninteresting
things like Captcha Requests being sent, or a single score was imported.

## Logger Usage

In `src/lib/logger/logger.ts` we define a wrapper around winston
for our logging needs. We use two functions for this.

The first function is `CreateLogCtx`. This spawns an
instance of the logger with "context".

This context allows us to keep track of common information
for the logger.

For file-level logging, you should do:

```ts
import CreateLogCtx from "~src/lib/logger/logger";
const logger = CreateLogCtx(__filename);

logger.info("foo");
// [src/file.ts] INFO: foo
```

!!! info
CreateLogCtx is short for Create Log Context.

This will spawn an instance of the logger with the context
of the current filename.

For more specific logging, you should create a logger
and pass it around as an argument to a function.

This is used in `src/lib/score-import`, as we create a
logger with the user's name and import type as "context".

```ts
const logger = CreateLogCtx(`${username} ${userID}`);

logger.info("foo");
// [zkldi INFO: foo

SomeOtherFunction(argument1, argument2, logger);
```

!!! info
Logger should be the last argument for a function that
takes a logger.

    The only exception to this is if it uses our `fetch` API,
    which **MUST** always be the last call.

If we have an existing logger and want to append context,
we can do that with the `AppendLogCtx` function.

```ts
const logger = CreateLogCtx("foo");

logger.info("hello!");
// [foo] INFO: hello!

const logger2 = AppendLogCtx("bar", logger);

logger2.info("hello!");
// [foo | bar] INFO: hello!
```

## Log Files

Logs are saved to `${pwd}/logs` in two files. The first
file logs everything above `LOG_LEVEL`. The second file
logs `error` and above calls.

!!! bug
Unintentional behaviour occurs here if LOG_LEVEL is
above `error` - the main file will not log errors,
but the error file will log errors regardless.

    This may be fixed at some point, but is fairly low priority.
