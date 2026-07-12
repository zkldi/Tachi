import type { Commit } from "#lib/transport/transport";

import { useMemo } from "react";

interface CommitSparklineProps {
	commits: Commit[];
	/** Number of trailing days to bucket. Default 90. */
	days?: number;
}

// Tiny inline SVG sparkline of commits per day, no chart lib. Good enough for
// the overview "pulse" view. Bars scale to the busiest day in the range.
export function CommitSparkline({ commits, days = 90 }: CommitSparklineProps) {
	const { bins, maxCount, start, end, total } = useMemo(() => {
		const now = Date.now();
		const bucket = new Map<string, number>();
		const startDate = new Date(now - days * 86_400_000);
		startDate.setHours(0, 0, 0, 0);

		// Seed every day in range with 0 so gaps show as empty bars.
		for (let i = 0; i < days; i++) {
			const d = new Date(startDate);
			d.setDate(startDate.getDate() + i);
			bucket.set(d.toISOString().slice(0, 10), 0);
		}

		let total = 0;
		for (const c of commits) {
			const d = new Date(c.author.date);
			if (Number.isNaN(d.getTime())) {
				continue;
			}
			if (d.getTime() < startDate.getTime()) {
				continue;
			}
			const key = d.toISOString().slice(0, 10);
			if (!bucket.has(key)) {
				continue;
			}
			bucket.set(key, (bucket.get(key) ?? 0) + 1);
			total++;
		}

		const bins = Array.from(bucket.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([day, count]) => ({ count, day }));
		const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 0);

		return {
			bins,
			end: new Date(),
			maxCount,
			start: startDate,
			total,
		};
	}, [commits, days]);

	const width = 600;
	const height = 70;
	const pad = 2;
	const barW = (width - pad * (bins.length + 1)) / bins.length;

	return (
		<div className="sparkline-wrap">
			<div className="sparkline-head">
				<span className="sparkline-title">Commit activity</span>
				<span className="sparkline-meta">
					{total} commit{total === 1 ? "" : "s"} in the last {days} days
				</span>
			</div>
			<svg
				aria-label={`Commit activity over the last ${days} days`}
				className="sparkline"
				preserveAspectRatio="none"
				role="img"
				viewBox={`0 0 ${width} ${height}`}
			>
				{bins.map((b, i) => {
					const h = maxCount === 0 ? 0 : (b.count / maxCount) * (height - 4);
					const x = pad + i * (barW + pad);
					const y = height - h - 2;
					const active = b.count > 0;
					return (
						<rect
							className={active ? "sparkline-bar is-active" : "sparkline-bar"}
							height={Math.max(h, active ? 2 : 1)}
							key={b.day}
							rx={1}
							width={barW}
							x={x}
							y={y}
						>
							<title>
								{b.day} - {b.count} commit{b.count === 1 ? "" : "s"}
							</title>
						</rect>
					);
				})}
			</svg>
			<div className="sparkline-scale">
				<span>{start.toLocaleDateString()}</span>
				<span>{end.toLocaleDateString()}</span>
			</div>
		</div>
	);
}
