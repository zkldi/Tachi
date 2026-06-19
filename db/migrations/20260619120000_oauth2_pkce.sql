-- Add PKCE (RFC 7636) support to OAuth2 authorization codes.
-- code_challenge: BASE64URL(SHA256(code_verifier)), stored at code creation time.
-- code_challenge_method: only "S256" is supported; NULL means client_secret flow.
ALTER TABLE "priv_oauth2_auth_token"
    ADD COLUMN code_challenge TEXT,
    ADD COLUMN code_challenge_method TEXT;
