import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { TachiConfig } from "#lib/config";
import { ToCDNURL } from "#util/api";

export default function SupporterIcon() {
	return (
		<QuickTooltip tooltipContent={<span>This user is a {TachiConfig.NAME} supporter!</span>}>
			<img
				alt="Logo"
				className="logo-default"
				src={ToCDNURL("/logos/logo-mark.png")}
				style={{ maxHeight: "10px" }}
			/>
		</QuickTooltip>
	);
}
