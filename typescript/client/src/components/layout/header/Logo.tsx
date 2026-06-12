import { TachiConfig } from "#lib/config";
import { ToCDNURL } from "#util/api";
import { Link } from "react-router-dom";

export default function Logo() {
	return (
		<Link
			className="p-2 d-none d-lg-block focus-visible-ring focus-ring-primary transition-color transition-box-shadow rounded"
			id="top"
			to="/"
		>
			<img
				alt={TachiConfig.NAME}
				height={35}
				id="logo"
				src={ToCDNURL("/logos/logo-mark.png")}
			/>
		</Link>
	);
}
