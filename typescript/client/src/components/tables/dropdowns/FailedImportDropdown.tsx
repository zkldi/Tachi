import DebugContent from "#components/util/DebugContent";
import HasDevModeOn from "#components/util/HasDevModeOn";
import Icon from "#components/util/Icon";
import SelectButton from "#components/util/SelectButton";
import { type FailedImportDataset } from "#types/tables";
import React, { useState } from "react";
import { Col } from "react-bootstrap";

import DropdownStructure from "./components/DropdownStructure";
import ImportInputViewer from "./components/ImportInputViewer";

export default function FailedImportDropdown({ data }: { data: FailedImportDataset[0] }) {
	const [view, setView] = useState<"debug" | "input">("input");

	let body;

	if (view === "debug") {
		body = <DebugContent data={data} />;
	} else if (view === "input") {
		body = (
			<Col xs={12}>
				<ImportInputViewer importID={data.importID} importType={data.importType} />
			</Col>
		);
	}

	return (
		<DropdownStructure
			buttons={
				<>
					<SelectButton id="input" setValue={setView} value={view}>
						<Icon type="database" /> Input
					</SelectButton>
					<HasDevModeOn>
						<SelectButton id="debug" setValue={setView} value={view}>
							<Icon type="bug" /> Debug Info
						</SelectButton>
					</HasDevModeOn>
				</>
			}
		>
			{body}
		</DropdownStructure>
	);
}
