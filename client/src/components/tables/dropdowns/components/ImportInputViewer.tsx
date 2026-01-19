import { ToCDNURL } from "util/api";
import React, { useMemo, useState } from "react";
import { useQuery } from "react-query";
import Loading from "components/util/Loading";
import SelectButton from "components/util/SelectButton";
import Divider from "components/util/Divider";
import DebugContent from "components/util/DebugContent";
import Muted from "components/util/Muted";
import { ImportTypes } from "tachi-common";
import ExternalLink from "components/util/ExternalLink";

export default function ImportInputViewer({
	importID,
	importType,
}: {
	importID: string;
	importType: ImportTypes;
}) {
	const cdnUrl = ToCDNURL(`/score-import-input/${importID}`);

	const { data, error } = useQuery<Array<unknown>, unknown>(cdnUrl, async () => {
		const res = await fetch(cdnUrl);
		const text = await res.text();

		if (res.status !== 200) {
			throw new Error(`${res.status} ${text}`);
		}

		const j = JSON.parse(text);

		if (!Array.isArray(j)) {
			throw new Error(`Unexpectedly got non-array-json? ${text}`);
		}

		return j;
	});

	if (error) {
		return (
			<div>
				Failed to fetch import input. It might have been pruned.
				<br />
				{String(error)}
			</div>
		);
	}

	if (!data) {
		return <Loading />;
	}

	return <InnerImportInputViewer data={data} importType={importType} />;
}

function InnerImportInputViewer({
	data,
	importType,
}: {
	data: Array<unknown>;
	importType: ImportTypes;
}) {
	const [curIdx, setCurIdx] = useState(0);

	const currentData = useMemo(() => {
		const value: any = data[curIdx];

		// was this a buffer before it was JSON stringified?
		if (value?.buffer?.type === "Buffer") {
			try {
				const td = new TextDecoder("utf-8", { fatal: true });

				return {
					type: "FILE",
					value: { ...value, buffer: undefined },
					textContent: td.decode(new Uint8Array(value.buffer.data)),
				};
			} catch (err) {
				console.warn(err);
				// failed to turn this buffer into a utf-8 string. probably a binary
				// file, if we ever support those.
			}
		}

		return { type: "RAW", value };
	}, [curIdx]);

	return (
		<div>
			<div className="btn-group">
				{data.map((e, i) => (
					<SelectButton key={i} value={curIdx} setValue={setCurIdx} id={i}>
						Arg {i}
					</SelectButton>
				))}
			</div>
			<div className="mt-2">
				<Muted>
					For information on what each argument means,{" "}
					<ExternalLink
						href={`https://github.com/zkldi/Tachi/blob/main/server/src/lib/score-import/import-types/${importType}/parser.ts`}
					>
						view the signature of the parser function for <code>{importType}</code>
					</ExternalLink>
				</Muted>
			</div>
			<Divider />
			{currentData.type === "RAW" ? (
				<DebugContent data={currentData.value} />
			) : (
				<>
					<div>File Contents</div>
					<br />
					<textarea
						readOnly
						className="w-100 font-monospace"
						style={{ height: "400px" }}
						value={currentData.textContent}
					/>
					<br />
					<div>Metadata</div>
					<br />
					<DebugContent data={currentData.value} />
				</>
			)}
		</div>
	);
}
