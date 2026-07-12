import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { ChangeOpacity } from "#util/color-opacity";

export default function IndicatorsCell({ highlight }: { highlight: boolean }) {
	return (
		<QuickTooltip
			tooltipContent={
				highlight
					? "This score has been highlighted!"
					: "This score has not been highlighted. If it was, this lamp lights up!"
			}
		>
			<td
				style={{
					backgroundColor: highlight
						? ChangeOpacity("#e6a303", 0.5)
						: "var(--bs-tertiary-bg)",
					maxWidth: 5,
					padding: 3,
				}}
			></td>
		</QuickTooltip>
	);
}
