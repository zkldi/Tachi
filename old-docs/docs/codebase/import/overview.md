# Score Import Overview

Score importing in Tachi is *very* complex, and involves
a lot of moving parts. For that reason, the entire process
(and my rationale behind each step) is documented here.

The code for Score Importing can be found at
`src/lib/score-import`.

The entry point function is `src/lib/score-import/framework/score-import-main.ts`, and everything else is located nearby.

*****

## Folders

Inside `src/lib/score-import` is two folders, `framework/`
and `import-types`.

### `framework/`

The framework folder contains the 'moving parts' of the score importing,
such as processing pbs and inserting scores.

This folder contains the "entry point" for the importing
mechanism, which is discussed in [Score Import Main](./main.md).

### `import-types/`

The Import-Types folder contains the specific parsers
and converter functions for a given ImportType.

You can read more about import types [here](./import-types.md).
