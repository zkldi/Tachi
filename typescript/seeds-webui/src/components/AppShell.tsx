import { DevStrip } from "#components/DevStrip";
import { EDIT_MODE } from "#lib/config";
import { listDrafts } from "#lib/edits/draft-store";
import React, { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Link, NavLink, useLocation } from "react-router-dom";

function useDraftCount(): number {
	const { data = 0 } = useQuery(
		"draft-count",
		async () => {
			if (!EDIT_MODE) {
				return 0;
			}
			return (await listDrafts()).length;
		},
		{
			refetchInterval: EDIT_MODE ? 2000 : false,
			staleTime: 0,
		},
	);
	return data;
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useTheme();
	const draftCount = useDraftCount();
	const location = useLocation();
	const onDraftsPage = location.pathname === "/drafts";

	return (
		<div className="app-shell">
			<header className="sw-header">
				<NavLink activeClassName="" className="brand" exact to="/">
					<img alt="Tachi" src="/logos/logo-mark.png" />
					<div className="brand-wordmark">
						Tachi
						<small>Seeds</small>
					</div>
				</NavLink>
				<nav className="sw-nav">
					<NavLink activeClassName="active" exact to="/">
						Overview
					</NavLink>
					<NavLink activeClassName="active" to="/query">
						Query
					</NavLink>
					<NavLink activeClassName="active" to="/diff">
						Diff
					</NavLink>
					{EDIT_MODE ? (
						<>
							<span className="nav-sep" />
							<span className="dev-label">Edit</span>
							<NavLink activeClassName="active" to="/bulk">
								Bulk
							</NavLink>
							<NavLink activeClassName="active" to="/drafts">
								Drafts
								{draftCount > 0 ? (
									<span className="draft-badge">{draftCount}</span>
								) : null}
							</NavLink>
							<NavLink activeClassName="active" to="/validate">
								Validate
							</NavLink>
						</>
					) : null}
				</nav>
				<div className="sw-header-right">
					<span
						className={`mode-badge ${EDIT_MODE ? "mode-dev" : "mode-readonly"}`}
						title={
							EDIT_MODE
								? "Running against a local dev server; edits write to disk."
								: "Read-only. Hosted build without a dev server."
						}
					>
						{EDIT_MODE ? "Dev" : "Read-only"}
					</span>
					<button
						aria-label="Toggle theme"
						className="theme-toggle"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						title="Toggle theme"
						type="button"
					>
						{theme === "dark" ? "Light mode" : "Dark mode"}
					</button>
				</div>
			</header>
			<DevStrip />
			<div className="sw-body">
				<main className="sw-content">{children}</main>
			</div>
			{EDIT_MODE && draftCount > 0 && !onDraftsPage ? (
				<DraftsFloatingBar count={draftCount} />
			) : null}
		</div>
	);
}

function DraftsFloatingBar({ count }: { count: number }) {
	return (
		<div className="drafts-bar">
			<span className="drafts-bar-icon">✎</span>
			<span className="drafts-bar-text">
				<strong>{count}</strong> staged {count === 1 ? "edit" : "edits"}
			</span>
			<Link className="drafts-bar-link" to="/drafts">
				Review &amp; Apply →
			</Link>
		</div>
	);
}

type Theme = "dark" | "light";

function useTheme(): [Theme, (t: Theme) => void] {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof document === "undefined") {
			return "dark";
		}
		return (document.documentElement.getAttribute("data-bs-theme") as Theme) ?? "dark";
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-bs-theme", theme);
		document.documentElement.style.setProperty(
			"color-scheme",
			theme === "light" ? "light" : "dark",
		);
	}, [theme]);

	const setTheme = (t: Theme) => {
		localStorage.setItem("seeds-webui-theme", t);
		setThemeState(t);
	};
	return [theme, setTheme];
}
