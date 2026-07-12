import { ToAbsoluteAPIURLForHelpLink, ToAPIURL } from "#util/api";
import { type TachiServerCoreConfig } from "tachi-common";
// @ts-expect-error No types available...
import syncFetch from "sync-fetch";

const mode = import.meta.env.VITE_TCHIC_MODE;

if (!mode) {
	throw new Error("No VITE_TCHIC_MODE set in Process Environment, refusing to boot.");
}

let configRes;
try {
	configRes = syncFetch(ToAPIURL("/config")).json();

	if (!configRes.success) {
		throw new Error(`Failed to fetch config -- ${configRes.description}.`);
	}
} catch (err) {
	const statusHelpUrl = ToAbsoluteAPIURLForHelpLink("/status");

	// Do NOT use document.open() / document.write() / document.close() here.
	// document.open() fires unload/beforeunload/pagehide events, which Vite's HMR
	// client intercepts to close its WebSocket. The HMR reconnection logic then
	// triggers a full page reload, re-running this module, failing again - an
	// infinite refresh loop.
	//
	// Do NOT throw either - an uncaught module-evaluation error is another signal
	// that Vite HMR uses to trigger a reload.
	//
	// Instead, use direct DOM mutation (no unload events) and console.error.
	document.head.innerHTML = `<style>
		.box {
			display: flex;
			justify-content: center;
			align-items: center;
			width: 100vw;
			height: 100vh;
			flex-direction: column;
			text-align: center;
			position: absolute;
		}

		ul {
			text-align: left;
		}
	</style>`;

	document.body.innerHTML = `<div class="box">
		${
			import.meta.env.VITE_IS_LOCAL_DEV
				? `
			<hr />
			<h1><b>Couldn't connect to the server.</b></h1>
			<h3>You are in local development mode.</h3>
			<ul style="font-size: 2rem;">
				<li>The backend appears to be down. Try <a href="${statusHelpUrl}">the status endpoint</a>.</li>
				<li>Are there any errors in your terminal?</li>
			</ul>
		`
				: `<h1>Failed to connect!</h1>
		<div>Welp. Looks like we're down. Sorry about that.</div>
		<div>Chances are, this is just a temporary outage and will be fixed soon.</div>
		<div style="font-size: 1.25rem; margin-top: 1rem; margin-bottom: 1rem;">
			Please be patient, <a href="https://github.com/zkldi/Tachi">Tachi is maintained by a very small team.</a>
		</div>
		<div>An error message can be found in the browser console. (<code>Ctrl-Shift-I</code>)</div>`
		}
	</div>`;

	// alert(`Fatal Error: Site is (probably) down. Sorry. (${(err as Error).message})`);
	console.error(`Site is (probably) down. Sorry. (${(err as Error).message})`);
	// Prevent the rest of this module from executing (configRes.body would throw),
	// but do so with a promise that never settles rather than a throw or a busy-loop.
	// Top-level await is valid in ES modules; this pauses execution without blocking
	// the thread and without signalling a module error to Vite HMR.
	await new Promise<never>(() => {
		/* intentionally never resolves */
	});
}

const conf: TachiServerCoreConfig = configRes.body;
const colourConf = {
	background: "#131313",
	lightground: "#2b292b",
	backestground: "#000000",
	overground: "#524e52",
	primary: "#000",
};

if (mode === "kamai") {
	colourConf.primary = "#e61c6e";
} else if (mode === "boku") {
	colourConf.primary = "#4974a5";
} else if (mode === "omni") {
	colourConf.primary = "#e61c6e";
} else {
	throw new Error("Invalid VITE_TCHIC_MODE. Expected kamai, boku or omni.");
}

export const TachiConfig = conf;
export const ColourConfig = colourConf;
export const ClientConfig = {
	MANDATE_LOGIN: import.meta.env.VITE_MANDATE_LOGIN,
};
