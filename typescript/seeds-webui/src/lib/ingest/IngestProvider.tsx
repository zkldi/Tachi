import { type BuildProgress, buildSqliteFromTransport } from "#lib/sqlite/builder";
import { getTransport } from "#lib/transport/transport";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "react-query";

interface IngestState {
	progress: BuildProgress | null;
	ready: boolean;
	/** True once all collections have been ingested (or found cached) at least once this session. */
	everReady: boolean;
	/** Ingest of seeds into the worker DB failed. */
	error: string | null;
	/** `getTransport` still resolving (ingest not started). */
	transportLoading: boolean;
	/** Transport layer could not be created; SQLite is unavailable. */
	transportError: string | null;
}

const IngestCtx = createContext<IngestState>({
	error: null,
	everReady: false,
	progress: null,
	ready: false,
	transportError: null,
	transportLoading: true,
});

export function useIngest(): IngestState {
	return useContext(IngestCtx);
}

export function IngestProvider({ children }: { children: React.ReactNode }) {
	const transportQuery = useQuery("transport", getTransport, { staleTime: Infinity });
	const transportLoading = transportQuery.isLoading;
	const transportError = transportQuery.isError
		? String(
				transportQuery.error instanceof Error
					? transportQuery.error.message
					: transportQuery.error,
			)
		: null;
	const [progress, setProgress] = useState<BuildProgress | null>(null);
	const [ready, setReady] = useState(false);
	const [everReady, setEverReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!transportQuery.data) {
			return;
		}
		let cancelled = false;
		setReady(false);
		setError(null);
		(async () => {
			for await (const p of buildSqliteFromTransport(transportQuery.data!)) {
				if (cancelled) {
					return;
				}
				setProgress(p);
			}
			if (!cancelled) {
				setReady(true);
				setEverReady(true);
			}
		})().catch((err) => {
			console.error("[seeds-webui] ingest failed:", err);
			if (!cancelled) {
				setError(String(err?.message ?? err));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [transportQuery.data]);

	return (
		<IngestCtx.Provider
			value={{ error, everReady, progress, ready, transportError, transportLoading }}
		>
			{children}
		</IngestCtx.Provider>
	);
}
