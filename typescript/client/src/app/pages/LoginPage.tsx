import useSetSubheader from "#components/layout/header/useSetSubheader";
import LoginPageLayout from "#components/layout/LoginPageLayout";
import { UserContext } from "#context/UserContext";
import { APIFetchV1 } from "#util/api";
import { HumaniseError } from "#util/humanise-error";
import { HistorySafeGoBack } from "#util/misc";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useFormik } from "formik";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import toast from "react-hot-toast";
import { Link, useHistory } from "react-router-dom";
import { type UserDocument } from "tachi-common";

export default function LoginPage() {
	useSetSubheader("Login");

	const [err, setErr] = useState("");
	const { setUser } = useContext(UserContext);
	const history = useHistory();

	const hcaptchaRef = useRef<InstanceType<typeof HCaptcha> | null>(null);

	const [localDevFirstAdminLogin, setLocalDevFirstAdminLogin] = useState<
		| { password: string; status: "ready"; username: string }
		| { status: "loading" }
		| { status: "unavailable" }
		| null
	>(null);

	useEffect(() => {
		if (!import.meta.env.VITE_IS_LOCAL_DEV) {
			return;
		}
		setLocalDevFirstAdminLogin({ status: "loading" });
		void APIFetchV1<{ password: string; username: string }>("/localdev/first-admin-login")
			.then((r) => {
				if (r.success && r.body) {
					setLocalDevFirstAdminLogin({
						status: "ready",
						username: r.body.username,
						password: r.body.password,
					});
				} else {
					setLocalDevFirstAdminLogin({ status: "unavailable" });
				}
			})
			.catch(() => {
				setLocalDevFirstAdminLogin({ status: "unavailable" });
			});
	}, []);

	const performLogin = async (values: {
		"!password": string;
		captcha: string;
		username: string;
	}) => {
		setErr("");

		const rj = await APIFetchV1(
			"/auth/login",
			{
				method: "POST",
				body: JSON.stringify({
					username: values.username.trim(),
					"!password": values["!password"],
					captcha: values.captcha,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			},
			false,
			false,
		);

		if (hcaptchaRef.current) {
			hcaptchaRef.current.resetCaptcha();
		}

		if (!rj.success) {
			setErr(HumaniseError(rj.description));
			return;
		}

		const userRJ = await APIFetchV1<UserDocument>("/users/me");

		if (userRJ.statusCode === 403) {
			setErr("You are banned.");
			return;
		}

		if (!userRJ.success) {
			console.error("Error retrieving own user?");
			setErr("An internal server error has occurred.");
			return;
		}

		toast.success("Logged in!");

		setTimeout(() => {
			setUser(userRJ.body);
			localStorage.setItem("isLoggedIn", "true");

			HistorySafeGoBack(history);
		}, 500);
	};

	const formik = useFormik({
		initialValues: {
			username: "",
			"!password": "",
			captcha: "",
		},
		onSubmit: performLogin,
	});

	const localDevReadyLogin =
		localDevFirstAdminLogin?.status === "ready" ? localDevFirstAdminLogin : null;

	return (
		<LoginPageLayout description={<Description />} heading="Log In">
			<Form className="d-flex flex-column gap-4 w-100" onSubmit={formik.handleSubmit}>
				{import.meta.env.VITE_IS_LOCAL_DEV && localDevReadyLogin && (
					<Alert className="mb-0" variant="info">
						<div className="d-flex flex-column gap-2">
							<span>
								You are in local development mode. You can log in as the first admin
								account (<code>{localDevReadyLogin.username}</code> /{" "}
								<code>{localDevReadyLogin.password}</code>).
							</span>
							<Button
								className="align-self-start"
								onClick={() =>
									void performLogin({
										username: localDevReadyLogin.username,
										"!password": localDevReadyLogin.password,
										captcha: formik.values.captcha,
									})
								}
								size="sm"
								type="button"
								variant="outline-primary"
							>
								Log in as first admin
							</Button>
						</div>
					</Alert>
				)}
				<Form.Group>
					<Form.Label>Username</Form.Label>
					<Form.Control
						id="username"
						onChange={formik.handleChange}
						tabIndex={1}
						type="text"
						value={formik.values.username}
					/>
				</Form.Group>
				<Form.Group>
					<Form.Label>Password</Form.Label>
					<Form.Control
						id="!password"
						onChange={formik.handleChange}
						tabIndex={2}
						type="password"
						value={formik.values["!password"]}
					/>
				</Form.Group>
				<Form.Group
					className="text-center text-danger"
					style={{ display: err ? "" : "none" }}
				>
					{err}
				</Form.Group>

				{import.meta.env.VITE_HCAPTCHA_SITEKEY && (
					<HCaptcha
						onExpire={() => {
							formik.setFieldValue("captcha", "");
						}}
						onVerify={(token) => {
							formik.setFieldValue("captcha", token);
						}}
						ref={hcaptchaRef}
						sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY}
					/>
				)}

				<Form.Group className="justify-content-center d-flex pt-4">
					<span
						className="me-auto btn btn-outline-danger"
						onClick={() => history.goBack()}
						tabIndex={4}
					>
						Back
					</span>
					<Link to="/forgot-password">Forgot Password</Link>
					<Button className="ms-auto" tabIndex={3} type="submit">
						Log In
					</Button>
				</Form.Group>
			</Form>
		</LoginPageLayout>
	);
}

const Description = () => (
	<>
		Don't have an account?
		<Link className="fw-bold ms-2 link-primary" to="/register">
			Sign Up!
		</Link>
	</>
);
