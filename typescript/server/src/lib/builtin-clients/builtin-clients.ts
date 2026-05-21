import { ACTION_InstallBuiltinClient } from "#actions/install-builtin-client";
import { log } from "#lib/log/log";
import { ServerConfig, TachiConfig } from "#lib/setup/config";
import _ from "lodash";
import { type APIPermissions, type TachiAPIClientDocument } from "tachi-common";
/* eslint-disable no-await-in-loop */
import { GetClientByID } from "#utils/queries/api-clients";
import { GetFirstAdmin } from "#utils/user";
import fjsh from "fast-json-stable-hash";

type DefaultClients = Array<Omit<TachiAPIClientDocument, "author" | "clientSecret">>;

// Defines some Tachi API Clients that should come default with a Tachi
// environment.
// These use the special Client ID prefix "CX" instead of "CI", which
// means they cannot possibly be collided.
const KamaiDefaultClients: DefaultClients = [
	{
		name: "Fervidex",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXFervidex",
		apiKeyFilename: "kamaitachi.fervidex.json",
		apiKeyTemplate: JSON.stringify(
			{
				url: `${ServerConfig.OUR_URL}/ir/fervidex`,
				token: "%%TACHI_KEY%%",
			},
			null,
			"\t",
		),
	},
	{
		name: "Barbatos",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXBarbatos",
		apiKeyFilename: "barbatos.json",
		apiKeyTemplate: JSON.stringify(
			{
				api_key: "%%TACHI_KEY%%",
			},
			null,
			"\t",
		),
	},
	{
		name: "Konaste Hook",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXKsHook",
		apiKeyFilename: "kamaitachi.kshook.json",
		apiKeyTemplate: JSON.stringify(
			{
				url: `${ServerConfig.OUR_URL}/ir/kshook`,
				token: "%%TACHI_KEY%%",
				games: ["sv6c"],
			},
			null,
			"\t",
		),
	},
	{
		clientID: "CXChunitachi",
		requestedPermissions: ["submit_score"],
		name: "ChunItachi",
		redirectUri: null,
		webhookUri: null,
		apiKeyFilename: "ChunItachi.ini",
		apiKeyTemplate: `[general]
; Show information for debugging. Useful in case things go wrong.
showDebug = true

; Set this to an extID if multiple people play on your setup
; and you only want to import scores from a specific user.
; You can find your extID inside your database...
; ...or you can set it to junk like 123 and check the debug logs.
extID = 0

; The current version of the game you're playing on.
; This should be any of the following:
; game = amazon
; game = amazonplus
; game = crystal
; game = paradise
; game = paradiselost

game = PUT_YOUR_GAME_HERE

; If true, Fails will take more priority than things like FULL COMBOs.
failOverLamp = false

[kamaitachi]
; What to use to check whether we're online or not.
apiStatus = ${ServerConfig.OUR_URL}/api/v1/status

; Where to POST scores to.
apiEndpoint = ${ServerConfig.OUR_URL}/ir/direct-manual/import

; This thing is secret! Keep it so. You can manage your API Keys at
; ${ServerConfig.OUR_URL}/users/me -> Integrations -> API Keys!
apikey = %%TACHI_KEY%%`,
	},
	{
		name: "SilentHook",
		apiKeyFilename: "silent-config.json",
		apiKeyTemplate: JSON.stringify(
			{
				key: "%%TACHI_KEY%%",
				url: `${ServerConfig.OUR_URL}/ir/direct-manual/import`,
			},
			null,
			"\t",
		),
		clientID: "CXSilentHook",
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		webhookUri: null,
	},
	{
		name: "Mikado",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXMikado",
		apiKeyFilename: "mikado.toml",
		apiKeyTemplate: `[general]
# Set to 'false' to disable the hook
enable = true
# Whether the hook should export your class (skill level) or not
export_class = true
# Whether the hook should should inject your Tachi PBs in place of Cloud PBs
inject_cloud_pbs = true
# Timeout for web requests, in milliseconds
timeout = 3000

[cards]
# Card numbers that should be whitelisted
# If this is empty, all cards will be whitelisted
# E000 format, should be in single quotes and separated by commas
# Example: whitelist = ['E000000000', 'E000000001']
whitelist = []

[tachi]
# Tachi instance base URL
base_url = '${ServerConfig.OUR_URL}'
# Tachi status endpoint
status = '/api/v1/status'
# Tachi score import endpoint
import = '/ir/direct-manual/import'
# Tachi pbs endpoint
pbs = '/api/v1/users/{}/games/sdvx/pbs/all'
# Your Tachi API key
api_key = '%%TACHI_KEY%%'
`,
	},
	{
		clientID: "CXSaekawa",
		requestedPermissions: ["submit_score"],
		name: "Saekawa",
		redirectUri: null,
		webhookUri: null,
		apiKeyFilename: "saekawa.toml",
		apiKeyTemplate: `[general]
# Whether the hook should export class medals (dans) and emblems.
export_class = true

# Whether FAILED lamps should override FULL COMBO and ALL JUSTICE.
# Not recommended, but it's an option.
fail_over_lamp = false

# Timeout for web requests, in milliseconds. If your network connection
# to Tachi is unstable, you might want to bump this up.
timeout = 3000

# Whether the hook should update itself when a new update is found.
auto_update = true

# The directory/folder to store failed imports due to network
# connectivity issues. It will not save any imports rejected
# by Tachi for other reasons.
failed_import_dir = "failed_saekawa_imports"

[cards]
# Tachi API keys go here. You can set a default API key for all
# cards using the \`default\` key:
#    default = "example-api-key"
# You can also set the API key that will be used for a specific access code
# (useful for shared setups):
#    "00001111222233334444" = "example-api-key-1"
#    "55556666777788889999" = "example-api-key-2"
# The \`default\` key can also be removed, discarding any scores
# that do not come from the list of access codes configured.

default = "%%TACHI_KEY%%"

[tachi]
# The base URL of the Tachi instance to submit scores to.
base_url = "${ServerConfig.OUR_URL}"`,
	},
	{
		clientID: "CXInohara",
		requestedPermissions: ["submit_score"],
		name: "Inohara",
		redirectUri: null,
		webhookUri: null,
		apiKeyFilename: "inohara.cfg",
		apiKeyTemplate: `[Options]

# Whether to enable score submissions
Enable = true

# Timeout for web requests, in seconds
Timeout = 5

# Tachi instance base URL
BaseUrl = ${ServerConfig.OUR_URL}

# Tachi API v1 route
ApiRoute = /api/v1

# Tachi score import endpoint
Import = /ir/direct-manual/import

# Whether to generate score/bell/life charts
EnableGraphs = true

[Keys]

* = %%TACHI_KEY%%

# If you have a multi-user setup, you can configure
# keys per-profile, using in-game name or access code:
#
# InGameUsername = TachiApiKey
# 00081111222233334444 = AnotherTachiApiKey
#
# If present, an * matches everyone else`,
	},
	{
		clientID: "CXRizu",
		requestedPermissions: ["submit_score"],
		name: "Rizu",
		redirectUri: null,
		webhookUri: null,
		apiKeyFilename: "Rizu.cfg",
		apiKeyTemplate: `[General]

## Whether to enable score submissions
# Setting type: Boolean
# Default value: true
Enable = true

## Timeout for score submission in seconds
# Setting type: Int32
# Default value: 30
NetworkTimeout = 30

## Folder for storing imports that failed due to network errors.
## Leave empty to disable
# Setting type: String
# Default value: UserData/Rizu/FailedImports
FailedImportsFolder = UserData/Rizu/FailedImports

[Keys]

## Kamaitachi API keys to use for score submissions, in the format
## of \`<access-code> = <api-key>\`. The \`default\` key is used as fallback
## if an access code does not have an API key set, and can be removed.
# Setting type: String
# Default value:
default = %%TACHI_KEY%%

[Tachi]

## Tachi instance base URL
# Setting type: String
# Default value: https://kamai.tachi.ac
BaseUrl = ${ServerConfig.OUR_URL}`,
	},
];

const BokuDefaultClients: DefaultClients = [
	{
		name: "Beatoraja IR",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXBeatorajaIR",
		apiKeyTemplate: null,
		apiKeyFilename: null,
	},
	{
		name: "USC IR",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXUSCIR",
		apiKeyTemplate: null,
		apiKeyFilename: null,
	},
	{
		name: "LR2 Hook",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXLR2Hook",
		apiKeyFilename: "BokutachiAuth.json",
		apiKeyTemplate: JSON.stringify(
			{
				url: `${ServerConfig.OUR_URL}/ir/lr2hook/import`,
				apiKey: "%%TACHI_KEY%%",
			},
			null,
			"\t",
		),
	},
	{
		name: "ITG Hook",
		webhookUri: null,
		redirectUri: null,
		requestedPermissions: ["submit_score"],
		clientID: "CXITGHook",
		apiKeyFilename: "Tachi.json",
		apiKeyTemplate: JSON.stringify([
			{
				url: `${ServerConfig.OUR_URL}/ir/direct-manual/import`,
				token: "%%TACHI_KEY%%",
			},
		]),
	},
];

export async function LoadDefaultClients() {
	if (TachiConfig.TYPE === "kamai") {
		await LoadClients(KamaiDefaultClients);
	} else if (TachiConfig.TYPE === "boku") {
		await LoadClients(BokuDefaultClients);
	} else {
		await LoadClients(KamaiDefaultClients);
		await LoadClients(BokuDefaultClients);
	}
}

async function LoadClients(clients: DefaultClients) {
	const firstAdmin = await GetFirstAdmin();

	for (const client of clients) {
		const exists = await GetClientByID(client.clientID);

		if (exists) {
			const existsOmitted = _.omit(exists, "author", "clientSecret");

			// Skip if nothing has changed.
			if (fjsh.hash(existsOmitted, "sha256") === fjsh.hash(client, "sha256")) {
				continue;
			}
		}

		const permissionsObject: Partial<Record<APIPermissions, boolean>> = {};
		for (const permission of client.requestedPermissions) {
			permissionsObject[permission] = true;
		}

		await ACTION_InstallBuiltinClient(
			{
				ip: null,
				acct: {
					id: firstAdmin.id,
					username: firstAdmin.username,
				},
			},
			{
				clientID: client.clientID,
				name: client.name,
				permissions: permissionsObject,
				apiKeyFilename: client.apiKeyFilename,
				apiKeyTemplate: client.apiKeyTemplate,
				redirectUri: client.redirectUri,
				webhookUri: client.webhookUri,
			},
		);

		log.info(`Loaded/Modified new built-in client ${client.name}.`);
	}
}
