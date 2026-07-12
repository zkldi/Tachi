import type { RunEvent } from "#lib/transport/transport";

export function RunOutput({ events }: { events: RunEvent[] }) {
	return (
		<pre aria-live="polite" className="run-output">
			{events.map((e, i) => {
				if (e.kind === "exit") {
					return (
						<div className={e.code === 0 ? "text-success" : "text-danger"} key={i}>
							{"\n"}[exit {e.code}]
						</div>
					);
				}
				return (
					<span className={e.kind === "stderr" ? "stderr" : undefined} key={i}>
						{e.data}
					</span>
				);
			})}
		</pre>
	);
}
