import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import { type JustChildren } from "#types/react";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useEffect, useState } from "react";
import { type UserDocument } from "tachi-common";

import { SplashScreen } from "./SplashScreen";

export function LoadingScreen({ children }: JustChildren) {
	const [loading, setLoading] = useState(true);
	// if we've been waiting around for too long, maybe we're down.
	const [broke, setBroke] = useState("");

	const { setUser } = useContext(UserContext);

	useEffect(() => {
		if (!localStorage.getItem("isLoggedIn")) {
			setLoading(false);
			return;
		}

		const timeout = setTimeout(
			() =>
				setBroke(
					`It's taking a long time for ${TachiConfig.NAME} to load. We might be under strain, or completely down, sorry!`,
				),
			4_000,
		);

		Promise.all([
			APIFetchV1<UserDocument>("/users/me").then((rj) => {
				if (rj.success) {
					setUser(rj.body);
				} else {
					localStorage.removeItem("isLoggedIn");
				}
			}),
		])
			.then(() => {
				setLoading(false);
				clearTimeout(timeout);
			})
			.catch((err) => {
				console.error(err);
				setBroke(
					`${TachiConfig.NAME} is currently down, sadly. Check back in a while, or we might be doing a quick server restart. Sorry!`,
				);
				clearTimeout(timeout);
			});
	}, []);

	if (loading) {
		return <SplashScreen broke={broke} />;
	}

	return <>{children}</>;
}
