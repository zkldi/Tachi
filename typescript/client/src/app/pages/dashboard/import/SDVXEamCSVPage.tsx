import ImportFileInfo from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { type FileUploadImportTypes } from "tachi-common";

export default function SDVXEamCSVPage({
	name,
	importType,
}: {
	importType: FileUploadImportTypes;
	name: string;
}) {
	useSetSubheader(["Import Scores", name]);

	return (
		<ImportFileInfo
			acceptMime="text/csv"
			importType={importType}
			name={name}
			parseFunction={ParseFunction}
		/>
	);
}

function ParseFunction(data: string) {
	const lines: string[] = data.split("\n");

	const headers = lines[0].split(",");

	if (headers.length !== 11) {
		throw new Error(
			`Unexpected amount of headers in the file -- Expected 11. Is this an eamusement CSV?`,
		);
	}

	if (lines.length === 1) {
		throw new Error(`This CSV has no scores? Only found headers.`);
	}

	const linesWithScores = lines.filter((e) => e !== "");

	return {
		valid: true,
		info: {
			Scores: linesWithScores.length - 1,
		},
	};
}
