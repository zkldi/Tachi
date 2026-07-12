import type React from "react";

import { type GameProfileProps } from "./react";

export interface GameUtility {
	urlPath: string;
	name: string;
	description: React.ReactChild;
	component: (ugpt: GameProfileProps) => JSX.Element;
	personalUseOnly?: boolean;
}
