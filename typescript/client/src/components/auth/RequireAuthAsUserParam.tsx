import ErrorPage from "#app/pages/ErrorPage";
import { UserContext } from "#context/UserContext";
import { type JustChildren } from "#types/react";
import { useContext } from "react";
import { useParams } from "react-router-dom";
import { UserAuthLevels } from "tachi-common";

export default function RequireAuthAsUserParam({ children }: JustChildren) {
	const { userID } = useParams<{ userID: string }>();
	const { user } = useContext(UserContext);

	if (!user) {
		return <ErrorPage customMessage="You are not signed in!" statusCode={401} />;
	}

	if (
		userID !== user.id.toString() &&
		userID.toLowerCase() !== user.usernameLowercase &&
		user.authLevel !== UserAuthLevels.ADMIN
	) {
		return <ErrorPage customMessage="You are not authorised to view this." statusCode={403} />;
	}

	return <>{children}</>;
}
