import { getTransport } from "#lib/transport/transport";
import { useQuery } from "react-query";

// Thin horizontal strip under the header in dev mode that shows the current
// branch + working-tree dirtiness. Rendered only when the transport is the
// dev one (i.e. /__seeds/ping succeeded).
export function DevStrip() {
	const { data: mode } = useQuery("transport-mode", async () => (await getTransport()).mode, {
		staleTime: Infinity,
	});
	const { data: status } = useQuery(
		"git-status",
		async () => {
			const t = await getTransport();
			return t.gitStatus ? t.gitStatus() : null;
		},
		{
			enabled: mode === "dev",
			refetchInterval: 15_000,
			staleTime: 10_000,
		},
	);

	if (mode !== "dev") {
		return null;
	}

	return (
		<div className="git-strip">
			<span className="text-muted">You are on branch</span>
			<code>{status?.branch ?? "…"}</code>
			{status?.hasUncommittedChanges ? (
				<span className="dirty">
					{status.changedFiles.length} changed file
					{status.changedFiles.length === 1 ? "" : "s"} under <code>db/seeds/</code>
				</span>
			) : (
				<span className="clean">No seeds changes made!</span>
			)}
			<span className="ms-auto text-muted">
				You can edit files, and they will change the seed files on your system.
			</span>
		</div>
	);
}
