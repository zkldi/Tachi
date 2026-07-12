import Icon from "#components/util/Icon";
import React, { type HTMLAttributes } from "react";

export default function SortableTH({
	name,
	shortName,
	sortingName = name,
	changeSort,
	currentSortMode,
	reverseSort,
	style = {},
}: {
	changeSort: (s: string) => void;
	currentSortMode: string | null;
	name: string;
	reverseSort: boolean;
	shortName: string;
	sortingName?: string;
	style?: HTMLAttributes<HTMLTableCellElement>["style"];
}) {
	return (
		<th onClick={() => changeSort(sortingName)} style={style}>
			<div className="vstack align-items-center text-nowrap gap-1">
				<span className="d-none d-xl-block">{name}</span>
				<span className="d-block d-xl-none">{shortName}</span>
				<span className="d-flex justify-content-center gap-1">
					<Icon
						className={
							currentSortMode === sortingName && reverseSort
								? "opacity-100"
								: "opacity-25"
						}
						type="arrow-up"
					/>
					<Icon
						className={
							currentSortMode === sortingName && !reverseSort
								? "opacity-100"
								: "opacity-25"
						}
						type="arrow-down"
					/>
				</span>
			</div>
		</th>
	);
}
