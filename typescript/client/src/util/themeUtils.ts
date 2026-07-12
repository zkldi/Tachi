export type Themes = "dark" | "light" | "oled";

export const metaThemeColours: Record<Themes, string> = {
	light: "#FFF",
	dark: "#131313",
	oled: "#000",
};

export function getStoredTheme() {
	const storedTheme = localStorage.getItem("theme");
	if (
		storedTheme &&
		(storedTheme === "light" || storedTheme === "dark" || storedTheme === "oled")
	) {
		return storedTheme as Themes;
	}
	return null;
}

export function mediaQueryPrefers() {
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		return "dark";
	} else {
		return "light";
	}
}

export function getTheme() {
	const storedTheme = getStoredTheme();
	if (storedTheme) {
		return storedTheme;
	}

	const mediaTheme = mediaQueryPrefers();
	if (mediaTheme) {
		return mediaTheme;
	}
	return "light";
}

export function setMetaTheme(theme: Themes) {
	const metaTheme = document.querySelector("meta[name='theme-color']");
	if (metaTheme) {
		metaTheme.setAttribute("content", metaThemeColours[theme]);
	} else {
		const head = document.getElementsByTagName("head")[0];
		const meta = document.createElement("meta");
		meta.setAttribute("name", "theme-color");
		meta.content = metaThemeColours[theme];
		head.appendChild(meta);
	}
}

export function setTheme(theme: Themes) {
	const root = document.documentElement;
	root.setAttribute("data-bs-theme", theme);
	root.style.setProperty("color-scheme", theme === "light" ? theme : "dark");
	setMetaTheme(theme);
}
