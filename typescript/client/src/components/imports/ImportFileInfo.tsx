import MiniTable from "#components/tables/components/MiniTable";
import Divider from "#components/util/Divider";
import useImport from "#components/util/import/useImport";
import { type SetState } from "#types/react";
import prettyBytes from "pretty-bytes";
import React, { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { type FileUploadImportTypes } from "tachi-common";

import ImportStateRenderer from "./ImportStateRenderer";

type ParseFunctionReturn = { info: Record<string, React.ReactChild>; valid: boolean };

export type MoreDataForm = ({
	setInfo,
	setFulfilled,
}: {
	setFulfilled: SetState<boolean>;
	setInfo: SetState<Record<string, string>>;
}) => JSX.Element;

export default function ImportFileInfo({
	name,
	acceptMime,
	parseFunction,
	importType,
	MoreDataForm,
}: {
	acceptMime: string | string[];
	importType: FileUploadImportTypes;
	MoreDataForm?: MoreDataForm;
	name: string;
	parseFunction: (r: string) => ParseFunctionReturn;
}) {
	const [file, setFile] = useState<File | null>(null);

	const [errMsg, setErrMsg] = useState<string | null>("");
	const [data, setData] = useState<ParseFunctionReturn | null>(null);
	const valid = useMemo(() => errMsg === null && file && file.size <= 8e6, [errMsg, file]);

	const [moreInfo, setMoreInfo] = useState<Record<string, string>>({});
	const [moreInfoFulfilled, setMoreInfoFulfilled] = useState(!MoreDataForm);

	useEffect(() => {
		if (!file) {
			setErrMsg("");
			return;
		}

		file.text().then((r) => {
			try {
				const { valid, info } = parseFunction(r);

				if (valid) {
					setErrMsg(null);
				}

				setData({ valid, info });
			} catch (err) {
				setErrMsg((err as Error).message);
				setData({ valid: false, info: {} });
			}
		});
	}, [file, parseFunction]);

	const info = useMemo(() => {
		if (!file) {
			return null;
		}

		const isTooLarge = file.size > 8e6;

		if (!data || !file) {
			return null;
		}

		return (
			<MiniTable colSpan={2} headers={["File Info"]}>
				{Object.entries(data?.info).map(([k, v]) => (
					<tr key={k}>
						<td>{k}</td>
						<td>{v}</td>
					</tr>
				))}
				<tr>
					<td>File Size</td>
					<td>
						<span className={isTooLarge ? "text-danger" : ""}>
							{prettyBytes(file.size)}
							{isTooLarge
								? " (File too large, Can't be larger than 8MB. Sorry!)"
								: ""}
						</span>
					</td>
				</tr>
			</MiniTable>
		);
	}, [errMsg, data, file]);

	const { importState, runImport, resetImport } = useImport("/import/file", {});

	return (
		<div>
			<Form.Group>
				<Form.Label>Upload {name} File</Form.Label>
				<input
					accept={Array.isArray(acceptMime) ? acceptMime.join(",") : acceptMime}
					className="form-control"
					id="batch-manual"
					multiple={false}
					onChange={(e) => setFile(e.target.files![0])}
					type="file"
				/>
			</Form.Group>
			{file && (
				<>
					{info}
					{errMsg ? <div className="text-danger text-center">Error: {errMsg}</div> : null}
					<Divider />
					{MoreDataForm ? (
						<>
							<MoreDataForm
								setFulfilled={setMoreInfoFulfilled}
								setInfo={setMoreInfo}
							/>
							<Divider />
						</>
					) : null}
					<div className="text-center">
						<div className="row justify-content-center mt-4">
							{valid && moreInfoFulfilled ? (
								<>
									{importState.state === "waiting_init" ? (
										<Button className="btn-primary" disabled>
											Processing...
										</Button>
									) : importState.state === "waiting_processing" ? (
										<Button className="btn-primary" disabled>
											Processing...
										</Button>
									) : (
										<Button
											className="btn-primary"
											onClick={() => {
												const formData = new FormData();
												formData.append("importType", importType);
												formData.append("scoreData", file);

												for (const [key, value] of Object.entries(
													moreInfo,
												)) {
													formData.append(key, value);
												}

												runImport({
													method: "POST",
													headers: {
														"X-User-Intent": "true",
													},
													body: formData,
												});
											}}
										>
											Submit File
										</Button>
									)}
								</>
							) : !valid ? (
								<Button className="btn-danger" disabled>
									There are errors in this {name} file, Can't upload.
								</Button>
							) : (
								<Button className="btn-warning" disabled>
									More fields need to be filled out.
								</Button>
							)}
						</div>
					</div>
					<Divider />
					<ImportStateRenderer onReverted={resetImport} state={importState} />
				</>
			)}
		</div>
	);
}
