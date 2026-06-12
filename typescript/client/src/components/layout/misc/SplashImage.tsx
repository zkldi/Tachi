import { TachiConfig } from "#lib/config";
import { ToCDNURL } from "#util/api";

export default function SplashImage() {
	return (
		<img
			alt={TachiConfig.NAME}
			src={ToCDNURL("/logos/logo-wordmark.png")}
			style={{ maxWidth: "50%" }}
			width="256px"
		/>
	);
}
