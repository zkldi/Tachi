import Icon from "#components/util/Icon";
import { type ReactNode } from "react";
import { Button, Form } from "react-bootstrap";

import styles from "./MobileTable.module.scss";
import NoDataWrapper from "./NoDataWrapper";
import { type Header, type ZTableTHProps } from "./TachiTable";

export default function MobileTable<D>({
	headers,
	headersRow,
	children,
	entryName,
	changeSort,
	currentSortMode,
	reverseSort,
}: {
	children: JSX.Element[];
	entryName: string;
	headers: Header<D>[];
	headersRow: ReactNode;
} & ZTableTHProps) {
	return (
		<div className={styles.mobileTable}>
			<div className={styles.sortBar}>
				<Form.Select
					aria-label={`Sort ${entryName}`}
					onChange={(event) => changeSort(event.target.value)}
					size="sm"
					value={currentSortMode ?? ""}
				>
					<option disabled value="">
						Sort by...
					</option>
					{headers
						.filter(([name, , sort]) => name && name !== "Indicators" && sort)
						.map(([name]) => (
							<option key={name} value={name}>
								Sort by {name === "#" ? "position" : name}
							</option>
						))}
				</Form.Select>
				<Button
					aria-label={reverseSort ? "Sort ascending" : "Sort descending"}
					disabled={!currentSortMode}
					onClick={() => currentSortMode && changeSort(currentSortMode)}
					size="sm"
					variant="outline-secondary"
				>
					<Icon type={reverseSort ? "sort-amount-down" : "sort-amount-up"} />
				</Button>
				{headers.some(([, , , component]) => component) && (
					<details className={styles.options}>
						<summary>Options</summary>
						<table className={styles.columnOptions}>
							<thead>{headersRow}</thead>
						</table>
					</details>
				)}
			</div>
			<table aria-label={entryName} className={styles.entries}>
				<tbody>
					<NoDataWrapper>{children}</NoDataWrapper>
				</tbody>
			</table>
		</div>
	);
}
