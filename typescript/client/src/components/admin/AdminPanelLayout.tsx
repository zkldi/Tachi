import { type JustChildren } from "#types/react";
import { NavLink } from "react-router-dom";

import styles from "./AdminPanelNav.module.scss";

const TABS = [
	{ label: "Job queue", to: "/admin/job-queue" },
	{ label: "Cron jobs", to: "/admin/cron-jobs" },
	{ label: "Actions", to: "/admin/actions" },
	{ label: "Operations", to: "/admin/operations" },
	{ label: "Destructive", to: "/admin/destructive" },
] as const;

export function AdminPanelLayout({ children }: JustChildren) {
	return (
		<div className="d-flex flex-column gap-4 w-100">
			<header className="d-flex align-items-center gap-3 pb-2">
				<h1
					className="h4 mb-0 text-uppercase fw-bold text-body-secondary"
					style={{ letterSpacing: "0.04em" }}
				>
					Admin Panel
				</h1>
			</header>
			<nav className={styles.tabBar}>
				{TABS.map((tab) => (
					<NavLink
						activeClassName={styles.tabActive}
						className={styles.tab}
						exact
						key={tab.to}
						to={tab.to}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>
			<div className="pt-2">{children}</div>
		</div>
	);
}
