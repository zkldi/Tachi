import CenterLayoutPage from "#components/layout/CenterLayoutPage";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import useQueryString from "#components/util/useQueryString";
import { UserContext } from "#context/UserContext";
import { useContext } from "react";

import ErrorPage from "./ErrorPage";
import LoginPage from "./LoginPage";

export default function VerifyEmailPage() {
	const { user } = useContext(UserContext);
	const params = useQueryString();

	const code = params.get("code");

	if (!code) {
		return (
			<ErrorPage
				customMessage="Invalid URL - Missing important parameters."
				statusCode={400}
			/>
		);
	}

	if (!user) {
		return <LoginPage />;
	}

	return (
		<CenterLayoutPage>
			<VerifyEmail code={code} />
		</CenterLayoutPage>
	);
}

function VerifyEmail({ code }: { code: string }) {
	const { data, error } = useApiQuery("/auth/verify-email", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			code,
		}),
	});

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<>
			Verified your email.
			<Divider />
			<LinkButton to="/">Go back home!</LinkButton>
		</>
	);
}
