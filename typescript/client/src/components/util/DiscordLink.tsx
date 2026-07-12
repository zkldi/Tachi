import { type JustChildren } from "#types/react";

import Muted from "./Muted";

export default function DiscordLink({ children }: JustChildren) {
	if (!import.meta.env.VITE_DISCORD) {
		return (
			<a href="#">
				Discord <Muted>(However, no Discord has been set up yet...)</Muted>
			</a>
		);
	}

	return (
		<a href={import.meta.env.VITE_DISCORD} rel="noopener noreferrer" target="_blank">
			{children}
		</a>
	);
}
