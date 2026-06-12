import Card from "#components/layout/page/Card";
import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";

import Select from "../Select";

export default function ImportViewerOptions({
	userIntent,
	setUserIntent,
	importType,
	setImportType,
}: {
	importType: string | null;
	setImportType: SetState<string | null>;
	setUserIntent: SetState<string | null>;
	userIntent: string | null;
}) {
	return (
		<>
			<Card header="Options">
				<Select
					allowNull
					name="Made with user intent (i.e. not an automatic upload by an IR or hook)"
					setValue={setUserIntent}
					unselectedName="Either"
					value={userIntent}
				>
					<option value="true">Yes</option>
					<option value="false">No</option>
				</Select>
				<br />
				<Select
					allowNull
					name="Import Type?"
					setValue={setImportType}
					unselectedName="Any"
					value={importType}
				>
					{TachiConfig.IMPORT_TYPES.map((e) => (
						<option key={e} value={e}>
							{e}
						</option>
					))}
				</Select>
			</Card>
		</>
	);
}
