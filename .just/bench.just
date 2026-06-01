# Vitest benchmarks (*.bench.ts).

bench:
	bun run --filter '*' --sequential --elide-lines=0 bench
