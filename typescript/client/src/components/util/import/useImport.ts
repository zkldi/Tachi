import { type ImportIDReturn } from "#types/api-returns";
import { type ImportStates, NotStartedState } from "#types/import";
import { useCallback, useState } from "react";
import { type ImportDocument, type integer } from "tachi-common";
/* eslint-disable no-await-in-loop */
import { APIFetchV1, ToAPIURL } from "#util/api";

export interface ImportDeferred {
	url: string;
	importID: string;
}

export type ImportPollStatus =
	| {
			import: ImportDocument;
			importStatus: "completed";
	  }
	| {
			importStatus: "ongoing";
			progress: {
				description: string;
				value: integer;
			};
	  };

export default function useImport(url: string, options: RequestInit) {
	const [importState, setImportState] = useState<ImportStates>(NotStartedState);

	const runImport = async (overrideOptions?: RequestInit) => {
		setImportState({ state: "waiting_init" });

		const initRes = await APIFetchV1<ImportDeferred | ImportDocument>(
			url,
			overrideOptions ?? options,
		);

		if (!initRes.success) {
			setImportState({ state: "failed", error: initRes.description });
			return;
		}

		// 200 means the import was processed on-router.
		if (initRes.statusCode === 200) {
			const importRes = await APIFetchV1<ImportIDReturn>(`/imports/${initRes.body.importID}`);

			if (!importRes.success) {
				setImportState({ state: "failed", error: importRes.description });
				return;
			}

			setImportState({
				state: "done",
				import: importRes.body.import,
			});
		} else if (initRes.statusCode === 202) {
			// 202 means the import is queued. Open an SSE stream for real-time progress
			// instead of polling.
			const importID = (initRes.body as ImportDeferred).importID;

			setImportState({
				state: "waiting_processing",
				progressInfo: { description: "Queued for processing." },
			});

			await new Promise<void>((resolve) => {
				const es = new EventSource(ToAPIURL(`/imports/${importID}/stream`), {
					withCredentials: true,
				});

				es.addEventListener("progress", (e) => {
					const { description } = JSON.parse((e as MessageEvent<string>).data) as {
						description: string;
					};
					setImportState({
						state: "waiting_processing",
						progressInfo: { description },
					});
				});

				es.addEventListener("done", () => {
					// Import finished — fetch the result from poll-status.
					APIFetchV1<ImportPollStatus>(`/imports/${importID}/poll-status`)
						.then((pollRes) => {
							if (pollRes.success && pollRes.body.importStatus === "completed") {
								setImportState({ state: "done", import: pollRes.body.import });
							} else {
								setImportState({
									state: "failed",
									error: "Import completed but could not be loaded.",
								});
							}
						})
						.catch(() => {
							setImportState({
								state: "failed",
								error: "Import completed but could not be loaded.",
							});
						})
						.finally(() => {
							es.close();
							resolve();
						});
				});

				es.addEventListener("import:failed", (e) => {
					const { description } = JSON.parse((e as MessageEvent<string>).data) as {
						description: string;
					};
					setImportState({ state: "failed", error: description });
					es.close();
					resolve();
				});

				// Connection-level error (network drop, server restart, etc.).
				// EventSource auto-reconnects; if it keeps failing, surface it to the user.
				let connectionErrors = 0;
				es.onerror = () => {
					connectionErrors++;
					if (connectionErrors >= 5) {
						setImportState({
							state: "failed",
							error: "Lost connection to the import progress stream. Please refresh.",
						});
						es.close();
						resolve();
					}
				};
			});
		} else {
			setImportState({
				state: "failed",
				error: initRes.description ?? "Import failed.",
			});
		}
	};

	const resetImport = useCallback(() => setImportState(NotStartedState), []);

	return { runImport, importState, resetImport };
}
