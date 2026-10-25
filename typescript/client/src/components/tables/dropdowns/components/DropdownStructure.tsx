import { type JustChildren } from "#types/react";

import styles from "./ScoreDetails.module.scss";

export default function DropdownStructure({
	buttons,
	children,
}: {
	buttons: React.ReactNode;
} & JustChildren) {
	return (
		<div className={styles.layout}>
			<nav aria-label="Score details" className={styles.navigation}>
				{buttons}
			</nav>
			<div className={styles.content}>
				<div className="row mb-0">{children}</div>
			</div>
		</div>
	);
}
