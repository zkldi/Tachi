import { type FailedImportDataset } from "#types/tables";
import { NumericSOV, StrSOV } from "#util/sorts";
import { MillisToSince } from "#util/time";
import { Link } from "react-router-dom";

import DropdownRow from "../components/DropdownRow";
import TachiTable, { type Header } from "../components/TachiTable";
import FailedImportDropdown from "../dropdowns/FailedImportDropdown";

export default function FailedImportsTable({ dataset }: { dataset: FailedImportDataset }) {
	const headers: Header<FailedImportDataset[0]>[] = [
		["User", "User", StrSOV((x) => x.__related.user.username)],
		["Type", "Type", StrSOV((x) => x.importType)],
		["Intent", "Intent", StrSOV((x) => x.userIntent.toString())],
		["Error", "Error"],
		["Timestamp", "Timestamp", NumericSOV((x) => x.timeStarted)],
	];

	return (
		<TachiTable
			dataset={dataset}
			defaultReverseSort
			defaultSortMode="Timestamp"
			entryName="Imports"
			headers={headers}
			rowFunction={(data) => <Row data={data} />}
			searchFunctions={{
				id: (k) => k.importID,
				type: (k) => k.importType,
				intent: (k) => k.userIntent,
				user: (k) => k.__related.user.username,
			}}
		/>
	);
}

function Row({ data }: { data: FailedImportDataset[0] }) {
	return (
		<DropdownRow dropdown={<FailedImportDropdown data={data} />}>
			<td>
				<Link className="text-decoration-none" to={`/u/${data.__related.user.username}`}>
					{data.__related.user.username}
				</Link>
			</td>
			<td>{data.importType}</td>
			<td>{data.userIntent.toString()}</td>
			<td>{data.error.message}</td>
			<td>Started: {MillisToSince(data.timeStarted)}</td>
		</DropdownRow>
	);
}
