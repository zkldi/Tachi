#!/bin/bash

cd "$(dirname "$0")" || exit 1

failed=()
function onFailure() {
	failed+=( "$?" )
}

trap onFailure ERR

tests=(test/**.test.ts)

# for all tests
for test in "${tests[@]}"
do
	# Output stderr and stdout to the terminal, but only save stderr to a file
	# Isn't bash wonderful?
	bun "$test" 2> >(tee failed-tests.log >&2)
done

# if more than 0 commands failed
if [ "${#failed[@]}" -ne 0 ]; then
	# iterate through the error codes and zip them with their
	# test equivalent
	for (( i = 0; i < ${#failed[@]}; i++ ));
	do
		if [ "${failed[$i]}" -ne 0 ]; then
			echo "Test ${tests[$i]} failed. exit code: ${failed[$i]}"
		fi;
	done

	exit 1;
fi;

# success
exit 0;