import { AccountSettings } from "#app/pages/dashboard/users/UserSettingsPage";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { ONE_MINUTE } from "#util/constants/time";
import React, { useContext, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import toast from "react-hot-toast";

import useSetSubheader from "../header/useSetSubheader";

export default function EmailVerify({
	setHasVerifiedEmail,
}: {
	setHasVerifiedEmail: SetState<boolean | null>;
}) {
	useSetSubheader("Email Verification...");

	const { user } = useContext(UserContext);

	async function CheckEmail() {
		const r = await APIFetchV1(`/users/${user!.id}/is-email-verified`);

		if (r.success && r.body) {
			setHasVerifiedEmail(true);
		}

		return r.success ? r.body : false;
	}

	const { data } = useApiQuery<string>(`/users/${user!.id}/email`);

	useEffect(() => {
		const interval = setInterval(CheckEmail, ONE_MINUTE);

		return () => clearInterval(interval);
	}, []);

	const [showChange, setShowChange] = useState(false);

	return (
		<div className="col-12 col-lg-6 offset-lg-3 text-center" style={{ fontSize: "1.4rem" }}>
			One last thing! You need to verify your email before you can use the site.
			<br />
			An email has been sent to the address you signed up with.
			{data && (
				<>
					{" "}
					(<code>{data}</code>)
				</>
			)}
			<br />
			It might've ended up in your spam, so check there too!
			<Divider />
			<Button
				onClick={async () => {
					const res = await CheckEmail();

					if (!res) {
						toast.error(
							"Looks like your email isn't verified. If you're having issues, contact us in the discord.",
						);
					}
				}}
			>
				Yup, verified my email.
			</Button>
			<Divider />
			<Button
				onClick={() => {
					setShowChange(!showChange);
				}}
				variant="danger"
			>
				I signed up with the wrong email address. Let me change it!
			</Button>
			{showChange && (
				<div className="col-12">
					<Divider className="mt-4 mb-4" />
					<AccountSettings reqUser={user!} />
				</div>
			)}
			<Divider />
			<Button
				onClick={async () => {
					await APIFetchV1("/auth/resend-verify-email", {
						method: "POST",
					});

					toast.success("Sent a new email to your address.");
				}}
				style={{ fontSize: "1.1rem" }}
				variant="warning"
			>
				I haven't got it. Re-send the email!
			</Button>
			<br />
			<span style={{ fontSize: "1rem" }}>
				<Muted>
					Can't get the email? Signed up with a fake email like an idiot? You'll have to
					contact us at the discord below.
				</Muted>
			</span>
		</div>
	);
}
