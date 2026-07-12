import { HashPassword } from "#lib/auth/auth";
import DB from "#services/pg/db";

let minimalIidxChartCounter = 0;

// `bcrypt.hash` at the test-mode rounds (BCRYPT_SALT_ROUNDS=4, see config.ts)
// is ~5 ms; in CI we have hundreds of `seedUser({ withCredential: true })`
// calls across the suite, almost all of them with the same handful of
// plaintexts (`"password123"` and friends). With `pool: "threads" +
// isolate: false` this cache survives across every file a worker processes,
// turning that into one hash per (plaintext, worker). The hash is a pure
// function of plaintext + rounds for our purposes (the salt varies, but
// tests only care that `PasswordCompare(plaintext, hash)` round-trips).
const hashedPasswordCache = new Map<string, Promise<string>>();
function cachedHashPassword(plaintext: string): Promise<string> {
	const cached = hashedPasswordCache.get(plaintext);
	if (cached !== undefined) {
		return cached;
	}
	const p = HashPassword(plaintext);
	hashedPasswordCache.set(plaintext, p);
	return p;
}

/**
 * Inserts a minimal `song` + `chart` row for `iidx` / `SP` (`game` = `iidx-sp`) so
 * goal/chart validation (`GetChartById`) succeeds in tests.
 */
export async function seedMinimalIidxSpChart() {
	const n = ++minimalIidxChartCounter;
	const songId = `S_MIN_IIDX_${n}_${Date.now()}`;
	const chartId = `C_MIN_IIDX_${n}_${Date.now()}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 90_000 + n,
			game_group: "iidx",
			title: "Minimal IIDX Test Chart",
			artist: "Tester",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `c_min_iidx_legacy_${n}`,
			game: "iidx-sp",
			song_id: songId,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["27"],
			data: { inGameID: 1000, notecount: 786 },
		})
		.execute();

	return chartId;
}

// ─── seedUser ─────────────────────────────────────────────────────────────────

interface SeedUserOpts {
	username?: string;
	email?: string;
	password?: string;
	authLevel?: "admin" | "user";
	/** Insert a priv_account_credential row. Defaults to false. */
	withCredential?: boolean;
	/** Insert an account_settings row. Defaults to false. */
	withSettings?: boolean;
}

/**
 * Insert an `account` row (and optionally `priv_account_credential` /
 * `account_settings`) and return the resulting data.
 *
 * - `withCredential: true` - also inserts `priv_account_credential`
 * - `withSettings: true`   - also inserts `account_settings`
 */
export async function seedUser(opts?: SeedUserOpts) {
	const username = opts?.username ?? "test_user";
	const email = opts?.email ?? "test@example.com";
	const password = opts?.password ?? "password123";
	const authLevel = opts?.authLevel ?? "user";

	const { id } = await DB.insertInto("account")
		.values({
			username,
			about: "Seed user for tests.",
			joined: new Date().toISOString(),
			last_seen: new Date().toISOString(),
			auth_level: authLevel,
			custom_pfp_location: null,
			custom_banner_location: null,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const userId = Number(id);

	if (opts?.withCredential) {
		const hashedPassword = await cachedHashPassword(password);

		await DB.insertInto("priv_account_credential")
			.values({ user_id: userId, email, password: hashedPassword })
			.execute();
	}

	if (opts?.withSettings) {
		await DB.insertInto("account_settings")
			.values({
				user_id: userId,
				pf_invisible: false,
				pf_developer_mode: false,
				pf_advanced_mode: false,
				pf_contentious_content: false,
				pf_deletable_scores: false,
			})
			.execute();
	}

	return { id: userId, username, email, password };
}

// ─── seedInvite ───────────────────────────────────────────────────────────────

/**
 * Insert a `priv_invite` row and return its code.
 */
export async function seedInvite(createdBy: number, code = "INVITE_CODE") {
	await DB.insertInto("priv_invite")
		.values({
			code,
			created_by: createdBy,
			created_at: new Date().toISOString(),
			consumed: false,
			consumed_by: null,
			consumed_at: null,
		})
		.execute();

	return code;
}

// ─── seedVerifyEmailToken ─────────────────────────────────────────────────────

/**
 * Insert a `priv_verify_email_token` row and return the token.
 */
export async function seedVerifyEmailToken(
	userId: number,
	email = "test@example.com",
	token = "VALID_TOKEN_ABCDEF1234",
) {
	await DB.insertInto("priv_verify_email_token")
		.values({ token, user_id: userId, email })
		.execute();

	return token;
}

// ─── seedResetToken ───────────────────────────────────────────────────────────

/**
 * Insert a `priv_password_reset_token` row and return the token.
 * Pass `ageHours > 0` to backdate the token (useful for expiry tests).
 */
export async function seedResetToken(userId: number, token = "VALID_RESET_TOKEN", ageHours = 0) {
	const createdOn =
		ageHours > 0
			? new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString()
			: new Date().toISOString();

	await DB.insertInto("priv_password_reset_token")
		.values({ token, user_id: userId, created_on: createdOn })
		.execute();

	return token;
}
