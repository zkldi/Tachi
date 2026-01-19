import { APIFetchV1 } from "util/api";
import { allPermissions, DelayedPageReload } from "util/misc";
import useSetSubheader from "components/layout/header/useSetSubheader";
import Card from "components/layout/page/Card";
import ApiError from "components/util/ApiError";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import FormInput from "components/util/FormInput";
import Icon from "components/util/Icon";
import Loading from "components/util/Loading";
import Muted from "components/util/Muted";
import useApiQuery from "components/util/query/useApiQuery";
import SelectLinkButton from "components/util/SelectLinkButton";
import { TachiConfig } from "lib/config";
import React, { useEffect, useReducer, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row } from "react-bootstrap";
import { Link, Route, Switch } from "react-router-dom";
import {
	APIPermissions,
	APITokenDocument,
	integer,
	UserDocument,
	TachiAPIClientDocument,
	CGCardInfo,
	MytCardInfo,
} from "tachi-common";
import { SetState } from "types/react";
import { CGNeedsIntegrate } from "components/imports/CGIntegrationPage";
import { MytNeedsIntegrate } from "components/imports/MYTIntegrationPage";
import FervidexIntegrationPage from "./FervidexIntegrationPage";
import KsHookSV6CIntegrationPage from "./KsHookSV6CIntegrationPage";

export default function UserIntegrationsPage({ reqUser }: { reqUser: UserDocument }) {
	useSetSubheader(
		["Users", reqUser.username, "Integrations"],
		[reqUser],
		`${reqUser.username}'s Integrations`
	);

	const baseUrl = `/u/${reqUser.username}/integrations`;

	return (
		<Card header="Integrations" className="col-12 offset-lg-2 col-lg-8">
			<Row>
				<Col xs={12}>
					<div className="btn-group d-flex justify-content-center">
						{TachiConfig.TYPE !== "boku" && (
							<SelectLinkButton className="text-wrap" to={`${baseUrl}/services`}>
								<Icon type="network-wired" /> Service Configuration
							</SelectLinkButton>
						)}
						<SelectLinkButton className="text-wrap" to={`${baseUrl}`}>
							<Icon type="key" /> API Keys
						</SelectLinkButton>
						<SelectLinkButton className="text-wrap" to={`${baseUrl}/oauth-clients`}>
							<Icon type="robot" /> My API Clients
						</SelectLinkButton>
					</div>
					<Divider />
				</Col>
				<Col xs={12}>
					<Switch>
						<Route exact path={baseUrl}>
							<APIKeysPage reqUser={reqUser} />
						</Route>
						<Route path={`${baseUrl}/services`}>
							<ServicesPage reqUser={reqUser} />
						</Route>
						<Route path={`${baseUrl}/oauth-clients`}>
							<OAuthClientPage />
						</Route>
					</Switch>
				</Col>
			</Row>
		</Card>
	);
}

function OAuthClientPage() {
	return (
		<Row className="text-center justify-content-center">
			<Col xs={12}>
				<h3>API Clients</h3>
				<Alert variant="info">
					This page is for programmers who want to make their own things that interface
					with {TachiConfig.NAME}.
					<br />
					You can read the documentation{" "}
					<ExternalLink href="https://docs.tachi.ac/codebase/infrastructure/api-clients/">
						here
					</ExternalLink>
					!
				</Alert>
				<Muted>Register your own clients for integrating with {TachiConfig.NAME}.</Muted>
			</Col>
			<Col xs={12}>
				<OAuthClientInfo />
			</Col>
		</Row>
	);
}

function OAuthClientInfo() {
	const { data, error } = useApiQuery<TachiAPIClientDocument[]>("/clients");

	const [clients, setClients] = useState<TachiAPIClientDocument[]>([]);

	useEffect(() => {
		setClients(data ?? []);
	}, [data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (clients.length === 0) {
		return (
			<>
				<Muted>You don't have any API Clients.</Muted>
				<Divider />
				<CreateNewOAuthClient setClients={setClients} />
			</>
		);
	}

	return (
		<>
			{clients.map((e) => (
				<OAuthClientRow
					setClients={setClients}
					clients={clients}
					key={e.clientID}
					client={e}
				/>
			))}
			<Divider />
			<CreateNewOAuthClient setClients={setClients} />
		</>
	);
}

function CreateNewOAuthClient({ setClients }: { setClients: SetState<TachiAPIClientDocument[]> }) {
	const [show, setShow] = useState(false);
	const [name, setName] = useState("");
	const [redirectUri, setRedirectUri] = useState("");
	const [webhookUri, setWebhookUri] = useState("");
	const [apiKeyFilename, setApiKeyFilename] = useState("");
	const [apiKeyTemplate, setApiKeyTemplate] = useState("");
	const [permissions, setPermissions] = useState<APIPermissions[]>([]);

	return (
		<>
			<Button onClick={() => setShow(true)} variant="success">
				Create New Client
			</Button>
			<Modal show={show} onHide={() => setShow(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Create New Client</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form
						onSubmit={async (e) => {
							e.preventDefault();

							const res = await APIFetchV1(
								"/clients/create",
								{
									method: "POST",
									headers: {
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										name,
										redirectUri: redirectUri || null,
										permissions,
										apiKeyTemplate: apiKeyTemplate || null,
										apiKeyFilename: apiKeyFilename || null,
										webhookUri: webhookUri || null,
									}),
								},
								true,
								true
							);

							if (res.success) {
								DelayedPageReload();
							}
						}}
					>
						<div className="input-group">
							<span className="input-group-text">Name</span>
							<input
								value={name}
								className="form-control"
								onChange={(e) => setName(e.target.value)}
								placeholder="My API Client"
							/>
						</div>
						<Muted>
							Give your Service a name. This will be shown when users use follow OAuth
							flow.
						</Muted>
						<Divider />
						<div className="input-group">
							<span className="input-group-text">Redirect URI</span>
							<input
								value={redirectUri}
								className="form-control"
								onChange={(e) => setRedirectUri(e.target.value)}
								placeholder="https://example.com/callback"
							/>
						</div>
						<Muted>
							This is the URL {TachiConfig.NAME} will redirect to as part of the OAuth
							flow.
						</Muted>
						<Divider />
						<FormInput
							fieldName="Webhook Uri"
							value={webhookUri}
							setValue={setWebhookUri}
							placeholder="https://example.com/webhook"
						/>
						<Muted>
							This is the URL {TachiConfig.NAME} will send webhook info to. Leave this
							blank to not recieve webhook events.
						</Muted>
						<Divider />
						<FormInput
							as="textarea"
							fieldName="File Template"
							value={apiKeyTemplate}
							setValue={setApiKeyTemplate}
							placeholder={JSON.stringify({ token: "%%TACHI_KEY%%" }, null, "\t")}
						/>
						<Muted>
							In what format should a generated API Key be shown to the user? This
							only applies to Client File Flow. <code>%%TACHI_KEY%%</code> will be
							replaced with the generated key. Read more about client file flow{" "}
							<ExternalLink href="https://docs.tachi.ac/codebase/infrastructure/file-flow/">
								here
							</ExternalLink>
							.
							<br />
							Leave this empty to spit the key out directly.
						</Muted>
						{apiKeyTemplate !== "" && !apiKeyTemplate.includes("%%TACHI_KEY%%") && (
							<>
								<br />
								<span className="text-danger">
									No %%TACHI_KEY%% detected in file template. Please add one!
								</span>
							</>
						)}
						<Divider />
						<FormInput
							fieldName="File Template"
							value={apiKeyFilename}
							setValue={setApiKeyFilename}
							placeholder="my-service-config.json"
						/>
						<Muted>
							If this is not empty, Client File Flow will result in a file of this
							name being downloaded (in the above format).
						</Muted>
						<Divider />
						<h4>Permissions</h4>
						<div className="px-4">
							{allPermissions.map((permission, i) => (
								<React.Fragment key={i}>
									<input
										key={permission}
										className="form-check-input"
										type="checkbox"
										onChange={(e) => {
											if (e.target.checked) {
												setPermissions([...permissions, permission]);
											} else {
												setPermissions(
													permissions.filter((e) => e !== permission)
												);
											}
										}}
									/>
									<label className="form-check-label">{permission}</label>
									<br />
								</React.Fragment>
							))}
						</div>

						<Divider />
						<button type="submit" className="btn btn-success">
							Create Client
						</button>
					</Form>
				</Modal.Body>
			</Modal>
		</>
	);
}

interface OAuthClientProps {
	client: TachiAPIClientDocument;
	clients: TachiAPIClientDocument[];
	setClients: SetState<TachiAPIClientDocument[]>;
}

function OAuthClientRow({ client, clients, setClients }: OAuthClientProps) {
	const [hasWarned, setHasWarned] = useState(false);
	const [showDangerousStuff, setShowDangerousStuff] = useState(false);
	const [deleteModalShow, setDeleteModalShow] = useState(false);
	const [editModalShow, setEditModalShow] = useState(false);

	return (
		<div key={client.clientID} className="col-12">
			<Divider />

			<h2 className="mb-4">{client.name}</h2>
			<div className="text-start">
				<h5>
					Client ID: <code>{client.clientID}</code>
				</h5>
				<h5>
					Client Secret:{" "}
					<code onClick={() => setHasWarned(true)}>
						{hasWarned ? client.clientSecret : "SENSITIVE: CLICK TO REVEAL"}
					</code>
				</h5>
				<h5>
					Permissions: <code>{client.requestedPermissions.join(", ")}</code>
				</h5>
				<h5>
					Redirect Uri: <code>{client.redirectUri ?? "No Redirect URI"}</code>
				</h5>
				<h5>
					Webhook Uri: <code>{client.webhookUri ?? "No Webhook URI"}</code>
				</h5>
				<h5>
					Download Filename: <code>{client.apiKeyFilename ?? "No Filename"}</code>
				</h5>
				<h5>
					File Format:{" "}
					<textarea
						readOnly
						className="w-100 mt-2 font-monospace"
						value={client.apiKeyTemplate ?? "%%TACHI_KEY%%"}
					/>
				</h5>
				<h6>
					Client File Flow Link: <br />
					<code>
						{window.location.origin}/client-file-flow/{client.clientID}
					</code>
				</h6>
				<h6>
					OAuth Flow Link: <br />
					<code>
						{window.location.origin}/oauth/request-auth?clientID={client.clientID}
					</code>
				</h6>
			</div>

			<Divider />

			<div className="d-flex" style={{ justifyContent: "space-around" }}>
				<Button variant="info" onClick={() => setEditModalShow(!editModalShow)}>
					Edit Client
				</Button>

				<Button
					onClick={() => {
						setShowDangerousStuff(!showDangerousStuff);
					}}
					variant="danger"
				>
					{showDangerousStuff ? "Hide Dangerous Stuff" : "Show Dangerous Stuff"}
				</Button>
			</div>

			{showDangerousStuff && (
				<div className="mt-8">
					<Button
						onClick={async () => {
							const res = await APIFetchV1<TachiAPIClientDocument>(
								`/clients/${client.clientID}/reset-secret`,
								{
									method: "POST",
								},
								true,
								true
							);

							if (res.success) {
								setClients(
									clients.map((e) => {
										if (e.clientID === client.clientID) {
											return res.body;
										}
										return e;
									})
								);
							}
						}}
						variant="warning"
					>
						Reset Client Secret
					</Button>
					<br />
					<Muted>
						You can reset your client secret incase you accidentally exposed it.
					</Muted>
					<br />
					<Button
						className="mt-4"
						onClick={() => setDeleteModalShow(true)}
						variant="danger"
					>
						Destroy Client
					</Button>
					<br />
					<Muted>
						This will destroy your client and all API Keys associated with it.
					</Muted>
				</div>
			)}

			<EditClientModal
				{...{ client, setClients, clients, show: editModalShow, setShow: setEditModalShow }}
			/>

			<Modal show={deleteModalShow} onHide={() => setDeleteModalShow(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Seriously, are you really sure?</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					All keys ever created for this API Client will be deleted.
					<br />
					<strong className="text-danger">
						ALL USERS USING THIS APPLICATION WILL NO LONGER BE ABLE TO USE THE
						ASSOCIATED KEYS!
					</strong>
					<Divider />
					<div className="w-100 d-flex justify-content-center">
						<Button
							variant="danger"
							onClick={async () => {
								const res = await APIFetchV1(
									`/clients/${client.clientID}`,
									{
										method: "DELETE",
									},
									true,
									true
								);

								if (res.success) {
									setClients(
										clients.filter((e) => e.clientID !== client.clientID)
									);
								}
							}}
						>
							I'm sure.
						</Button>
					</div>
				</Modal.Body>
			</Modal>
		</div>
	);
}

function EditClientModal({
	client,
	clients,
	setClients,
	show,
	setShow,
}: OAuthClientProps & {
	show: boolean;
	setShow: SetState<boolean>;
}) {
	const [name, setName] = useState(client.name);
	const [redirectUri, setRedirectUri] = useState(client.redirectUri ?? "");
	const [webhookUri, setWebhookUri] = useState(client.webhookUri ?? "");
	const [apiKeyFilename, setApiKeyFilename] = useState(client.apiKeyFilename ?? "");
	const [apiKeyTemplate, setApiKeyTemplate] = useState(client.apiKeyTemplate ?? "");

	return (
		<Modal show={show} onHide={() => setShow(false)}>
			<Modal.Header closeButton>
				<Modal.Title>Edit {client.name}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Form
					onSubmit={async (e) => {
						e.preventDefault();

						const res = await APIFetchV1<TachiAPIClientDocument>(
							`/clients/${client.clientID}`,
							{
								method: "PATCH",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									name,
									redirectUri,
									webhookUri: webhookUri === "" ? null : webhookUri,
									apiKeyFilename: apiKeyFilename === "" ? null : apiKeyFilename,
									apiKeyTemplate: apiKeyTemplate === "" ? null : apiKeyTemplate,
								}),
							},
							true,
							true
						);

						if (res.success) {
							setClients(
								clients.map((e) => {
									if (e.clientID === client.clientID) {
										return res.body;
									}

									return e;
								})
							);
						}
					}}
				>
					<FormInput
						fieldName="Client Name"
						value={name}
						setValue={setName}
						placeholder="My API Client"
					/>
					<Divider />
					<FormInput
						fieldName="Redirect URI"
						value={redirectUri}
						setValue={setRedirectUri}
						placeholder="https://example.com/callback"
					/>
					<Muted>
						Where a user will be redirected to after completing the OAuth flow.
					</Muted>

					<Divider />
					<FormInput
						fieldName="Webhook URI"
						value={webhookUri}
						setValue={setWebhookUri}
						placeholder="https://example.com/webhook"
					/>
					<Muted>
						Where to send webhook events to. Please read the{" "}
						<ExternalLink href="https://docs.tachi.ac/api/webhooks/main/">
							Webhook Documentation
						</ExternalLink>{" "}
						before using this, as there are necessary security precautions.
					</Muted>

					<Divider />
					<FormInput
						as="textarea"
						fieldName="File Template"
						value={apiKeyTemplate}
						setValue={setApiKeyTemplate}
						placeholder={JSON.stringify({ token: "%%TACHI_KEY%%" }, null, "\t")}
					/>
					<Muted>
						In what format should a generated API Key be shown to the user? This only
						applies to Client File Flow. <code>%%TACHI_KEY%%</code> will be replaced
						with the generated key. Read more about client file flow{" "}
						<ExternalLink href="https://docs.tachi.ac/codebase/infrastructure/file-flow/">
							here
						</ExternalLink>
						.
						<br />
						Leave this empty to spit the key out directly.
					</Muted>
					{apiKeyTemplate !== "" && !apiKeyTemplate.includes("%%TACHI_KEY%%") && (
						<>
							<br />
							<span className="text-danger">
								No %%TACHI_KEY%% detected in file template. Please add one!
							</span>
						</>
					)}
					<Divider />
					<FormInput
						fieldName="File Template"
						value={apiKeyFilename}
						setValue={setApiKeyFilename}
						placeholder="my-service-config.json"
					/>
					<Muted>
						If this is not empty, Client File Flow will result in a file of this name
						being downloaded (in the above format).
					</Muted>

					<Divider />

					<button type="submit" className="btn btn-success">
						Update Client
					</button>
				</Form>
			</Modal.Body>
		</Modal>
	);
}

function ServicesPage({ reqUser }: { reqUser: UserDocument }) {
	if (TachiConfig.TYPE === "boku") {
		return (
			<Row className="text-center">
				Looks like there's no services available for integration.
			</Row>
		);
	}

	const baseUrl = `/u/${reqUser.username}/integrations/services`;

	return (
		<Row className="text-center justify-content-center">
			<Col xs={12}>
				<h3>Service Configuration</h3>
				<span>
					This is for <b>Configuring Integrations!</b>
				</span>
				<br />
				<Muted>
					Note: Some services have had their names truncated to their first three
					characters for privacy reasons.
				</Muted>
				<Divider />
			</Col>
			<Col xs={12}>
				<div className="btn-group d-flex overflow-x-auto scrollbar-hide whitespace-nowrap">
					<SelectLinkButton to={`${baseUrl}/fervidex`}>Fervidex</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/cg-gan`}>CG GAN</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/cg-nag`}>CG NAG</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/cg-dev`}>CG Dev</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/myt`}>MYT</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/kshook`}>KsHook</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/flo`}>FLO</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/eag`}>EAG</SelectLinkButton>
					<SelectLinkButton to={`${baseUrl}/min`}>MIN</SelectLinkButton>
				</div>
				<Divider />
			</Col>
			<Switch>
				<Route exact path={`${baseUrl}/fervidex`}>
					<FervidexIntegrationPage reqUser={reqUser} />
				</Route>
				<Route exact path={`${baseUrl}/cg-gan`}>
					<CGIntegrationInfo key="cg" userID={reqUser.id} cgType="gan" />
				</Route>
				<Route exact path={`${baseUrl}/cg-nag`}>
					<CGIntegrationInfo key="cg" userID={reqUser.id} cgType="nag" />
				</Route>
				<Route exact path={`${baseUrl}/cg-dev`}>
					<CGIntegrationInfo key="cg" userID={reqUser.id} cgType="dev" />
				</Route>
				<Route exact path={`${baseUrl}/myt`}>
					<MytIntegrationInfo userID={reqUser.id} />
				</Route>
				<Route exact path={`${baseUrl}/kshook`}>
					<KsHookSV6CIntegrationPage reqUser={reqUser} />
				</Route>
				<Route exact path={`${baseUrl}/flo`}>
					<KAIIntegrationStatus userID={reqUser.id} kaiType="flo" />
				</Route>
				<Route exact path={`${baseUrl}/eag`}>
					<KAIIntegrationStatus userID={reqUser.id} kaiType="eag" />
				</Route>
				<Route exact path={`${baseUrl}/min`}>
					<KAIIntegrationStatus userID={reqUser.id} kaiType="min" />
				</Route>
			</Switch>
		</Row>
	);
}

function KAIIntegrationStatus({
	kaiType,
	userID,
}: {
	kaiType: "flo" | "eag" | "min";
	userID: integer;
}) {
	const { data, error } = useApiQuery<{ authStatus: boolean }>(
		`/users/${userID}/integrations/kai/${kaiType}`
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<div className="row">
			<div className="col-12">
				<h3>
					{data.authStatus
						? `You are authenticated with ${kaiType.toUpperCase()}!`
						: `You are not authenticated with ${kaiType.toUpperCase()}`}
				</h3>
				{data.authStatus ? (
					<>
						<Button
							variant="danger"
							onClick={async () => {
								const res = await APIFetchV1(
									`/users/${userID}/integrations/kai/${kaiType}`,
									{
										method: "DELETE",
									},
									true,
									true
								);

								if (res.success) {
									window.location.reload();
								}
							}}
						>
							Revoke Authentication?
						</Button>
						<Divider />
						The below button will <strong>revoke</strong> your authentication with{" "}
						{kaiType.toUpperCase()}.
						<br />
						You only need to do this if you've revoked it on {kaiType.toLowerCase()}!
					</>
				) : (
					<h4>
						You should authenticate yourself by going to{" "}
						<Link to="/import" className="link-primary">
							Import Scores
						</Link>{" "}
						for the thing you want to import for!
					</h4>
				)}
			</div>
		</div>
	);
}

function APIKeysPage({ reqUser }: { reqUser: UserDocument }) {
	const [apiKeys, setApiKeys] = useState<APITokenDocument[]>([]);
	const [showModal, setShowModal] = useState(false);

	const { data, error } = useApiQuery<APITokenDocument[]>(`/users/${reqUser.id}/api-tokens`);

	useEffect(() => {
		if (data) {
			setApiKeys(data);
		}
	}, [data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<>
			<Alert variant="danger">
				API Keys allow other programs to interact with {TachiConfig.NAME} on your behalf.
				They have limited permissions, so they can't just change your password!
				<br />
				<br />
				In contrast to Integrations, API Keys let other programs interact with{" "}
				{TachiConfig.NAME}, rather than the other way around.
				<br />
				<br />
				Still, the stuff on this page is sensitive information! Be careful who you give
				these keys to.
			</Alert>
			<div className="row">
				{apiKeys.length === 0 ? (
					<div className="text-center">You have no API Keys.</div>
				) : (
					apiKeys.map((e) => (
						<APIKeyRow
							apiKeys={apiKeys}
							setApiKeys={setApiKeys}
							key={e.token}
							apiKey={e}
						/>
					))
				)}
			</div>
			<Divider />
			<button className="btn btn-primary w-100" onClick={() => setShowModal(true)}>
				Create new API Key
			</button>
			<CreateAPIKeyModal {...{ showModal, setShowModal, reqUser, setApiKeys, apiKeys }} />
		</>
	);
}

function CreateAPIKeyModal({
	showModal,
	setShowModal,
	reqUser,
	apiKeys,
	setApiKeys,
}: {
	showModal: boolean;
	setShowModal: SetState<boolean>;
	reqUser: UserDocument;
	apiKeys: APITokenDocument[];
	setApiKeys: SetState<APITokenDocument[]>;
}) {
	const [identifier, setIdentifier] = useState("My API Key");
	const [permissions, setPermissions] = useState<APIPermissions[]>([]);

	return (
		<Modal show={showModal} onHide={() => setShowModal(false)}>
			<Modal.Header>Create API Key</Modal.Header>
			<Modal.Body>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						const res = await APIFetchV1<APITokenDocument>(
							`/users/${reqUser.id}/api-tokens/create`,
							{
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									permissions,
									identifier,
								}),
							},
							true,
							true
						);

						if (res.success) {
							setApiKeys([...apiKeys, res.body]);
							setShowModal(false);
						}
					}}
				>
					<div className="input-group">
						<span className="input-group-text">Identifier</span>
						<input
							value={identifier}
							className="form-control"
							onChange={(e) => setIdentifier(e.target.value)}
						/>
					</div>
					<Muted>Give your API Key a name, so you dont forget what it's for!</Muted>
					<Divider />
					<h4>Permissions</h4>
					<div className="px-4">
						{allPermissions.map((permission, i) => (
							<React.Fragment key={i}>
								<input
									key={permission}
									className="form-check-input"
									type="checkbox"
									onChange={(e) => {
										if (e.target.checked) {
											setPermissions([...permissions, permission]);
										} else {
											setPermissions(
												permissions.filter((e) => e !== permission)
											);
										}
									}}
								/>
								<label className="form-check-label">{permission}</label>
								<br />
							</React.Fragment>
						))}
					</div>

					<Divider />
					<button type="submit" className="btn btn-success">
						Create Key
					</button>
				</form>
			</Modal.Body>
		</Modal>
	);
}

function APIKeyRow({
	apiKey,
	setApiKeys,
	apiKeys,
}: {
	apiKey: APITokenDocument;
	apiKeys: APITokenDocument[];
	setApiKeys: SetState<APITokenDocument[]>;
}) {
	const [show, setShow] = useState(false);
	const [sure, setSure] = useState(false);

	return (
		<div className="col-12">
			<Divider />
			<h4>{apiKey.identifier}</h4>
			{show ? (
				<code style={{ fontSize: "2rem" }}>{apiKey.token}</code>
			) : (
				<code style={{ fontSize: "2rem" }} onClick={() => setShow(true)}>
					Sensitive Information. Click to reveal.
				</code>
			)}
			<h5>Permissions: {Object.keys(apiKey.permissions).join(", ")}</h5>
			<Button
				onClick={async () => {
					if (!sure) {
						setSure(true);
					} else {
						await APIFetchV1(
							`/users/${apiKey.userID}/api-tokens/${apiKey.token}`,
							{
								method: "DELETE",
							},
							true,
							true
						);

						setApiKeys(apiKeys.filter((e) => e.token !== apiKey.token));
					}
				}}
				className="float-end"
				variant="danger"
			>
				{sure ? "Are you really sure?" : "Delete Key"}
			</Button>
		</div>
	);
}

function CGIntegrationInfo({ cgType, userID }: { cgType: "dev" | "gan" | "nag"; userID: integer }) {
	const [reload, shouldReloadCardInfo] = useReducer((x) => x + 1, 0);

	const { data, error } = useApiQuery<CGCardInfo | null>(
		`/users/${userID}/integrations/cg/${cgType}`,
		undefined,
		[reload]
	);

	if (error) {
		return <ApiError error={error} />;
	}

	// null is a valid response for this call, so be explicit with going to loading
	if (data === undefined) {
		return <Loading />;
	}

	return (
		<CGNeedsIntegrate
			cgType={cgType}
			onSubmit={async (cardID, pin) => {
				const res = await APIFetchV1(
					`/users/${userID}/integrations/cg/${cgType}`,
					{
						method: "PUT",
						body: JSON.stringify({ cardID, pin }),
						headers: {
							"Content-Type": "application/json",
						},
					},
					true,
					true
				);

				if (res.success) {
					shouldReloadCardInfo();
				}
			}}
			initialCardID={data?.cardID ?? undefined}
			initialPin={data?.pin ?? undefined}
		/>
	);
}

function MytIntegrationInfo({ userID }: { userID: integer }) {
	const [reload, shouldReloadCardInfo] = useReducer((x) => x + 1, 0);

	const { data, error } = useApiQuery<MytCardInfo | null>(
		`/users/${userID}/integrations/myt`,
		undefined,
		[reload]
	);

	if (error) {
		return <ApiError error={error} />;
	}

	// null is a valid response for this call, so be explicit with going to loading
	if (data === undefined) {
		return <Loading />;
	}

	return (
		<MytNeedsIntegrate
			onSubmit={async (cardAccessCode) => {
				const res = await APIFetchV1(
					`/users/${userID}/integrations/myt`,
					{
						method: "PUT",
						body: JSON.stringify({ cardAccessCode }),
						headers: {
							"Content-Type": "application/json",
						},
					},
					true,
					true
				);

				if (res.success) {
					shouldReloadCardInfo();
				}
			}}
			initialCardAccessCode={data?.cardAccessCode ?? undefined}
		/>
	);
}
