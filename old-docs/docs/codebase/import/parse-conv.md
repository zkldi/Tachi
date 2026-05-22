# Parsing and Converting

Tachi faces an interesting problem with its score importing
code. We could rewrite our entire score importing process
for every possible import method, or we could try to
factor out the common parts of this process.

The latter is what we've gone for, but it isn't without
its own traps.

We face the first obvious problem when it comes to actually
"getting" the scores from a source and turning them into
our format.

Our source needs to be dynamically set, sometimes we might
be drawing scores from a file, sometimes from a HTTP
request body, sometimes from another API!

Then, we need to convert the data that document gave us
into a format the rest of our code to understand.

To solve this problem, Tachi uses two processes,
Parsing and Converting.

## Outline

As a rough outline, the parser converts data from
any source into an iterable.

The iterable is then traversed, and the Converter
is called for every element of the iterable.

The converter function turns the element into something
the rest of the Tachi import code can work with.

## Parsing

Parsing is the job of drawing the data from the source into
an **iterable** (The usage of iterable and **NOT** array will be explained later).

A parser function is intended to be created *outside* of
score-import-main, which means it can be really whatever
it wants to be, and draw data from whatever source it needs
to.

!!! warning
	Parser functions return more than just an iterable,
	but in the interest of introducing complexity slowly
	we're going to pretend that they only return an
	iterable for now.

### Implementation

As an example, let's say we had a CSV being sent to us as a file.

We could write a parser for that as follows:

```js
// note: awful example code, this is NOT how to parse a CSV!
function ParserFunction(request) {
	let csv = request.file;

	return csv.toString().split("\n");
}
```

This takes the provided file, splits it on newlines, and returns
the array. This meets all our criteria, as it returns
an iterable, but we still have problems.

Firstly, the calling signature for this involves a `request`. Score Import Main doesn't know of any HTTP requests, as it might not even be triggered by one.

We could solve this by passing a request object, and
also any other context a parser could possibly need,
but that quickly breaks down when we start needing to
fetch from APIs.

Instead, we define a ParserFunction is defined to be a function that
takes *one* argument, the Import Logger.

This means that we actually have to use some
closures in order to call a parser.

```js
function CreateParser(request) {
	return (logger) => {
		return request.file.toString().split("\n");
	}
}

const ParserFunction = CreateParser(request);
```

Using closures, we can dynamically create the parser function
and enclose any context it needs to use inside of it.

This approach allows ScoreImportMain to continue knowing
nothing about where the data is coming from, and
avoids passing lots of initial context, bloating up the
score import function.

The iterable returned by the parser should be in the
most immediately sensible format.

!!! info
	Parser Functions may be asynchronous.

### Iterable Vs. Array

Above, we specifically mentioned that the Parser function
returns an *iterable*. There's a subtle difference here
that allows for significant performance gains when getting
data from a paginated API.

Let's write an example where we retrieve data from an API.

```js
function CreateParser() {
	return async (logger) => {
		let page = 1;

		let array = [];
		while (true) {
			// pretend this returns some scores

			let res = await fetch("example.com?page=" + page).then(r => r.json());
			
			array.push(...res.scores);

			if (!res.moreData) {
				break;
			}

			page++;
		}

		return array;
	}
}
```

It's not bad, but it has some performance issues if the
user has a lot of scores, by creating a massive array
in memory and *then* passing it.

We can improve this code significantly using generators.

```js
function CreateParser() {
	return async function* (logger) {
		let page = 1;

		while (true) {
			let res = await fetch("example.com?page=" + page).then(r => r.json());
			
			for (const score of res.scores) {
				yield score;
			}

			if (!res.moreData) {
				break;
			}

			page++;
		}
	}
}
```

With generators, this code can now yield each score from
the data returned, instead of having to bubble it up in
one large array.

### Other Returns

We mentioned above that parsers return more than
just an iterable.

In practice, a Parser returns four things in an object. Context, the Game this import is for, the Iterable discussed above and a Class Handler.

#### `context`

Some import formats require context to be parsed properly.

The most obvious example is the IIDX E-Amusement CSV format, which does not declare whether the scores are from
single or double play inside the file.

To properly interpret a score of, say, 1000 on 5.1.1. ANOTHER, we need to have some context about the score.
That is, we need data that isn't part of the 'score'.

To solve this, parsers return a `context` object which
contains context for the converter function.

For IIDX E-Amusement, the parser function could interpret
the playtype from user input, and then return it as context.

#### `game`

Sometimes, the game an import is for is not statically
known from the Import Type. This means that the parser
will have to return the `game` this import is for rather
than inferring it.

An example of a format doing this would be the [BATCH MANUAL](foo) format,
which declares what game the import is for in a header.

#### `classHandler`

Sometimes, an import may result in the changing of a users'
classes. This may also sometimes be dependent on data that
is part of the import.

An example of this would be the Fervidex Static import type,
which passes a set of the users scores, and also passes
their Dans.

Since dans are part of the user's IIDX classes, we need to
take the information from that request and update classes
accordingly.

The classHandler returned from the parser should be a callable function
that will update the user's classes dependent on this data.

!!! info
	If no class information is dependent on the content
	known by the parser function, then `classHandler`
	can be set to null, and it will not be called.

### Final Example

With all these other things to return, we can
write a simple example of a parser as follows:

```js
function CreateIIDXFileParser(request) {
	return (logger) => {
		let csv = request.file;

		let playtype = request.body.playtype;

		if (playtype !== "SP" && playtype !== "DP") {
			// todo: throw error
		}

		return {
			iterable: csv.toString().split("\n"),
			game: "iidx",
			context: {
				playtype,
			},
			classHandler: null,
		}
	}
}
```

## Converters

let's say we have a parser for SDVX that returns:
```js
[{
	score: 9000000,
	lamp: "HARD CLEAR",
	timestamp: 1623760037
},
// <more similar elements here...>
]
```

Our converter has to take every element here and
*convert* it into the form the rest of Tachi can
work with.

Unlike Parser Functions, Converter Functions are static,
that means that they cannot be dynamically constructed
with closures or similar.

### Arguments

Converters are called with these four arguments:

| Property | Type | Description |
| :: | :: | :: |
| `data` | ParserElement | The given element in the parser's iterable. |
| `context` | ParserContext | The context the parser returned. |
| `importType` | [ImportType](./import-types.md) | The import type this import is for. |
| `logger` | Logger | The import logger. |

### Returns

Converter functions are expected to return three values
on success.

- `dryScore`

A dry score is a 'partial' real Tachi Score format
with certain properties left blank (because they can be
filled elsewhere).

In short, the Dry Score is all the properties that can
only be derived from the parser's passed data.

Other properties, like calculated data are filled out
in a score "hydration" process (hence the name Dry Score).

- `chart`

The chart this score is for.

- `song`

The song this score is for.

### Throws

Converters are also expected to fail.
For this, we have a very specific throw format
that should be thrown whenever a specific error has occurred.

These are called Failures, and a full list of them can be
found [here](./conv-failures.md).

If a non-failure is thrown, it is logged as an error and the score is ignored (because crashing the entire
import from an unexpected error is a bad idea.)
