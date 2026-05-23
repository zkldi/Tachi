import { useInvalidateUseApiQueryCache } from "#components/util/query/useApiQuery";
import { APIFetchV1 } from "#util/api";
import React, { useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { type ImportDocument } from "tachi-common";

export default function ManageImport({
	importDoc,
	onReverted,
}: {
	importDoc: ImportDocument;
	onReverted?: () => void;
}) {
	const [warn, setWarn] = useState(0);
	const invalidateApiQueries = useInvalidateUseApiQueryCache();
	const message = useMemo(() => {
		if (warn === 0) {
			return "Undo Import (Requires Further Confirmation)";
		} else if (warn === 1) {
			return "Are you absolutely sure? This import, and *everything* as a result of it, will be undone.";
		} else if (warn === 2) {
			return `I'm serious. You will lose ${importDoc.scoreIDs.length} score(s). They will be gone. Are you REALLY sure you want to do this?`;
		} else if (warn === 3) {
			return "OK. Click me one last time, then.";
		} else if (warn === 4) {
			return "Reverting import...";
		}

		return "lol unknown state";
	}, [warn]);

	return (
		<div className="d-flex w-100 justify-content-center">
			<Button
				className="btn btn-danger"
				disabled={warn >= 4}
				onClick={() => {
					if (warn < 3) {
						setWarn((w) => w + 1);
					} else {
						setWarn(4);
						APIFetchV1(
							`/imports/${importDoc.importID}/revert`,
							{
								method: "POST",
							},
							true,
							true,
						)
							.then((res) => {
								if (res.success) {
									invalidateApiQueries();
									onReverted?.();
								} else {
									setWarn(0);
								}
							})
							.catch(() => {
								setWarn(0);
							});
					}
				}}
				variant="danger"
			>
				{message}
			</Button>
		</div>
	);
}
