export type SchemaPanelProps = {
	className?: string;
	schema: Record<string, string[]> | null;
};

/**
 * Read-only list of ingested SQLite tables and their columns (for reference while writing SQL).
 */
export function SchemaPanel({ className, schema }: SchemaPanelProps) {
	if (schema === null) {
		return (
			<div className={className}>
				<span className="schema-panel-hint small">Loading schema…</span>
			</div>
		);
	}

	const tables = Object.keys(schema).sort((a, b) => a.localeCompare(b));
	if (tables.length === 0) {
		return (
			<div className={className}>
				<span className="schema-panel-hint small">
					No tables yet. Ingest seeds from the overview, then available tables will appear
					here.
				</span>
			</div>
		);
	}

	return (
		<div className={className}>
			<div className="schema-panel-title small mb-2">Available tables</div>
			<div className="schema-panel-scroll">
				<ul className="list-unstyled mb-0 small schema-tables">
					{tables.map((table) => {
						const columns = schema[table] ?? [];
						return (
							<li className="schema-table mb-2" key={table}>
								<div className="mono text-body fw-medium">{table}</div>
								{columns.length > 0 ? (
									<ul className="list-unstyled schema-table-columns">
										{columns.map((col) => (
											<li className="text-break" key={col}>
												{col}
											</li>
										))}
									</ul>
								) : null}
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
