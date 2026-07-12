import LoginPageLayout from "#components/layout/LoginPageLayout";
import MainPageTitleContainer from "#components/util/MainPageTitleContainer";
import { APIFetchV1 } from "#util/api";
import { ShortDelayify } from "#util/misc";
import { useState } from "react";
import { Button, Form } from "react-bootstrap";

import ErrorPage from "./ErrorPage";

export default function ResetPasswordPage() {
	const code = new URLSearchParams(window.location.search).get("code");
	const [password, setPassword] = useState("");
	const [confirmPass, setConfirmPass] = useState("");

	if (!code) {
		return <ErrorPage statusCode={400} />;
	}

	<MainPageTitleContainer
		desc="Pick something you'll remember this time :)"
		title="Reset Password"
	/>;
	return (
		<LoginPageLayout
			description="Pick something you'll remember this time :)"
			heading="Reset Password"
		>
			<Form
				className="d-flex flex-column gap-4 w-100"
				onSubmit={async (e) => {
					e.preventDefault();

					const res = await APIFetchV1(
						"/auth/reset-password",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ code, "!password": password }),
						},
						true,
						true,
					);

					if (res.success) {
						ShortDelayify(() => (window.location.href = "/"));
					}
				}}
			>
				<Form.Group>
					<Form.Label>New Password</Form.Label>
					<Form.Control
						isValid={password.length >= 8}
						onChange={(e) => setPassword(e.target.value)}
						type="password"
						value={password}
					/>
				</Form.Group>
				<Form.Group>
					<Form.Label>Confirm</Form.Label>
					<Form.Control
						isValid={password === confirmPass}
						onChange={(e) => setConfirmPass(e.target.value)}
						type="password"
						value={confirmPass}
					/>
				</Form.Group>
				<Form.Group className="justify-content-center d-flex pt-4">
					<Button
						className="ms-auto"
						disabled={!(password === confirmPass && password.length >= 8)}
						tabIndex={3}
						type="submit"
					>
						Reset Password
					</Button>
				</Form.Group>
			</Form>
		</LoginPageLayout>
	);
}
