#!/usr/bin/env bun
/**
 * Read aggregated Istanbul coverage from Vitest v8 output and print summaries.
 *
 * Typical workflow:
 *   just test-typescript              # generates coverage under each package’s coverage/
 *   just coverage-report              # this tool
 *
 * Flags:
 *   --json              machine-readable report on stdout
 *   --by-dir            per top-level src/ subdirectory (server/bot only; needs src layout)
 *   --packages a,b      limit to manifest ids (default: all)
 *   --min-lines N       exit 1 if any selected package is below this line %
 *   --strict            exit 1 if a coverage file is missing
 *
 * Programmatic: import { buildReport } from "./report-coverage.js" (see buildReport).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { COVERAGE_SOURCES } from "./manifest";
import {
	loadCoverageMapFromFinal,
	metricsFromSummary,
	summarizeByTopSrcDir,
	type Metrics,
} from "./summary-from-final";

export type PackageReport = {
	id: string;
	packageRoot: string;
	coverageFinal: string;
	present: boolean;
	metrics: Metrics | null;
	byDir?: Record<string, Metrics>;
};

export type CoverageReport = {
	repoRoot: string;
	packages: PackageReport[];
};

function pct(n: number): string {
	return `${n.toFixed(1)}%`;
}

function row(label: string, m: Metrics): string {
	return [
		label.padEnd(10),
		pct(m.lines.pct).padStart(7),
		pct(m.statements.pct).padStart(7),
		pct(m.functions.pct).padStart(7),
		pct(m.branches.pct).padStart(7),
		`${m.lines.covered}/${m.lines.total}`.padStart(12),
	].join(" ");
}

function resolveRepoRoot(): string {
	// This file lives at typescript/coverage-tools/src/
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function buildReport(options: {
	repoRoot: string;
	packageIds: Set<string> | null;
	byDir: boolean;
}): CoverageReport {
	const { repoRoot, packageIds, byDir } = options;
	const packages: PackageReport[] = [];

	for (const src of COVERAGE_SOURCES) {
		if (packageIds && !packageIds.has(src.id)) {
			continue;
		}
		const finalPath = path.join(repoRoot, src.coverageFinal);
		let present = fs.existsSync(finalPath);
		let metrics: Metrics | null = null;
		let byDirMetrics: Record<string, Metrics> | undefined;

		if (present) {
			try {
				const map = loadCoverageMapFromFinal(finalPath);
				metrics = metricsFromSummary(map.getCoverageSummary());
				if (byDir) {
					byDirMetrics = summarizeByTopSrcDir(map, src.packageRoot, repoRoot);
				}
			} catch {
				present = false;
			}
		}

		packages.push({
			id: src.id,
			packageRoot: src.packageRoot,
			coverageFinal: src.coverageFinal,
			present,
			metrics,
			byDir: byDirMetrics,
		});
	}

	return { repoRoot, packages };
}

function printHuman(report: CoverageReport): void {
	console.log("Coverage (Vitest v8 / Istanbul)\n");
	console.log(
		[
			"".padEnd(10),
			"Lines".padStart(7),
			"Stmt".padStart(7),
			"Funcs".padStart(7),
			"Branch".padStart(7),
			"Lines hit".padStart(12),
		].join(" "),
	);
	console.log("-".repeat(62));

	for (const p of report.packages) {
		if (!p.present || !p.metrics) {
			console.log(`${p.id.padEnd(10)}  (no data - run: just test-typescript)`);
			continue;
		}
		console.log(row(p.id, p.metrics));
		if (p.byDir && Object.keys(p.byDir).length > 0) {
			const names = Object.keys(p.byDir).sort((a, b) => a.localeCompare(b));
			for (const name of names) {
				console.log(row(`  ${name}`, p.byDir[name]!));
			}
		}
	}
	console.log("");
}

function main(): void {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			json: { type: "boolean", default: false },
			"by-dir": { type: "boolean", default: false },
			"min-lines": { type: "string" },
			packages: { type: "string" },
			strict: { type: "boolean", default: false },
			help: { type: "boolean", default: false, short: "h" },
		},
		strict: true,
		allowPositionals: false,
	});

	if (values.help) {
		console.log(`Usage: bun run src/report-coverage.ts [options]

Options:
  --json           Emit JSON (CoverageReport shape)
  --by-dir         Break down each package by top-level directory under src/
  --packages a,b   Only include manifest ids (default: all in manifest.ts)
  --min-lines N    Fail if any included package line coverage < N
  --strict         Fail if any expected coverage file is missing or unreadable
`);
		process.exit(0);
	}

	const repoRoot = resolveRepoRoot();
	let packageIds: Set<string> | null = null;
	if (values.packages) {
		packageIds = new Set(
			values.packages
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		);
	}

	const report = buildReport({
		repoRoot,
		packageIds,
		byDir: values["by-dir"] ?? false,
	});

	let exitCode = 0;

	if (values.strict) {
		for (const p of report.packages) {
			if (!p.present || !p.metrics) {
				exitCode = 1;
			}
		}
	}

	const minLines = values["min-lines"] ? Number(values["min-lines"]) : null;
	if (minLines !== null && !Number.isFinite(minLines)) {
		console.error("Invalid --min-lines");
		process.exit(1);
	}
	if (minLines !== null) {
		for (const p of report.packages) {
			if (p.metrics && p.metrics.lines.pct < minLines) {
				exitCode = 1;
			}
		}
	}

	if (values.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		printHuman(report);
		if (exitCode !== 0) {
			if (values.strict) {
				console.error("Strict mode: missing or invalid coverage for one or more packages.");
			}
			if (minLines !== null) {
				console.error(
					`Line coverage below --min-lines ${minLines} for one or more packages.`,
				);
			}
		}
	}

	process.exit(exitCode);
}

function isMainModule(): boolean {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}
	return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
	main();
}
