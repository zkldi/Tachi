import { RunOutput } from "#components/RunOutput";
import { getTransport, type RunEvent } from "#lib/transport/transport";
import { useState } from "react";

export function Validate() {
	const [events, setEvents] = useState<RunEvent[]>([]);
	const [running, setRunning] = useState(false);

	async function run() {
		setEvents([]);
		setRunning(true);
		try {
			const t = await getTransport();
			if (!t.runTests) {
				throw new Error("Read-only transport");
			}
			for await (const ev of t.runTests()) {
				setEvents((prev) => [...prev, ev]);
			}
		} catch (err) {
			setEvents((prev) => [
				...prev,
				{ data: `\n[client error] ${(err as Error).message}\n`, kind: "stderr" },
			]);
		} finally {
			setRunning(false);
		}
	}

	return (
		<div>
			<h2 className="page-title">Validate</h2>
			<p className="page-subtitle">
				Runs the <code>seeds-scripts</code> test suite (schemas, references, IDs, …) and
				streams the output.
			</p>
			<button className="btn btn-primary mb-3" disabled={running} onClick={() => void run()}>
				{running ? "Running…" : "Run seeds-scripts tests"}
			</button>
			{events.length > 0 ? <RunOutput events={events} /> : null}
		</div>
	);
}
