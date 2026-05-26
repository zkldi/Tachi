import ClassBadge from "#components/game/ClassBadge";
import MiniTable from "#components/tables/components/MiniTable";
import TachiTable from "#components/tables/components/TachiTable";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import { UserContext } from "#context/UserContext";
import { UppercaseFirst } from "#util/misc";
import React, { useContext } from "react";
import { Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { type ImportDocument } from "tachi-common";

/**
 * Detail view for **`file/import-class`** only — class deltas instead of scores/sessions.
 */
export default function ImportClassImportInfo({ importDoc }: { importDoc: ImportDocument }) {
	const { user } = useContext(UserContext);
	const deltas = importDoc.classDeltas;

	const warningErrors = importDoc.errors.filter(
		(e) => e.type === "SongOrChartNotFound" || e.type === "OrphanExists",
	);
	const hardErrors = importDoc.errors.filter(
		(e) => e.type !== "SongOrChartNotFound" && e.type !== "OrphanExists",
	);

	return (
		<>
			<div className="col-12">
				<MiniTable colSpan={2} headers={["Provided class import"]}>
					<tr>
						<td>Class changes</td>
						<td>{deltas.length}</td>
					</tr>
					<tr>
						<td>Errors</td>
						<td>{importDoc.errors.length}</td>
					</tr>
				</MiniTable>
			</div>

			{deltas.length > 0 && (
				<>
					<div className="col-12">
						<Divider />
					</div>
					<div className="col-12">
						<MiniTable headers={["Class set", "Before", "After"]}>
							{deltas.map((d, i) => (
								<tr key={`${d.game}-${String(d.set)}-${d.old ?? ""}-${d.new}-${i}`}>
									<td>{UppercaseFirst(String(d.set))}</td>
									<td>
										{d.old ? (
											<ClassBadge
												classSet={d.set}
												classValue={d.old}
												game={d.game}
												showSetOnHover={false}
											/>
										) : (
											<span className="text-muted">—</span>
										)}
									</td>
									<td>
										{d.new !== null ? (
											<ClassBadge
												classSet={d.set}
												classValue={d.new}
												game={d.game}
												showSetOnHover={false}
											/>
										) : (
											<span className="text-muted">Unset</span>
										)}
									</td>
								</tr>
							))}
						</MiniTable>
					</div>
				</>
			)}

			{(warningErrors.length > 0 || hardErrors.length > 0) && (
				<>
					<div className="col-12">
						<Divider />
					</div>
					<div className="col-12 vstack gap-4">
						<div className="text-start">
							<Icon type="exclamation-triangle" /> Errors
						</div>
						{warningErrors.length > 0 && (
							<>
								<h5 className="text-start mb-0">Warnings</h5>
								<Alert variant="warning">
									<strong>SongOrChartNotFound</strong> and{" "}
									<strong>OrphanExists</strong> relate to orphaned score rows —
									less common for class-only imports.
								</Alert>
								<TachiTable
									dataset={warningErrors}
									entryName="Warnings"
									headers={[
										["Warning Name", "Warning Name"],
										["Info", "Info"],
									]}
									rowFunction={(r) => (
										<tr>
											<td>{r.type}</td>
											<td>
												<div>{r.message}</div>
												{r.orphanID !== undefined && (
													<div className="mt-2 small text-muted">
														{user ? (
															<Link
																to={`/u/${user.username}/orphans`}
															>
																Open orphan queue
															</Link>
														) : (
															"Open orphan queue"
														)}{" "}
														(ID: <code>{r.orphanID}</code>)
													</div>
												)}
											</td>
										</tr>
									)}
								/>
							</>
						)}
						{hardErrors.length > 0 && (
							<>
								<h5 className="text-start mb-0">Errors</h5>
								<TachiTable
									dataset={hardErrors}
									entryName="Errors"
									headers={[
										["Error Name", "Error Name"],
										["Info", "Info"],
									]}
									rowFunction={(r) => (
										<tr>
											<td>{r.type}</td>
											<td>{r.message}</td>
										</tr>
									)}
								/>
							</>
						)}
					</div>
				</>
			)}
		</>
	);
}
