import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import OAuthMoreInfo from "#components/util/OAuthMoreInfo";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type APITokenDocument, type TachiAPIClientDocument } from "tachi-common";

export default function ClientFileFlowPage() {
	const { clientID } = useParams<{ clientID: string }>();
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [showKey, setShowKey] = useState(false);

	const { user } = useContext(UserContext);

	const { data, error } = useApiQuery<Omit<TachiAPIClientDocument, "clientSecret">>(
		`/clients/${clientID}`,
	);

	if (error) {
		return (
			<>
				<ApiError error={error} />
				<div>
					Since you're on this page, this probably wasn't your fault. Report it to the
					person who directed you here.
				</div>
			</>
		);
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<div className="row">
			{createdKey === null ? (
				<>
					<div className="col-12">
						{data.name} is requesting you create an API Key.
						<Divider />
					</div>
					<div className="col-12">
						The key will have the following permissions.
						<ul>
							{data.requestedPermissions.map((e) => (
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
								const res = await APIFetchV1<APITokenDocument>(
									`/users/${user?.id}/api-tokens/create`,
									{
										method: "POST",
										body: JSON.stringify({
											clientID: data.clientID,
										}),
										headers: {
											"Content-Type": "application/json",
										},
									},
									true,
									true,
								);

								if (res.success) {
									setCreatedKey(
										data.apiKeyTemplate
											? data.apiKeyTemplate.replace(
													"%%TACHI_KEY%%",
													res.body.token!,
												)
											: res.body.token,
									);
								}
							}}
						>
							Create the key.
						</button>
					</div>
					<div className="col-12" style={{ fontSize: "1.3rem" }}>
						<Divider />
						<OAuthMoreInfo client={data} />
					</div>
				</>
			) : (
				<>
					<div className="col-12 text-center">Created API Key.</div>
					<div className="col-12">
						<Divider />
						{showKey ? (
							<>
								<code>{createdKey}</code>
								<br />
								You should copy this token back to the application that requested
								this.
							</>
						) : data.apiKeyFilename ? (
							<>
								<a
									className="btn btn-info"
									download={data.apiKeyFilename}
									href={`data:text/plain,${encodeURIComponent(createdKey)}`}
								>
									Download {data.apiKeyFilename}
								</a>
								<br />
								<Link className="mt-8" style={{ fontSize: "0.9rem" }} to="/">
									Go Back to {TachiConfig.NAME}
								</Link>
							</>
						) : (
							<button
								className="btn btn-danger"
								onClick={() => {
									setShowKey(true);
								}}
							>
								Reveal key
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}
