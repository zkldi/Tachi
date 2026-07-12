import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TachiConfig } from "#lib/config";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { CopyToClipboard } from "#util/misc";
import { Alert, Button, Col, Row } from "react-bootstrap";

function Component({ game, reqUser }: GameProfileProps) {
	const { data, error } = useApiQuery<string>(
		`/users/${reqUser.id}/games/${game}/eamusement-csv`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<Row>
			<Col xs={12}>
				<Alert variant="warning">
					Hey! Please be aware that this format is <strong>lossy</strong>. You should use
					this to integrate with other tools that only support eamusement CSVs.
					<br />
					Tachi offers more fully fledged score exporting if you're looking to actually
					get your scores elsewhere.
				</Alert>
				<Divider />
			</Col>
			<Col xs={12}>
				<textarea
					className="w-100 font-monospace"
					readOnly
					style={{ height: "400px" }}
					value={data}
				/>
				<Divider />
				<div className="d-flex w-100 justify-content-center" style={{ gap: "10px" }}>
					<Button onClick={() => CopyToClipboard(data)} variant="outline-info">
						Copy to Clipboard
					</Button>
					<a
						className="btn btn-outline-primary"
						download={`iidx-eam-${reqUser.username}.csv`}
						href={`data:text/plain,${encodeURIComponent(data)}`}
					>
						Download
					</a>
				</div>
			</Col>
		</Row>
	);
}

export const IIDXEamusementExportTool: GameUtility = {
	name: `e-amusement CSV Export`,
	urlPath: "eam-csv-export",
	description: `Export your ${TachiConfig.NAME} scores into e-amusement format.`,
	component: Component,
	personalUseOnly: true,
};
