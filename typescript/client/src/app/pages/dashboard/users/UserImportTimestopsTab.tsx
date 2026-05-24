import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { APIFetchV1 } from "#util/api";
import { FormatTime } from "#util/time";
import { DateTime } from "luxon";
import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Table } from "react-bootstrap";
import { useQueryClient } from "react-query";
import { type UserDocument } from "tachi-common";

type ImportTimestopEntry = {
	importType: string;
	lastScoreTime: number | null;
};

function toDatetimeLocalValue(ms: number | null): string {
	if (ms === null) {
		return "";
	}

	return DateTime.fromMillis(ms).toFormat("yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocalValue(value: string): number | null {
	if (!value) {
		return null;
	}

	const parsed = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm");

	if (!parsed.isValid) {
		return null;
	}

	return parsed.toMillis();
}

export default function UserImportTimestopsTab({ reqUser }: { reqUser: UserDocument }) {
	const queryKey = `/users/${reqUser.id}/import-timestops`;
	const queryClient = useQueryClient();
	const { data, error } = useApiQuery<{ timestops: Array<ImportTimestopEntry> }>(queryKey);
	const [busyImportType, setBusyImportType] = useState<string | null>(null);
	const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
	const [message, setMessage] = useState<string | null>(null);

	const timestops = useMemo(() => {
		if (!data) {
			return [];
		}

		return [...data.timestops].sort((a, b) => a.importType.localeCompare(b.importType));
	}, [data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const invalidate = async () => {
		await queryClient.invalidateQueries([queryKey]);
	};

	const onReset = async (importType: string) => {
		if (
			!window.confirm(
				`Reset the timestop for ${importType}? The next import will fetch all available scores again.`,
			)
		) {
			return;
		}

		setBusyImportType(importType);
		setMessage(null);

		const res = await APIFetchV1(
			`/users/${reqUser.id}/import-timestops`,
			{
				body: JSON.stringify({ importType }),
				headers: { "Content-Type": "application/json" },
				method: "DELETE",
			},
			true,
			true,
		);

		setBusyImportType(null);

		if (!res.success) {
			setMessage(res.description);
			return;
		}

		setDraftTimes((prev) => {
			const next = { ...prev };
			delete next[importType];
			return next;
		});
		setMessage(`Reset timestop for ${importType}.`);
		await invalidate();
	};

	const onSave = async (importType: string) => {
		const draft =
			draftTimes[importType] ??
			toDatetimeLocalValue(
				timestops.find((entry) => entry.importType === importType)?.lastScoreTime ?? null,
			);
		const lastScoreTime = fromDatetimeLocalValue(draft);

		if (lastScoreTime === null) {
			setMessage("Enter a valid date and time.");
			return;
		}

		setBusyImportType(importType);
		setMessage(null);

		const res = await APIFetchV1(
			`/users/${reqUser.id}/import-timestops`,
			{
				body: JSON.stringify({ importType, lastScoreTime }),
				headers: { "Content-Type": "application/json" },
				method: "PUT",
			},
			true,
			true,
		);

		setBusyImportType(null);

		if (!res.success) {
			setMessage(res.description);
			return;
		}

		setMessage(`Updated timestop for ${importType}.`);
		await invalidate();
	};

	return (
		<div className="vstack gap-3">
			<Card header="Import timestops">
				<p className="mb-2">
					API imports track the newest score they have already imported. On the next
					import, anything at or before that timestamp is skipped.
				</p>
				<p className="mb-0">
					Reset a timestop to re-fetch all scores, or set a custom cursor if you need to
					re-import from a specific point in time.
				</p>
			</Card>

			{message && <Alert variant="info">{message}</Alert>}

			<Table hover responsive striped>
				<thead>
					<tr>
						<th>Import type</th>
						<th>Current cursor</th>
						<th>Set cursor</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{timestops.map((entry) => {
						const draft =
							draftTimes[entry.importType] ??
							toDatetimeLocalValue(entry.lastScoreTime);
						const isBusy = busyImportType === entry.importType;

						return (
							<tr key={entry.importType}>
								<td>
									<code>{entry.importType}</code>
								</td>
								<td>
									{entry.lastScoreTime === null ? (
										<span className="text-muted">Not set</span>
									) : (
										FormatTime(entry.lastScoreTime)
									)}
								</td>
								<td>
									<Form.Control
										disabled={isBusy}
										onChange={(event) =>
											setDraftTimes((prev) => ({
												...prev,
												[entry.importType]: event.target.value,
											}))
										}
										type="datetime-local"
										value={draft}
									/>
								</td>
								<td className="text-nowrap">
									<Button
										className="me-2"
										disabled={isBusy}
										onClick={() => void onSave(entry.importType)}
										size="sm"
										variant="primary"
									>
										Save
									</Button>
									<Button
										disabled={isBusy || entry.lastScoreTime === null}
										onClick={() => void onReset(entry.importType)}
										size="sm"
										variant="outline-danger"
									>
										Reset
									</Button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</Table>
		</div>
	);
}
