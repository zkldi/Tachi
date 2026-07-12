import { type GameProfileProps } from "#types/react";
import { useMemo } from "react";

export default function useUserGameBase({ reqUser, game }: GameProfileProps) {
	return useMemo(() => `/u/${reqUser.username}/games/${game}`, [reqUser, game]);
}
