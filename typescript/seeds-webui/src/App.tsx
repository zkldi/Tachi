import { AppShell } from "#components/AppShell";
import { IngestToast } from "#components/IngestToast";
import { EDIT_MODE } from "#lib/config";
import { IngestProvider } from "#lib/ingest/IngestProvider";
import { Collection } from "#pages/Collection";
import { Diff } from "#pages/Diff";
import { Overview } from "#pages/Overview";
import { Query } from "#pages/Query";
import { QuestProposalPR } from "#pages/QuestProposalPR";
import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { BrowserRouter, Redirect, Route, Switch } from "react-router-dom";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 60_000,
		},
	},
});

// Load the editing routes lazily via a single dynamic import. The import is
// only reached when EDIT_MODE is true; since EDIT_MODE is replaced with the
// literal `false` during `vite build`, rollup drops the entire expression -
// which means `editRoutes.ts` and every page it references is never emitted
// into the prod bundle.
type EditRoute = { component: React.ComponentType; path: string };

function useEditRoutes(): EditRoute[] {
	const [routes, setRoutes] = useState<EditRoute[]>([]);
	useEffect(() => {
		if (!EDIT_MODE) {
			return;
		}
		let alive = true;
		import("./app/editRoutes")
			.then((m) => {
				if (alive) {
					setRoutes(m.editRoutes);
				}
			})
			.catch((err) => {
				console.error("[seeds-webui] failed to load edit routes:", err);
			});
		return () => {
			alive = false;
		};
	}, []);
	return routes;
}

export default function App() {
	const editRoutes = useEditRoutes();
	return (
		<QueryClientProvider client={queryClient}>
			<IngestProvider>
				<BrowserRouter>
					<AppShell>
						<Switch>
							<Route component={Overview} exact path="/" />
							<Route component={Query} exact path="/query" />
							<Route exact path="/history" render={() => <Redirect to="/diff" />} />
							<Route component={Diff} exact path="/diff" />
							<Route component={Collection} exact path="/c/:name" />
							<Route component={QuestProposalPR} exact path="/pr/:prNumber" />
							{editRoutes.map((r) => (
								<Route component={r.component} exact key={r.path} path={r.path} />
							))}
						</Switch>
					</AppShell>
					<IngestToast />
				</BrowserRouter>
			</IngestProvider>
		</QueryClientProvider>
	);
}
