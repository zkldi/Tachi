import CenterLayoutPage from "#components/layout/CenterLayoutPage";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import OAuthMoreInfo from "#components/util/OAuthMoreInfo";
import useApiQuery from "#components/util/query/useApiQuery";
import useQueryString from "#components/util/useQueryString";
import { APIFetchV1 } from "#util/api";
import { Link } from "react-router-dom";
import { type integer, type TachiAPIClientDocument } from "tachi-common";

export default function OAuthRequestAuthPage() {
	const params = useQueryString();

	const clientID = params.get("clientID");

	if (!clientID) {
		return (
			<CenterLayoutPage>
				No ClientID. Whoever gave you this link likely messed up somehow. <br />
				<Link to="/">Go Home.</Link>
			</CenterLayoutPage>
		);
	}

	return (
		<CenterLayoutPage>
			<OAuthRequestAuthLoader clientID={clientID} />
		</CenterLayoutPage>
	);
}

function OAuthRequestAuthLoader({ clientID }: { clientID: string }) {
	const { error, data } = useApiQuery<Omit<TachiAPIClientDocument, "clientSecret">>(
		`/clients/${clientID}`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (!data.redirectUri) {
		return (
			<>
				This client does not support OAuth Flows.
				<br />
				Whoever gave you this link likely messed up somehow. <br />
				<Link to="/">Go Home.</Link>
			</>
		);
	}

	return <OAuthRequestAuthMain client={data} />;
}

function OAuthRequestAuthMain({
	client,
}: {
	client: Omit<TachiAPIClientDocument, "clientSecret">;
}) {
	const params = useQueryString();

	const context = params.get("context");

	return (
		<div className="row">
			<>
				<div className="col-12">
					{client.name} is requesting you authenticate with them.
					<Divider />
				</div>
				<div className="col-12">
					The key will have the following permissions.
					<ul>
						{client.requestedPermissions.map((e) => (
							<li key={e}>{e}</li>
						))}
					</ul>
				</div>
				<div className="col-12 d-flex" style={{ justifyContent: "space-evenly" }}>
					<Link className="btn btn-danger" to="/">
						No thanks.
					</Link>
					<button
						className="btn btn-success"
						onClick={async () => {
							const tokenRes = await APIFetchV1<{
								code: string;
								createdOn: number;
								userID: integer;
							}>(
								"/oauth/create-code",
								{
									method: "POST",
								},
								false,
								true,
							);

							if (!tokenRes.success) {
								return;
							}

							const redirectURL = new URL(client.redirectUri!);

							redirectURL.searchParams.set("code", tokenRes.body.code);

							if (context) {
								redirectURL.searchParams.set("context", context);
							}

							window.location.href = redirectURL.toString();
						}}
					>
						I want to authenticate with {client.name}.
					</button>
				</div>
				<div className="col-12" style={{ fontSize: "1.3rem" }}>
					<Divider />
					<OAuthMoreInfo client={client} />
				</div>
			</>
		</div>
	);
}
