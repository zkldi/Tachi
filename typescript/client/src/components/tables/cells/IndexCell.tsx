import { type integer } from "tachi-common";

// gold, silver, bronze
const COLORS = ["rgba(212,175,55,0.2)", "rgba(192,192,192,0.2)", "rgba(139,69,19,0.2)"];

export default function IndexCell({ index }: { index: integer }) {
	return (
		<td
			style={{
				backgroundColor: index < 3 ? COLORS[index] : undefined,
			}}
		>
			<span className="text-body-secondary" style={{ marginRight: "1px" }}>
				#
			</span>
			<span
				style={{
					fontWeight: index + 1 < 10 ? "bold" : undefined,
				}}
			>
				{index + 1}
			</span>
		</td>
	);
}
