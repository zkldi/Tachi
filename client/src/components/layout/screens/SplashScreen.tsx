import Loading from "components/util/Loading";
import React from "react";
import SplashImage from "../misc/SplashImage";

export function SplashScreen({ broke }: { broke: string }) {
	return (
		<div id="splash-screen" className="splash-screen">
			<SplashImage />
			{!broke && <Loading />}
			{broke && <p className="mt-4">{broke}</p>}
		</div>
	);
}
