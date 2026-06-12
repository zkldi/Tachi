import type { TableDocument } from "tachi-common";

import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Collapse from "react-bootstrap/Collapse";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import { matchPath, useHistory, useLocation } from "react-router-dom";

import type { FolderTableScopedProps } from "./folderTableShared";

import TableFolderViewer from "./TableFolderViewer";

const FOLDER_ROUTE_PATTERN = "/u/:userID/games/:game/folders/:folderSlug";

export default function FolderTablePage({ reqUser, game }: FolderTableScopedProps) {
	const { data, error } = useApiQuery<TableDocument[]>(`/games/${game}/tables?showInactive=true`);

	const { settings } = useLoggedInUserGameSettings();

	const location = useLocation();
	const history = useHistory();

	const folderRouteMatch = useMemo(
		() =>
			matchPath<{ folderSlug: string }>(location.pathname, {
				exact: true,
				path: FOLDER_ROUTE_PATTERN,
			}),
		[location.pathname],
	);

	const activeFolderSlug = folderRouteMatch?.params.folderSlug ?? undefined;

	const [tableOverviewOpen, setTableOverviewOpen] = useState(true);
	const overviewPanelId = useMemo(() => `folder-table-overview-${game}`, [game]);

	const [highlightRevealKey, setHighlightRevealKey] = useState(0);

	const [tableID, setTableID] = useState("");
	const [tableMap, setTableMap] = useState(new Map());

	const collapseTableOverview = useCallback(() => {
		setTableOverviewOpen(false);
	}, []);

	const onTablePickChange = useCallback(
		(nextTableID: string) => {
			setTableID(nextTableID);
			if (!activeFolderSlug) {
				return;
			}

			history.replace(`/u/${reqUser.username}/games/${game}/folders`);
		},
		[activeFolderSlug, game, history, reqUser.username],
	);

	useLayoutEffect(() => {
		if (activeFolderSlug) {
			setTableOverviewOpen(false);
			return;
		}

		setTableOverviewOpen(true);
	}, [activeFolderSlug]);

	useEffect(() => {
		if (!activeFolderSlug || !tableOverviewOpen) {
			return;
		}

		setHighlightRevealKey((n) => n + 1);
	}, [activeFolderSlug, tableOverviewOpen]);

	const table = useMemo(() => tableMap.get(tableID), [tableID, tableMap]);

	useEffect(() => {
		if (data) {
			const newMap = new Map();
			let foundDefault = false;

			for (const table of data) {
				newMap.set(table.tableID, table);

				if (settings?.preferences.defaultTable) {
					if (settings.preferences.defaultTable === table.tableID) {
						setTableID(table.tableID);
						foundDefault = true;
					}
				}

				if (table.default && !foundDefault) {
					setTableID(table.tableID);
					foundDefault = true;
				}
			}
			setTableMap(newMap);

			if (!foundDefault) {
				console.warn(`No default table returned? Falling back to the first thing we saw.`);
				setTableID(data[0].tableID);
			}
		}
	}, [data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const displayableTables = data.filter(
		(e) =>
			!e.inactive ||
			(settings?.preferences.defaultTable && settings.preferences.defaultTable === e.tableID),
	);

	const tablePicker = (
		<InputGroup size="lg">
			<InputGroup.Text>Table</InputGroup.Text>
			<Form.Select onChange={(e) => onTablePickChange(e.target.value)} value={tableID}>
				{displayableTables.map((e) => (
					<option key={e.tableID} value={e.tableID}>
						{e.title}
					</option>
				))}
			</Form.Select>
		</InputGroup>
	);

	return (
		<>
			{activeFolderSlug ? (
				<div>
					<Button
						aria-controls={overviewPanelId}
						aria-expanded={tableOverviewOpen}
						className={`align-items-center d-flex fw-semibold gap-2 px-4 py-3 shadow-sm text-wrap justify-content-between w-100 ${!tableOverviewOpen ? "border-0" : ""}`}
						onClick={() => {
							setTableOverviewOpen((prev) => !prev);
						}}
						type="button"
						variant={tableOverviewOpen ? "outline-primary" : "primary"}
					>
						<span>{tableOverviewOpen ? "Hide all folders" : "Show all folders"}</span>
						<Icon
							aria-hidden
							className={tableOverviewOpen ? undefined : "opacity-75"}
							type={tableOverviewOpen ? "chevron-up" : "chevron-down"}
						/>
					</Button>
					<Collapse in={tableOverviewOpen}>
						<div className="pt-3" id={overviewPanelId}>
							{tablePicker}
							<Divider className="my-3" />
							{table ? (
								<TableFolderViewer
									game={game}
									highlightFolderSlug={activeFolderSlug}
									highlightRevealKey={highlightRevealKey}
									onFolderRowNavigate={collapseTableOverview}
									reqUser={reqUser}
									table={table}
								/>
							) : null}
						</div>
					</Collapse>
				</div>
			) : (
				<>
					{tablePicker}
					<Divider />
					{table ? <TableFolderViewer {...{ reqUser, game, table }} /> : null}
				</>
			)}
		</>
	);
}
