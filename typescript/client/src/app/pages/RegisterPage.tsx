import useSetSubheader from "#components/layout/header/useSetSubheader";
import LoginPageLayout from "#components/layout/LoginPageLayout";
import Divider from "#components/util/Divider";
import { UserContext } from "#context/UserContext";
import { ClientConfig } from "#lib/config";
import { type UseFormik } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { HumaniseError } from "#util/humanise-error";
import { HistorySafeGoBack } from "#util/misc";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useFormik } from "formik";
import React, { type MutableRefObject, useContext, useRef, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import toast from "react-hot-toast";
import { Link, useHistory } from "react-router-dom";
import { type UserDocument } from "tachi-common";

// seconds it takes for a user to actually read the rules.
const RULES_READ_TIME = Number(import.meta.env.VITE_RULES_READ_TIME) || 30;

// When set, skip the rules gate entirely and go straight to the signup form.
const SKIP_RULES = import.meta.env.VITE_SKIP_RULES === "true";

export default function RegisterPage() {
	useSetSubheader("Register");

	const [err, setErr] = useState("");
	// not opened: user has not clicked the rules link
	// opened: user has clicked the rules link
	// read: at least 30 seconds have expired.
	const [readRules, setReadRules] = useState<"acknowledged" | "not-opened" | "opened" | "read">(
		SKIP_RULES ? "acknowledged" : "not-opened",
	);
	const [disabled, setDisabled] = useState(true);
	const [btnText, setBtnText] = useState("I've read the rules. (Click the rules.)");

	const { setUser } = useContext(UserContext);
	const history = useHistory();
	const hcaptchaRef = useRef<InstanceType<typeof HCaptcha> | null>(null);

	const urlParams = new URLSearchParams(location.search);

	const formik = useFormik({
		initialValues: {
			username: "",
			"!password": "",
			confPassword: "",
			inviteCode: urlParams.get("inviteCode") ?? "",
			email: "",
			captcha: "temp",
		},
		onSubmit: async (values) => {
			if (values["!password"] !== values.confPassword) {
				setErr("Password and confirm password do not match!");
				return;
			}

			// user trying to gmail but can't use their keyboard
			// like TEN people have made this mistake and then complained to me on discord
			// what the hell?
			//
			// how do real websites deal with this?
			if (values.email.match(/@gma/u) && !values.email.match(/@gmail\.com *$/u)) {
				setErr("This email address is probably typo'd. Did you mean 'gmail'?");
				return;
			}

			const rj = await APIFetchV1<UserDocument>(
				"/auth/register",
				{
					method: "POST",
					body: JSON.stringify({
						"!password": values["!password"],
						inviteCode: values.inviteCode,
						username: values.username.trim(),
						"!email": values.email,
						captcha: values.captcha,
					}),
					headers: {
						"Content-Type": "application/json",
					},
				},
				false,
				true,
			);

			if (hcaptchaRef.current) {
				hcaptchaRef.current.resetCaptcha();
			}

			if (!rj.success) {
				setErr(HumaniseError(rj.description));
				return;
			}

			toast.success("Created Account, Logged In!");

			setTimeout(() => {
				setUser(rj.body);
				localStorage.setItem("isLoggedIn", "true");

				HistorySafeGoBack(history);
			}, 500);
		},
	});

	function ReadRulesWait() {
		if (readRules !== "not-opened") {
			return;
		}

		setReadRules("opened");

		// users have to actually read the rules.
		let wait = RULES_READ_TIME;
		const tickerRef = setInterval(() => {
			wait--;
			setBtnText(`I've read the rules (${wait}s)`);
		}, 1000);

		setTimeout(() => {
			setReadRules("read");
			setBtnText("I've read the rules.");
			setDisabled(false);
			clearInterval(tickerRef);
		}, RULES_READ_TIME * 1000);
	}

	return (
		<LoginPageLayout description={<Description />} heading="Register">
			{readRules === "acknowledged" ? (
				<RegisterForm err={err} formik={formik} hcaptchaRef={hcaptchaRef} />
			) : (
				<div className="text-center">
					<div className="mb-8">
						<Alert variant="warning">
							<b>
								If you already have an account. DO NOT MAKE ANOTHER ONE! That will
								get both accounts banned.
							</b>
						</Alert>
						<h4>
							Hey! Before you make an account, please read the{" "}
							<a
								href="https://docs.tachi.ac/wiki/rules/"
								onAuxClick={ReadRulesWait}
								onClick={() => {
									setTimeout(() => ReadRulesWait(), 300);
								}}
								rel="noopener noreferrer"
								target="_blank"
							>
								Rules.
							</a>
						</h4>

						<h6>(This link opens in a new tab.)</h6>
					</div>

					<Divider />

					{readRules === "opened" ? (
						<p className="mt-4">
							Hey, it takes longer than {RULES_READ_TIME} seconds to read the rules.
							<br />I know it sucks to wait around, but the few rules we have are
							enforced strictly.
							<br />
							The last thing you'd want is to accidentally get yourself banned!
						</p>
					) : (
						<></>
					)}

					<div className="justify-content-center d-flex mt-4">
						<Link className="me-auto btn btn-outline-danger" tabIndex={-1} to="/">
							Back
						</Link>
						<Button
							className="ms-auto"
							disabled={disabled}
							onClick={() => setReadRules("acknowledged")}
						>
							{btnText}
						</Button>
					</div>
				</div>
			)}
		</LoginPageLayout>
	);
}

function Description() {
	return (
		<>
			Have an account?
			<Link className="fw-bold ms-2 link-primary" to="/login">
				Sign in!
			</Link>
		</>
	);
}

function RegisterForm({
	formik,
	err,
	hcaptchaRef,
}: {
	err: string;
	formik: UseFormik<{
		"!password": string;
		captcha: string;
		confPassword: string;
		email: string;
		inviteCode: string;
		username: string;
	}>;
	hcaptchaRef: MutableRefObject<InstanceType<typeof HCaptcha> | null>;
}) {
	return (
		<Form className="d-flex flex-column gap-4 w-100" onSubmit={formik.handleSubmit}>
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
				<Form.Label>Email</Form.Label>
				<Form.Control
					id="email"
					onChange={formik.handleChange}
					tabIndex={2}
					type="email"
					value={formik.values.email}
				/>
				<Alert className="mt-4 mb-0" variant="warning">
					This is used for things like password recovery, and authentication checks. If
					this email is fake, and you forget your password, <br />
					<b>You will be permanently locked out of your account.</b>
					<br />
					We will never use this to send spam!
				</Alert>
			</Form.Group>
			<Form.Group>
				<Form.Label>Password</Form.Label>
				<Form.Control
					id="!password"
					onChange={formik.handleChange}
					tabIndex={3}
					type="password"
					value={formik.values["!password"]}
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label>Confirm Password</Form.Label>
				<Form.Control
					id="confPassword"
					onChange={formik.handleChange}
					tabIndex={4}
					type="password"
					value={formik.values.confPassword}
				/>
			</Form.Group>
			{ClientConfig.MANDATE_LOGIN && (
				<Form.Group>
					<Form.Label>Invite Code</Form.Label>
					<Form.Control
						id="inviteCode"
						onChange={formik.handleChange}
						tabIndex={5}
						type="text"
						value={formik.values.inviteCode}
					/>
				</Form.Group>
			)}

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

			<Form.Group className="text-center text-danger" style={{ display: err ? "" : "none" }}>
				{err}
			</Form.Group>
			<Form.Group className="justify-content-center d-flex pt-4">
				<Link className="me-auto btn btn-outline-danger" tabIndex={7} to="/">
					Back
				</Link>
				<Button className="ms-auto" tabIndex={6} type="submit">
					Register!
				</Button>
			</Form.Group>
		</Form>
	);
}
