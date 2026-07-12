import fs from "node:fs";
import path from "node:path";
import { createCoverageMap } from "istanbul-lib-coverage";
import type { CoverageMap, CoverageSummary } from "istanbul-lib-coverage";

export type Metrics = {
	lines: { pct: number; covered: number; total: number };
	statements: { pct: number; covered: number; total: number };
	functions: { pct: number; covered: number; total: number };
	branches: { pct: number; covered: number; total: number };
};

export function metricsFromSummary(s: CoverageSummary): Metrics {
	return {
		lines: {
			pct: s.lines.pct,
			covered: s.lines.covered,
			total: s.lines.total,
		},
		statements: {
			pct: s.statements.pct,
			covered: s.statements.covered,
			total: s.statements.total,
		},
		functions: {
			pct: s.functions.pct,
			covered: s.functions.covered,
			total: s.functions.total,
		},
		branches: {
			pct: s.branches.pct,
			covered: s.branches.covered,
			total: s.branches.total,
		},
	};
}

export function loadCoverageMapFromFinal(coverageFinalPath: string): CoverageMap {
	const raw = fs.readFileSync(coverageFinalPath, "utf8");
	const data = JSON.parse(raw) as Parameters<CoverageMap["merge"]>[0];
	const map = createCoverageMap();
	map.merge(data);
	return map;
}

/** Group file paths by top-level segment under `src/` (e.g. actions, server, utils). */
export function summarizeByTopSrcDir(
	map: CoverageMap,
	packageRoot: string,
	repoRoot: string,
): Record<string, Metrics> {
	const srcPrefix = path.join(repoRoot, packageRoot, "src") + path.sep;
	const groups: Record<string, CoverageMap> = {};

	for (const file of map.files()) {
		if (!file.startsWith(srcPrefix)) {
			continue;
		}
		const rel = file.slice(srcPrefix.length);
		const top = rel.split(path.sep)[0];
		if (!top || top.startsWith("@")) {
			continue;
		}
		if (!groups[top]) {
			groups[top] = createCoverageMap();
		}
		const fc = map.fileCoverageFor(file);
		groups[top].merge({ [file]: fc.data });
	}

	const out: Record<string, Metrics> = {};
	for (const [name, g] of Object.entries(groups)) {
		out[name] = metricsFromSummary(g.getCoverageSummary());
	}
	return out;
}
