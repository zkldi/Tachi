import { type ImportIDReturn } from "#types/api-returns";
import { type ImportStates, NotStartedState } from "#types/import";
import { useState } from "react";
import { type ImportDocument, type integer } from "tachi-common";
/* eslint-disable no-await-in-loop */
import { APIFetchV1 } from "#util/api";
import { Sleep } from "#util/misc";

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
			// 202 means the import is processing. We'll have to poll the
			// status of the import in real time to see whats happening.

			let isImportFinished = false;

			while (!isImportFinished) {
				const pollRes = await APIFetchV1<ImportPollStatus>(
					`/imports/${initRes.body.importID}/poll-status`,
				);

				if (!pollRes.success || pollRes.statusCode >= 400) {
					setImportState({ state: "failed", error: pollRes.description });
					isImportFinished = true;
					continue;
				}

				if (pollRes.body.importStatus === "completed") {
					isImportFinished = true;
					setImportState({ state: "done", import: pollRes.body.import });
				} else if (pollRes.body.importStatus === "ongoing") {
					const progress = pollRes.body.progress;
					const description =
						progress &&
						typeof progress === "object" &&
						"description" in progress &&
						typeof progress.description === "string"
							? progress.description
							: "Importing.";

					setImportState({
						state: "waiting_processing",
						progressInfo: { description },
					});

					await Sleep(1000);
				} else {
					setImportState({
						state: "failed",
						error: pollRes.description ?? "Import failed.",
					});
					isImportFinished = true;
				}
			}
		} else {
			setImportState({
				state: "failed",
				error: initRes.description ?? "Import failed.",
			});
		}
	};

	return { runImport, importState };
}
