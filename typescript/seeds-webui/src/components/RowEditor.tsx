import { useEffect, useState } from "react";
import { type z } from "zod";

// ---------------------------------------------------------------------------
// JSON textarea editor with live Zod validation.
//
// Replaces the previous schema-driven field-tree form. Seeds documents are
// complex enough (discriminated unions, per-game chart data, etc.) that a
// generated form was always going to be leaky - it's cleaner to just edit
// the raw JSON and let the schema tell you exactly what's wrong.
//
// Behaviour:
//   - Textarea is pre-filled with the initial value as pretty-printed JSON.
//   - On every keystroke we try JSON.parse; if it succeeds we run safeParse
//     against the Zod schema and show any issues inline.
//   - Save is disabled until the JSON is both valid JSON and passes the schema.
// ---------------------------------------------------------------------------

interface RowEditorProps {
	schema: z.ZodType<unknown>;
	initial: unknown;
	onSave: (value: unknown) => void;
	onCancel: () => void;
	title?: string;
	submitLabel?: string;
}

export function RowEditor({
	schema,
	initial,
	onSave,
	onCancel,
	title,
	submitLabel = "Save",
}: RowEditorProps) {
	const [text, setText] = useState(() => safeStringify(initial));
	const [parseError, setParseError] = useState<string | null>(null);
	const [zodErrors, setZodErrors] = useState<string[]>([]);
	const [parsed, setParsed] = useState<unknown>(initial);

	useEffect(() => {
		setText(safeStringify(initial));
		setParseError(null);
		setZodErrors([]);
		setParsed(initial);
	}, [initial]);

	function handleChange(s: string) {
		setText(s);
		try {
			const v = JSON.parse(s);
			setParseError(null);
			setParsed(v);
			const result = schema.safeParse(v);
			if (result.success) {
				setZodErrors([]);
			} else {
				setZodErrors(
					result.error.issues.map(
						(issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
					),
				);
			}
		} catch (e) {
			setParseError(e instanceof Error ? e.message : String(e));
			setZodErrors([]);
			setParsed(undefined);
		}
	}

	function handleSave() {
		const result = schema.safeParse(parsed);
		if (!result.success) {
			return;
		}
		onSave(result.data);
	}

	const isValid = !parseError && zodErrors.length === 0 && parsed !== undefined;

	return (
		<div className="row-editor">
			{title ? <h4 className="row-editor-title">{title}</h4> : null}
			<div className="row-editor-body">
				<textarea
					className="form-control mono"
					onChange={(e) => handleChange(e.target.value)}
					spellCheck={false}
					style={{ minHeight: 420, resize: "vertical", fontSize: "0.82rem" }}
					value={text}
				/>
				{parseError ? (
					<div className="row-editor-error alert alert-danger mono">{parseError}</div>
				) : zodErrors.length > 0 ? (
					<div className="row-editor-error alert alert-warning mono">
						{zodErrors.map((e, i) => (
							<div key={i}>{e}</div>
						))}
					</div>
				) : (
					<div className="text-success mono" style={{ fontSize: "0.78rem" }}>
						✓ valid
					</div>
				)}
			</div>
			<div className="row-editor-actions">
				<button className="btn btn-outline-secondary" onClick={onCancel} type="button">
					Cancel
				</button>
				<button
					className="btn btn-primary"
					disabled={!isValid}
					onClick={handleSave}
					type="button"
				>
					{submitLabel}
				</button>
			</div>
		</div>
	);
}

function safeStringify(v: unknown): string {
	if (v === undefined) {
		return "";
	}
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return "";
	}
}
