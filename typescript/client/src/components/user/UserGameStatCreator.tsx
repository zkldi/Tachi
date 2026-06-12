import DebounceSearch from "#components/util/DebounceSearch";
import Muted from "#components/util/Muted";
import { UserContext } from "#context/UserContext";
import { type SongChartsSearch } from "#types/api-returns";
import { type GameProps, type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { CreateSongMap } from "#util/data";
import { UppercaseFirst } from "#util/misc";
import { StrSOV } from "#util/sorts";
import { useFormik } from "formik";
import { type ChangeEventHandler, useContext, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import {
	type FolderDocument,
	FormatDifficultyLong,
	GetGameConfig,
	GetScoreMetricConf,
	GetScoreMetrics,
	type ShowcaseStatDetails,
	type UserDocument,
	type V3Game,
} from "tachi-common";

function defaultFolderGteForMetric(game: V3Game, metric: string): number {
	const conf = GetScoreMetricConf(GetGameConfig(game), metric);
	if (!conf) {
		return 0;
	}
	if (conf.type === "ENUM") {
		const i = conf.values.indexOf(conf.minimumRelevantValue);
		return i >= 0 ? i : 0;
	}
	return 0;
}

interface Props {
	reqUser: UserDocument;
	onCreate: (stat: ShowcaseStatDetails) => void;
	show: boolean;
	setShow: SetState<boolean>;
}

export default function UserGameStatCreator({
	reqUser,
	game,
	onCreate,
	show,
	setShow,
}: GameProps & Props) {
	return (
		<Modal centered onHide={() => setShow(false)} scrollable show={show} size="lg">
			<Modal.Header className="border-bottom-0 pb-0" closeButton>
				<Modal.Title className="fs-5">Evaluate a one-off stat</Modal.Title>
			</Modal.Header>
			<Modal.Body className="pt-2">
				{show && (
					<UGStatInnerSearchyBit
						game={game}
						onCreate={onCreate}
						reqUser={reqUser}
						setShow={setShow}
						show={show}
					/>
				)}
			</Modal.Body>
		</Modal>
	);
}

function UGStatInnerSearchyBit({ game, onCreate, setShow }: GameProps & Props) {
	const gameConfig = GetGameConfig(game);

	const formik = useFormik({
		initialValues: {
			mode: "chart",
			metric: GetScoreMetrics(gameConfig, ["DECIMAL", "INTEGER", "ENUM"])[0],
			folderSlug: undefined as string | undefined,
			chartID: undefined,
		},
		onSubmit: (values) => {
			let stat: ShowcaseStatDetails;

			if (values.mode === "chart") {
				stat = {
					mode: "chart",
					chartID: values.chartID ?? "",
				};
			} else if (values.mode === "folder") {
				stat = {
					mode: "folder",
					metric: values.metric as "grade" | "lamp" | "percent" | "score",
					slug: values.folderSlug ?? "",
					gte,
				};
			} else {
				throw new Error(`Unknown values.mode ${values.mode}.`);
			}

			onCreate(stat);
			setShow(false);
		},
	});

	useEffect(() => {
		if (formik.values.mode === "folder" && formik.values.metric === "playcount") {
			formik.setValues({ ...formik.values, metric: "lamp" });
		}
	}, [formik.values.mode]);

	const { user } = useContext(UserContext);
	const [chartData, setChartData] = useState<{ chartID: string; name: string }[]>([]);
	const [chartSearch, setChartSearch] = useState("");
	const [requesterHasPlayed, setRequesterHasPlayed] = useState(user !== null);

	const [folderData, setFolderData] = useState<{ name: string; slug: string }[]>([]);
	const [folderSearch, setFolderSearch] = useState("");

	const [gte, setGte] = useState(0);

	useEffect(() => {
		if (formik.values.mode === "folder") {
			setGte(defaultFolderGteForMetric(game, formik.values.metric));
		}
	}, [formik.values.mode, formik.values.metric, game]);

	useEffect(() => {
		(async () => {
			const search = folderSearch;
			const params = new URLSearchParams({
				search,
			});

			const res = await APIFetchV1<FolderDocument[]>(
				`/games/${game}/folders?${params.toString()}`,
				{},
				false,
				true,
			);

			if (!res.success) {
				throw new Error(res.description);
			}

			setFolderData(
				res.body.map((e) => ({ slug: e.slug, name: e.title })).sort(StrSOV((e) => e.name)),
			);
		})();
	}, [folderSearch]);

	useEffect(() => {
		(async () => {
			const search = chartSearch;
			const params = new URLSearchParams({
				search,
			});

			if (requesterHasPlayed) {
				params.set("requesterHasPlayed", "true");
			}

			const res = await APIFetchV1<SongChartsSearch>(
				`/games/${game}/charts?${params.toString()}`,
				{},
				false,
				true,
			);

			if (!res.success) {
				throw new Error(res.description);
			}

			const songMap = CreateSongMap(res.body.songs);

			const data = [];
			for (const chart of res.body.charts) {
				const song = songMap.get(chart.song.id);

				data.push({
					chartID: chart.chartID,
					name: `${song!.title} ${FormatDifficultyLong(chart)}`,
				});
			}

			data.sort(StrSOV((e) => e.name));

			setChartData(data);
		})();
	}, [chartSearch, requesterHasPlayed]);

	return (
		<Form className="d-flex flex-column gap-4" onSubmit={formik.handleSubmit}>
			<Form.Group className="d-flex flex-column">
				<Form.Label>Mode</Form.Label>
				<Form.Select id="mode" onChange={formik.handleChange} value={formik.values.mode}>
					<option value="chart">Chart</option>
					<option value="folder">Folder</option>
				</Form.Select>
				<Form.Text>What kind of stat should this be?</Form.Text>
			</Form.Group>
			{formik.values.mode === "folder" && (
				<Form.Group className="d-flex flex-column">
					<Form.Label>Property</Form.Label>
					<Form.Select
						id="metric"
						onChange={formik.handleChange}
						value={formik.values.metric}
					>
						{GetScoreMetrics(gameConfig, ["DECIMAL", "INTEGER", "ENUM"]).map((e) => (
							<option key={e} value={e}>
								{UppercaseFirst(e)}
							</option>
						))}
					</Form.Select>
					<Form.Text>What kind of statistic should this check for?</Form.Text>
				</Form.Group>
			)}
			{formik.values.mode === "chart" ? (
				<Form.Group className="d-flex flex-column">
					<Form.Label>Chart</Form.Label>
					<DebounceSearch placeholder="Chart Name" setSearch={setChartSearch} />
					{user && (
						<Form.Check
							checked={requesterHasPlayed}
							className="mt-4 mb-4"
							id="requesterHasPlayed"
							label="Only show charts you've played?"
							onChange={(e) => setRequesterHasPlayed(e.target.checked)}
						/>
					)}
					{chartData.length ? (
						<Form.Select
							id="chartID"
							onChange={formik.handleChange}
							value={formik.values.chartID}
						>
							<option value="">Select a chart...</option>
							{chartData.map((e, i) => (
								<option key={i} value={e.chartID}>
									{e.name}
								</option>
							))}
						</Form.Select>
					) : (
						<Muted>Your search returned nothing... :(</Muted>
					)}
				</Form.Group>
			) : (
				<>
					<Form.Group>
						<Form.Label>Target</Form.Label>
						<FolderGTESelect
							onChange={(e) => setGte(Number(e.target.value))}
							value={gte}
							{...{
								game,
								metric: formik.values.metric,
							}}
						/>
					</Form.Group>
					<Form.Group>
						<Form.Label>Folder</Form.Label>
						<DebounceSearch placeholder="Folder Name" setSearch={setFolderSearch} />
						{folderData.length ? (
							<Form.Select
								className="mt-4"
								id="folderSlug"
								onChange={formik.handleChange}
								value={formik.values.folderSlug}
							>
								<option value="">Select a folder...</option>
								{folderData.map((e, i) => (
									<option key={i} value={e.slug}>
										{e.name}
									</option>
								))}
							</Form.Select>
						) : (
							<></>
						)}
					</Form.Group>
				</>
			)}
			<Button
				className="mt-2 w-100"
				disabled={
					(formik.values.mode === "chart" && !formik.values.chartID) ||
					(formik.values.mode === "folder" && !formik.values.folderSlug)
				}
				type="submit"
				variant="primary"
			>
				Evaluate
			</Button>
		</Form>
	);
}

function FolderGTESelect({
	metric,
	game,
	value,
	onChange,
}: {
	metric: string;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
	value: number;
} & GameProps) {
	const gameConfig = GetGameConfig(game);

	const props = { value, onChange };

	const conf = GetScoreMetricConf(gameConfig, metric);

	if (!conf) {
		return <>No config for {metric}. This is a bug!</>;
	}

	switch (conf.type) {
		case "GRAPH":
		case "NULLABLE_GRAPH":
			return <>Not applicable.</>;
		case "DECIMAL":
		case "INTEGER":
			return <Form.Control onChange={onChange as any} type="number" value={value} />;
		case "ENUM":
			return (
				<Form.Select {...props}>
					{conf.values.map((v, i) => (
						<option key={v} value={i}>
							{v}
						</option>
					))}
				</Form.Select>
			);
	}
}
