import { COLOUR_SET } from "tachi-common";

export default function OngekiDamageCell({
	damage,
	mobile,
}: {
	damage: number | null | undefined;
	mobile: boolean;
}) {
	if (mobile) {
		// Consolidate with OngekiJudgementCell
		return <td style={{ display: "none" }}></td>;
	}
	return (
		<td style={{ verticalAlign: "middle" }}>
			<strong style={{ color: COLOUR_SET.red }}>{damage ?? "?"}</strong>
		</td>
	);
}
