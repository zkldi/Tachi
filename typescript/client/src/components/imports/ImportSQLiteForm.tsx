import Divider from "#components/util/Divider";
import useImport from "#components/util/import/useImport";
import Loading from "#components/util/Loading";
import { openDatabase } from "#util/db-converters/sql-loader";
import React, { useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { type Database } from "sql.js";

import ImportStateRenderer from "./ImportStateRenderer";

export interface ConvertWarning {
	message: string;
	level: "error" | "warn";
}

export interface ConvertResult {
	/** One or more Batch Manual documents to submit in sequence. */
	results: unknown[];
	warnings: ConvertWarning[];
}

export interface SQLiteFileInput {
	/** Human-readable label shown above the file picker. */
	label: string;
	/** Key used to look up the opened Database in the convert callback. */
	key: string;
}

interface Props {
	/** Heading for this import form. */
	name: string;
	/** One file input (USC) or two (LR2 / Beatoraja). */
	fileInputs: SQLiteFileInput[];
	/** Optional extra controls rendered between file pickers and the import button
	 *  (e.g. a playtype selector). Validity of those controls is signalled via
	 *  `extraValid`; if omitted the import button doesn't wait for them. */
	extraControls?: React.ReactNode;
	/** When `extraControls` is provided, set this to false to disable the import
	 *  button until the controls have a valid value. */
	extraValid?: boolean;
	/** Target file format (default: .db) */
	fileFormat?: string;
	/**
	 * Conversion function.  Receives a map of `key → opened Database` and
	 * returns one or more Batch Manual documents plus any warnings.
	 * Called on the main thread – keep it reasonably fast (typical score DBs
	 * are a few thousand rows, so this should be fine).
	 */
	convert: (dbs: Record<string, Database>) => ConvertResult;
}

type ConvertState =
	| { message: string; phase: "error" }
	| { phase: "idle" }
	| { phase: "loading" }
	| { phase: "preview"; results: unknown[]; warnings: ConvertWarning[] };

export default function ImportSQLiteForm({
	name,
	fileInputs,
	extraControls,
	extraValid = true,
	fileFormat,
	convert,
}: Props) {
	// One File ref per declared file input
	const [files, setFiles] = useState<Record<string, File | null>>(() =>
		Object.fromEntries(fileInputs.map((f) => [f.key, null])),
	);

	const [convertState, setConvertState] = useState<ConvertState>({ phase: "idle" });
	const {
		importState: importState1,
		runImport: runImport1,
		resetImport: resetImport1,
	} = useImport("/import/file", {});
	const {
		importState: importState2,
		runImport: runImport2,
		resetImport: resetImport2,
	} = useImport("/import/file", {});

	const allFilesProvided = fileInputs.every((f) => files[f.key] !== null);
	const canConvert =
		allFilesProvided &&
		extraValid &&
		convertState.phase !== "loading" &&
		importState1.state === "not_started" &&
		importState2.state === "not_started";

	async function handleConvertAndImport() {
		if (!allFilesProvided) {
			return;
		}

		setConvertState({ phase: "loading" });

		const dbs: Record<string, Database> = {};
		try {
			for (const { key } of fileInputs) {
				dbs[key] = await openDatabase(files[key]!);
			}

			const { results, warnings } = convert(dbs);

			if (results.length === 0) {
				setConvertState({
					phase: "error",
					message: "No importable scores were found in the database.",
				});
				return;
			}

			setConvertState({ phase: "preview", results, warnings });
		} catch (err) {
			setConvertState({
				phase: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		} finally {
			for (const db of Object.values(dbs)) {
				try {
					db.close();
				} catch {
					// ignore
				}
			}
		}
	}

	async function handleSubmit() {
		if (convertState.phase !== "preview") {
			return;
		}
		const { results } = convertState;

		const makeOptions = (body: unknown): RequestInit => {
			const formData = new FormData();
			formData.append("importType", "file/batch-manual");
			formData.append(
				"scoreData",
				new Blob([JSON.stringify(body)], { type: "application/json" }),
				"scores.json",
			);
			return {
				method: "POST",
				headers: { "X-User-Intent": "true" },
				body: formData,
			};
		};

		if (results.length >= 1) {
			await runImport1(makeOptions(results[0]));
		}
		if (results.length >= 2) {
			await runImport2(makeOptions(results[1]));
		}
	}

	const bothDone =
		importState1.state === "done" &&
		(importState2.state === "done" || importState2.state === "not_started");

	return (
		<div className="vstack gap-3">
			<h2 className="text-center">{name}</h2>

			<Alert variant="warning">
				Processing your database file runs entirely in your browser. Depending on the number
				of scores, this may use significant CPU for a few seconds. This is expected.
			</Alert>
			{fileInputs.map(({ key, label }) => (
				<Form.Group key={key}>
					<Form.Label>{label}</Form.Label>
					<input
						accept={fileFormat ?? ".db"}
						className="form-control"
						onChange={(e) => {
							const file = e.target.files?.[0] ?? null;
							setFiles((prev) => ({ ...prev, [key]: file }));
							// Reset convert state when a file changes
							setConvertState({ phase: "idle" });
						}}
						type="file"
					/>
				</Form.Group>
			))}

			{extraControls}

			{convertState.phase === "error" && (
				<Alert variant="danger">
					<strong>Error:</strong> {convertState.phase === "error" && convertState.message}
				</Alert>
			)}

			{convertState.phase === "preview" && (
				<>
					<Alert variant="info">
						<strong>Ready to import</strong>
						<ul className="mb-0 mt-1">
							{convertState.results.map((r, i) => {
								const bm = r as {
									meta: { game: string; playtype: string };
									scores: unknown[];
								};
								return (
									<li key={i}>
										<strong>
											{bm.meta.game} {bm.meta.playtype}
										</strong>
										: {bm.scores.length} score
										{bm.scores.length !== 1 ? "s" : ""}
									</li>
								);
							})}
						</ul>
					</Alert>
					{convertState.warnings.length > 0 && (
						<Alert variant="warning">
							<strong>{convertState.warnings.length} warning(s):</strong>
							<ul className="mb-0 mt-1">
								{convertState.warnings.map((w, i) => (
									<li
										className={w.level === "error" ? "text-danger" : ""}
										key={i}
									>
										{w.message}
									</li>
								))}
							</ul>
						</Alert>
					)}
				</>
			)}

			<div className="text-center">
				{convertState.phase !== "preview" ? (
					<Button
						disabled={!canConvert}
						onClick={handleConvertAndImport}
						variant="primary"
					>
						{convertState.phase === "loading" ? (
							<>
								<Loading /> Reading database…
							</>
						) : (
							"Read Database"
						)}
					</Button>
				) : !bothDone ? (
					<Button
						disabled={
							importState1.state === "waiting_init" ||
							importState1.state === "waiting_processing" ||
							importState2.state === "waiting_init" ||
							importState2.state === "waiting_processing"
						}
						onClick={handleSubmit}
						variant="success"
					>
						Submit Scores
					</Button>
				) : null}
			</div>

			{importState1.state !== "not_started" && (
				<>
					<Divider />
					<ImportStateRenderer onReverted={resetImport1} state={importState1} />
				</>
			)}
			{importState2.state !== "not_started" && (
				<>
					<Divider />
					<ImportStateRenderer onReverted={resetImport2} state={importState2} />
				</>
			)}
		</div>
	);
}
