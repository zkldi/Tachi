import ImportClassImportInfo from "#components/imports/ImportClassImportInfo";
import ImportInfo from "#components/imports/ImportInfo";
import DebugContent from "#components/util/DebugContent";
import HasDevModeOn from "#components/util/HasDevModeOn";
import Icon from "#components/util/Icon";
import SelectButton from "#components/util/SelectButton";
import { UserContext } from "#context/UserContext";
import { type ImportDataset } from "#types/tables";
import React, { useContext, useState } from "react";
import { Col } from "react-bootstrap";

import DropdownStructure from "./components/DropdownStructure";
import ImportInputViewer from "./components/ImportInputViewer";
import ManageImport from "./components/ManageImport";

export default function ImportDropdown({ data }: { data: ImportDataset[0] }) {
	const [view, setView] = useState<"debug" | "info" | "input" | "manage">("info");
	const { user: currentUser } = useContext(UserContext);

	let body;

	if (view === "debug") {
		body = <DebugContent data={data} />;
	} else if (view === "info") {
		body = (
			<Col xs={12}>
				{data.importType === "file/import-class" ? (
					<ImportClassImportInfo importDoc={data} />
				) : (
					<ImportInfo importID={data.importID} noTopTable />
				)}
			</Col>
		);
	} else if (view === "input") {
		body = (
			<Col xs={12}>
				<ImportInputViewer importID={data.importID} importType={data.importType} />
			</Col>
		);
	} else if (view === "manage") {
		body = <ManageImport importDoc={data} />;
	}

	return (
		<DropdownStructure
			buttons={
				<>
					<SelectButton id="info" setValue={setView} value={view}>
						<Icon type="exclamation-triangle" /> Import Info
					</SelectButton>
					<SelectButton id="input" setValue={setView} value={view}>
						<Icon type="database" /> Input
					</SelectButton>
					{currentUser?.id === data.userID && data.importType !== "file/import-class" && (
						<SelectButton id="manage" setValue={setView} value={view}>
							<Icon type="trash" /> Revert Import
						</SelectButton>
					)}
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
