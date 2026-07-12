import Loading from "#components/util/Loading";
import React, { type CSSProperties } from "react";
import { type UnsuccessfulAPIResponse } from "tachi-common";

export default function LoadingWrapper({
	dataset,
	error,
	children,
	style,
}: {
	children: JSX.Element | JSX.Element[];
	dataset: unknown | null | undefined;
	error: UnsuccessfulAPIResponse | null;
	style?: CSSProperties;
}) {
	if (error) {
		return <h3>An error has occurred. {error.description}</h3>;
	}

	if (!dataset) {
		return <Loading style={style} />;
	}

	return <>{children}</>;
}
