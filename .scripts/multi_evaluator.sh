#!/bin/bash

set -eo pipefail
trap 'echo "Interrupted. Killing all subprocesses..."; kill 0; exit 130' INT

export errors=()
export successes=()

function evaluate() {
	echo "Evaluating $1"
	if eval "$1"; then
		successes+=("$1")
	else
		errors+=("$1")
	fi
}

function post_evaluate() {
	if [ ${#successes[@]} -gt 0 ]; then
		echo "These commands passed:"
		for success in "${successes[@]}"; do
			echo "  - $success"
		done
	fi

	if [ ${#errors[@]} -gt 0 ]; then
		echo "These commands failed:"
		for error in "${errors[@]}"; do
			echo "  - $error"
		done
		exit 1
	fi

	echo "All evaluations passed!"
}