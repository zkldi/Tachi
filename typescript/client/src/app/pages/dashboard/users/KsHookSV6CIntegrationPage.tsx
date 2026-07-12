import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { APIFetchV1 } from "#util/api";
import React, { useState } from "react";
import { Button, Col, Form } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type FervidexSettingsDocument,
	type KsHookSettingsDocument,
	type UserDocument,
} from "tachi-common";

export default function KsHookSV6CIntegrationPage({ reqUser }: { reqUser: UserDocument }) {
	const { data: settings, error } = useApiQuery<FervidexSettingsDocument | null>(
		`/users/${reqUser.id}/integrations/kshook-sv6c/settings`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (settings === undefined) {
		return <Loading />;
	}

	return (
		<>
			<Col xs={12}>
				<h4>KsHook Integration</h4>
				<span>
					KsHook is a Score-Importing Hook for SOUND VOLTEX EA-CLOUD. Configuring it is as
					simple as dropping a <code>.dll</code> and config file into your game folder.
				</span>
			</Col>
			<Col className="mt-4" xs={12}>
				Instructions on how to setup the KsHook can be found{" "}
				<Link to="/import/kshook">here</Link>.
				<Divider />
			</Col>
			<Col className="mt-4" xs={12}>
				<h4 className="mb-4">Advanced Settings</h4>
				<KsHookSV6CForm {...{ reqUser, settings }} />
			</Col>
		</>
	);
}

function KsHookSV6CForm({
	reqUser,
	settings,
}: {
	reqUser: UserDocument;
	settings: KsHookSettingsDocument | null;
}) {
	const [formSettings, setFormSettings] = useState<Omit<KsHookSettingsDocument, "userID">>(
		settings ? { forceStaticImport: settings.forceStaticImport } : { forceStaticImport: false },
	);

	return (
		<Form
			className="text-start d-flex flex-column gap-4"
			onSubmit={async (e) => {
				e.preventDefault();

				await APIFetchV1(
					`/users/${reqUser.id}/integrations/kshook-sv6c/settings`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(formSettings),
					},
					true,
					true,
				);
			}}
		>
			<Form.Group>
				<Form.Check
					checked={formSettings.forceStaticImport}
					label="Sync Existing Scores"
					onChange={(e) => {
						setFormSettings({ ...formSettings, forceStaticImport: e.target.checked });
					}}
					type="checkbox"
				/>
				<Form.Text>
					Import existing scores on game load.
					<br />
					<span className="text-warning">
						Warning: You should always import from your network first. Statically
						imported scores have the bare minimum data (No timestamps!).
					</span>
				</Form.Text>
			</Form.Group>

			<Button type="submit" variant="primary">
				Submit Settings
			</Button>
		</Form>
	);
}
