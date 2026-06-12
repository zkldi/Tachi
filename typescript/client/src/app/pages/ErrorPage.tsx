import useSetSubheader from "#components/layout/header/useSetSubheader";
import { ToCDNURL } from "#util/api";
import { HistorySafeGoBack } from "#util/misc";
import { useHistory } from "react-router-dom";

export default function ErrorPage({
	statusCode,
	customMessage,
}: {
	customMessage?: string;
	statusCode: number;
}) {
	useSetSubheader(statusCode ? statusCode.toString() : "Lost Connection.");

	let message;

	const history = useHistory();

	if (!customMessage) {
		switch (statusCode) {
			case 400:
				message = "The server refused this request.";
				break;
			case 401:
				message = "Looks like you're not authorised. Try logging in.";
				break;
			case 403:
				message = "Looks like you're not allowed to be here.";
				break;
			case 404:
				message = "This page does not exist. If you think it should exist, let us know!";
				break;
			case 429:
				message = "You're being rate limited. If this was unexpected, please report this.";
				break;
			case 500:
				message = "Looks like the server has failed. This has been reported!";
				break;
			case undefined:
				message =
					"Looks like we've lost connection to the server. Ah well. Try reloading, but there's no promises.";
				break;
			default:
				message = "An unexpected error has occurred. This has been reported!";
				break;
		}
	} else {
		message = customMessage;
	}

	const style =
		statusCode === 999
			? {
					background: "red",
					backgroundImage: `url(${ToCDNURL("/eggs/michael.png")})`,
					backgroundRepeat: "no-repeat",
					backgroundPosition: "center",
					backgroundSize: "cover",
					color: "red",
					zIndex: 9999,
				}
			: { zIndex: 9999 };

	const bgColour = statusCode === 999 ? " " : " bg-body ";

	return (
		<div
			className={`position-fixed inset-0 d-flex flex-column justify-content-center align-items-center${bgColour}text-center`}
			style={style}
		>
			<h1 className="display-1 enable-rfs fw-bold mt-15">
				{statusCode || "Lost Connection"}
			</h1>
			<p className="fs-3">{message}</p>
			<a
				href="#"
				onClick={(e) => {
					e.preventDefault();
					HistorySafeGoBack(history);
				}}
				style={{ color: "inherit" }}
			>
				Go Back
			</a>
		</div>
	);
}
