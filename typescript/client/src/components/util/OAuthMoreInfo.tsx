import { type TachiAPIClientDocument, type UserDocument } from "tachi-common";

import ApiError from "./ApiError";
import Loading from "./Loading";
import Muted from "./Muted";
import useApiQuery from "./query/useApiQuery";

export default function OAuthMoreInfo({
	client,
}: {
	client: Omit<TachiAPIClientDocument, "clientSecret">;
}) {
	const { data, error } = useApiQuery<UserDocument>(`/users/${client.author}`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return <Muted>API Client Author: {data.username}.</Muted>;
}
