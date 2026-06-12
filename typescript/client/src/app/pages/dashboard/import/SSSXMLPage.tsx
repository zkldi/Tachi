import ImportFileInfo from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";

export default function SSSXMLPage() {
	useSetSubheader(["Import Scores", "SSS .xml"]);

	return (
		<ImportFileInfo
			acceptMime="text/xml"
			importType="file/solid-state-squad"
			name="SSS .xml"
			parseFunction={(d: string) => {
				const parser = new DOMParser();
				const xmlDoc = parser.parseFromString(d, "text/xml");

				const main = xmlDoc.querySelector("s3data");

				if (!main) {
					throw new Error("Couldn't find s3data, is this valid SSS XML?");
				}

				const body = main.querySelector("scoredata");

				if (!body) {
					throw new Error("Couldn't find scoredata, is this valid SSS XML?");
				}

				return {
					valid: true,
					info: {
						Scores: body.childElementCount,
					},
				};
			}}
		/>
	);
}
