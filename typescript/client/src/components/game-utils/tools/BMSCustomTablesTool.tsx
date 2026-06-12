import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TachiConfig } from "#lib/config";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { ToAPIURL } from "#util/api";
import { CopyToClipboard } from "#util/misc";
import { Col, Row } from "react-bootstrap";

function Component({ game, reqUser }: GameProfileProps) {
	const { data, error } = useApiQuery<
		Array<{
			description: string;
			forSpecificUser?: boolean;
			symbol: string;
			tableName: string;
			urlName: string;
		}>
	>(`/games/${game}/custom-tables`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<Row>
			<Col xs={12}>
				Just paste these URLs into your BMS client of choice. For LR2oraja, this is on the
				setup screen.
				<Divider />
			</Col>
			{data.map((tbl) => {
				const TABLE_URL = ToAPIURL(
					`${
						tbl.forSpecificUser ? `/users/${reqUser.username}` : ""
					}/games/${game}/custom-tables/${tbl.urlName}`,
				);

				return (
					<Col key={tbl.urlName} lg={6} xs={12}>
						<Card className="my-4" header={tbl.tableName}>
							{tbl.description}
							<br />
							<br />
							URL: <code>{TABLE_URL}</code>
							<Icon
								onClick={() => {
									CopyToClipboard(TABLE_URL);
								}}
								type="link"
							/>
						</Card>
					</Col>
				);
			})}
		</Row>
	);
}

export const BMSCustomTablesTool: GameUtility = {
	name: `${TachiConfig.NAME} BMS Tables`,
	urlPath: "custom-tables",
	description: `${TachiConfig.NAME} has its own BMS tables that you can use in-game!`,
	component: Component,
	personalUseOnly: true,
};
