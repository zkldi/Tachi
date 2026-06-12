import Loading from "#components/util/Loading";

import SplashImage from "../misc/SplashImage";

export function SplashScreen({ broke }: { broke: string }) {
	return (
		<div
			className="bg-body position-fixed inset-0 d-flex flex-column justify-content-center align-items-center"
			id="splash-screen"
		>
			<SplashImage />
			{!broke && <Loading />}
			{broke && <p className="mt-4">{broke}</p>}
		</div>
	);
}
