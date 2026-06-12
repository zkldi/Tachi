import ClassBadge from "#components/game/ClassBadge";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import MiniTable from "#components/tables/components/MiniTable";
import DebugContent from "#components/util/DebugContent";
import { type GameProps } from "#types/react";
import { type Classes, FormatGame, GetGameConfig, type V3Game } from "tachi-common";

export default function GameDevInfo({ game }: GameProps) {
	useSetSubheader(
		["Games", FormatGame(game), "Dev Info"],
		[game],
		`${FormatGame(game)} Dev Info`,
	);

	const gameGroupConfig = GetGameConfig(game);

	return (
		<>
			<Card header="Game Configuration">
				<DebugContent data={gameGroupConfig} />
			</Card>
			<Card className="mt-4" header="Class Badges">
				<div className="d-flex w-100 justify-content-center" style={{ gap: "30px" }}>
					{Object.entries(gameGroupConfig.classes).map(([classSet, conf]) => (
						<div key={classSet}>
							<MiniTable colSpan={2} headers={[classSet]}>
								{conf.values.map((e) => (
									<tr key={e.id}>
										<td>{e.id}</td>
										<td>
											<ClassBadge
												classSet={classSet as Classes[V3Game]}
												classValue={e.id}
												game={game}
											/>
										</td>
									</tr>
								))}
							</MiniTable>
						</div>
					))}
				</div>
			</Card>
		</>
	);
}
