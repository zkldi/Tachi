# Import Documents and Import Timings

The final step of the process is to coalesce all the returns
of the various steps above into one analysable document
and return it.

*****

## Logging

If the import had over 500 scores, we log the import at Info level. This is because those are generally rare, and we
want to know how our performance is doing at a glance.

If the import has over 1 score, it is logged as verbose.

Else, the import is logged as debug.

## Timings

An internal document - Import Timings - is created by
storing the time each step of the import process took
in milliseconds.

This is analysed regularly to check for performance
degradation and look for potential optimisations.

This is also stored in the database.

## Returns

The Import Document **is** the return from ScoreImportMain.

This document contains all the relevant information
about the import and what it has resulted in, and
is also stored in the database under a random ID.
