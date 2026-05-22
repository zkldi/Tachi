# Import Types

The score import code for Tachi uses 'Import Types' to
determine what kind of code to run on a given import,
and what converter to call (more on that later.)

*****

## Format

An import type is just a string. It is formatted as follows:

```
type/name
```

## Types

There are three types.

| Type | Description |
| :: | :: |
| `file/` | The data is coming from a file, such as one from a multipart form submission. |
| `ir/` | The data is coming from a HTTP Request sent to us. |
| `api/` | The data is being fetched by us from another service through HTTP Requests. |

## User Intent

Some imports are performed with user intent, such as
the user going to the Tachi website and uploading
a file and clicking submit.

Some imports are performed without user intent, i.e.
the user sets up a score hook to automatically import
their scores whenever they get one. The reason for the
distinction is for hiding "automatic" imports from the
users imports page.

For certain endpoints, the special header `X-User-Intent`
is set to indicate that this was done with User Intent.

!!! warning
	As this is just a convention, you can abuse it, but you
	shouldn't, because it's not nice to break things
	(and you may be banned).

## List of Import Types

| ImportType | Description | Availability | User Intent |
| :: | :: | :: | :: |
| `file/eamusement-iidx-csv` | The E-amusement CSV format for IIDX. This type accepts both Pre-HV and Post-HV formats. | Kamaitachi | Yes |
| `file/batch-manual` | The Tachi BATCH-MANUAL format submitted through a multipart form. | Kamaitachi & Bokutachi | Yes |
| `file/solid-state-squad` | The IIDX XML output by Solid State Squad. | Kamaitachi | Yes |
| `file/pli-iidx-csv` | Same as eamusement's IIDX CSV, but output from PLI. | Kamaitachi | Yes |
| `ir/direct-manual` | The Tachi BATCH-MANUAL format but submitted in a HTTP Request body as `application/json`. | Kamaitachi & Bokutachi | Depends on Header |
| `ir/barbatos` | Barbatos's format submitted in a HTTP Request Body. | Kamaitachi | No |
| `ir/fervidex` | Fervidex's score format submitted in a HTTP Request Body. | Kamaitachi | No |
| `ir/fervidex-static` | Fervidex's profile sync format submitted in a HTTP Request Body. | Kamaitachi | No |
| `ir/usc` | An implementation of the [USCIR](https://uscir.rtfd.io)'s POST /scores endpoint. | Bokutachi | No |
| `ir/beatoraja` | A handler for BokutachiIR's score format. | Bokutachi | No |
| `api/flo-iidx`, `api/eag-iidx` | Both the same IIDX format, but yielded from different APIs with different players. | Kamaitachi | Depends on Calling[^1] |
| `api/flo-sdvx`, `api/eag-sdvx`, `api/min-sdvx`| See above, but for SDVX. | Kamaitachi | Depends on Calling[^1] |

[^1]: If this is synced manually by the user, I.e. they have called it to be synced, then it is with intent. If it was called for them through automatic synchronisation, then it was not done with user intent.
