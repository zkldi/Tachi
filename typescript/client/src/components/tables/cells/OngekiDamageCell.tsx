import { COLOUR_SET } from "tachi-common";

export default function OngekiDamageCell({ damage }: { damage: number | null | undefined }) {
	return (
		<td style={{ verticalAlign: "middle" }}>
			<strong style={{ color: COLOUR_SET.red }}>{damage ?? "?"}</strong>
		</td>
	);
}
