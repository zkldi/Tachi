import { ONE_DAY } from "util/constants/time";
import Card from "components/layout/page/Card";
import ExternalLink from "components/util/ExternalLink";
import Icon from "components/util/Icon";
import useApiQuery from "components/util/query/useApiQuery";
import { TachiConfig } from "lib/config";
import React, { useEffect, useState } from "react";
import { UserDocument, integer } from "tachi-common";

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
