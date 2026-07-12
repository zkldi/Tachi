import { sql, SQLite } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Replaces the default CodeMirror colors in dark mode - `defaultHighlightStyle` uses #708
 * (purple) for keywords, which is nearly unreadable on the seeds-webui near-black page.
 * When `themeType: "dark"`, this becomes the only non-fallback highlighter, so the purple
 * palette is not used.
 */
const sqlEditorHighlightDark = HighlightStyle.define(
	[
		{ tag: tags.keyword, color: "#2dd4bf" },
		{ tag: tags.typeName, color: "#22d3ee" },
		{ tag: tags.name, color: "#e2e8f0" },
		{ tag: tags.number, color: "#38bdf8" },
		{ tag: tags.string, color: "#fbbf24" },
		{ tag: tags.bool, color: "#4ade80" },
		{ tag: tags.null, color: "#4ade80" },
		{ tag: tags.lineComment, color: "#64748b" },
		{ tag: tags.blockComment, color: "#64748b" },
		{ tag: tags.comment, color: "#64748b" },
		{ tag: tags.operator, color: "#a1a1aa" },
		{ tag: tags.punctuation, color: "#9ca3af" },
		{ tag: tags.paren, color: "#cbd5e1" },
		{ tag: tags.brace, color: "#cbd5e1" },
		{ tag: tags.squareBracket, color: "#cbd5e1" },
	],
	{ themeType: "dark" },
);

/** `data-bs-theme` on <html> - must drive CodeMirror's `EditorView.darkTheme` or the caret stays light-theme (black) on a dark page. */
function useBootstrapPageDark(): boolean {
	const [isDark, setIsDark] = useState(
		() => document.documentElement.getAttribute("data-bs-theme") !== "light",
	);

	const sync = useCallback(() => {
		setIsDark(document.documentElement.getAttribute("data-bs-theme") !== "light");
	}, []);

	useEffect(() => {
		const el = document.documentElement;
		const obs = new MutationObserver(sync);
		obs.observe(el, { attributeFilter: ["data-bs-theme"], attributes: true });
		return () => {
			obs.disconnect();
		};
	}, [sync]);

	return isDark;
}

export type SqlEditorProps = {
	className?: string;
	onChange: (next: string) => void;
	onRun: () => void;
	/** Table name → column names; drives SQL autocomplete. */
	schema: Record<string, string[]> | null;
	value: string;
};

/** Surfaces, caret, and panels - all use Bootstrap CSS variables so light/dark track the page. */
// Use baseTheme: `&light` / `&dark` are only expanded in buildTheme(..., lightDarkIDs), not in EditorView.theme().
const surfaceTheme = EditorView.baseTheme({
	"&": {
		fontSize: "0.9375rem",
		backgroundColor: "var(--bs-body-bg)",
		color: "var(--bs-body-color)",
		fontVariantLigatures: "none",
		fontFeatureSettings: '"liga" 0, "calt" 0',
	},
	// Caret: drawSelection defaults to black / #ddd for &dark, but the editor was not getting
	// `EditorView.darkTheme` - keep an explicit color so the caret always matches body text.
	".cm-cursor, .cm-dropCursor": {
		borderLeft: "1.2px solid var(--bs-body-color)",
	},
	".cm-content": {
		caretColor: "var(--bs-body-color)",
		fontFamily: "var(--sw-mono)",
		minHeight: "220px",
		paddingBlock: "0.5rem",
	},
	// Override drawSelection’s fixed &light / &gray colors (see @codemirror/view).
	"&light .cm-selectionBackground": {
		background: "rgba(var(--bs-primary-rgb), 0.2)",
	},
	"&dark .cm-selectionBackground": {
		background: "rgba(var(--bs-primary-rgb), 0.2)",
	},
	"&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
		background: "rgba(var(--bs-primary-rgb), 0.28)",
	},
	"&dark.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
		background: "rgba(var(--bs-primary-rgb), 0.28)",
	},
	".cm-scroller": {
		border: "1px solid var(--bs-border-color)",
		borderRadius: "var(--bs-border-radius)",
		overflow: "auto",
	},
	"&light .cm-gutters, &dark .cm-gutters": {
		backgroundColor: "var(--bs-secondary-bg)",
		borderRight: "1px solid var(--bs-border-color)",
		borderRadius: "0",
		color: "var(--bs-secondary-color)",
		borderTopLeftRadius: "var(--bs-border-radius)",
		borderBottomLeftRadius: "var(--bs-border-radius)",
	},
	"&light .cm-activeLineGutter, &dark .cm-activeLineGutter": {
		backgroundColor: "var(--bs-tertiary-bg)",
	},
	"&light .cm-activeLine, &dark .cm-activeLine": {
		backgroundColor: "var(--bs-tertiary-bg)",
	},
	".cm-panels, .cm-panels-top, .cm-panels-bottom": {
		backgroundColor: "var(--bs-body-bg)",
		color: "var(--bs-body-color)",
	},
	".cm-tooltip": {
		backgroundColor: "var(--bs-body-bg)",
		border: "1px solid var(--bs-border-color)",
		boxShadow: "var(--bs-box-shadow)",
		color: "var(--bs-body-color)",
	},
	".cm-tooltip.cm-tooltip-autocomplete > ul": {
		fontFamily: "var(--sw-mono)",
		fontSize: "0.875rem",
	},
	".cm-tooltip-autocomplete ul li[aria-selected]": {
		background: "var(--bs-primary)",
		color: "#fff",
	},
});

function sqlSupportForSchema(schema: Record<string, string[]> | null) {
	const s = schema ?? {};
	return sql({
		dialect: SQLite,
		schema: s as Record<string, readonly string[]>,
		upperCaseKeywords: false,
	});
}

export function SqlEditor({ className, onChange, onRun, schema, value }: SqlEditorProps) {
	const isPageDark = useBootstrapPageDark();
	const hostRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const darkConf = useRef(new Compartment());
	const sqlConf = useRef(new Compartment());
	const onChangeRef = useRef(onChange);
	const onRunRef = useRef(onRun);
	onChangeRef.current = onChange;
	onRunRef.current = onRun;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) {
			return;
		}

		const state = EditorState.create({
			doc: value,
			extensions: [
				basicSetup,
				darkConf.current.of(EditorView.darkTheme.of(isPageDark)),
				syntaxHighlighting(sqlEditorHighlightDark),
				surfaceTheme,
				sqlConf.current.of(sqlSupportForSchema(schema)),
				keymap.of([
					{
						key: "Mod-Enter",
						run: () => {
							onRunRef.current();
							return true;
						},
					},
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChangeRef.current(update.state.doc.toString());
					}
				}),
			],
		});

		const view = new EditorView({ state, parent: host });
		viewRef.current = view;

		return () => {
			view.destroy();
			viewRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; schema/value/dark synced below
	}, []);

	// Keep CodeMirror’s `dark` facet in sync with Bootstrap (caret, selection, completion UI).
	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}
		view.dispatch({
			effects: darkConf.current.reconfigure(EditorView.darkTheme.of(isPageDark)),
		});
	}, [isPageDark]);

	// Keep document in sync when `value` is updated externally (e.g. reset).
	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}
		const cur = view.state.doc.toString();
		if (cur === value) {
			return;
		}
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: value },
		});
	}, [value]);

	// Refresh SQL language + completions when schema changes.
	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}
		view.dispatch({
			effects: sqlConf.current.reconfigure(sqlSupportForSchema(schema)),
		});
	}, [schema]);

	return <div className={className} ref={hostRef} />;
}
