import { UserContext } from "#context/UserContext";
import React, { useContext } from "react";
import { type UserDocument } from "tachi-common";

export default function ReferToUser({ reqUser }: { reqUser: UserDocument }) {
	const { user } = useContext(UserContext);

	return <>{user?.id === reqUser.id ? "You have" : `${reqUser.username} has`}</>;
}
