import { TachiConfig } from "#lib/config";
import { type UserDocument } from "tachi-common";

export default function SupportBanner({ user }: { user: UserDocument }) {
	// thank you
	if (user.isSupporter) {
		return (
			<div className="d-flex w-100 justify-content-center flex-column align-items-center">
				<div>❤️❤️❤️ Thank you for supporting {TachiConfig.NAME}. ❤️❤️❤️</div>
			</div>
		);
	}

	return <></>;
}
