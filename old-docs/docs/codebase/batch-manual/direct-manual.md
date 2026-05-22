# Direct Manual

Direct Manual is a way of POSTing BATCH-MANUAL content straight to the server.

In short, this lets you implement your own IRs, with absolutely no input
from me.

## Flow

You need to send a POST request to `/ir/direct-manual/import`, with the body
of the request being a batch manual document.

You can set the `X-User-Intent` Header to true if the import was done with
user-intent (i.e. they clicked a button to fire this request, rather than it
being automated in the background).

!!! warning
	The response from `/ir/direct-manual/import` *MAY* be deferred if the `tachi-server` instance uses score import workers. If this happens **202** will be returned as the status code. You **MUST** then poll the import status to find out what happened to it (such as it failing.)

## That's it!

Seriously -- that's it.
