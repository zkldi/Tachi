# Tests

Tachi makes extensive use of tests to ensure code
is of high quality when its released.

*****

## Running Tests

Tests are ran with [node-tap](https://node-tap.org).

You can run the server test suite with the following script:

```
pnpm test
```

This will execute every test, and also perform coverage
analysis.

!!! bug
	This may or may not impact you depending on how
	dependencies install, but `tap` requires `ts-node`
	and `typescript` to also be installed.

	Otherwise, you will get a
	`cannot use import outside of module`
	error, which indicates that our typescript hasn't
	been transpiled.

## Writing Tests

Tests should be located in the same folder as the file they're testing, and tests should only ever test
exports from one file at a time.

Tests should call things like `ResetDBState` and `CloseAllConnections` as lifecycle hooks to ensure
the file exits.

Tests should use the extension `.test.ts`, and keep
the same filename as the file they are testing.

## Coverage

Coverage should be kept above 80%. New code should be tested.

Pull Requests will be rejected if they contain significant
changes that are untested!

## Single Process TAP

Since we don't mock our MongoDB install out, we run a real instance of Mongo for our tests, and run against it.

TAP runs every test file in isolation. This is a good idea normally, as it means state is never shared across files, and nothing bad is generally going to happen.

*However*, it takes around 2 seconds to connect to the MongoDB server when a new test file is started. These 2 seconds add up over the course of a ~1500 test file suite, and result in tests taking over 15-20 minutes.

To get around this, we use a Single Process TAP hack, which rolls all of our test files up into one test file.

The hack part here is **not** an understatement, and it is genuinely rather dirty. **BUT**, it runs in ~40-50 seconds, works the same for coverage, and can just generally be ignored as an abstraction layer.

As a downside, this makes error messages *way* more cryptic, but for a 20x performance gain, it can be lived with.

!!! warning
	If you are getting failures like "Child test left in suite", one of your test files is *crashing* the entire process, leaving all other tests just dangling.
